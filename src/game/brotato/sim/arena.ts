// La arena de una partida del Brotato es el mundo de vóxeles: el nivel declara un generador, la semilla de la partida
// decide el mapa (src/worldgen) y se construye en vóxeles (src/world/build.ts). Sustituye al Obstacles del Brotato
// (sim/map.ts): la colisión es la del runtime (src/game/body.ts) sobre WorldQuery, y todo va en ejes del modelo
// (x este, y norte, z arriba; 1 vóxel = 1 px del juego). Puro y determinista.
import { SHOP_PROP_THEMES, stampShopProp } from './shopprop';
import type { Point } from '../api';
import type { LevelModule } from '../registry/schemas';
import { generateLayout, NORTH, TILE, WALL, type Layout } from '@voxpix/worldgen';
import { buildWorldState, type World } from '@voxpix/world/build';
import { FOLIAGE_THEMES, addFoliage } from './foliage';
import { GLASS_THEMES, addGlass } from './glass';
import type { WorldState } from '@voxpix/world/state';
import { DEFAULT_RULES, fits, moveBody, restZ, waterFactor } from '@voxpix/runtime/body';

// Altura sobre el suelo a la que vuelan los disparos: lo que es sólido ahí (paredes, columnas, muebles) los para
const SHOT_HEIGHT = 8;
// El radio del enemigo más grande (embestidor y escupidor): un punto de aparición tiene que dejarle sitio
const SPAWN_RADIUS = 6;
const FLOW = 4;          // lado de la celda del camino de la prórroga
const PATH_NEAR = 8;     // a cuánto del destino se da por llegado (y desde dónde se cuentan las distancias)
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function mix(seed: number, salt: number): number {
  let h = (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// El nivel de la partida: uno al azar por la semilla, igual que en el Brotato (misma semilla, mismo tema)
export function pickLevel(levels: readonly LevelModule[], seed: number): LevelModule {
  return levels[mix(seed, 1) % levels.length]!;
}

// El mapa del nivel para esa partida. Sin materiales sueltos: salen de los enemigos (la economía del Brotato).
export function levelLayout(level: LevelModule, seed: number): Layout {
  return generateLayout({
    ...level.generator,
    cols: level.arena.width / TILE,
    rows: level.arena.height / TILE,
    materials: 0,
  }, mix(seed, 2));
}

// Un cuerpo que se mueve por la arena: los pies en (x, y), apoyados a la altura z
export interface Mover {
  x: number;
  y: number;
  z: number;
}

export class Arena {
  readonly layout: Layout;
  readonly world: World;                 // el mundo construido (lo que se hornea para la vista)
  readonly state: WorldState;
  // Interior jugable, en ejes del modelo: dentro de las paredes (la del norte es tapa + fachada)
  readonly inner: { x0: number; y0: number; x1: number; y1: number };
  readonly start: Point;
  // La entrada a la tienda: el objeto del mapa que brilla con la oleada limpia (la fuente en el medieval; un adorno en
  // los otros temas, en el mismo tipo de sitio). radius: lo que ocupa; reach: a qué distancia del centro se entra
  readonly shop: { x: number; y: number; radius: number; reach: number };
  // La caja del objeto de la tienda en celdas del mundo [x0, y0, z0, x1, y1, z1], desde z = 1 (por encima del suelo):
  // la que rodea el resalte de VoxPix cuando la oleada queda limpia
  readonly shopBox: [number, number, number, number, number, number];
  readonly floorZ: number;               // altura del suelo (la cara de arriba de las losetas)
  private free: Point[] = [];
  // El camino de la prórroga (pathDir): dónde cabe un enemigo en la rejilla de FLOW y la distancia a la celda de MAIA
  private flowOk: Uint8Array | null = null;
  private flowDist: Int32Array | null = null;
  private flowGoal = '';
  // Las plantas que puso la vegetación, por tipo (vacío si el tema no la lleva)
  plants: Record<string, number> = {};
  // Cuántas rampas pasaron a vidrio (0 si el tema no lo lleva)
  glassRamps = 0;

  // foliage / glass: false quitan la vegetación o el vidrio (para las pruebas que comparan con y sin ellos)
  constructor(level: LevelModule, seed: number, opts: { foliage?: boolean; glass?: boolean; bushes?: boolean } = {}) {
    this.layout = levelLayout(level, seed);
    // Dónde sale la jugadora, en ejes del modelo (las filas del worldgen van hacia abajo): la vegetación deja ahí un claro
    const start = { x: this.layout.spawn.x, y: this.layout.rows * TILE - 1 - this.layout.spawn.y };
    // Lo que cada tema añade entre construir el mundo y crear su estado: la vegetación (solo aspecto, se atraviesa) y el
    // vidrio (ventanas y pantallas, que dejan pasar la luz)
    const veg = opts.foliage !== false && FOLIAGE_THEMES.has(level.theme);
    const glass = opts.glass !== false && GLASS_THEMES.has(level.theme);
    // Los temas sin fuente llevan su adorno de la tienda (la impresora, el servidor) en el sitio en que iría la fuente
    const prop = SHOP_PROP_THEMES.has(level.theme) ? shopSpot(this.layout) : null;
    let propBox: [number, number, number, number, number, number] | null = null;
    const decorate = (w: World) => {
      if (prop) propBox = stampShopProp(w, level.theme, prop);
      if (veg) this.plants = addFoliage(w, seed, start, { bushes: opts.bushes });
      if (glass) this.glassRamps = addGlass(w);
    };
    ({ world: this.world, state: this.state } = buildWorldState(this.layout, level.theme, veg || glass || prop ? { decorate } : {}));
    const { cols, rows } = this.layout;
    const D = rows * TILE;
    // Las filas del worldgen van hacia abajo (y = 0 al norte); en el modelo, y crece hacia el norte
    const my = (py: number) => D - 1 - py;
    this.inner = { x0: TILE, y0: TILE, x1: (cols - 1) * TILE, y1: D - NORTH * TILE };
    this.start = { x: this.layout.spawn.x, y: my(this.layout.spawn.y) };
    this.floorZ = restZ(this.state, this.start.x, this.start.y, 1);
    const f = this.world.fountain;
    const spot = f ? { x: f.x, y: f.y, radius: f.radius + 2 } : { ...(prop ?? shopSpot(this.layout)), radius: SHOP_PROP_RADIUS };
    this.shop = { ...spot, reach: spot.radius + SHOP_REACH };
    // La caja del resalte (NARUTO, VoxPix a612e67): la de la fuente con 3 de margen hasta encima del cuenco, o la del adorno
    const r = f ? f.radius + 3 : 0;
    this.shopBox = f ? [Math.floor(f.x - r), Math.floor(f.y - r), 1, Math.ceil(f.x + r), Math.ceil(f.y + r), f.bowl.z + 3]
      : propBox ?? [Math.floor(spot.x - SHOP_PROP_RADIUS), Math.floor(spot.y - SHOP_PROP_RADIUS), 1, Math.ceil(spot.x + SHOP_PROP_RADIUS), Math.ceil(spot.y + SHOP_PROP_RADIUS), 24];
    // Donde puede aparecer alguien: tierra sin nada sólido en ella ni en sus 8 vecinas (el mismo criterio del
    // Brotato, sobre el mismo layout, para que las oleadas salgan en los mismos sitios)
    const solid = (tx: number, ty: number) => tx < 0 || ty < 0 || tx >= cols || ty >= rows
      || this.layout.wall[ty * cols + tx] !== WALL.none || this.layout.pillar[ty * cols + tx] === 1;
    for (let y = 1; y < rows - 1; y++) for (let x = 1; x < cols - 1; x++) {
      if (this.layout.water[y]![x] === '~') continue;
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (solid(x + dx, y + dy)) ok = false;
      if (ok) this.free.push({ x: x * TILE + TILE / 2, y: my(y * TILE + TILE - 2) });
    }
    // Y que quepa de verdad un enemigo del radio más grande: lo que el layout no sabe (los arbustos de la vegetación)
    this.free = this.free.filter((f) => this.fits(f.x, f.y, this.floorZ, SPAWN_RADIUS));
  }

  // Los puntos donde pueden aparecer enemigos (para las pruebas)
  get spawnPoints(): readonly Point[] {
    return this.free;
  }

  // Mueve un cuerpo de radio r (dx, dy) con la colisión del runtime: resbala por las paredes, sube escalones bajos
  // y no entra en agua honda
  move(m: Mover, r: number, dx: number, dy: number): void {
    const body = { x: m.x, y: m.y, z: m.z, r };
    moveBody(this.state, body, dx, dy, DEFAULT_RULES);
    m.x = body.x; m.y = body.y; m.z = body.z;
  }

  // Dónde se apoya un cuerpo recién puesto en (x, y)
  restZ(x: number, y: number, r: number): number {
    return restZ(this.state, x, y, r);
  }

  // ¿Cabe ahí un cuerpo de radio r con los pies a z? (el piloto de la curva lo usa para rodear obstáculos)
  fits(x: number, y: number, z: number, r: number): boolean {
    return fits(this.state, x, y, z, r, DEFAULT_RULES);
  }

  // Lo que frena el agua bajo los pies (1 en seco)
  slowdown(x: number, y: number): number {
    return waterFactor(this.state.waterAt(x, y)?.depth ?? 0);
  }

  // ¿Para algo un disparo en (x, y)? Fuera del interior, o algo sólido a la altura a la que vuela
  shotBlocked(x: number, y: number): boolean {
    const { x0, y0, x1, y1 } = this.inner;
    if (x < x0 || x > x1 || y < y0 || y > y1) return true;
    return this.state.solidAt(x, y, this.floorZ + SHOT_HEIGHT);
  }

  // El punto libre (para aparecer) más cercano a uno dado; si el dado ya está libre, el mismo
  nearestFree(p: Point): Point {
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    if (this.free.some((f) => Math.floor(f.x / TILE) === tx && Math.floor(f.y / TILE) === ty) && this.fits(p.x, p.y, this.floorZ, SPAWN_RADIUS)) return p;
    let best = this.free[0] ?? p;
    let bestD = Infinity;
    for (const f of this.free) {
      const d = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = f; }
    }
    return { x: best.x, y: best.y };
  }

  // Hacia dónde ir (unitario) desde `from` para llegar a `to` por el camino más corto, rodeando arbustos, columnas y
  // paredes; null si ya está al lado (a `near` px o menos) o si no hay camino. Rejilla de FLOW px donde cabe el enemigo
  // más grande, con las distancias por BFS desde las celdas libres a `near` de `to` (`to` puede ser sólido, como el
  // centro de la fuente, o un hueco donde el grande no cabe); se rehacen cuando cambia la celda de `to` o `near`. Un
  // enemigo pequeño encajado donde el grande no cabe sale hacia la celda con camino más cercana (a 2 o menos)
  pathDir(from: Point, to: Point, near = PATH_NEAR): Point | null {
    const cols = Math.ceil(this.world.width / FLOW), rows = Math.ceil(this.world.depth / FLOW), n = cols * rows;
    if (!this.flowOk) {
      this.flowOk = new Uint8Array(n);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        this.flowOk[j * cols + i] = this.fits(i * FLOW + FLOW / 2, j * FLOW + FLOW / 2, this.floorZ, SPAWN_RADIUS) ? 1 : 0;
      }
      this.flowDist = new Int32Array(n);
    }
    const ok = this.flowOk, dist = this.flowDist!;
    const cell = (p: Point) => Math.min(rows - 1, Math.max(0, Math.floor(p.y / FLOW))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(p.x / FLOW)));
    const goal = `${cell(to)}:${near}`;
    if (goal !== this.flowGoal) {
      this.flowGoal = goal;
      dist.fill(-1);
      const queue = new Int32Array(n);
      let head = 0, tail = 0;
      const span = Math.ceil(near / FLOW), gx = Math.floor(to.x / FLOW), gy = Math.floor(to.y / FLOW);
      for (let y = gy - span; y <= gy + span; y++) for (let x = gx - span; x <= gx + span; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const k = y * cols + x;
        if (!ok[k] || Math.hypot(x * FLOW + FLOW / 2 - to.x, y * FLOW + FLOW / 2 - to.y) > near) continue;
        dist[k] = 0;
        queue[tail++] = k;
      }
      while (head < tail) {
        const k = queue[head++]!, x = k % cols, y = (k - x) / cols;
        for (const [dx, dy] of NEIGHBORS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const m = ny * cols + nx;
          if (dist[m]! >= 0 || !ok[m]) continue;
          dist[m] = dist[k]! + 1;
          queue[tail++] = m;
        }
      }
    }
    // La vecina (de las 8, o a 2 si está encajado) con menos distancia
    const c = cell(from), cx = c % cols, cy = (c - cx) / cols, here = dist[c]!;
    if (here === 0) return null;
    const span = here >= 0 ? 1 : 2;
    let best = -1, bd = here >= 0 ? here : Infinity;
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const d = dist[ny * cols + nx]!;
      if (d >= 0 && d < bd) { bd = d; best = ny * cols + nx; }
    }
    if (best < 0) return null;
    const tx = (best % cols) * FLOW + FLOW / 2 - from.x, ty = Math.floor(best / cols) * FLOW + FLOW / 2 - from.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  }

  // Dentro del interior (lo que no se mueve con colisión: los materiales que caen)
  clampInside(p: { x: number; y: number }, margin: number): void {
    const { x0, y0, x1, y1 } = this.inner;
    p.x = Math.min(Math.max(p.x, x0 + margin), x1 - margin);
    p.y = Math.min(Math.max(p.y, y0 + margin), y1 - margin);
  }
}

// A cuánto del borde del objeto de la tienda se puede entrar, y lo que ocupa el adorno de los temas sin fuente
const SHOP_REACH = 12;
const SHOP_PROP_RADIUS = 10;

// Dónde va la entrada a la tienda en un tema sin fuente: el mismo criterio con el que VoxPix pone la fuente
// (buildWorld): el centro de 3×3 losetas sin pared, columna ni agua más cercano a la salida, a 70 o más de ella para que
// no tape el sitio de pelear. En ejes del modelo
export function shopSpot(layout: Layout): Point {
  const { cols, rows } = layout;
  const free = (cx: number, cy: number) => {
    if (cx < 1 || cy < 1 || cx >= cols - 1 || cy >= rows - 1) return false;
    const i = cy * cols + cx;
    return layout.wall[i] === WALL.none && !layout.pillar[i] && layout.water[cy]?.[cx] !== '~';
  };
  let best: Point | null = null, bd = Infinity;
  for (let cy = NORTH + 1; cy < rows - 2; cy++) for (let cx = 2; cx < cols - 2; cx++) {
    let ok = true;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) ok = free(cx + dx, cy + dy);
    if (!ok) continue;
    const fx = cx * TILE + 8, fy = cy * TILE + 8;
    const d = Math.hypot(fx - layout.spawn.x, fy - layout.spawn.y);
    if (d < 70 || d >= bd) continue;
    bd = d; best = { x: fx, y: fy };
  }
  const p = best ?? { x: layout.spawn.x, y: layout.spawn.y };
  return { x: p.x + 0.5, y: rows * TILE - 1 - p.y + 0.5 };
}
