import Phaser from 'phaser';
import { computeLight, type Light, type Region } from '../lighting';
import { buildLayers } from '../lighting/shade';
import { TERRAIN_TILE, type LevelModule } from '../registry/schemas';
import { animKey, textureKey } from './anims';
import { analyzeMasses } from '../terrain';
import { buildWaterAtlas, cellRect, depthStep, TILE } from '../terrain/waterTiles';

// Escenario del nivel que no es suelo: el agua (src/engine/terrain) y la luz (src/engine/lighting).
// Las dos son opcionales en el nivel; sin ellas la arena se pinta exactamente como antes.

if (TILE !== TERRAIN_TILE) throw new Error(`las piezas de agua miden ${TILE} px y el mapa de terreno ${TERRAIN_TILE}`);

const WATER_DEPTH = 0.5;   // sobre el suelo (0) y debajo de los avisos (1) y los materiales (1.5)
const LIGHT_DEPTH = 40;    // sobre el mundo y debajo del texto flotante (50) y el HUD (100)
const FLICKER_HZ = 12;     // la luz que parpadea se recalcula a este ritmo, no en cada cuadro
let patches = 0;           // nombres únicos para las texturas del parche, que se rehacen en cada oleada

// El agua se hornea UNA vez por nivel en una textura con nombre, como el suelo
export function drawWater(scene: Phaser.Scene, level: LevelModule): void {
  const rows = level.terrain?.water;
  if (!rows) return;
  const key = `water:${level.id}`;
  if (!scene.textures.exists(key)) {
    const cols = level.arena.width / TILE;
    const lines = level.arena.height / TILE;
    // El borde de la arena es tierra: un charco pegado a la pared tiene orilla por ese lado
    const masses = analyzeMasses(cols, lines, (x, y) => rows[y]?.[x] === '~', { edgeIsMember: false });
    const atlas = buildWaterAtlas();
    const out = new Uint8ClampedArray(level.arena.width * level.arena.height * 4);
    for (let cy = 0; cy < lines; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const i = cy * cols + cx;
        if (masses.region[i]! < 0) continue;
        const kind = (['none', 'puddle', 'lake', 'ocean'] as const)[masses.kind[i]!]!;
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

// La luz va en coordenadas del mundo y las luces no se mueven: se hornea la arena entera UNA vez por nivel
// en dos capas (una multiplica, ambiente y sombra; la otra suma, lo que deslumbra). Solo el recuadro de las
// luces que parpadean se recalcula, a FLICKER_HZ: en la base ese recuadro queda neutro (blanco en la que
// multiplica, negro en la que suma) y lo pinta un parche aparte encima. Así el coste no depende del scroll
// ni del tamaño de la pantalla.
export class LightLayer {
  private readonly images: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> = [];
  private readonly patch: { region: Region; multiply: Phaser.Textures.CanvasTexture; add: Phaser.Textures.CanvasTexture } | null = null;
  private lastTick = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly light: NonNullable<LevelModule['light']>,
    level: LevelModule,
  ) {
    const lights = light.lights as readonly Light[];
    const arena: Region = { x: 0, y: 0, width: level.arena.width, height: level.arena.height };
    const flickering = lights.filter((l) => l.flicker && l.flicker.amount > 0);
    const patchRegion = flickering.length ? boundsOf(flickering, arena) : null;

    const base = `light:${level.id}`;
    if (!scene.textures.exists(`${base}:multiply`)) {
      const t0 = performance.now();
      const layers = buildLayers(computeLight(arena, lights, { color: light.ambient }, () => false, 0), arena, light.shade);
      if (patchRegion) clearRect(layers, arena.width, patchRegion);
      canvasTexture(scene, `${base}:multiply`, layers.multiply, arena.width, arena.height);
      canvasTexture(scene, `${base}:add`, layers.add, arena.width, arena.height);
      perfSample('light-bake', performance.now() - t0);
    }
    // El objeto del que sale cada luz, ordenado por su pie como los personajes (se dibuja bajo la luz)
    for (const l of light.lights) {
      if (!l.sprite) continue;
      this.images.push(scene.add.sprite(l.x, l.y, textureKey('level', level.id)).setOrigin(0.5, 1)
        .setDepth(2 + l.y / 10000).play(animKey('level', level.id, l.sprite)));
    }
    this.images.push(this.image(`${base}:multiply`, 0, 0, Phaser.BlendModes.MULTIPLY));
    this.images.push(this.image(`${base}:add`, 0, 0, Phaser.BlendModes.ADD));

    if (patchRegion) {
      // Se pinta en el primer update
      const { x, y, width, height } = patchRegion;
      const blank = new Uint8ClampedArray(width * height * 4);
      const multiply = canvasTexture(scene, `${base}:patch-multiply:${patches}`, blank, width, height);
      const add = canvasTexture(scene, `${base}:patch-add:${patches++}`, blank, width, height);
      this.images.push(this.image(multiply.key, x, y, Phaser.BlendModes.MULTIPLY));
      this.images.push(this.image(add.key, x, y, Phaser.BlendModes.ADD));
      this.patch = { region: patchRegion, multiply, add };
    }
  }

  // time en segundos
  update(time: number): void {
    if (!this.patch) return;
    const tick = Math.floor(time * FLICKER_HZ);
    if (tick === this.lastTick) return;
    this.lastTick = tick;
    const t0 = performance.now();
    const { region, multiply, add } = this.patch;
    const layers = buildLayers(computeLight(region, this.light.lights as readonly Light[], { color: this.light.ambient }, () => false, tick / FLICKER_HZ), region, this.light.shade);
    paint(multiply, layers.multiply, region.width, region.height);
    paint(add, layers.add, region.width, region.height);
    perfSample('light', performance.now() - t0);
  }

  destroy(): void {
    for (const image of this.images) image.destroy();
    this.patch?.multiply.destroy();
    this.patch?.add.destroy();
  }

  private image(key: string, x: number, y: number, blend: Phaser.BlendModes): Phaser.GameObjects.Image {
    return this.scene.add.image(x, y, key).setOrigin(0, 0).setDepth(LIGHT_DEPTH).setBlendMode(blend);
  }
}

// Recuadro que cubre a las luces dadas, recortado a la arena. Con esquinas múltiplos de 4: así la trama
// (4×4) y las celdas del mapa de luz caen igual en el parche que en la base y no se ve la costura.
function boundsOf(lights: readonly Light[], arena: Region): Region {
  const x0 = Math.max(arena.x, Math.floor(Math.min(...lights.map((l) => l.x - l.radius)) / 4) * 4);
  const y0 = Math.max(arena.y, Math.floor(Math.min(...lights.map((l) => l.y - l.radius)) / 4) * 4);
  const x1 = Math.min(arena.x + arena.width, Math.ceil(Math.max(...lights.map((l) => l.x + l.radius)) / 4) * 4);
  const y1 = Math.min(arena.y + arena.height, Math.ceil(Math.max(...lights.map((l) => l.y + l.radius)) / 4) * 4);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
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
