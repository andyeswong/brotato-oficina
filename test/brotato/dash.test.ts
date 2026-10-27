// El dash (Andrés, 2026-10-26: "como mejora global el dash, 1, 2 o 3 dashes"): Esprint en el árbol de mejoras da las
// cargas. Un tramo fijo con invulnerabilidad, que la pared para, y las cargas vuelven de una en una.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { DASH_DISTANCE, DASH_RECHARGE, DASH_TIME } from '../../src/game/brotato/sim/World';
import { UPGRADES, metaDashCharges } from '../../src/game/brotato/meta/upgrades';
import { metaKey, treeOrder } from '../../src/game/brotato/ui/meta';
import { drawHud } from '../../src/game/brotato/ui/hud';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import type { Painter, Zone } from '../../src/game/brotato/ui/paint';
import { Model, material } from '@voxpix/core';

vi.setConfig({ testTimeout: 60_000 });
const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const DT = 1 / 60, STILL = { x: 0, y: 0 };

// Una oleada sin armas ni enemigos que molesten: MAIA en el centro libre del interior
function wave(dash: number) {
  const run = new Run(registry, maia, registry.level('oficina'), 7, { weapons: [], meta: dash ? { dash } : {} });
  const world = run.startWave();
  world.player.maxHp = world.player.hp = 1e9;
  return { run, world };
}

describe('el dash', () => {
  it('Esprint da 1, 2 o 3 cargas, cuelga de Juego de pies y tiene tecla en el árbol', () => {
    const u = UPGRADES.find((x) => x.id === 'dash')!;
    expect(u.requires).toBe('esquiva');
    expect(u.costs).toHaveLength(3);
    expect([0, 1, 2, 3, 9].map((n) => metaDashCharges({ dash: n }))).toEqual([0, 1, 2, 3, 3]);
    const index = treeOrder().findIndex((r) => r.u.id === 'dash');
    const code = index === 10 ? 'Minus' : index === 9 ? 'Digit0' : `Digit${index + 1}`;
    expect(metaKey({ code, key: '' })).toEqual({ type: 'upgrade', id: 'dash' });
  });

  it('sin Esprint no hay dash: la tecla no hace nada y la huella es la de siempre', () => {
    const a = wave(0), b = wave(0);
    for (let t = 0; t < 120; t++) { a.world.step(DT, { x: 1, y: 0 }); b.world.step(DT, { x: 1, y: 0 }, false, t % 10 === 0); }
    expect(a.world.dash.max).toBe(0);
    expect(runDigest(b.run, b.world, false)).toBe(runDigest(a.run, a.world, false));
  });

  it('recorre su tramo en DASH_TIME, invulnerable, gasta una carga y la recupera en DASH_RECHARGE', () => {
    const { world } = wave(2);
    const p = world.player;
    expect(world.dash.charges).toBe(2);
    const x0 = p.x, y0 = p.y;
    world.step(DT, STILL, false, true);         // sin moverse: hacia donde miraba (la cámara, -y)
    expect(world.dash.charges).toBe(1);
    expect(p.iframes).toBeGreaterThan(DASH_TIME);
    // un toque mientras dura no encadena otro
    world.step(DT, STILL, false, true);
    expect(world.dash.charges).toBe(1);
    for (let t = 0; t < Math.ceil(DASH_TIME / DT) + 2; t++) world.step(DT, STILL);
    expect(world.dash.t).toBe(0);
    const moved = Math.hypot(p.x - x0, p.y - y0);
    // o el tramo entero, o la pared lo paró antes (nunca más lejos)
    expect(moved).toBeLessThanOrEqual(DASH_DISTANCE + 1e-6);
    expect(p.x).toBeCloseTo(x0, 6);
    expect(p.y).toBeLessThan(y0);
    for (let t = 0; t < Math.ceil(DASH_RECHARGE / DT) + 1; t++) world.step(DT, STILL);
    expect(world.dash.charges).toBe(2);
  });

  it('va hacia donde se anda, llega más lejos que andando y la pared lo para', () => {
    const { run, world } = wave(3);
    const p = world.player;
    // En campo abierto: el centro libre más alejado de las paredes, hacia +x
    const free = run.arena.spawnPoints.filter((s) => [...Array(12)].every((_, k) => run.arena.fits(s.x + k * 4, s.y, p.z, 6)));
    expect(free.length).toBeGreaterThan(0);
    Object.assign(p, { x: free[0]!.x, y: free[0]!.y });
    const x0 = p.x;
    world.step(DT, { x: 1, y: 0 }, false, true);
    for (let t = 0; t < Math.ceil(DASH_TIME / DT); t++) world.step(DT, STILL);
    expect(p.x - x0).toBeGreaterThan(DASH_DISTANCE * 0.9);
    // Contra la pared este: las tres cargas seguidas y no sale del interior
    for (let k = 0; k < 2; k++) {
      world.step(DT, { x: 1, y: 0 }, false, true);
      for (let t = 0; t < Math.ceil(DASH_TIME / DT); t++) world.step(DT, { x: 1, y: 0 });
    }
    for (let t = 0; t < 600; t++) world.step(DT, { x: 1, y: 0 }, false, t % 40 === 0);
    expect(run.arena.fits(p.x, p.y, p.z, 5)).toBe(true);
    expect(p.x).toBeLessThan(run.arena.inner.x1);
  });

  it('el mismo dash da la misma partida (determinista)', () => {
    const play = () => {
      const { run, world } = wave(2);
      for (let t = 0; t < 900; t++) world.step(DT, { x: Math.cos(t / 50), y: Math.sin(t / 70) }, false, t % 37 === 0);
      return runDigest(run, world, false);
    };
    expect(play()).toBe(play());
  });

  it('el HUD enseña las cargas y, en táctil, el botón de dash dentro de la pantalla en las tres medidas', () => {
    const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
    const cube = new Model(pal, 'c'); cube.set(0, 0, 0, material(0, 1));
    const models: Models = { model: () => cube, walk: () => null };
    const game = new BrotatoGame(registry, 7, models, { model: cube, walk: [cube], walkMs: 100 }, registry.level('oficina'), { meta: { dash: 3 } });
    for (const [width, height] of [[384, 216], [249, 218], [216, 384]] as const) {
      const outside: string[] = [];
      const p: Painter = {
        width, height, icon: () => true,
        fill(x, y, w, h) { if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`${x},${y} ${w}x${h}`); },
        onText(t, x, y) { if (x < 0 || y < 0 || x > width || y > height) outside.push(t); },
      };
      const zones: Zone<unknown>[] = drawHud(p, game, { touch: true });
      expect(outside, `${width}x${height}`).toEqual([]);
      const btn = zones.find((z) => (z.action as { type: string }).type === 'dash');
      expect(btn, `${width}x${height}`).toBeDefined();
      // no pisa los botones de girar
      for (const z of zones) if (z !== btn) expect(z.y + z.h <= btn!.y || z.y >= btn!.y + btn!.h || z.x + z.w <= btn!.x || z.x >= btn!.x + btn!.w).toBe(true);
    }
  });
});
