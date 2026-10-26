// El fin de la oleada (Andrés, 2026-10-25): acabado el tiempo no aparece nadie más, pero los vivos hay que matarlos;
// la oleada queda limpia (open) con tiempo cumplido y 0 vivos, y solo entonces F junto a la entrada abre la tienda.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { placeAtShop } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { OVERTIME_MAX } from '../../src/game/brotato/sim/World';
import { kite, playRunAsync } from './pilot';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const STILL = { x: 0, y: 0 };

describe('el fin de la oleada', () => {
  it('con el tiempo cumplido y enemigos vivos no se cierra, no aparece nadie y F no hace nada', () => {
    // Sin armas no mata a nadie: al acabar el tiempo quedan vivos seguro
    const run = new Run(registry, maia, registry.level('oficina'), 3, { weapons: [] });
    const world = run.startWave();
    world.player.maxHp = world.player.hp = 1e9;
    while (world.time < world.duration) world.step(1 / 60, STILL, true);
    expect(world.enemies.length).toBeGreaterThan(0);
    expect(world.status).toBe('playing');
    expect(world.overtime).toBe(true);
    expect(world.telegraphs).toHaveLength(0);
    // diez segundos más: los mismos (o menos), ninguno nuevo, y F (junto a la entrada) sin efecto
    const uids = new Set(world.enemies.map((e) => e.uid));
    for (let t = 0; t < 600; t++) {
      placeAtShop(world.player, run.arena.shop);
      world.step(1 / 60, STILL, true);
      for (const e of world.enemies) expect(uids.has(e.uid)).toBe(true);
      expect(world.status).toBe('playing');
    }
    // muertos todos, queda limpia
    for (const e of world.enemies) e.hp = 0, e.alive = false;
    world.step(1 / 60, STILL);
    expect(world.status).toBe('open');
  });

  it('en la prórroga los que quedan llegan hasta MAIA rodeando lo que haya en medio, y pasado el tope se van', () => {
    // Medieval s30: el que se quedaba tras los arbustos. MAIA sin armas y quieta: o llegan a tocarla, o se van al tope
    const run = new Run(registry, maia, registry.level('medieval'), 30, { weapons: [] });
    const world = run.startWave();
    world.player.maxHp = world.player.hp = 1e9;
    while (world.time < world.duration) world.step(1 / 60, STILL);
    const far = () => Math.max(...world.enemies.map((e) => Math.hypot(e.x - world.player.x, e.y - world.player.y)));
    expect(world.enemies.length).toBeGreaterThan(0);
    const before = far();
    for (let t = 0; t < 60 * 10; t++) world.step(1 / 60, STILL);
    expect(far()).toBeLessThan(Math.min(before, 40));
    while (world.status === 'playing' && world.time < world.duration + OVERTIME_MAX) world.step(1 / 60, STILL);
    world.step(1 / 60, STILL);
    expect(world.enemies).toHaveLength(0);
    expect(world.status).toBe('open');
  });

  it('medieval s23: el piloto acaba la oleada 1 (en línea recta un enemigo se quedaba tras los arbustos para siempre)', () => {
    const run = new Run(registry, maia, registry.level('medieval'), 23);
    const world = run.startWave();
    let left = -1;
    for (let t = 0; world.status === 'playing' && t < 60 * (world.duration + 60); t++) {
      world.step(1 / 60, kite(world, run));
      left = world.enemies.length;
    }
    expect(world.time, `quedan ${left}`).toBeLessThan(world.duration + OVERTIME_MAX);
    expect(['open', 'dead']).toContain(world.status);
  });

  it('antes de cumplir el tiempo, F junto a la entrada no hace nada', () => {
    const run = new Run(registry, maia, registry.level('medieval'), 5);
    const world = run.startWave();
    world.player.maxHp = world.player.hp = 1e9;
    for (let t = 0; t < 300; t++) {
      placeAtShop(world.player, run.arena.shop);
      world.step(1 / 60, STILL, true);
      expect(world.status).toBe('playing');
    }
  });

  it('limpia: F lejos de la entrada no hace nada; junto a ella, cierra', () => {
    const run = new Run(registry, maia, registry.level('cyberpunk'), 7);
    const world = run.startWave();
    world.time = world.duration;
    world.step(1 / 60, STILL);
    expect(world.status).toBe('open');
    const s = run.arena.shop;
    expect(Math.hypot(world.player.x - s.x, world.player.y - s.y)).toBeGreaterThan(s.reach);   // sale lejos (70+)
    for (let t = 0; t < 60; t++) world.step(1 / 60, STILL, true);
    expect(world.status).toBe('open');
    placeAtShop(world.player, s);
    expect(world.atShop).toBe(true);
    world.step(1 / 60, STILL, true);
    expect(world.status).toBe('cleared');
  });

  it('la última oleada no tiene tienda: limpia, se cierra sola', () => {
    const run = new Run(registry, maia, registry.level('oficina'), 2);
    run.waveIndex = run.level.waves.length - 1;
    const world = run.startWave();
    world.time = world.duration;
    world.step(1 / 60, STILL);
    expect(world.status).toBe('cleared');
  });

  it('la entrada a la tienda: en el medieval, la fuente; en todo tema, alcanzable desde la salida', () => {
    for (const id of ['oficina', 'medieval', 'cyberpunk']) for (const seed of [1, 2, 3]) {
      const run = new Run(registry, maia, registry.level(id), seed);
      const s = run.arena.shop, f = run.arena.world.fountain;
      if (id === 'medieval') expect(f && Math.hypot(f.x - s.x, f.y - s.y)).toBe(0);
      // algún punto a su alcance donde cabe MAIA
      let ok = false;
      for (let k = 0; k < 16 && !ok; k++) {
        const a = (k * Math.PI) / 8;
        ok = run.arena.fits(s.x + Math.cos(a) * (s.reach - 2), s.y + Math.sin(a) * (s.reach - 2), run.arena.floorZ, run.body.radius);
      }
      expect(ok, `${id} s${seed}`).toBe(true);
    }
  });

  it('oficina y cyberpunk llevan su adorno (impresora, servidor) estampado y sólido en la caja del resalte', () => {
    for (const id of ['oficina', 'cyberpunk']) {
      const run = new Run(registry, maia, registry.level(id), 4);
      const [x0, y0, z0, x1, y1, z1] = run.arena.shopBox;
      expect(z0).toBeGreaterThanOrEqual(1);
      let solid = 0;
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (run.arena.state.solidAt(x + 0.5, y + 0.5, z)) solid++;
      expect(solid, id).toBeGreaterThan(2000);   // la impresora tiene 5570 vóxeles, el servidor 7236
      expect(run.arena.fits(run.arena.shop.x, run.arena.shop.y, run.arena.floorZ, run.body.radius), id).toBe(false);
    }
  });

  // Asíncrona (cede entre oleadas): dos partidas enteras seguidas sin soltar el hilo tumbaban al trabajador de vitest
  // en oficina (Timeout calling onTaskUpdate) y el despliegue se paraba con todo en verde
  it('el piloto va a la entrada y entra: la partida entera es determinista', async () => {
    const play = async () => { const r = new Run(registry, maia, registry.level('medieval'), 9); const out = await playRunAsync(r); return { out, d: runDigest(r, r.world!, false) }; };
    const a = await play(), b = await play();
    expect(a.out.reached).toBeGreaterThan(1);   // pasó al menos una tienda
    expect(a.out).toEqual(b.out);
    expect(a.d).toBe(b.d);
  });
});
