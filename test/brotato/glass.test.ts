import { describe, expect, it } from 'vitest';
import { bakeWorld } from '@voxpix/world/bake';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { GLASS_RAMPS } from '../../src/game/brotato/sim/glass';
import { kite, steer } from './pilot';

// El vidrio (src/game/brotato/sim/glass.ts): ventanas y pantallas en oficina y cyberpunk. Deja pasar la luz y la partida
// es la misma con y sin él
const { registry } = validateContent(discoverContent());
const run = (level: string, seed: number, glass = true) => new Run(registry, registry.character('maia'), registry.level(level), seed, { glass });

describe('el vidrio', () => {
  it('oficina y cyberpunk lo llevan en sus ventanas y pantallas; medieval no', { timeout: 60_000 }, () => {
    for (const lv of ['oficina', 'cyberpunk']) {
      const r = run(lv, 2);
      expect(r.arena.glassRamps, lv).toBe(GLASS_RAMPS.length);
      const glassy = r.arena.world.model.palette.ramps.filter((x) => x.material === 'vidrio').map((x) => x.name);
      expect(glassy.sort(), lv).toEqual([...GLASS_RAMPS].sort());
    }
    expect(run('medieval', 2).arena.glassRamps).toBe(0);
  });

  // La luz horneada va en los pesos de cada luz (el color del horneado es sin iluminar). En oficina con la semilla 2 hay
  // luces detrás de ventanas y pantallas: con vidrio les llega más (en cyberpunk con esa semilla, ninguna)
  it('deja pasar la luz: con vidrio la luz horneada llega más lejos', { timeout: 60_000 }, () => {
    const bake = (glass: boolean) => bakeWorld(run('oficina', 2, glass).arena.world, { topZ: 40, incline: 0.5 }).lights;
    const sum = (ls: ReturnType<typeof bake>) => ls.reduce((t, l) => t + l.weight.reduce((u, w) => u + w, 0), 0);
    const a = bake(true), b = bake(false);
    expect(a.length).toBe(b.length);
    expect(sum(a)).toBeGreaterThan(sum(b));
  });

  it('la partida es la misma con y sin vidrio', { timeout: 120_000 }, () => {
    for (const [lv, seed] of [['oficina', 2], ['cyberpunk', 5]] as const) {
      const runs = [true, false].map((g) => run(lv, seed, g));
      const waves = runs.map((r) => r.startWave());
      for (let t = 0; t < 1200; t++) for (let k = 0; k < 2; k++) {
        const w = waves[k]!, r = runs[k]!;
        if (w.status === 'playing') w.step(1 / 60, steer(r, w.player, kite(w, r)));
      }
      expect(runDigest(runs[0]!, waves[0]!, false), lv).toBe(runDigest(runs[1]!, waves[1]!, false));
    }
  });
});
