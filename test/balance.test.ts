import { describe, expect, it } from 'vitest';
import type { Point } from '../src/engine/api';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { Run } from '../src/engine/sim/Run';
import type { World } from '../src/engine/sim/World';

// Curva de F1 (MAIA, 2026-10-20): la oleada 1 puede pasarse quieta, pero hay que moverse antes de la 3.
// Sin tienda: mide la base, no la partida real.
const { registry } = validateContent(discoverContent());
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function play(seed: number, pilot: (world: World, run: Run) => Point): number {
  const run = new Run(registry, registry.character('maia'), registry.level('oficina'), seed);
  for (;;) {
    const world = run.startWave();
    while (world.status === 'playing') world.step(1 / 60, pilot(world, run));
    if (world.status === 'dead' || run.finishWave() === 'victory') return run.waveNumber;
  }
}

const still = () => ({ x: 0, y: 0 });

// Un piloto torpe: huye de los enemigos y proyectiles cercanos y no se pega al borde
function kite(world: World, run: Run): Point {
  const p = world.player;
  const { width, height } = run.level.arena;
  let fx = (width / 2 - p.x) * 0.002;
  let fy = (height / 2 - p.y) * 0.002;
  for (const e of world.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy + 1;
    if (d2 < 200 * 200) {
      fx += (dx / d2) * 100;
      fy += (dy / d2) * 100;
    }
  }
  for (const pr of world.projectiles) {
    if (pr.owner !== 'enemy') continue;
    const dx = p.x - pr.x;
    const dy = p.y - pr.y;
    const d2 = dx * dx + dy * dy + 1;
    if (d2 < 120 * 120) {
      fx += (dx / d2) * 150;
      fy += (dy / d2) * 150;
    }
  }
  const len = Math.hypot(fx, fy);
  return len > 0.05 ? { x: fx / len, y: fy / len } : { x: 0, y: 0 };
}

describe('balance de F1', () => {
  it('quieta, con el Buzón, MAIA no pasa de la oleada 3', () => {
    for (const seed of SEEDS) expect(play(seed, still), `semilla ${seed}`).toBeLessThanOrEqual(3);
  });

  it('moviéndose, aguanta más que quieta (en media)', () => {
    const avg = (pilot: (w: World, r: Run) => Point) => SEEDS.reduce((sum, s) => sum + play(s, pilot), 0) / SEEDS.length;
    expect(avg(kite)).toBeGreaterThan(avg(still));
  });
});
