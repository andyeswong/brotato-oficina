// La pausa del modo vóxel (app/src/juego/voxel.ts, ?dev): mientras se mira, el reloj fijo no avanza y frame3D solo
// lee el mundo. Pausar a mitad de oleada, pintar unas vistas y seguir da la misma partida que no pausar.
import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { FixedLoop, type TickInput } from '@voxpix/runtime/runtime';
import { frame3D } from '@voxpix/world/frame3d';
import { TICK } from '@voxpix/world/state';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';

const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const modelCache = new Map<string, Model>(), walkCache = new Map<string, { frames: Model[]; ms: number }>();
const models: Models = {
  model: (ref) => modelCache.get(ref) ?? (modelCache.set(ref, cube(2)), modelCache.get(ref)!),
  walk: (ref, role) => walkCache.get(`${ref}|${role}`) ?? (walkCache.set(`${ref}|${role}`, { frames: [cube(3), cube(4)], ms: 100 }), walkCache.get(`${ref}|${role}`)!),
};
const player = { model: cube(6), walk: [cube(7), cube(8)], walkMs: 100 };

function input(t: number): TickInput {
  const a = Math.floor(t / 90) * 1.7;
  return { dx: Math.cos(a), dy: Math.sin(a), stomp: false };
}

// Una partida con el reloj fijo del juego, a cuadros de 60 Hz; en `pauseAt` se para `pausedFrames` cuadros
function play(pauseAt: number, pausedFrames: number, look: boolean) {
  const g = new BrotatoGame(registry, 11, models, player, registry.level('oficina'));
  const loop = new FixedLoop(g, input, 10);
  for (let f = 0; f < 600; f++) {
    if (f === pauseAt) for (let p = 0; p < pausedFrames; p++) {
      if (!look) continue;
      const me = g.state.entities.get(g.playerId)!;
      frame3D(g.state, { width: 64, height: 48, center: [Math.round(me.x), Math.round(me.y)], radius: 48, yaw: -30 + p * 40, elevation: 35, zoom: 3, time: p, lights: true, ambient: g.run.arena.ambient, outline: 'both' });
    }
    loop.advance(TICK);
  }
  return { ticks: g.tick, hash: g.state.hash(), digest: runDigest(g.run, g.current, false) };
}

describe('la pausa del modo vóxel', () => {
  it('pausar y mirar el mundo en vóxeles no cambia la partida', { timeout: 120_000 }, () => {
    const straight = play(-1, 0, false);
    const paused = play(300, 4, true);
    expect(paused.ticks).toBe(600);
    expect(paused.hash).toBe(straight.hash);
    expect(paused.digest).toBe(straight.digest);
  });
});
