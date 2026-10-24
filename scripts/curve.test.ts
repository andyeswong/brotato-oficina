// Informe de balance, no un test: `npm run curva` (o SEEDS=1,2 LEVEL=medieval npm run curva; sin LEVEL, la oficina). Juega partidas completas con un piloto automático
// (huye de enemigos y proyectiles) y una política de compra simple, e imprime la curva por oleada.
import { it } from 'vitest';
import type { Point } from '../src/engine/api';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { Run } from '../src/engine/sim/Run';
import type { World } from '../src/engine/sim/World';

const { registry } = validateContent(discoverContent());
const SEEDS = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const LEVEL = process.env.LEVEL ?? 'oficina';

function kite(world: World, run: Run): Point {
  const p = world.player;
  const { width, height } = run.level.arena;
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

// Rodeo local: si 14 px por delante de los pies hay una pared, una columna o un mueble, prueba a girar 30°, 60°…
// hacia uno y otro lado y toma el primer camino libre. Sin esto el piloto se queda pegado y mide al piloto, no el mapa.
function steer(run: Run, p: Point, dir: Point): Point {
  const o = run.obstacles;
  if (!o) return dir;
  const free = (d: Point) => [8, 14].every((k) => !o.solidAt(p.x + d.x * k, p.y - run.body.radius + d.y * k));
  if (free(dir)) return dir;
  const a = Math.atan2(dir.y, dir.x);
  for (let step = 1; step <= 5; step++) {
    for (const sign of [1, -1]) {
      const b = a + sign * step * (Math.PI / 6);
      const d = { x: Math.cos(b), y: Math.sin(b) };
      if (free(d)) return d;
    }
  }
  return dir;
}

// Compra: primero armas que MAIA no tenga (su pasivo premia la variedad), luego cualquier arma, luego ítems.
// Si después le sobra dinero, vuelve a tirar (hasta 3 veces por tienda) y sigue comprando, como haría una persona.
function shop(run: Run): string[] {
  const bought: string[] = [];
  for (let rerolls = 0; ; rerolls++) {
    bought.push(...buyAll(run));
    if (rerolls >= 3 || run.materials < run.shop.rerollPrice() + 20 || !run.shop.reroll().ok) return bought;
  }
}

function buyAll(run: Run): string[] {
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

// Se salta en los tests normales; solo corre con CURVA=1 (npm run curva)
it.skipIf(!process.env.CURVA)('curva de balance', () => {
  const rows: string[] = [];
  const reached: number[] = [];
  for (const seed of SEEDS) {
    const run = new Run(registry, registry.character('maia'), registry.level(LEVEL), seed);
    for (;;) {
      const world = run.startWave();
      while (world.status === 'playing') world.step(1 / 60, kite(world, run));
      const line = `s${seed} oleada ${String(run.waveNumber).padStart(2)} · ${world.status === 'dead' ? 'MUERE' : 'pasa '} a los ${world.time.toFixed(0).padStart(2)} s · vida ${world.player.hp}/${world.player.maxHp} · bajas ${run.kills} · materiales ${run.materials}`;
      if (world.status === 'dead') { rows.push(line); reached.push(run.waveNumber); break; }
      const result = run.finishWave();
      if (result === 'victory') { rows.push(`${line} · VICTORIA`); reached.push(11); break; }
      run.shop.open();
      const bought = shop(run);
      rows.push(`${line} · compra: ${bought.join(', ') || '—'} · quedan ${run.materials} · armas ${run.weapons.map((w) => w.id + (w.tier ? `+${w.tier}` : '')).join(',')}`);
    }
  }
  console.log(['', ...rows, '', `${LEVEL}: oleada alcanzada por semilla: ${reached.join(', ')} (11 = victoria)`].join('\n'));
});
