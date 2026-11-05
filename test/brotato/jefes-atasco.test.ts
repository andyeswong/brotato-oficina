import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';

// Bosses that did not fit where they spawned, or stood still behind a column: the three fixes that keep them coming.
const { registry } = validateContent(discoverContent());
const T = 1 / 60;

function bossWave(level: string, seed: number, boss: string, warm = 0, full = false) {
  const run: any = new Run(registry, registry.character('maia'), registry.level(level), seed, { boss } as any);
  run.waveIndex = 9;
  if (warm) run.arena.warmPath(warm);
  const w: any = run.startWave();
  // Only the boss: the rest of the wave costs time and these tests are about it
  const keepAlive = () => { w.player.maxHp = 1e7; w.player.hp = 1e7; if (!full) for (let i = w.enemies.length - 1; i >= 0; i--) if (!w.enemies[i].def.boss) w.enemies.splice(i, 1); };
  for (let i = 0; i < 60 * 40 && !w.enemies.some((e: any) => e.def.boss); i++) { keepAlive(); w.step(T, { x: 0, y: 0 }); }
  return { run, w, a: run.arena, b: w.enemies.find((e: any) => e.def.boss), keepAlive };
}

describe('boss spawn', () => {
  // The seeds where each one used to spawn wedged into a wall in the medieval level
  it.each([['jefe', 37], ['jefe', 47], ['golem', 6], ['golem', 7], ['arana', 37]])('%s fits where it appears (seed %i)', { timeout: 120_000 }, (boss, seed) => {
    // The whole wave: it draws from the same dice as the boss's spawn point
    const { a, b, w } = bossWave('medieval', seed as number, boss as string, 0, true);
    expect(a.fits(b.x, b.y, a.restZ(b.x, b.y, b.def.radius), b.def.radius)).toBe(true);
    expect(w.bossNoFit).toBe(false);
    const i = a.inner;
    expect(b.x >= i.x0 && b.x <= i.x1 && b.y >= i.y0 && b.y <= i.y1).toBe(true);
  });

  it('nearestFit leaves a point that fits alone, and answers null when nothing does', { timeout: 120_000 }, () => {
    const { a, w } = bossWave('medieval', 1, 'jefe');
    const free = a.free.find((f: any) => a.fits(f.x, f.y, a.floorZ, 12));
    expect(a.nearestFit(free, 12, w.player, 0)).toBe(free);
    expect(a.nearestFit(free, 400, w.player, 0)).toBeNull();
  });
});

describe('boss path grid', () => {
  it('warming it behind the sign changes nothing in the run', { timeout: 120_000 }, () => {
    const pass = (warm: number) => {
      const { w, b, keepAlive } = bossWave('medieval', 5, 'golem', warm);
      let h = 0;
      for (let i = 0; i < 60 * 50 && w.status === 'playing'; i++) {
        keepAlive(); w.step(T, { x: Math.cos(i * T), y: Math.sin(i * T) });
        h = (Math.imul(h, 31) + Math.round(b.x * 100) + Math.round(b.y * 100)) | 0;
      }
      expect(w.overtime).toBe(true);
      return h;
    };
    expect(pass(12)).toBe(pass(0));
  });

  it('updating it after a smash gives the same as remaking it', { timeout: 120_000 }, () => {
    const { a, w, b } = bossWave('medieval', 3, 'golem');
    a.warmPath(b.def.radius);
    a.pathDir(b, w.player, undefined, b.def.radius);
    const col = [...a.state.objects].find((o: any) => o.mass > 500) as any;
    expect(col).toBeTruthy();
    a.furniture.smash(col.id);
    for (let i = 0; i < 120; i++) { a.stepObjects(); a.pathDir(b, w.player, undefined, b.def.radius); }
    const kept = Uint8Array.from(a.bigFlow.get(b.def.radius).ok);
    a.bigFlow.clear();
    a.pathDir(b, w.player, undefined, b.def.radius);
    expect([...kept].filter((v, i) => v !== a.bigFlow.get(b.def.radius).ok[i]).length).toBe(0);
  });

  it('does not touch the grid of everybody else', { timeout: 120_000 }, () => {
    const { a, w, b } = bossWave('medieval', 3, 'golem');
    const before = a.pathDir({ x: 100, y: 100 }, w.player);
    a.pathDir(b, w.player, undefined, b.def.radius);
    expect(a.pathDir({ x: 100, y: 100 }, w.player)).toEqual(before);
  });
});

describe('golem walking', () => {
  // The way ?jefecolumna does it: everybody heads for the column nearest the boss
  function lured(seed: number) {
    const { a, w, b, keepAlive } = bossWave('medieval', seed, 'golem');
    const columns = () => [...a.state.objects].filter((o: any) => o.mass > 500);
    const start = columns().length, inner = { ...a.inner };
    let h = 0;
    for (let i = 0; i < 60 * 38 && w.status === 'playing'; i++) {
      let best: any = null, bd = Infinity;
      for (const o of columns() as any[]) {
        const r = a.furniture.rect(o.id); if (!r) continue;
        const c = { x: (r.x0 + r.x1 + 1) / 2, y: (r.y0 + r.y1 + 1) / 2 }, d = Math.hypot(c.x - b.x, c.y - b.y);
        if (d < bd) { bd = d; best = c; }
      }
      w.lure = best; keepAlive(); w.step(T, { x: 0, y: 0 });
      h = (Math.imul(h, 31) + Math.round(b.x * 100) + Math.round(b.y * 100)) | 0;
    }
    return { broken: start - columns().length, h, a, inner };
  }

  it('breaks columns, the same ones in two passes, and leaves the walls alone', { timeout: 120_000 }, () => {
    const x = lured(3), y = lured(3);
    expect(x.broken).toBeGreaterThan(0);
    expect(y.broken).toBe(x.broken);
    expect(y.h).toBe(x.h);
    expect(x.a.inner).toEqual(x.inner);
    // A wall is not an object: outside the inner rectangle nothing has opened up
    const i = x.inner, opened: number[] = [];
    for (let k = 0; k < x.a.world.width; k += 3) for (const v of [i.y0 - 6, i.y1 + 6]) if (x.a.fits(k, v, x.a.floorZ, 1)) opened.push(k);
    const clean = bossWave('medieval', 3, 'golem').a; const before: number[] = [];
    for (let k = 0; k < clean.world.width; k += 3) for (const v of [i.y0 - 6, i.y1 + 6]) if (clean.fits(k, v, clean.floorZ, 1)) before.push(k);
    expect(opened).toEqual(before);
  });
});
