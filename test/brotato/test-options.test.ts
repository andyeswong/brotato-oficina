import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';

// Las opciones para medir de BrotatoGame (fase 4): empezar en otra oleada y que MAIA no caiga. Apagadas no cambian nada.
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const one = cube(2);
const models: Models = { model: () => one, walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const still = { dx: 0, dy: 0, stomp: false };

describe('opciones para medir', () => {
  it('apagadas, la partida es la misma que sin ellas', { timeout: 60_000 }, () => {
    const a = new BrotatoGame(registry, 4, models, player, registry.level('oficina'));
    const b = new BrotatoGame(registry, 4, models, player, registry.level('oficina'), {});
    for (let t = 0; t < 600; t++) { a.step(still); b.step(still); }
    expect(runDigest(b.run, b.current, false)).toBe(runDigest(a.run, a.current, false));
    expect(b.state.hash()).toBe(a.state.hash());
  });

  it('startWave empieza en esa oleada', () => {
    const g = new BrotatoGame(registry, 4, models, player, registry.level('oficina'), { startWave: 10 });
    expect(g.run.waveNumber).toBe(10);
  });

  it('immortal: MAIA aguanta quieta la oleada 10 entera y se juntan cientos de enemigos', { timeout: 120_000 }, () => {
    const g = new BrotatoGame(registry, 4, models, player, registry.level('oficina'), { startWave: 10, immortal: true });
    let most = 0;
    // Hasta que acaba el tiempo (quieta no caza a los que quedan en la prórroga: eso ya es jugar)
    while (g.phase === 'wave' && !g.current.overtime && g.current.status === 'playing') { g.step(still); most = Math.max(most, g.current.enemies.length); }
    expect(g.phase).toBe('wave');
    expect(g.current.time).toBeGreaterThanOrEqual(g.current.duration);
    expect(most).toBeGreaterThanOrEqual(100);
    // Sin immortal, quieta en la 10, cae
    const h = new BrotatoGame(registry, 4, models, player, registry.level('oficina'), { startWave: 10 });
    for (let t = 0; h.phase === 'wave' && t < 60 * 120; t++) h.step(still);
    expect(h.phase).toBe('dead');
  });
});
