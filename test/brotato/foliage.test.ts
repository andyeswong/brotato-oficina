import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { kite, steer } from './pilot';

// La vegetación (src/game/brotato/sim/foliage.ts): solo en medieval, y solo aspecto: la partida es la misma con y sin ella
const { registry } = validateContent(discoverContent());

describe('la vegetación', () => {
  it('solo medieval la lleva: hierba y flores en todas las semillas probadas', () => {
    for (const seed of [1, 2, 3]) {
      const m = new Run(registry, registry.character('maia'), registry.level('medieval'), seed).arena.plants;
      expect(m.grass, `semilla ${seed}`).toBeGreaterThan(0);
      expect(m.flowers, `semilla ${seed}`).toBeGreaterThan(0);
      for (const lv of ['oficina', 'cyberpunk']) expect(new Run(registry, registry.character('maia'), registry.level(lv), seed).arena.plants).toEqual({});
    }
  });

  it('se atraviesa: con y sin ella, la misma partida jugada por el piloto da la misma huella', { timeout: 120_000 }, () => {
    for (const seed of [2, 5]) {
      const runs = [true, false].map((foliage) => new Run(registry, registry.character('maia'), registry.level('medieval'), seed, { foliage }));
      expect(runs[0]!.arena.plants.grass).toBeGreaterThan(0);
      const waves = runs.map((r) => r.startWave());
      for (let t = 0; t < 1200; t++) {
        for (let k = 0; k < 2; k++) {
          const w = waves[k]!, r = runs[k]!;
          if (w.status !== 'playing') continue;
          const d = steer(r, w.player, kite(w, r));
          w.step(1 / 60, d);
        }
      }
      expect(runDigest(runs[0]!, waves[0]!, false), `semilla ${seed}`).toBe(runDigest(runs[1]!, waves[1]!, false));
    }
  });
});
