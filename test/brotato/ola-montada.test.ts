// ?ola= arranca en un piso que no se cruzó por la salida: tiene que estar montado entero, con la misma colisión que uno
// sin vista. Con la caída retenida se quedaba sin paredes, muebles ni mamparas, y solo se veía el suelo.
import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';

const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };

describe('?ola= con vista', () => {
  for (const level of ['oficina', 'medieval', 'cyberpunk']) {
    it(`${level}: el piso está montado, igual que sin vista`, () => {
      const seed = 7, level_ = registry.level(level);
      const g = new BrotatoGame(registry, seed, models, player, level_, { startWave: 4, waitFloor: true });
      const run = new Run(registry, registry.character('maia'), level_, seed);
      run.waveIndex = 3;
      run.startWave();
      expect(g.run.arena.fall ?? null).toBeNull();
      const a = g.run.arena.state.solid, b = run.arena.state.solid;
      let solid = 0, differ = 0;
      for (let x = 0; x < a.width; x += 3) for (let y = 0; y < a.depth; y += 3) for (let z = 1; z < 24; z += 2) {
        if (a.get(x, y, z)) solid++;
        if (!!a.get(x, y, z) !== !!b.get(x, y, z)) differ++;
      }
      expect(solid).toBeGreaterThan(100);
      expect(differ).toBe(0);
    }, 60_000);
  }
});
