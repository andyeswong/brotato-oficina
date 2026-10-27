// El piloto automático y la política de compra de la curva de balance (portados del Brotato, scripts/curve.test.ts):
// huye de enemigos y proyectiles, rodea obstáculos y compra armas primero. Lo usan la curva y la prueba de huella.
import type { Point } from '../../src/game/brotato/api';
import type { Run } from '../../src/game/brotato/sim/Run';
import type { World } from '../../src/game/brotato/sim/World';
import type { BrotatoGame, GameInput } from '../../src/game/brotato/play';

const HUNT_NEAR = 50;

export function kite(world: World, run: Run): Point {
  const p = world.player;
  // Prórroga (el tiempo acabó y quedan vivos): hay que matarlos, y huyendo no se acaba nunca (el escupidor guarda la
  // distancia). Va a por el más cercano hasta tenerlo a HUNT_NEAR: estar "a tiro" no basta, el disparo puede dar en un
  // muro que hay en medio
  if (world.overtime) {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const e of world.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best && bd > HUNT_NEAR) return goTo(run, p, best);
  }
  const { width, height } = run.level.arena;   // el centro de la arena es el mismo en ejes del modelo
  const u = width / 1280; // el piloto se diseñó en una arena de 1280: sus distancias escalan con la arena
  let fx = ((width / 2 - p.x) * 0.002) / u;
  let fy = ((height / 2 - p.y) * 0.002) / u;
  for (const e of world.enemies) {
    const dx = (p.x - e.x) / u, dy = (p.y - e.y) / u, d2 = dx * dx + dy * dy + 1;
    if (d2 < 200 * 200) { fx += (dx / d2) * 100; fy += (dy / d2) * 100; }
  }
  for (const pr of world.projectiles) {
    if (pr.owner !== 'enemy') continue;
    const dx = (p.x - pr.x) / u, dy = (p.y - pr.y) / u, d2 = dx * dx + dy * dy + 1;
    if (d2 < 120 * 120) { fx += (dx / d2) * 150; fy += (dy / d2) * 150; }
  }
  const len = Math.hypot(fx, fy);
  return len > 0.05 ? steer(run, p, { x: fx / len, y: fy / len }) : { x: 0, y: 0 };
}

// Hacia la entrada de la tienda (un punto a su alcance: el centro es sólido), por el camino fino de la arena (pathDir,
// el de los enemigos en la prórroga): la rejilla de 8 de goTo no veía los pasos estrechos entre arbustos y el piloto
// se quedaba sin llegar (medieval s38, s51, s58). Se sigue tal cual, sin steer: las celdas del camino caben a un cuerpo
// mayor que el de MAIA, y steer, que mira 14 px por delante, veía el borde de la fuente y la hacía oscilar a la puerta
// (s12). Sin camino, goTo
export function toShop(world: World, run: Run): Point {
  const s = run.arena.shop, d = run.arena.pathDir(world.player, s, s.reach - 3);
  return d ?? goTo(run, world.player, s);
}

// Tras la tienda, a la salida del piso (abierta): el mismo camino fino que a la tienda
export function toExit(world: World, run: Run): Point {
  const e = run.arena.exit!, d = run.arena.pathDir(world.player, e, e.reach - 4);
  return d ?? goTo(run, world.player, e);
}

// Ir a un sitio dando la vuelta a lo que haga falta (en la prórroga hay que llegar al último enemigo aunque esté al
// otro lado de un muro; el rodeo local de steer se queda pegado). Camino más corto (BFS) sobre una rejilla de celdas
// de 8 donde cabe el cuerpo; se sigue la celda del camino a 3 pasos, con steer para lo fino. Sin camino, steer recto
const CELL = 8;
const grids = new WeakMap<object, { cols: number; rows: number; ok: Uint8Array }>();
function grid(run: Run) {
  let g = grids.get(run.arena);
  if (!g) {
    const { width, height } = run.level.arena, cols = Math.ceil(width / CELL), rows = Math.ceil(height / CELL);
    const ok = new Uint8Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      ok[j * cols + i] = run.arena.fits(i * CELL + CELL / 2, j * CELL + CELL / 2, run.arena.floorZ, run.body.radius) ? 1 : 0;
    }
    g = { cols, rows, ok };
    grids.set(run.arena, g);
  }
  return g;
}
export function goTo(run: Run, p: Point & { z: number }, to: Point): Point {
  const g = grid(run);
  const cell = (q: Point) => Math.min(g.rows - 1, Math.max(0, Math.floor(q.y / CELL))) * g.cols + Math.min(g.cols - 1, Math.max(0, Math.floor(q.x / CELL)));
  const start = cell(p), goal = cell(to);
  const straight = () => { const dx = to.x - p.x, dy = to.y - p.y, l = Math.hypot(dx, dy) || 1; return steer(run, p, { x: dx / l, y: dy / l }); };
  // El destino puede ser sólido (el centro de la fuente): vale cualquier celda libre a 2 o menos de él
  const near = (k: number) => Math.abs((k % g.cols) - (goal % g.cols)) <= 2 && Math.abs(Math.floor(k / g.cols) - Math.floor(goal / g.cols)) <= 2;
  const from = new Int32Array(g.cols * g.rows).fill(-1);
  from[start] = start;
  const queue = [start];
  let end = -1;
  for (let h = 0; h < queue.length && end < 0; h++) {
    const k = queue[h]!;
    if (near(k) && (g.ok[k] || k === goal)) { end = k; break; }
    const x = k % g.cols, y = Math.floor(k / g.cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.cols || ny >= g.rows) continue;
      const n = ny * g.cols + nx;
      if (from[n]! >= 0 || !g.ok[n]) continue;
      from[n] = k;
      queue.push(n);
    }
  }
  if (end < 0) return straight();
  const path: number[] = [];
  for (let k = end; k !== start; k = from[k]!) path.push(k);
  if (path.length <= 2) return straight();
  const wp = path[Math.max(0, path.length - 3)]!;
  const wx = (wp % g.cols) * CELL + CELL / 2, wy = Math.floor(wp / g.cols) * CELL + CELL / 2;
  const dx = wx - p.x, dy = wy - p.y, l = Math.hypot(dx, dy) || 1;
  return steer(run, p, { x: dx / l, y: dy / l });
}

// Rodeo local: si a 8 o 14 px por delante el cuerpo no cabe (pared, columna, mueble, agua honda), prueba a girar 30°,
// 60°… hacia uno y otro lado y toma el primer camino libre. Sin esto el piloto se queda pegado y mide al piloto, no el
// mapa. (En el Brotato miraba un punto contra la rejilla de tiles; aquí, el cuerpo entero contra los vóxeles.)
export function steer(run: Run, p: Point & { z: number }, dir: Point): Point {
  const a = run.arena;
  const free = (d: Point) => [8, 14].every((k) => a.fits(p.x + d.x * k, p.y + d.y * k, p.z, run.body.radius));
  if (free(dir)) return dir;
  const ang = Math.atan2(dir.y, dir.x);
  for (let step = 1; step <= 5; step++) {
    for (const sign of [1, -1]) {
      const b = ang + sign * step * (Math.PI / 6);
      const d = { x: Math.cos(b), y: Math.sin(b) };
      if (free(d)) return d;
    }
  }
  return dir;
}

// Compra: primero armas que MAIA no tenga (su pasivo premia la variedad), luego cualquier arma, luego ítems.
// Si después le sobra dinero, vuelve a tirar (hasta 3 veces por tienda) y sigue comprando, como haría una persona.
export function shop(run: Run): string[] {
  const bought: string[] = [];
  for (let rerolls = 0; ; rerolls++) {
    bought.push(...buyAll(run));
    if (rerolls >= 3 || run.materials < run.shop.rerollPrice() + 20 || !run.shop.reroll().ok) return bought;
  }
}

export function buyAll(run: Run): string[] {
  const bought: string[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const offers = run.shop.offers.map((o, i) => ({ o, i })).filter((x) => x.o && x.o.price <= run.materials);
    const owned = new Set(run.weapons.map((w) => w.id));
    const pick =
      offers.find((x) => x.o!.kind === 'weapon' && !owned.has(x.o!.id)) ??
      offers.find((x) => x.o!.kind === 'weapon') ??
      offers.sort((a, b) => a.o!.price - b.o!.price).find((x) => x.o!.kind === 'item');
    if (!pick || !run.shop.buy(pick.i).ok) break;
    bought.push(pick.o!.id);
  }
  return bought;
}

type Hooks = { onTick?: (world: World) => void; onWave?: (world: World) => void };

// Una partida entera: oleadas con el piloto y tienda entre ellas. onWave recibe cada oleada al acabar y onTick cada
// paso; devuelve la oleada alcanzada (11 = victoria) y una línea por oleada.
export function playRun(run: Run, hooks: Hooks = {}): { reached: number; rows: string[] } {
  const rows: string[] = [];
  for (;;) {
    if (wave(run, hooks, rows)) return { reached: run.world!.status === 'dead' ? run.waveNumber : 11, rows };
  }
}

// Lo mismo, soltando el hilo entre oleadas: una prueba que juega partidas enteras sin soltarlo deja al trabajador de
// vitest sin responder (en oficina, "Timeout calling onTaskUpdate", y la suite falla aunque todo pase)
export async function playRunAsync(run: Run, hooks: Hooks = {}): Promise<{ reached: number; rows: string[] }> {
  const rows: string[] = [];
  for (;;) {
    if (wave(run, hooks, rows)) return { reached: run.world!.status === 'dead' ? run.waveNumber : 11, rows };
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// Una oleada y su tienda; true si la partida acabó
function wave(run: Run, hooks: Hooks, rows: string[]): boolean {
  {
    const world = run.startWave();
    let openT = 0, overT = 0;
    while (world.status === 'playing' || world.status === 'open') {
      // Si la prórroga no acaba en dos minutos, el piloto no sabe cazar a alguno: que se vea, no un bucle sin fin
      if (world.overtime && ++overT > 60 * 120) throw new Error(`s${run.seed} oleada ${run.waveNumber}: la prórroga no acaba (quedan ${world.enemies.length})`);
      if (world.status === 'open') {
        // Oleada limpia: a la entrada de la tienda y F (si no llega en un minuto, el mapa o el piloto están mal)
        if (++openT > 60 * 60) throw new Error(`s${run.seed} oleada ${run.waveNumber}: el piloto no llega a la tienda en 60 s`);
        world.step(1 / 60, world.atShop ? { x: 0, y: 0 } : toShop(world, run), world.atShop);
      } else world.step(1 / 60, kite(world, run));
      hooks.onTick?.(world);
    }
    hooks.onWave?.(world);
    const line = `s${run.seed} oleada ${String(run.waveNumber).padStart(2)} · ${world.status === 'dead' ? 'MUERE' : 'pasa '} a los ${world.time.toFixed(0).padStart(2)} s · vida ${world.player.hp}/${world.player.maxHp} · bajas ${run.kills} · materiales ${run.materials}`;
    if (world.status === 'dead') { rows.push(line); return true; }
    const result = run.finishWave();
    if (result === 'victory') { rows.push(`${line} · VICTORIA`); return true; }
    run.shop.open();
    const bought = shop(run);
    rows.push(`${line} · compra: ${bought.join(', ') || '—'} · quedan ${run.materials} · armas ${run.weapons.map((w) => w.id + (w.tier ? `+${w.tier}` : '')).join(',')}`);
    // Con pisos: a la salida (si no llega en un minuto, el mapa o el piloto están mal)
    const out = run.openExit();
    for (let t = 0; out && out.status === 'exit'; t++) {
      if (t > 60 * 60) throw new Error(`s${run.seed} piso ${run.floor + 1}: el piloto no llega a la salida en 60 s`);
      out.step(1 / 60, toExit(out, run));
      hooks.onTick?.(out);
    }
    return false;
  }
}

// La entrada de un tick para una partida con vista (BrotatoGame), con el mismo piloto: huye y caza en la oleada y, con
// ella limpia, va a la entrada de la tienda y pulsa F
export function gameInput(g: BrotatoGame): GameInput {
  const w = g.current;
  if (w.status === 'exit') {
    const d = toExit(w, g.run);
    return { dx: d.x, dy: d.y, stomp: false };
  }
  if (w.status === 'open') {
    if (w.atShop) return { dx: 0, dy: 0, stomp: false, interact: true };
    const d = toShop(w, g.run);
    return { dx: d.x, dy: d.y, stomp: false };
  }
  const d = kite(w, g.run);
  return { dx: d.x, dy: d.y, stomp: false };
}
