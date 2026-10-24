import Phaser from 'phaser';
import { computeLight, lightIntensity, lightsOf, type Light, type LightField, type LightSource, type Occluder, type Region } from '../lighting';
import { buildLayers } from '../lighting/shade';
import { TERRAIN_TILE, type LevelModule } from '../registry/schemas';
import { analyzeMasses, KIND_BY_ID } from '../terrain';
import { buildWaterAtlas, cellRect, depthStep, TILE } from '../terrain/waterTiles';
import { WALL, type Layout } from '../worldgen';
import { animKey, frameOf, textureKey } from './anims';
import { shadeBand, shadowBox } from './lightBands';

// Escenario del nivel que no es el suelo de losetas: el mapa generado (src/engine/worldgen), el agua
// (src/engine/terrain) y la luz (src/engine/lighting). Todo opcional en el nivel; sin nada de eso la arena se
// pinta exactamente como antes.

if (TILE !== TERRAIN_TILE) throw new Error(`las piezas de agua miden ${TILE} px y el mapa de terreno ${TERRAIN_TILE}`);

const WATER_DEPTH = 0.5;   // sobre el suelo (0) y debajo de los avisos (1) y los materiales (1.5)
const LIGHT_DEPTH = 40;    // sobre el mundo y debajo del texto flotante (50) y el HUD (100)
const FLICKER_HZ = 8;      // cada parche de luz que parpadea se recalcula a este ritmo, no en cada cuadro
const BANDS = 4;           // un repintado de parche se reparte en tantos cuadros
const FLICKER_MIN = 0.01;  // un parpadeo menor se hornea fijo. Lo que no llega a cambiar un nivel de la luz cuantizada ya lo
                           // deja fuera el recorte del parche (patchGeometry): no cuesta
const BASE_TILE = 64;      // lado de las baldosas de la luz horneada
let patches = 0;           // nombres únicos para las texturas de los parches, que se rehacen en cada oleada

// Las texturas que dependen del mapa llevan su semilla en el nombre: al cambiar de partida se borran las viejas
function freshKey(scene: Phaser.Scene, prefix: string, key: string): boolean {
  for (const old of scene.textures.getTextureKeys()) if (old.startsWith(prefix) && old !== key) scene.textures.remove(old);
  return !scene.textures.exists(key);
}

// Suelo, tapas de las paredes y fachada norte de un mapa generado, horneados en una textura por partida.
// Las columnas y los muebles tienen altura: van aparte, ordenados por los pies como los personajes.
export function drawMap(scene: Phaser.Scene, level: LevelModule, layout: Layout): void {
  const sheet = textureKey('level', level.id);
  const key = `map:${level.id}:${layout.seed}`;
  const { cols, rows } = layout;
  if (freshKey(scene, `map:${level.id}:`, key)) {
    const map = scene.textures.addDynamicTexture(key, cols * TILE, rows * TILE)!;
    map.beginDraw();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const wall = layout.wall[i];
      if (wall === WALL.none) map.batchDrawFrame(sheet, frameOf(level.sprites, layout.floor[i]!), x * TILE, y * TILE);
      else if (wall === WALL.cap) map.batchDrawFrame(sheet, frameOf(level.sprites, layout.caps[(x + y) % 2]!), x * TILE, y * TILE);
    }
    // La fachada mide 16x32 y empieza bajo la tapa norte
    for (let x = 1; x < cols - 1; x++) map.batchDrawFrame(sheet, frameOf(level.sprites, layout.facade[x]!), x * TILE, TILE);
    map.endDraw();
  }
  scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);

  const pillar = pillarTexture(scene, level);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (!layout.pillar[i] || layout.prop[i]) continue;
    const foot = (y + 1) * TILE;
    scene.add.image(x * TILE, foot, pillar).setOrigin(0, 1).setDepth(2 + foot / 10000);
  }
  for (const p of layout.props) {
    const foot = (p.y + p.h) * TILE;
    scene.add.image(p.x * TILE, foot, sheet, frameOf(level.sprites, p.anim)).setOrigin(0, 1).setDepth(2 + foot / 10000);
  }
}

// Columna de 16x24 dibujada con código, con los colores del nivel: cuerpo con luz a la izquierda, juntas y tapa
function pillarTexture(scene: Phaser.Scene, level: LevelModule): string {
  const key = `pillar:${level.id}`;
  if (scene.textures.exists(key)) return key;
  const c = level.generator!.pillar;
  const texture = scene.textures.createCanvas(key, 16, 24)!;
  const ctx = texture.context;
  const dot = (x: number, y: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); };
  for (let y = 4; y < 24; y++) for (let x = 2; x < 14; x++) {
    const joint = (y - 4) % 6 === 5 || y === 23;
    dot(x, y, joint ? c.joint : x <= 4 ? c.lit : x <= 9 ? c.mid : c.dark);
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const d = ((x - 7.5) / 7.5) ** 2 + ((y - 3.5) / 3.8) ** 2;
    if (d <= 1) dot(x, y, d > 0.72 ? c.mid : x < 8 ? c.top : c.topDim);
  }
  texture.refresh();
  return key;
}

// El agua (la del mapa generado o la del mapa fijo), horneada una vez por mapa
export function drawWater(scene: Phaser.Scene, level: LevelModule, layout: Layout | null): void {
  const rows = layout?.water ?? level.terrain?.water;
  if (!rows || !rows.some((r) => r.includes('~'))) return;
  const key = `water:${level.id}:${layout?.seed ?? 'fijo'}`;
  if (freshKey(scene, `water:${level.id}:`, key)) {
    const cols = level.arena.width / TILE;
    const lines = level.arena.height / TILE;
    // El borde de la arena es tierra: un charco pegado a la pared tiene orilla por ese lado
    const masses = layout?.masses ?? analyzeMasses(cols, lines, (x, y) => rows[y]?.[x] === '~', { edgeIsMember: false });
    const atlas = buildWaterAtlas();
    const out = new Uint8ClampedArray(level.arena.width * level.arena.height * 4);
    for (let cy = 0; cy < lines; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (masses.region[i]! < 0 || rows[cy]?.[cx] !== '~') continue;
        const kind = KIND_BY_ID[masses.kind[i]!]!;
        if (kind === 'none') continue;
        const r = cellRect(masses.variant[i]!, kind, depthStep(masses.depth[i]!));
        for (let y = 0; y < TILE; y++) {
          const from = ((r.y + y) * atlas.width + r.x) * 4;
          out.set(atlas.data.subarray(from, from + TILE * 4), ((cy * TILE + y) * level.arena.width + cx * TILE) * 4);
        }
      }
    }
    const texture = scene.textures.createCanvas(key, level.arena.width, level.arena.height)!;
    texture.context.putImageData(new ImageData(out, level.arena.width, level.arena.height), 0, 0);
    texture.refresh();
  }
  scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(WATER_DEPTH);
}

interface Patch {
  region: Region;
  phase: number;     // desfase en ticks (0..1): los parches no tocan todos en el mismo cuadro
  tick: number;      // último tick pintado
  // La geometría de la luz (distancias y sombras) no cambia: se calcula una vez. Cada tick solo se suma la base
  // (ambiente + luces fijas) y la luz de cada una que parpadea, escalada por su intensidad en ese instante.
  base: LightField;
  flickering: Array<{ light: Light; unit: Float32Array }>;
  multiply: Phaser.Textures.CanvasTexture;
  add: Phaser.Textures.CanvasTexture;
  pixels: Layers;    // lo que enseña ahora (la sombra del cuerpo se escribe encima)
  shown: number;     // tick de lo que enseña; -1, neutro
}

interface BaseTile {
  region: Region;
  multiply: Phaser.Textures.CanvasTexture;
  add: Phaser.Textures.CanvasTexture;
}

interface Layers {
  multiply: Uint8ClampedArray;
  add: Uint8ClampedArray;
}

// La luz va en coordenadas del mundo y las fuentes no se mueven: se hornea la arena entera UNA vez por mapa en
// dos capas (una multiplica, ambiente y sombra; la otra suma, lo que deslumbra). Las luces que parpadean de
// verdad se recalculan a FLICKER_HZ en parches: uno por grupo de luces que se tocan, solo si la cámara lo ve, y
// como mucho uno por cuadro (desfasados entre sí), para que el coste de un cuadro sea el de un parche.
// En la base, el sitio de cada parche queda neutro (blanco en la que multiplica, negro en la que suma). Así el
// coste no depende del scroll ni del tamaño de la pantalla.
export class LightLayer {
  private readonly images: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> = [];
  private readonly patches: Patch[] = [];
  private readonly lights: Light[];
  private readonly opaque: (tx: number, ty: number) => boolean;
  private job: { patch: Patch; total: Float32Array; row: number; multiply: Uint8ClampedArray; add: Uint8ClampedArray } | null = null;
  // La sombra del cuerpo: las capas de la arena en memoria, de quién es cada píxel (-1 la base, si no el índice
  // del parche) y el recuadro que se pintó con sombra la última vez (hay que devolverlo a su luz al irse)
  private readonly arena: Region;
  private readonly base: { tiles: BaseTile[]; pixels: Layers };
  private readonly owner: Int16Array;
  private readonly patchOf = new Map<Light, Patch>();
  private shadow: { box: Region | null; key: string } = { box: null, key: '' };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly light: NonNullable<LevelModule['light']>,
    level: LevelModule,
    layout: Layout | null,
  ) {
    const sources: LightSource[] = [...(layout?.sources ?? []), ...light.sources];
    this.lights = lightsOf(sources);
    // Tapan la luz las tapas de las paredes y las columnas. La fachada no: las antorchas y los neones nacen en
    // ella, y si tapara, su luz no bajaría nunca al suelo (se quedaba en un recuadro sobre la propia pieza).
    // Los muebles tampoco: son bajos, y su pantalla alumbra desde dentro.
    this.opaque = layout
      ? (tx, ty) => tx < 0 || ty < 0 || tx >= layout.cols || ty >= layout.rows
        || layout.wall[ty * layout.cols + tx] === WALL.cap
        || (layout.pillar[ty * layout.cols + tx] === 1 && layout.prop[ty * layout.cols + tx] === 0)
      : () => false;
    const arena: Region = { x: 0, y: 0, width: level.arena.width, height: level.arena.height };
    this.arena = arena;
    const geometry = flickerGroups(this.lights.filter(isFlickering), arena)
      .map((g) => this.patchGeometry(g))
      .filter((g): g is NonNullable<typeof g> => g !== null);

    // La base se hornea una vez por mapa y se guarda entre oleadas (la escena se rehace en cada una). Va en
    // baldosas de BASE_TILE: la sombra del cuerpo se escribe en memoria y se suben solo las baldosas que toca
    // (subir la arena entera costaba 3 ms por cuadro, 11 ms con la CPU a 6x).
    const base = `light:${level.id}:${layout?.seed ?? 'fijo'}`;
    for (const old of scene.textures.getTextureKeys()) if (old.startsWith(`light:${level.id}:`) && !old.startsWith(`${base}:`)) scene.textures.remove(old);
    if (baked?.key !== base) {
      const t0 = performance.now();
      const layers = buildLayers(computeLight(arena, this.lights, { color: light.ambient }, this.opaque, 0), arena, light.shade);
      for (const g of geometry) clearRect(layers, arena.width, g.region);
      baked = { key: base, pixels: layers };
      perfSample('light-bake', performance.now() - t0);
    }
    const pixels = baked.pixels;
    const tiles: BaseTile[] = [];
    for (let y = 0; y < arena.height; y += BASE_TILE) for (let x = 0; x < arena.width; x += BASE_TILE) {
      const region = { x, y, width: Math.min(BASE_TILE, arena.width - x), height: Math.min(BASE_TILE, arena.height - y) };
      const texture = (layer: 'multiply' | 'add') => {
        const key = `${base}:${layer}:${x},${y}`;
        if (scene.textures.exists(key)) return scene.textures.get(key) as Phaser.Textures.CanvasTexture;
        const t = scene.textures.createCanvas(key, region.width, region.height)!;
        upload(t, pixels[layer], arena.width, region, region);
        return t;
      };
      tiles.push({ region, multiply: texture('multiply'), add: texture('add') });
    }
    this.base = { tiles, pixels };
    this.owner = new Int16Array(arena.width * arena.height).fill(-1);
    // El objeto del que sale cada fuente fija, ordenado por su pie como los personajes (se dibuja bajo la luz).
    // Las del mapa generado ya van dibujadas en su pieza de fachada o en su mueble.
    for (const s of light.sources) {
      if (!s.sprite) continue;
      this.images.push(scene.add.sprite(s.x, s.y, textureKey('level', level.id)).setOrigin(0.5, 1)
        .setDepth(2 + s.y / 10000).play(animKey('level', level.id, s.sprite)));
    }
    perfSample('patch-count', geometry.length);
    perfSample('patch-px', geometry.reduce((n, g) => n + g.region.width * g.region.height, 0));
    // Primero todas las que multiplican y luego todas las que suman: así se agrupan en pocas llamadas a la GPU
    for (const t of tiles) this.images.push(this.image(t.multiply.key, t.region.x, t.region.y, Phaser.BlendModes.MULTIPLY));
    for (const t of tiles) this.images.push(this.image(t.add.key, t.region.x, t.region.y, Phaser.BlendModes.ADD));

    geometry.forEach(({ region, base: field, flickering }, i) => {
      // Neutro hasta el primer update en que la cámara lo vea
      const n = patches++;
      const pixels = { multiply: new Uint8ClampedArray(region.width * region.height * 4).fill(255), add: new Uint8ClampedArray(region.width * region.height * 4) };
      const multiply = canvasTexture(scene, `patch-multiply:${n}`, pixels.multiply, region.width, region.height);
      const add = canvasTexture(scene, `patch-add:${n}`, pixels.add, region.width, region.height);
      this.images.push(this.image(multiply.key, region.x, region.y, Phaser.BlendModes.MULTIPLY));
      this.images.push(this.image(add.key, region.x, region.y, Phaser.BlendModes.ADD));
      const patch: Patch = { region, multiply, add, pixels, shown: -1, phase: i / geometry.length, tick: -1, base: field, flickering };
      this.patches.push(patch);
      for (const { light: l } of flickering) this.patchOf.set(l, patch);
      for (let y = region.y; y < region.y + region.height; y++) this.owner.fill(i, y * arena.width + region.x, y * arena.width + region.x + region.width);
    });
  }

  // La geometría de un parche: base (ambiente + luces fijas) y la luz de cada una que parpadea con intensidad 1.
  // El recuadro se recorta a los píxeles que el parpadeo llega a cambiar: con todas al mínimo y todas al máximo
  // de su parpadeo, donde las capas salen iguales no cambia nada nunca y lo pinta la base. Sin nada, sin parche.
  private patchGeometry(group: Region): Pick<Patch, 'region' | 'base' | 'flickering'> | null {
    const fields = (region: Region) => {
      const inside = (l: Light) => l.x + l.radius > region.x && l.x - l.radius < region.x + region.width
        && l.y + l.radius > region.y && l.y - l.radius < region.y + region.height;
      const near = this.lights.filter(inside);
      return {
        region,
        base: computeLight(region, near.filter((l) => !isFlickering(l)), { color: this.light.ambient }, this.opaque, 0),
        flickering: near.filter(isFlickering).map((l) => ({
          light: l,
          unit: computeLight(region, [{ ...l, intensity: 1, flicker: undefined }], { color: [0, 0, 0] }, this.opaque, 0).total,
        })),
      };
    };
    const whole = fields(group);
    const at = (k: (l: Light) => number) => {
      const total = Float32Array.from(whole.base.total);
      for (const { light, unit } of whole.flickering) for (let i = 0; i < total.length; i++) total[i] = total[i]! + unit[i]! * k(light);
      return buildLayers({ ...whole.base, total }, group, this.light.shade);
    };
    const lo = at((l) => l.intensity * (1 - l.flicker!.amount));
    const hi = at((l) => l.intensity * (1 + l.flicker!.amount));
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (let y = 0; y < group.height; y++) for (let x = 0; x < group.width; x++) {
      const o = (y * group.width + x) * 4;
      if (lo.multiply[o] === hi.multiply[o] && lo.multiply[o + 1] === hi.multiply[o + 1] && lo.multiply[o + 2] === hi.multiply[o + 2]
        && lo.add[o] === hi.add[o] && lo.add[o + 1] === hi.add[o + 1] && lo.add[o + 2] === hi.add[o + 2]) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    if (x1 < 0) return null;
    const arena: Region = { x: group.x, y: group.y, width: group.width, height: group.height };
    return fields(boxOf(group.x + x0, group.y + y0, group.x + x1 + 1, group.y + y1 + 1, arena));
  }

  // time en segundos; view, lo que enseña la cámara (en el mundo). Repinta el parche visible que más tiempo lleva
  // sin pintarse, si ya le toca. Un repintado se reparte en BANDS cuadros (una banda horizontal por cuadro), así el
  // coste de un cuadro es una fracción de un parche; los demás parches esperan a que acabe.
  update(time: number, view: Region): void {
    if (!this.job) {
      let next: Patch | null = null;
      let due = 0;
      for (const p of this.patches) {
        const { region } = p;
        if (region.x >= view.x + view.width || region.y >= view.y + view.height
          || region.x + region.width <= view.x || region.y + region.height <= view.y) continue;
        const tick = Math.floor(time * FLICKER_HZ + p.phase);
        if (tick !== p.tick && (!next || tick - p.tick > due)) { next = p; due = tick - p.tick; }
      }
      if (!next) return;
      next.tick = Math.floor(time * FLICKER_HZ + next.phase);
      const total = Float32Array.from(next.base.total);
      for (const { light, unit } of next.flickering) {
        const k = lightIntensity(light, next.tick / FLICKER_HZ);
        for (let i = 0; i < total.length; i++) total[i] = total[i]! + unit[i]! * k;
      }
      const { width, height } = next.region;
      this.job = { patch: next, total, row: 0, multiply: new Uint8ClampedArray(width * height * 4), add: new Uint8ClampedArray(width * height * 4) };
    }
    const t0 = performance.now();
    const { patch, total, multiply, add } = this.job;
    const { region, base } = patch;
    const rows = Math.ceil(region.height / BANDS / 4) * 4;
    const y0 = this.job.row;
    const y1 = Math.min(region.height, y0 + rows);
    const band = shadeBand({ ...base, total }, region, y0, y1, this.light.shade);
    multiply.set(band.multiply, y0 * region.width * 4);
    add.set(band.add, y0 * region.width * 4);
    this.job.row = y1;
    if (y1 >= region.height) {
      paint(patch.multiply, multiply, region.width, region.height);
      paint(patch.add, add, region.width, region.height);
      patch.pixels = { multiply, add };
      patch.shown = patch.tick;
      this.job = null;
    }
    perfSample('light', performance.now() - t0);
  }

  // La sombra de un cuerpo que se mueve (el personaje). Cada cuadro se recalcula solo el recuadro donde puede
  // caer, con el recuadro de la vez anterior para borrar la vieja, y se escribe en la capa dueña de cada píxel
  // (la base o un parche: si se pintara aparte, multiplicaría dos veces). Las luces que parpadean van con la
  // intensidad que enseña su parche, para que no se vea la costura del recuadro.
  updateShadow(body: Occluder | null): void {
    const t0 = performance.now();
    const raw = body ? shadowBox(this.lights, body) : null;
    const box = raw ? boxOf(raw.x, raw.y, raw.x + raw.width, raw.y + raw.height, this.arena) : null;
    const old = this.shadow.box;
    // Se rehace si el cuerpo se mueve o si se repinta un parche que pisa su sombra (el parche nuevo no la lleva)
    const near = this.patches.filter((p) => (box && overlaps(p.region, box)) || (old && overlaps(p.region, old)));
    const key = body && box ? `${body.x},${body.y},${body.rx},${body.ry}|${near.map((p) => p.shown).join(',')}` : '';
    if (key === this.shadow.key) return;
    const boxes = !old ? (box ? [box] : []) : !box ? [old] : overlaps(old, box) ? [union(old, box, this.arena)] : [old, box];
    this.shadow = { box, key };
    const touched = new Set<Patch>();
    for (const r of boxes) {
      const lights = this.lights
        .filter((l) => l.x + l.radius > r.x && l.x - l.radius < r.x + r.width && l.y + l.radius > r.y && l.y - l.radius < r.y + r.height)
        .map((l) => {
          const p = this.patchOf.get(l);
          return { ...l, intensity: lightIntensity(l, p && p.shown >= 0 ? p.shown / FLICKER_HZ : 0), flicker: undefined };
        });
      const field = computeLight(r, lights, { color: this.light.ambient }, this.opaque, 0, { occluders: body ? [body] : [] });
      const layers = buildLayers(field, r, this.light.shade);
      this.write(layers, r, touched);
    }
    for (const r of boxes) for (const t of this.base.tiles) {
      if (!overlaps(r, t.region)) continue;
      upload(t.multiply, this.base.pixels.multiply, this.arena.width, t.region, r);
      upload(t.add, this.base.pixels.add, this.arena.width, t.region, r);
    }
    for (const p of touched) {
      paint(p.multiply, p.pixels.multiply, p.region.width, p.region.height);
      paint(p.add, p.pixels.add, p.region.width, p.region.height);
    }
    perfSample('shadow', performance.now() - t0);
  }

  // Copia un recuadro sombreado en la capa dueña de cada píxel. Un parche que aún no se ha pintado (neutro)
  // se deja como está: lo pintará su primer tick.
  private write(layers: Layers, r: Region, touched: Set<Patch>): void {
    const w = this.arena.width;
    for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) {
      const ax = r.x + x, ay = r.y + y;
      const owner = this.owner[ay * w + ax]!;
      const from = (y * r.width + x) * 4;
      let to: Layers, o: number;
      if (owner < 0) { to = this.base.pixels; o = (ay * w + ax) * 4; } else {
        const p = this.patches[owner]!;
        if (p.shown < 0) continue;
        touched.add(p);
        to = p.pixels; o = ((ay - p.region.y) * p.region.width + ax - p.region.x) * 4;
      }
      for (let k = 0; k < 4; k++) { to.multiply[o + k] = layers.multiply[from + k]!; to.add[o + k] = layers.add[from + k]!; }
    }
  }

  destroy(): void {
    this.updateShadow(null);   // la base guardada para la próxima oleada vuelve sin sombra
    for (const image of this.images) image.destroy();
    for (const p of this.patches) {
      p.multiply.destroy();
      p.add.destroy();
    }
  }

  private image(key: string, x: number, y: number, blend: Phaser.BlendModes): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, key).setOrigin(0, 0).setDepth(LIGHT_DEPTH).setBlendMode(blend);
  }
}

const isFlickering = (l: Light) => (l.flicker?.amount ?? 0) >= FLICKER_MIN;

// Recuadros que cubren a las luces que parpadean: uno por grupo de luces cuyos recuadros se tocan, para que
// dos parches nunca se pisen (multiplicarían dos veces). Con esquinas múltiplos de 4: así la trama (4×4) y
// las celdas del mapa de luz caen igual en el parche que en la base y no se ve la costura.
function flickerGroups(lights: readonly Light[], arena: Region): Region[] {
  let boxes = lights.map((l) => boxOf(l.x - l.radius, l.y - l.radius, l.x + l.radius, l.y + l.radius, arena));
  for (let merged = true; merged;) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length && !merged; j++) {
      const a = boxes[i]!, b = boxes[j]!;
      if (a.x >= b.x + b.width || b.x >= a.x + a.width || a.y >= b.y + b.height || b.y >= a.y + a.height) continue;
      boxes[i] = boxOf(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x + a.width, b.x + b.width), Math.max(a.y + a.height, b.y + b.height), arena);
      boxes = boxes.filter((_, k) => k !== j);
      merged = true;
    }
  }
  return boxes;
}

function overlaps(a: Region, b: Region): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function union(a: Region, b: Region, arena: Region): Region {
  return boxOf(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x + a.width, b.x + b.width), Math.max(a.y + a.height, b.y + b.height), arena);
}

function boxOf(x0: number, y0: number, x1: number, y1: number, arena: Region): Region {
  const ax = Math.max(arena.x, Math.floor(x0 / 4) * 4);
  const ay = Math.max(arena.y, Math.floor(y0 / 4) * 4);
  const bx = Math.min(arena.x + arena.width, Math.ceil(x1 / 4) * 4);
  const by = Math.min(arena.y + arena.height, Math.ceil(y1 / 4) * 4);
  return { x: ax, y: ay, width: bx - ax, height: by - ay };
}

// Deja neutro un recuadro de las capas: blanco en la que multiplica y negro en la que suma
function clearRect(layers: { multiply: Uint8ClampedArray; add: Uint8ClampedArray }, width: number, r: Region): void {
  for (let y = r.y; y < r.y + r.height; y++) {
    const o = (y * width + r.x) * 4;
    layers.multiply.fill(255, o, o + r.width * 4);
    for (let i = o; i < o + r.width * 4; i += 4) layers.add[i] = layers.add[i + 1] = layers.add[i + 2] = 0;
  }
}

// La luz horneada del último mapa, en memoria (la que se ve, con la sombra del cuerpo puesta: destroy la quita)
let baked: { key: string; pixels: Layers } | null = null;

// Sube a la baldosa `tile` la parte `dirty` de una capa del tamaño de la arena (de ancho `width`)
function upload(texture: Phaser.Textures.CanvasTexture, data: Uint8ClampedArray, width: number, tile: Region, dirty: Region): void {
  const x0 = Math.max(tile.x, dirty.x), y0 = Math.max(tile.y, dirty.y);
  const x1 = Math.min(tile.x + tile.width, dirty.x + dirty.width), y1 = Math.min(tile.y + tile.height, dirty.y + dirty.height);
  if (x1 <= x0 || y1 <= y0) return;
  const image = new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, data.length / 4 / width);
  texture.context.putImageData(image, -tile.x, -tile.y, x0, y0, x1 - x0, y1 - y0);
  texture.refresh();
}

function canvasTexture(scene: Phaser.Scene, key: string, data: Uint8ClampedArray, width: number, height: number): Phaser.Textures.CanvasTexture {
  const texture = scene.textures.createCanvas(key, width, height)!;
  paint(texture, data, width, height);
  return texture;
}

function paint(texture: Phaser.Textures.CanvasTexture, data: Uint8ClampedArray, width: number, height: number): void {
  texture.context.putImageData(new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  texture.refresh();
}

// ?perf guarda lo que tarda cada recálculo en window.__perf, para medirlo desde fuera (el Flip incluido)
const PERF = new URLSearchParams(location.search).has('perf');
function perfSample(name: string, ms: number): void {
  if (!PERF) return;
  const w = window as unknown as { __perf?: Record<string, number[]> };
  ((w.__perf ??= {})[name] ??= []).push(ms);
}
