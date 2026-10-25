// EL MUNDO: la única fuente de verdad del juego. Lo leen igual los dos renderizadores (el 2D horneado del juego y
// el vóxel 3D) y la lógica (colisión, agua bajo los pies). Contiene:
//   - vóxeles estáticos en trozos de CHUNK x CHUNK (editables; cada trozo lleva su versión para volver a hornearlo);
//   - el agua: un fluido sobre la misma rejilla (WaterLayer: altura por columna en lagos y charcos);
//   - entidades: un modelo de vóxeles con posición y giro (MAIA, después los demás);
//   - fuentes de luz y gotas.
// Ejes del modelo: x hacia el este, y hacia el norte, z hacia arriba. Las posiciones del juego (px, py con y hacia
// abajo) se pasan con toModelY.
import type { Palette, VoxelSource } from '../core';
import { decode, key, unkey } from '../core';
import type { WorldLight } from './build';
import type { WaterLayer } from './water';
import { Drops } from './particles';

export const CHUNK = 32;

// Vóxeles estáticos en trozos: una matriz tipada por trozo con la columna entera de zMin a zMax
export class StaticVoxels implements VoxelSource {
  readonly cols: number;
  readonly rows: number;
  readonly zh: number;
  private chunks: Array<Uint16Array | null>;
  readonly versions: Uint32Array;

  constructor(public palette: Palette, readonly width: number, readonly depth: number, readonly zMin: number, readonly zMax: number) {
    this.cols = Math.ceil(width / CHUNK);
    this.rows = Math.ceil(depth / CHUNK);
    this.zh = zMax - zMin + 1;
    this.chunks = new Array(this.cols * this.rows).fill(null);
    this.versions = new Uint32Array(this.cols * this.rows);
  }

  private where(x: number, y: number, z: number): [Uint16Array | null, number, number] {
    if (x < 0 || y < 0 || x >= this.width || y >= this.depth || z < this.zMin || z > this.zMax) return [null, -1, -1];
    const c = Math.floor(y / CHUNK) * this.cols + Math.floor(x / CHUNK);
    return [this.chunks[c]!, c, ((z - this.zMin) * CHUNK + (y % CHUNK)) * CHUNK + (x % CHUNK)];
  }

  get(x: number, y: number, z: number): number {
    const [data, , i] = this.where(x, y, z);
    return data ? data[i]! : 0;
  }

  set(x: number, y: number, z: number, value: number): void {
    let [data, c, i] = this.where(x, y, z);
    if (c < 0) throw new Error(`vóxel fuera del mundo: ${x},${y},${z}`);
    if (!data) { if (!value) return; data = this.chunks[c] = new Uint16Array(CHUNK * CHUNK * this.zh); }
    if (data[i] === value) return;
    data[i] = value;
    this.versions[c] = this.versions[c]! + 1;
  }

  // Vóxeles llenos de una región (en orden fijo: trozo, z, y, x)
  *entries(region?: { x0: number; y0: number; x1: number; y1: number }): Generator<[number, number, number, number]> {
    const r = region ?? { x0: 0, y0: 0, x1: this.width - 1, y1: this.depth - 1 };
    for (let cy = Math.max(0, Math.floor(r.y0 / CHUNK)); cy <= Math.min(this.rows - 1, Math.floor(r.y1 / CHUNK)); cy++)
      for (let cx = Math.max(0, Math.floor(r.x0 / CHUNK)); cx <= Math.min(this.cols - 1, Math.floor(r.x1 / CHUNK)); cx++) {
        const data = this.chunks[cy * this.cols + cx];
        if (!data) continue;
        for (let i = 0; i < data.length; i++) {
          const v = data[i]!;
          if (!v) continue;
          const lx = i % CHUNK, ly = Math.floor(i / CHUNK) % CHUNK, lz = Math.floor(i / (CHUNK * CHUNK));
          const x = cx * CHUNK + lx, y = cy * CHUNK + ly;
          if (x < r.x0 || x > r.x1 || y < r.y0 || y > r.y1) continue;
          yield [x, y, lz + this.zMin, v];
        }
      }
  }

  get size(): number {
    let n = 0;
    for (const d of this.chunks) if (d) for (let i = 0; i < d.length; i++) if (d[i]) n++;
    return n;
  }
}

export interface Entity {
  id: string;
  model: VoxelSource;        // su modelo, en sus propios ejes (los pies en el origen)
  x: number;                 // posición de los pies en el mundo (vóxeles del modelo)
  y: number;
  z: number;
  yaw: number;               // grados; 0 = mira al sur (a la cámara)
  rampOffset: number;        // dónde empiezan sus rampas en la paleta del mundo
}

export interface ViewRegion { x0: number; y0: number; x1: number; y1: number }

export class WorldState {
  palette: Palette;
  readonly entities: Entity[] = [];
  readonly drops = new Drops();

  constructor(readonly solid: StaticVoxels, readonly lights: WorldLight[], public water: WaterLayer | null) {
    this.palette = solid.palette;
  }

  get width(): number { return this.solid.width; }
  get depth(): number { return this.solid.depth; }
  toModelY(py: number): number { return this.depth - 1 - py; }

  // Añade una entidad: sus rampas se suman a la paleta del mundo (una vez por modelo)
  addEntity(id: string, model: VoxelSource, x: number, y: number, z = 0, yaw = 0): Entity {
    const same = this.entities.find((e) => e.model === model);
    let rampOffset: number;
    if (same) rampOffset = same.rampOffset;
    else {
      rampOffset = this.palette.ramps.length;
      this.palette = { ...this.palette, ramps: [...this.palette.ramps, ...model.palette.ramps] };
      this.solid.palette = this.palette;
    }
    const e: Entity = { id, model, x, y, z, yaw, rampOffset };
    this.entities.push(e);
    return e;
  }

  entity(id: string): Entity | undefined { return this.entities.find((e) => e.id === id); }

  // Material de una entidad en la paleta del mundo
  static remap(e: Entity, v: number): number {
    const { ramp, tone } = decode(v);
    return (e.rampOffset + ramp) * 16 + tone + 1;
  }

  // ---- lo que ve un renderizador: lo estático, las entidades y el agua, compuestos al vuelo y sin copias
  view(region: ViewRegion, opts: { entities?: boolean; water?: boolean } = {}): VoxelSource {
    const withEntities = opts.entities ?? true, withWater = opts.water ?? true;
    const ent = new Map<number, number>();
    const entList: Array<[number, number, number, number]> = [];
    if (withEntities) for (const e of this.entities) {
      // En vóxeles, el giro va a la vuelta de 90° más cercana (el 2D gira libre)
      const turns = ((Math.round(e.yaw / 90) % 4) + 4) % 4;
      const c = [1, 0, -1, 0][turns]!, s = [0, 1, 0, -1][turns]!;
      const ox = Math.round(e.x), oy = Math.round(e.y), oz = Math.round(e.z);
      for (const [x, y, z, v] of e.model.entries()) {
        const wx = ox + x * c - y * s, wy = oy + x * s + y * c, wz = oz + z;
        const vv = WorldState.remap(e, v);
        ent.set(key(wx, wy, wz), vv);
        entList.push([wx, wy, wz, vv]);
      }
    }
    const water = withWater ? this.waterColumns(region) : null;
    const solid = this.solid;
    const self = this;
    return {
      get palette() { return self.palette; },
      get(x: number, y: number, z: number): number {
        const s = solid.get(x, y, z);
        if (s) return s;
        if (!ent.size && !water) return 0;
        const k = key(x, y, z);
        return ent.get(k) ?? water?.get(k) ?? 0;
      },
      *entries() {
        for (const v of solid.entries(region)) yield v;
        for (const v of entList) if (!solid.get(v[0], v[1], v[2])) yield v;
        if (water) for (const [k, v] of water) {
          const [x, y, z] = unkey(k);
          if (!solid.get(x, y, z) && !ent.has(k)) yield [x, y, z, v];
        }
      },
    };
  }

  // El agua de una región como vóxeles: cada columna desde el fondo hasta la superficie de ahora
  waterColumns(region: ViewRegion): Map<number, number> {
    const out = new Map<number, number>();
    const w = this.water;
    if (!w) return out;
    const waterRamp = this.palette.ramps.findIndex((r) => r.name === 'agua');
    if (waterRamp < 0) return out;
    const sim = w.sim, D = this.depth;
    const gx0 = Math.max(0, Math.floor(region.x0 / 2) - 1), gx1 = Math.min(w.gw - 1, Math.ceil(region.x1 / 2) + 1);
    const gy0 = Math.max(0, Math.floor((D - 1 - region.y1) / 2) - 1), gy1 = Math.min(w.gh - 1, Math.ceil((D - 1 - region.y0) / 2) + 1);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const i = gy * w.gw + gx;
      const d = sim.depth[i]!;
      if (d < 0.05 || sim.solid[i]) continue;
      const x0 = gx * 2, y0 = D - 1 - gy * 2;
      if (x0 + 1 < region.x0 || x0 > region.x1 || y0 < region.y0 || y0 - 1 > region.y1) continue;
      const g = sim.ground[i]!, top = Math.round(g + d) - 1;
      for (let z = g + 1; z <= top; z++) {
        const tone = z === top ? 3 : top - z > 3 ? 1 : 2;
        const v = waterRamp * 16 + tone + 1;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]] as const) out.set(key(x0 + dx, y0 + dy, z), v);
      }
    }
    return out;
  }

  // ---- consultas del juego (posiciones del juego: px, py con y hacia abajo)
  waterDepthAt(px: number, py: number): number { return this.water ? this.water.depthAt(px, py) : 0; }
  waterSurfaceAt(px: number, py: number): number { return this.water ? this.water.surfaceAt(px, py) : 0; }
  // Alto del suelo que pisa algo en (px, py): el fondo del agua si la hay
  floorAt(px: number, py: number): number { return this.water ? Math.min(0, this.water.groundAt(px, py)) : 0; }

  step(dt: number): void {
    this.water?.step(dt);
    this.drops.step(dt, this.water);
  }
}
