import type { Point } from '../api';
import { TERRAIN_TILE, type LevelModule } from '../registry/schemas';
import { generateLayout, NORTH, WALL, type Layout } from '../worldgen';

// El mapa de una partida: el nivel declara un generador y la semilla de la partida decide el mapa. Todo puro y
// determinista: la misma semilla da el mismo tema, el mismo mapa y la misma partida (los tests de balance cuentan con ello).

function mix(seed: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// El nivel de la partida: entre los que tienen generador, uno al azar por la semilla. Sin ninguno, el primero.
export function pickLevel(levels: readonly LevelModule[], seed: number): LevelModule {
  const generated = levels.filter((l) => l.generator);
  if (generated.length === 0) return levels[0]!;
  return generated[mix(seed, 1) % generated.length]!;
}

// El mapa generado del nivel para esa partida, o null si el nivel es de mapa fijo
export function levelLayout(level: LevelModule, seed: number): Layout | null {
  const g = level.generator;
  if (!g) return null;
  return generateLayout({
    cols: level.arena.width / TERRAIN_TILE,
    rows: level.arena.height / TERRAIN_TILE,
    floors: g.floors,
    caps: g.caps,
    facade: g.facade,
    water: g.water,
    pillars: g.pillars,
    props: g.props,
    materials: 0, // los materiales salen de los enemigos: los sueltos cambiarían la economía de F1
  }, mix(seed, 2));
}

// Lo que bloquea el paso en un mapa generado: paredes, columnas y muebles. El agua no (es decorado hasta que se
// decida qué hace al jugar), pero nadie aparece dentro de ella.
export class Obstacles {
  readonly tile = TERRAIN_TILE;
  // Interior jugable, en píxeles: dentro de las paredes (la del norte es tapa + fachada)
  readonly inner: { x0: number; y0: number; x1: number; y1: number };
  private readonly solid: Uint8Array;
  private readonly free: Point[] = [];

  constructor(readonly layout: Layout) {
    const { cols, rows, wall, pillar } = layout;
    this.solid = new Uint8Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) this.solid[i] = wall[i] !== WALL.none || pillar[i] === 1 ? 1 : 0;
    this.inner = { x0: this.tile, y0: NORTH * this.tile, x1: (cols - 1) * this.tile, y1: (rows - 1) * this.tile };
    // Celdas donde puede aparecer alguien: tierra sin nada sólido en ella ni en sus 8 vecinas
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      if (layout.water[y]![x] === '~') continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (this.solidTile(x + dx, y + dy)) ok = false;
      if (ok) this.free.push({ x: x * this.tile + this.tile / 2, y: y * this.tile + this.tile - 2 });
    }
  }

  solidTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.layout.cols || ty >= this.layout.rows) return true;
    return this.solid[ty * this.layout.cols + tx] === 1;
  }

  solidAt(x: number, y: number): boolean {
    return this.solidTile(Math.floor(x / this.tile), Math.floor(y / this.tile));
  }

  // Saca de lo sólido un cuerpo con los pies en (x, y): se le trata como un círculo de radio r apoyado en el suelo
  // (centro en y - r). Se empuja por la normal de cada celda que toca, así que resbala por las paredes.
  push(pos: { x: number; y: number }, r: number): void {
    for (let pass = 0; pass < 2; pass++) {
      const cx = pos.x;
      const cy = pos.y - r;
      const t0x = Math.floor((cx - r) / this.tile), t1x = Math.floor((cx + r) / this.tile);
      const t0y = Math.floor((cy - r) / this.tile), t1y = Math.floor((cy + r) / this.tile);
      let moved = false;
      for (let ty = t0y; ty <= t1y; ty++) for (let tx = t0x; tx <= t1x; tx++) {
        if (!this.solidTile(tx, ty)) continue;
        const x0 = tx * this.tile, y0 = ty * this.tile;
        const nx = Math.min(Math.max(pos.x, x0), x0 + this.tile);
        const ny = Math.min(Math.max(pos.y - r, y0), y0 + this.tile);
        let dx = pos.x - nx, dy = pos.y - r - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 === 0) {
          // El centro está dentro de la celda: sale por el lado más cercano
          const left = pos.x - x0, right = x0 + this.tile - pos.x, up = pos.y - r - y0, down = y0 + this.tile - (pos.y - r);
          const m = Math.min(left, right, up, down);
          if (m === left) pos.x = x0 - r; else if (m === right) pos.x = x0 + this.tile + r;
          else if (m === up) pos.y = y0; else pos.y = y0 + this.tile + 2 * r;
        } else {
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          pos.x += dx * (r - d);
          pos.y += dy * (r - d);
        }
        moved = true;
      }
      if (!moved) return;
    }
  }

  // El punto libre (para aparecer) más cercano a uno dado; si el dado ya está libre, el mismo
  nearestFree(p: Point): Point {
    const tx = Math.floor(p.x / this.tile), ty = Math.floor(p.y / this.tile);
    if (this.free.some((f) => Math.floor(f.x / this.tile) === tx && Math.floor(f.y / this.tile) === ty)) return p;
    let best = this.free[0] ?? p;
    let bestD = Infinity;
    for (const f of this.free) {
      const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    return { x: best.x, y: best.y };
  }
}
