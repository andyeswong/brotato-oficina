import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { playRun } from './pilot';

// Puerta de MAIA para la fase 1: la misma semilla tiene que dar la misma partida COMPLETA dos veces, byte a byte.
// Se juega entera (oleadas, tienda, compras) con el piloto de la curva y se toma la huella de todo el estado cada
// medio segundo (sin el mundo de vóxeles, que la oleada no toca) y con todo al final de cada oleada.
const { registry } = validateContent(discoverContent());

function trace(level: string, seed: number): { digests: string[]; reached: number } {
  const run = new Run(registry, registry.character('maia'), registry.level(level), seed);
  const digests: string[] = [];
  let tick = 0;
  const { reached } = playRun(run, {
    onTick: (world) => { if (++tick % 30 === 0) digests.push(runDigest(run, world, false)); },
    onWave: (world) => digests.push(runDigest(run, world)),
  });
  digests.push(runDigest(run, null));
  return { digests, reached };
}

describe('huella de la partida completa', () => {
  it.each([['oficina', 5], ['medieval', 5], ['cyberpunk', 5], ['oficina', 13]] as const)('%s, semilla %i: dos veces, la misma partida byte a byte', { timeout: 120_000 }, (level, seed) => {
    const a = trace(level, seed);
    const b = trace(level, seed);
    expect(a.digests.length, 'la partida tiene que durar').toBeGreaterThan(100);
    expect(new Set(a.digests).size, 'y cambiar').toBeGreaterThan(a.digests.length * 0.9);
    // Primera huella distinta, si la hay: dice en qué paso se rompió
    const first = a.digests.findIndex((d, i) => d !== b.digests[i]);
    expect(first, `se separan en la huella ${first} de ${a.digests.length}`).toBe(-1);
    expect(b.digests.length).toBe(a.digests.length);
    expect(b.reached).toBe(a.reached);
  });

  it('otra semilla, otra partida desde el primer paso', () => {
    const a = new Run(registry, registry.character('maia'), registry.level('oficina'), 5);
    const b = new Run(registry, registry.character('maia'), registry.level('oficina'), 6);
    expect(runDigest(a, null)).not.toBe(runDigest(b, null));
  });
});
