import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { skipTo } from '../../src/game/brotato/skip';

// El salto de ?ir=: MAIA no cae mientras simula y vuelve a poder caer al llegar
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const one = cube(2);
const models: Models = { model: () => one, walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };

describe('salto de ?ir=', () => {
  // Medieval s3 y cyberpunk s11: quieta, MAIA caía en la oleada 1 antes de la tienda (el Flip, 2026-10-27)
  for (const [level, seed] of [['medieval', 3], ['cyberpunk', 11]] as const) {
    it(`${level} s${seed}: llega al piso 2 sin caer`, { timeout: 120_000 }, () => {
      const g = new BrotatoGame(registry, seed, models, player, registry.level(level), { waitFloor: true });
      const r = skipTo(g, 'piso2');
      expect(r).toEqual({ reached: true, phase: 'wave' });
      expect(g.run.floor).toBe(1);
    });
  }

  it('al llegar, MAIA vuelve a poder caer', { timeout: 120_000 }, () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('medieval'), { waitFloor: true });
    expect(skipTo(g, 'tienda').reached).toBe(true);
    expect(g.guarded).toBe(false);
    g.leaveShop();
    while (g.awaitingFloor || g.current.status === 'exit') {
      if (g.awaitingFloor) g.floorReady();
      const exit = g.run.arena.exit;
      if (g.current.status === 'exit' && exit) Object.assign(g.current.player, { x: exit.x, y: exit.y });
      g.step({ dx: 0, dy: 0, stomp: false });
    }
    for (let t = 0; t < 60 * 120 && g.phase === 'wave'; t++) g.step({ dx: 0, dy: 0, stomp: false });
    expect(g.phase).toBe('dead');
  });

  it('?ir=fin no protege: llega al fin con MAIA cayendo (el de verify)', { timeout: 120_000 }, () => {
    const g = new BrotatoGame(registry, 5, models, player, registry.level('oficina'), { waitFloor: true });
    expect(skipTo(g, 'fin')).toEqual({ reached: true, phase: 'dead' });
    expect(g.run.floor).toBeLessThanOrEqual(1);
  });

  it('sin el salto la partida no cambia (guarded apagado por defecto)', () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('medieval'));
    expect(g.guarded).toBe(false);
  });
});
