// La puerta de la salida se desmorona (Andrés, pisos): al salir de la tienda la pared del hueco cae en piezas hacia
// fuera, tick a tick, mientras MAIA anda hasta ella. El hueco se cruza desde el primer tick: las piezas ya no están en
// el mundo, solo se dibujan
import { describe, expect, it, vi } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { skipTo } from '../../src/game/brotato/skip';

vi.setConfig({ testTimeout: 240_000 });
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const still = { dx: 0, dy: 0, stomp: false };

describe('la puerta de la salida', () => {
  for (const [level, seed] of [['oficina', 7], ['medieval', 3], ['cyberpunk', 11]] as const) {
    it(`se desmorona en piezas que salen hacia fuera y desaparecen; el hueco se cruza ya (${level})`, () => {
      const g = new BrotatoGame(registry, seed, models, player, registry.level(level), { immortal: true });
      expect(skipTo(g, 'salida').reached).toBe(true);
      const a = g.run.arena, exit = a.exit!, fall = a.exitFall!;
      expect(fall).not.toBeNull();
      const pieces = fall.active;
      expect(pieces).toBeGreaterThan(10);
      // Cruzable en el acto: MAIA cabe en la loseta del hueco
      expect(a.fits(exit.x, exit.y, a.floorZ, 5)).toBe(true);
      // Las piezas aparecen como entidades y se van alejando hacia fuera
      const ents0 = a.state.entities.length;
      let ticks = 0, most = ents0;
      while (a.exitFall && ticks < 60 * 10) { g.step(still); ticks++; most = Math.max(most, a.state.entities.length); }
      const ents1 = a.state.entities.length;
      console.log(`PUERTA ${level}: ${pieces} piezas, ${ticks} ticks (${(ticks / 60).toFixed(1)} s), entidades ${ents0} -> máx ${most} -> ${ents1}`);
      expect(a.exitFall).toBeNull();
      expect(most - ents1).toBeGreaterThan(10);   // las piezas se dibujaron y ya no están
      expect(ticks).toBeLessThan(60 * 4);   // se acaba antes de que MAIA llegue a la salida desde la tienda
      // MAIA sigue pudiendo salir
      Object.assign(g.current.player, { x: exit.x, y: exit.y });
      for (let t = 0; t < 600 && g.run.floor < 1; t++) g.step(still);
      expect(g.run.floor).toBe(1);
    });
  }
});
