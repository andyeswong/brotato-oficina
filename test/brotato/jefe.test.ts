// El jefe del piso 10 (Andrés y MAIA, 2026-10-29). Las cuatro condiciones de MAIA: (a) en los tres mundos hay forma de
// aturdirlo; (b) romper una columna cabe en el presupuesto de piezas, y con el presupuesto lleno rompe y aturde igual,
// sin piezas; (c) la oleada 10 tiene tope de tiempo: sin matar al jefe, derrota; (d) los saltos de ?ir= no se cuelgan
import { describe, expect, it, vi } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { BOSS_OVERTIME, type EnemyState } from '../../src/game/brotato/sim/World';
import { PIECE_BUDGET, STRUCTURE_KG } from '../../src/game/brotato/sim/furniture';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { skipTo } from '../../src/game/brotato/skip';
import { hudText } from '../../src/game/brotato/ui/hud';

vi.setConfig({ testTimeout: 240_000 });
const { registry } = validateContent(discoverContent());
const TICK = 1 / 60;
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const still = { dx: 0, dy: 0, stomp: false };

// Una oleada en calma con solo el jefe, puesto en (x, y), y MAIA en (px, py), inmortal
function arenaWithBoss(level: string, seed: number) {
  const run = new Run(registry, registry.character('maia'), registry.level(level), seed);
  const w = run.startWave();
  return { run, w, a: run.arena };
}
function place(w: ReturnType<typeof arenaWithBoss>['w'], x: number, y: number, px: number, py: number): EnemyState {
  w.enemies.length = 0; w['telegraphs'].length = 0;
  w['addEnemy'](registry.enemy('jefe'), x, y);
  Object.assign(w.player, { x: px, y: py });
  return w.enemies[0]!;
}
// Pasos con solo el jefe (los demás que salgan se quitan) hasta que se aturda o pasen `ticks`
function until(w: ReturnType<typeof arenaWithBoss>['w'], boss: EnemyState, ticks: number, stop: () => boolean) {
  for (let t = 0; t < ticks && !stop(); t++) {
    for (let i = w.enemies.length - 1; i >= 0; i--) if (w.enemies[i] !== boss) w.enemies.splice(i, 1);
    w['telegraphs'].length = 0;
    w.player.hp = w.player.maxHp;
    w.step(TICK, { x: 0, y: 0 });
  }
}
const stuns = (b: EnemyState) => b.mem.stuns ?? 0;

describe('el jefe', () => {
  for (const [level, seed] of [['oficina', 7], ['medieval', 3], ['cyberpunk', 11]] as const) {
    it(`se aturde al embestir contra la pared de la sala (${level})`, () => {
      const { w, a } = arenaWithBoss(level, seed);
      // Una fila con 80 vóxeles libres desde la pared oeste: la pared es el primer x donde cabe el jefe al barrer desde 0
      let y = -1, wx = -1;
      for (let yy = 60; yy < a.world.depth - 60 && y < 0; yy += 4) {
        let x0 = -1;
        for (let x = 0; x < 120 && x0 < 0; x++) if (a.fits(x, yy, a.floorZ, 10)) x0 = x;
        if (x0 < 0) continue;
        let clear = true;
        for (let x = x0; x <= x0 + 80 && clear; x += 2) clear = a.fits(x, yy, a.floorZ, 10);
        if (clear) { y = yy; wx = x0; }
      }
      expect(y).toBeGreaterThan(0);
      // MAIA pegada a la pared y el jefe a 70: embiste hacia el oeste y la pared lo para
      const boss = place(w, wx + 70, y, wx + 1, y);
      until(w, boss, 60 * 6, () => stuns(boss) > 0);
      expect(stuns(boss)).toBe(1);
      expect(boss.mem.state).toBe(4);   // STUN
    });
  }

  it('en el medieval rompe una columna al embestirla y se queda aturdido; las piezas caben en el presupuesto', () => {
    const { w, a } = arenaWithBoss('medieval', 3);
    const col = [...a.state.objects].find((o) => o.mass > STRUCTURE_KG && a.furniture.rect(o.id))!;
    expect(col).toBeDefined();
    const r = a.furniture.rect(col.id)!, cy = (r.y0 + r.y1) / 2;
    // El jefe al oeste de la columna y MAIA al este, en línea
    const boss = place(w, r.x0 - 30, cy, r.x1 + 20, cy);
    until(w, boss, 60 * 6, () => !a.state.objects.get(col.id));
    expect(a.state.objects.get(col.id)).toBeUndefined();
    const pieces = a.furniture.pieces;
    console.log(`JEFE columna medieval: ${col.cells.length / 4} vóxeles, ${pieces} piezas`);
    expect(pieces).toBeGreaterThan(0);
    expect(pieces).toBeLessThanOrEqual(PIECE_BUDGET);
    until(w, boss, 2, () => false);
    expect(stuns(boss)).toBeGreaterThanOrEqual(1);
  });

  it('con el presupuesto de piezas lleno, rompe la columna igual (sin piezas) y se aturde igual', () => {
    const { w, a } = arenaWithBoss('medieval', 3);
    Object.defineProperty(a.furniture, 'pieces', { get: () => PIECE_BUDGET });
    const col = [...a.state.objects].find((o) => o.mass > STRUCTURE_KG && a.furniture.rect(o.id))!;
    const r = a.furniture.rect(col.id)!, cy = (r.y0 + r.y1) / 2;
    const boss = place(w, r.x0 - 30, cy, r.x1 + 20, cy);
    until(w, boss, 60 * 6, () => !a.state.objects.get(col.id));
    expect(a.state.objects.get(col.id)).toBeUndefined();
    expect(a.furniture.debris.length).toBe(0);
    until(w, boss, 2, () => false);
    expect(stuns(boss)).toBeGreaterThanOrEqual(1);
  });

  it('en la oficina se aturde contra un escritorio que no puede arrastrar (contra la pared)', () => {
    const { w, a } = arenaWithBoss('oficina', 7);
    // Un escritorio pegado a la pared norte (y grande en el modelo): el jefe al sur, embistiendo hacia el norte
    const desk = [...a.state.objects].filter((o) => o.name?.startsWith('escritorio')).map((o) => ({ o, r: a.furniture.rect(o.id)! }))
      .filter(({ r }) => !a.fits((r.x0 + r.x1) / 2, r.y1 + 12, a.floorZ, 6) && a.fits((r.x0 + r.x1) / 2, r.y0 - 40, a.floorZ, 10))[0];
    expect(desk).toBeDefined();
    const { r } = desk!, cx = (r.x0 + r.x1) / 2;
    const boss = place(w, cx, r.y0 - 40, cx, r.y1 + 2);
    until(w, boss, 60 * 6, () => stuns(boss) > 0);
    expect(stuns(boss)).toBe(1);
  });

  it('fase 2: tras cada embestida llama a 3 perseguidores; fase 3: dos embestidas seguidas', () => {
    const { w, a } = arenaWithBoss('oficina', 7);
    const y = a.world.depth / 2;
    const boss = place(w, a.world.width / 2, y, a.world.width / 2 + 60, y);
    boss.hp = boss.maxHp * 0.5;
    let summoned = 0;
    for (let t = 0; t < 60 * 6 && !summoned; t++) {
      w['telegraphs'].length = 0; w.player.hp = w.player.maxHp;
      w.step(TICK, { x: 0, y: 0 });
      summoned = w.enemies.filter((e) => e.def.id === 'perseguidor').length;
    }
    expect(boss.mem.phase).toBe(1);
    expect(summoned).toBe(3);
    // Fase 3: cuenta las embestidas de una tanda (entradas en DASH antes de descansar)
    w.enemies.length = 0; w.enemies.push(boss);
    boss.hp = boss.maxHp * 0.2;
    Object.assign(boss.mem, { state: 0, t: 0 });
    let dashes = 0, prev = boss.mem.state;
    for (let t = 0; t < 60 * 6; t++) {
      for (let i = w.enemies.length - 1; i >= 0; i--) if (w.enemies[i] !== boss) w.enemies.splice(i, 1);
      w['telegraphs'].length = 0; w.player.hp = w.player.maxHp;
      w.step(TICK, { x: 0, y: 0 });
      if (boss.mem.state === 2 && prev !== 2) dashes++;
      if ((boss.mem.state === 3 || boss.mem.state === 4) && dashes > 0) break;
      prev = boss.mem.state;
    }
    expect(boss.mem.phase).toBe(2);
    expect(dashes === 2 || boss.mem.state === 4).toBe(true);   // dos seguidas, salvo que la primera lo aturda
  });

  it('la oleada 10 tiene tope: sin matar al jefe, la partida se pierde por tiempo, también con immortal', () => {
    const g = new BrotatoGame(registry, 7, models, player, registry.level('oficina'), { startWave: 10, immortal: true });
    let ticks = 0;
    const max = Math.ceil((g.current.duration + BOSS_OVERTIME + 5) / TICK);
    let sawBoss = false;
    // Solo el jefe: los demás se quitan en cada paso (lo que se prueba es el tope, no la oleada; con todos, minutos)
    const thin = () => { const es = g.current.enemies; for (let i = es.length - 1; i >= 0; i--) if (!es[i]!.def.boss) es.splice(i, 1); };
    while (g.phase === 'wave' && ticks < max) { thin(); g.step(still); ticks++; if (g.current.boss) sawBoss = true; }
    expect(sawBoss).toBe(true);
    expect(g.phase).toBe('dead');
    expect(g.current.timedOut).toBe(true);
    expect(ticks * TICK).toBeGreaterThanOrEqual(g.current.duration + BOSS_OVERTIME - 0.1);
  });

  it('el HUD lleva su nombre y su vida mientras vive', () => {
    const { w } = arenaWithBoss('medieval', 3);
    place(w, 200, 200, 300, 200);
    const g = { current: w, run: { waveNumber: 10, totalWaves: 10, materials: 0, kills: 0, waveIndex: 9 }, phase: 'wave', theme: 'medieval' } as unknown as BrotatoGame;
    expect(hudText(g)).toContain('Coloso de latón 600/600');
  });

  // La oleada 10 entera con sus cientos de enemigos: tarda (en reposo, ~1 min por salto)
  it('?ir=fin y los saltos con el jefe vivo no se cuelgan', { timeout: 900_000 }, () => {
    for (const target of ['fin', 'tienda'] as const) {
      const g = new BrotatoGame(registry, 7, models, player, registry.level('oficina'), { startWave: 10 });
      const r = skipTo(g, target);
      expect(['dead', 'victory']).toContain(g.phase);
      expect(r.reached).toBe(target === 'fin');
    }
  });
});
