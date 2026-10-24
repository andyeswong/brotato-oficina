import Phaser from 'phaser';
import { computeLight, lightsOf, type Light, type LightSource, type Region } from '../lighting';
import { buildLayers } from '../lighting/shade';
import { TERRAIN_TILE, type LevelModule } from '../registry/schemas';
import { analyzeMasses, KIND_BY_ID } from '../terrain';
import { buildWaterAtlas, cellRect, depthStep, TILE } from '../terrain/waterTiles';
import { WALL, type Layout } from '../worldgen';
import { animKey, frameOf, textureKey } from './anims';

// Escenario del nivel que no es el suelo de losetas: el mapa generado (src/engine/worldgen), el agua
// (src/engine/terrain) y la luz (src/engine/lighting). Todo opcional en el nivel; sin nada de eso la arena se
// pinta exactamente como antes.

if (TILE !== TERRAIN_TILE) throw new Error(`las piezas de agua miden ${TILE} px y el mapa de terreno ${TERRAIN_TILE}`);

const WATER_DEPTH = 0.5;   // sobre el suelo (0) y debajo de los avisos (1) y los materiales (1.5)
const LIGHT_DEPTH = 40;    // sobre el mundo y debajo del texto flotante (50) y el HUD (100)
const FLICKER_HZ = 12;     // la luz que parpadea se recalcula a este ritmo, no en cada cuadro
const FLICKER_MIN = 0.1;   // un parpadeo menor no se ve con la luz cuantizada: esa luz se hornea fija
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
  multiply: Phaser.Textures.CanvasTexture;
  add: Phaser.Textures.CanvasTexture;
}

// La luz va en coordenadas del mundo y las fuentes no se mueven: se hornea la arena entera UNA vez por mapa en
// dos capas (una multiplica, ambiente y sombra; la otra suma, lo que deslumbra). Las luces que parpadean de
// verdad se recalculan a FLICKER_HZ en parches: uno por grupo de luces que se tocan, y solo si la cámara lo ve.
// En la base, el sitio de cada parche queda neutro (blanco en la que multiplica, negro en la que suma). Así el
// coste no depende del scroll ni del tamaño de la pantalla.
export class LightLayer {
  private readonly images: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> = [];
  private readonly patches: Patch[] = [];
  private readonly lights: Light[];
  private readonly opaque: (tx: number, ty: number) => boolean;
  private lastTick = -1;

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
    const groups = flickerGroups(this.lights.filter((l) => (l.flicker?.amount ?? 0) >= FLICKER_MIN), arena);

    const base = `light:${level.id}:${layout?.seed ?? 'fijo'}`;
    if (freshKey(scene, `light:${level.id}:`, `${base}:multiply`)) {
      scene.textures.remove(`${base}:add`);
      const t0 = performance.now();
      const layers = buildLayers(computeLight(arena, this.lights, { color: light.ambient }, this.opaque, 0), arena, light.shade);
      for (const g of groups) clearRect(layers, arena.width, g);
      canvasTexture(scene, `${base}:multiply`, layers.multiply, arena.width, arena.height);
      canvasTexture(scene, `${base}:add`, layers.add, arena.width, arena.height);
      perfSample('light-bake', performance.now() - t0);
    }
    // El objeto del que sale cada fuente fija, ordenado por su pie como los personajes (se dibuja bajo la luz).
    // Las del mapa generado ya van dibujadas en su pieza de fachada o en su mueble.
    for (const s of light.sources) {
      if (!s.sprite) continue;
      this.images.push(scene.add.sprite(s.x, s.y, textureKey('level', level.id)).setOrigin(0.5, 1)
        .setDepth(2 + s.y / 10000).play(animKey('level', level.id, s.sprite)));
    }
    this.images.push(this.image(`${base}:multiply`, 0, 0, Phaser.BlendModes.MULTIPLY));
    this.images.push(this.image(`${base}:add`, 0, 0, Phaser.BlendModes.ADD));

    for (const region of groups) {
      // Neutro hasta el primer update en que la cámara lo vea
      const n = patches++;
      const multiply = canvasTexture(scene, `patch-multiply:${n}`, new Uint8ClampedArray(region.width * region.height * 4).fill(255), region.width, region.height);
      const add = canvasTexture(scene, `patch-add:${n}`, new Uint8ClampedArray(region.width * region.height * 4), region.width, region.height);
      this.images.push(this.image(multiply.key, region.x, region.y, Phaser.BlendModes.MULTIPLY));
      this.images.push(this.image(add.key, region.x, region.y, Phaser.BlendModes.ADD));
      this.patches.push({ region, multiply, add });
    }
  }

  // time en segundos; view, lo que enseña la cámara (en el mundo)
  update(time: number, view: Region): void {
    if (this.patches.length === 0) return;
    const tick = Math.floor(time * FLICKER_HZ);
    if (tick === this.lastTick) return;
    this.lastTick = tick;
    const t0 = performance.now();
    let painted = 0;
    for (const { region, multiply, add } of this.patches) {
      if (region.x >= view.x + view.width || region.y >= view.y + view.height
        || region.x + region.width <= view.x || region.y + region.height <= view.y) continue;
      const field = computeLight(region, this.lights, { color: this.light.ambient }, this.opaque, tick / FLICKER_HZ);
      const layers = buildLayers(field, region, this.light.shade);
      paint(multiply, layers.multiply, region.width, region.height);
      paint(add, layers.add, region.width, region.height);
      painted++;
    }
    if (painted > 0) perfSample('light', performance.now() - t0);
  }

  destroy(): void {
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
