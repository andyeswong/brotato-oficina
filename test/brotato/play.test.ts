import { describe, expect, it } from 'vitest';
import { Model, material } from '../../src/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';
import type { TickInput } from '../../src/game/runtime';

// La partida y su reflejo en el mundo (src/game/brotato/play.ts): determinista como la simulación, y cada cosa que
// se ve de la oleada tiene su entidad (y deja de tenerla cuando se va).
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => ({ frames: [cube(3), cube(4)], ms: 100 }) };
const player = { model: cube(6), walk: [cube(7), cube(8)], walkMs: 100 };

function input(t: number): TickInput {
  const a = Math.floor(t / 90) * 1.7;
  return { dx: Math.cos(a), dy: Math.sin(a), stomp: false };
}

describe('la partida en el mundo', () => {
  it('misma semilla y misma entrada: el mismo mundo (entidades incluidas) y la misma partida', { timeout: 60_000 }, () => {
    const a = new BrotatoGame(registry, 5, models, player, registry.level('oficina'));
    const b = new BrotatoGame(registry, 5, models, player, registry.level('oficina'));
    for (let t = 0; t < 900; t++) { a.step(input(t)); b.step(input(t)); }
    expect(a.state.hash()).toBe(b.state.hash());
    expect(runDigest(a.run, a.current, false)).toBe(runDigest(b.run, b.current, false));
  });

  it('cada enemigo, disparo y material de la oleada tiene su entidad, y ninguna sobra', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 7, models, player, registry.level('medieval'));
    let seenEnemies = 0;
    for (let t = 0; t < 900 && g.phase === 'wave'; t++) {
      g.step(input(t));
      const w = g.current;
      seenEnemies = Math.max(seenEnemies, w.enemies.length);
      // MAIA + sus armas + enemigos + disparos + materiales (sin luz en la mano en esta prueba)
      expect(g.state.entities.length).toBe(1 + w.weapons.length + w.enemies.length + w.projectiles.length + w.materials.length);
    }
    expect(seenEnemies).toBeGreaterThan(0);
  });

  it('la oleada superada para la partida hasta seguir, y seguir empieza la siguiente', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('cyberpunk'));
    for (let t = 0; t < 60 * 30 && g.phase === 'wave'; t++) g.step(input(t));
    expect(g.phase).toBe('cleared');
    const tick = g.tick, time = g.current.time;
    g.step(input(0));
    expect(g.current.time).toBe(time);                 // parada: la oleada no avanza
    expect(g.tick).toBe(tick + 1);                     // pero el mundo sí (agua, gotas)
    g.nextWave();
    expect(g.phase).toBe('wave');
    expect(g.run.waveNumber).toBe(2);
  });
});
