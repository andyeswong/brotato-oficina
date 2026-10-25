// El piloto automático y la política de compra de la curva de balance (portados del Brotato, scripts/curve.test.ts):
// huye de enemigos y proyectiles, rodea obstáculos y compra armas primero. Lo usan la curva y la prueba de huella.
import type { Point } from '../../src/game/brotato/api';
import type { Run } from '../../src/game/brotato/sim/Run';
import type { World } from '../../src/game/brotato/sim/World';

export function kite(world: World, run: Run): Point {
  const p = world.player;
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
// vitest sin responder (en oficina, "Timeout calling onTaskUpdate", y npm test falla aunque todo pase)
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
    while (world.status === 'playing') { world.step(1 / 60, kite(world, run)); hooks.onTick?.(world); }
    hooks.onWave?.(world);
    const line = `s${run.seed} oleada ${String(run.waveNumber).padStart(2)} · ${world.status === 'dead' ? 'MUERE' : 'pasa '} a los ${world.time.toFixed(0).padStart(2)} s · vida ${world.player.hp}/${world.player.maxHp} · bajas ${run.kills} · materiales ${run.materials}`;
    if (world.status === 'dead') { rows.push(line); return true; }
    const result = run.finishWave();
    if (result === 'victory') { rows.push(`${line} · VICTORIA`); return true; }
    run.shop.open();
    const bought = shop(run);
    rows.push(`${line} · compra: ${bought.join(', ') || '—'} · quedan ${run.materials} · armas ${run.weapons.map((w) => w.id + (w.tier ? `+${w.tier}` : '')).join(',')}`);
    return false;
  }
}
