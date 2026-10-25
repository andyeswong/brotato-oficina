import { describe, expect, it } from 'vitest';
import { Model, material, type VoxelSource } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, CLEARED_TICKS, type Models } from '../../src/game/brotato/play';
import { Run } from '../../src/game/brotato/sim/Run';
import { TICK } from '@voxpix/world/state';
import { runDigest } from '../../src/game/brotato/sim/digest';
import type { TickInput } from '@voxpix/runtime/runtime';

// La partida y su reflejo en el mundo (src/game/brotato/play.ts): determinista como la simulación, y cada cosa que
// se ve de la oleada tiene su entidad (y deja de tenerla cuando se va).
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
// Como la vista: un modelo por referencia y unos cuadros de andar por modelo y papel, siempre los mismos objetos
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
    const yaws = new Set<number>();
    const seenModels = new Set<VoxelSource>();
    for (let t = 0; t < 900 && g.phase === 'wave'; t++) {
      g.step(input(t));
      const w = g.current;
      seenEnemies = Math.max(seenEnemies, w.enemies.length);
      // MAIA + sus armas + enemigos + disparos + materiales (sin luz en la mano en esta prueba)
      expect(g.state.entities.length).toBe(1 + w.weapons.length + w.enemies.length + w.projectiles.length + w.materials.length);
      // y todas en uno de los 8 rumbos: un giro continuo es un sprite nuevo en la caché del compositor por cuadro
      for (const e of g.state.entities) yaws.add(e.yaw);
      for (const e of g.state.entities) seenModels.add(e.model);
    }
    expect(seenEnemies).toBeGreaterThan(0);
    expect([...yaws].every((y) => y % 45 === 0 && y >= 0 && y < 360), [...yaws].join(' ')).toBe(true);
    // y todo modelo que llegó a verse está en la lista para precalentar (game.models())
    const listed = new Set(g.preloadModels().map((it) => it.model));
    for (const m of seenModels) expect(listed.has(m), 'un modelo visto que no está en preloadModels()').toBe(true);
  });

  it('la oleada superada: un respiro, la tienda (el mundo sigue, la oleada no) y salir empieza la siguiente', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('cyberpunk'));
    for (let t = 0; t < 60 * 30 && g.phase === 'wave'; t++) g.step(input(t));
    expect(g.phase).toBe('cleared');
    expect(g.run.waveIndex).toBe(1);                    // cerrada en el acto, como el Brotato
    for (let t = 0; t < CLEARED_TICKS; t++) { expect(g.phase).toBe('cleared'); g.step(input(0)); }
    expect(g.phase).toBe('shop');
    expect(g.run.shop.offers.length).toBe(registry.level('cyberpunk').shop.slots);
    const tick = g.tick, time = g.current.time;
    g.step(input(0));
    expect(g.current.time).toBe(time);                 // parada: la oleada no avanza
    expect(g.tick).toBe(tick + 1);                     // pero el mundo sí (agua, gotas)
    g.leaveShop();
    expect(g.phase).toBe('wave');
    expect(g.run.waveNumber).toBe(2);
  });

  // La huella sin el mundo de vóxeles: el juego lo hace avanzar (agua, entidades) y el Run solo no; la simulación,
  // en cambio, tiene que ser la misma tick a tick (comprobado: solo se separan en el tick en que se cierra la oleada,
  // que el juego cierra en el acto y aquí se cierra después)
  it('comprar en la tienda del juego es comprar en la del Run: la misma huella que la partida sin vista', { timeout: 120_000 }, () => {
    const g = new BrotatoGame(registry, 11, models, player, registry.level('oficina'));
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 11);
    let wave = run.startWave();
    let t = 0, shops = 0;
    for (let round = 0; round < 3 && g.phase !== 'dead' && g.phase !== 'victory'; round++) {
      // Una oleada en los dos, con la misma entrada
      while (g.phase === 'wave') {
        const i = input(t++);
        g.step(i);
        const len = Math.hypot(i.dx, i.dy);
        wave.step(TICK, len > 0 ? { x: i.dx / len, y: i.dy / len } : { x: 0, y: 0 });
      }
      if (g.phase !== 'cleared') break;
      while (g.phase === 'cleared') g.step(input(0));
      run.finishWave();
      run.shop.open();
      // Las mismas compras: todo lo que alcance, de izquierda a derecha, y una tirada si sobra
      for (const r of [g.run, run]) {
        r.shop.offers.forEach((_o, k) => r.shop.buy(k));
        r.shop.reroll();
        r.shop.buy(0);
      }
      expect(runDigest(g.run, g.current, false)).toBe(runDigest(run, wave, false));
      g.leaveShop();
      wave = run.startWave();
      shops++;
    }
    expect(shops).toBeGreaterThanOrEqual(1);   // al menos una tienda, y la oleada de después jugada con lo comprado
    expect(g.run.items.length + g.run.weapons.length).toBeGreaterThan(registry.character('maia').startingWeapons!.length);
    expect(runDigest(g.run, g.current, false)).toBe(runDigest(run, wave, false));
  });
});
