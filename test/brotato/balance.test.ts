import { vi, describe, expect, it } from 'vitest';
import type { Point } from '../../src/game/brotato/api';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import type { World } from '../../src/game/brotato/sim/World';
import { kite } from './pilot';

// Cada partida construye su mundo de vóxeles (~250 ms): los ficheros que crean muchas pasan de los 5 s por defecto
vi.setConfig({ testTimeout: 60_000 });

// Curva de F1 (MAIA, 2026-10-20): la oleada 1 puede pasarse quieta, pero hay que moverse antes de la 3.
// Sin tienda: mide la base, no la partida real.
const { registry } = validateContent(discoverContent());
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function play(seed: number, pilot: (world: World, run: Run) => Point): number {
  const run = new Run(registry, registry.character('maia'), registry.level('oficina'), seed);
  for (;;) {
    const world = run.startWave();
    // Sin tienda: la oleada limpia (open) cuenta como pasada. Con tope: un piloto que no caza a los que quedan en la
    // prórroga (el quieto no alcanza al escupidor) no la pasa
    for (let t = 0; world.status === 'playing' && t < 60 * 600; t++) world.step(1 / 60, pilot(world, run));
    if (world.status === 'playing' || world.status === 'dead' || run.finishWave() === 'victory') return run.waveNumber;
  }
}

const still = () => ({ x: 0, y: 0 });

// El que se mueve es el piloto de la curva (test/brotato/pilot.ts): huye rodeando obstáculos y, en la prórroga,
// caza a los que quedan (MAIA, 2026-10-26: con la ronda nueva hay que matarlos a todos, y un piloto que solo huye ya
// no juega como un jugador). El torpe que había aquí moría en la prórroga de la oleada 1: 1,75 contra 1,875 de la quieta

describe('balance de F1', () => {
  it('quieta, con el Buzón, MAIA no pasa de la oleada 3', () => {
    for (const seed of SEEDS) expect(play(seed, still), `semilla ${seed}`).toBeLessThanOrEqual(3);
  });

  // Cede entre semillas: el piloto que caza juega más oleadas, y de un tirón tumbaba al trabajador de vitest en oficina
  it('moviéndose, aguanta más que quieta (en media)', async () => {
    const avg = async (pilot: (w: World, r: Run) => Point) => {
      let sum = 0;
      for (const s of SEEDS) { sum += play(s, pilot); await new Promise((r) => setTimeout(r, 0)); }
      return sum / SEEDS.length;
    };
    expect(await avg(kite)).toBeGreaterThan(await avg(still));
  });
});
