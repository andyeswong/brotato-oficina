// Los pisos (Andrés, 2026-10-26: "que cada ronda me abra la puerta a un nuevo piso, si son 10 rondas 10 pisos, en cada
// piso debe haber una tienda"): cada oleada en su piso (floorLayout de VoxPix), tienda en cada uno y, al salir de ella,
// la salida abierta hasta el piso siguiente. Y la regla de MAIA: el horneado del piso nuevo nunca cae en una oleada.
import { describe, expect, it, vi } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { Arena } from '../../src/game/brotato/sim/arena';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { drawHud, hudText } from '../../src/game/brotato/ui/hud';
import { POINTER_MARGIN, paintPointer } from '../../src/game/brotato/ui/fx';
import type { Painter } from '../../src/game/brotato/ui/paint';
import { gameInput, playRunAsync } from './pilot';

vi.setConfig({ testTimeout: 240_000 });
const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const LEVELS = ['oficina', 'medieval', 'cyberpunk'] as const;
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };

// Andar de un punto a otro con el camino fino de la arena (el del piloto y el de la prórroga); dónde acaba, o null
// si no llega a `near` del destino
function walk(arena: Arena, from: { x: number; y: number }, to: { x: number; y: number }, near: number): { x: number; y: number } | null {
  const m = { x: from.x, y: from.y, z: arena.restZ(from.x, from.y, 5) };
  for (let t = 0; t < 4000; t++) {
    if (Math.hypot(m.x - to.x, m.y - to.y) <= near) return m;
    const d = arena.pathDir(m, to, near - 2);
    if (!d) break;
    arena.move(m, 5, d.x, d.y);
  }
  return Math.hypot(m.x - to.x, m.y - to.y) <= near ? m : null;
}

describe('los pisos', () => {
  it('cada piso tiene su mapa, y la misma semilla da los mismos pisos', () => {
    for (const id of LEVELS) {
      const level = registry.level(id);
      const hashes = [0, 1, 2, 9].map((f) => new Arena(level, 4, { floor: f }).state.hash());
      expect(new Set(hashes).size, id).toBe(4);
      expect(new Arena(level, 4, { floor: 2 }).state.hash(), id).toBe(hashes[2]);
    }
  });

  it('en cada piso se llega a la tienda y, abierta la salida, a la salida (3 temas, 10 pisos, 2 semillas)', () => {
    for (const id of LEVELS) for (const seed of [3, 17]) for (let f = 0; f < 10; f++) {
      const a = new Arena(registry.level(id), seed, { floor: f });
      const tag = `${id} s${seed} piso ${f + 1}`;
      const atShop = walk(a, a.start, a.shop, a.shop.reach);
      expect(atShop, `${tag}: tienda`).not.toBeNull();
      // Cerrada, la salida no se cruza: la loseta de dentro se alcanza, pero atExit dice que no
      expect(a.atExit(a.exit!), tag).toBe(false);
      const touched = a.openExit();
      expect(touched, tag).not.toBeNull();
      // Desde donde se quedó junto a la tienda (su centro es sólido)
      expect(walk(a, atShop!, a.exit!, a.exit!.reach), `${tag}: salida`).not.toBeNull();
      expect(a.atExit(a.exit!), tag).toBe(true);
    }
  });

  // Medieval s33, s38, s51, s53 (la curva con pisos): con la salida al este o al oeste hay suelo en la columna del borde
  // y la vegetación plantaba un vóxel fuera del mundo («vóxel fuera del mundo: -1,224,2»)
  it('abrir la salida no pone nada fuera del mundo, tampoco la vegetación del medieval', () => {
    for (const seed of [33, 38, 51, 53]) for (let f = 0; f < 10; f++) {
      const a = new Arena(registry.level('medieval'), seed, { floor: f });
      expect(() => a.openExit(), `s${seed} piso ${f + 1}`).not.toThrow();
    }
  });

  it('la salida se abre al salir de la tienda, no antes, y cruzarla lleva al piso siguiente', () => {
    const run = new Run(registry, maia, registry.level('oficina'), 5);
    const world = run.startWave();
    expect(run.arena.floor).toBe(0);
    world.status = 'open';
    world.step(1 / 60, { x: 0, y: 0 });
    expect(run.arena.exitOpen).toBe(false);
    expect(run.openExit()).toBeNull();          // aún no entró en la tienda
    world.status = 'cleared';
    run.finishWave();
    const first = run.arena;
    const out = run.openExit()!;
    expect(out.status).toBe('exit');
    expect(first.exitOpen).toBe(true);
    Object.assign(out.player, { x: first.exit!.x, y: first.exit!.y });
    out.step(1 / 60, { x: 0, y: 0 });
    expect(out.status).toBe('left');
    const next = run.startWave();
    expect(run.arena).not.toBe(first);
    expect(run.arena.floor).toBe(1);
    expect(next.time).toBe(0);
  });

  it('el horneado del piso nuevo nunca cae en una oleada: la partida espera quieta a la vista', async () => {
    // Una vista de mentira: cada cuadro da unos ticks (como FixedLoop) y, si la arena cambió, "hornea" y apunta en qué
    // estado estaba la oleada en ese momento
    const g = new BrotatoGame(registry, 8, models, player, registry.level('cyberpunk'), { immortal: true, waitFloor: true });
    let shown = g.run.arena;
    const bakes: Array<{ floor: number; status: string; time: number; awaiting: boolean }> = [];
    for (let frame = 0; frame < 60 * 60 * 20 && bakes.length < 3; frame++) {
      for (let k = 0; k < 3; k++) {
        if (g.phase === 'shop') { g.leaveShop(); continue; }
        g.step(gameInput(g));
      }
      if (g.run.arena !== shown) {
        // Mientras espera, los ticks no mueven la oleada nueva
        const t = g.current.time;
        for (let k = 0; k < 30; k++) g.step(gameInput(g));
        expect(g.current.time).toBe(t);
        bakes.push({ floor: g.run.arena.floor!, status: g.current.status, time: g.current.time, awaiting: g.awaitingFloor });
        shown = g.run.arena;
        g.floorReady();
      }
      if (frame % 600 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    expect(bakes.map((b) => b.floor)).toEqual([1, 2, 3]);
    for (const b of bakes) expect(b, JSON.stringify(b)).toEqual({ floor: b.floor, status: 'playing', time: 0, awaiting: true });
  });

  it('el piloto sube de piso y la partida se repite igual con la misma semilla', async () => {
    const play = async () => {
      const run = new Run(registry, maia, registry.level('medieval'), 11);
      const r = await playRunAsync(run);
      return { reached: r.reached, floor: run.arena.floor, digest: runDigest(run, run.world, true) };
    };
    const a = await play(), b = await play();
    expect(a).toEqual(b);
    expect(a.reached).toBeGreaterThan(2);
    expect(a.floor).toBe(Math.min(a.reached, 10) - 1);
  });

  it('el aviso de la salida cabe en las tres medidas', () => {
    const g = new BrotatoGame(registry, 5, models, player, registry.level('oficina'));
    g.current.status = 'cleared';
    g.run.finishWave();
    g.run.openExit();
    expect(hudText(g)).toContain('ve a la salida');
    for (const [width, height] of [[384, 216], [249, 218], [216, 384]] as const) {
      const outside: string[] = [], texts: string[] = [];
      const p: Painter = {
        width, height, icon: () => true,
        fill(x, y, w, h) { if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`${x},${y}`); },
        onText(t) { texts.push(t); },
      };
      drawHud(p, g, { touch: true });
      expect(outside, `${width}x${height}`).toEqual([]);
      expect(texts.join(' '), `${width}x${height}`).toContain('salida');
    }
  });
});

describe('la flecha hacia la salida o la tienda', () => {
  const canvas = (width: number, height: number) => {
    const px: Array<[number, number, string]> = [];
    const p: Painter = { width, height, icon: () => false, fill(x, y, w, h, c) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) px.push([x + i, y + j, c]); } };
    return { p, px };
  };

  it('nada si el sitio se ve; si no, en el borde de su lado y sin salirse', () => {
    for (const [W, H] of [[384, 216], [249, 218], [216, 384]] as const) {
      expect(paintPointer(canvas(W, H).p, W / 2, H / 2, '#ff00ff')).toBeNull();
      for (const [x, y, side] of [[-300, H / 2, 'w'], [W + 300, H / 2, 'e'], [W / 2, -500, 'n'], [W / 2, H + 500, 's'], [-90, -90, 'nw']] as const) {
        const { p, px } = canvas(W, H);
        const at = paintPointer(p, x, y, '#ff00ff')!;
        expect(at, `${W}x${H} ${side}`).not.toBeNull();
        expect(px.length).toBeGreaterThan(5);
        for (const [qx, qy] of px) expect(qx >= 0 && qy >= 0 && qx < W && qy < H, `${W}x${H} ${side}`).toBe(true);
        if (side === 'w') expect(at[0]).toBe(POINTER_MARGIN);
        if (side === 'e') expect(at[0]).toBe(W - POINTER_MARGIN);
        if (side === 'n') expect(at[1]).toBe(POINTER_MARGIN);
        if (side === 's') expect(at[1]).toBe(H - POINTER_MARGIN);
        // la punta (lo más lejos del centro en el acento) apunta al sitio
        const tip = px.filter((q) => q[2] === '#ff00ff').sort((a, b) => Math.hypot(b[0] - W / 2, b[1] - H / 2) - Math.hypot(a[0] - W / 2, a[1] - H / 2))[0]!;
        expect(Math.hypot(x - tip[0], y - tip[1])).toBeLessThan(Math.hypot(x - at[0], y - at[1]));
      }
    }
  });
});
