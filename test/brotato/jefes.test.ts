// Los jefes nuevos y su sorteo (MAIA, 2026-11-04): reproducible con la semilla, sin gastar números de la partida, con
// una mecánica que no es embestir.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run, pickBoss } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());
const TICK = 1 / 60;
const LAST = 9;

function bossWave(boss: string, level = 'oficina', seed = 3) {
  const run = new Run(registry, registry.character('maia'), registry.level(level), seed, { boss });
  run.waveIndex = LAST;
  return { run, w: run.startWave() };
}
// Pone al jefe y lo deja actuar con MAIA quieta e inmortal, sin más enemigos
function fight(boss: string, secs: number, each?: (w: ReturnType<Run['startWave']>) => void) {
  const { run, w } = bossWave(boss);
  w.summon(boss, w.player.x + 80, w.player.y);
  const self = w.enemies[w.enemies.length - 1]!;
  (w as unknown as { deps: { wave: { groups: unknown[] } } }).deps.wave = { ...w['deps'].wave, groups: [] };
  for (let t = 0; t < 60 * secs; t++) { w.player.hp = w.player.maxHp; w.step(TICK, { x: 0, y: 0 }); each?.(w); }
  return { run, w, self };
}

describe('el sorteo del jefe', () => {
  it('sale de la semilla, salen los tres y no gasta números de la partida', () => {
    const picks = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      expect(pickBoss(registry, s)).toBe(pickBoss(registry, s));
      picks.add(pickBoss(registry, s));
    }
    expect([...picks].sort()).toEqual(['arana', 'golem', 'jefe']);
    const a = new Run(registry, registry.character('maia'), registry.level('oficina'), 7, { boss: 'jefe' });
    const b = new Run(registry, registry.character('maia'), registry.level('oficina'), 7, { boss: 'golem' });
    expect(a.rng.state).toBe(b.rng.state);
  });

  it('el mismo jefe en la oleada 10 pase lo que pase con la opción', () => {
    const { w } = bossWave('golem');
    for (let t = 0; t < 60 * 24; t++) { w.player.hp = w.player.maxHp; w.step(TICK, { x: 0, y: 0 }); }
    expect(w.boss?.def.id).toBe('golem');
  });

  it('una oleada que no es la del jefe no cambia con el sorteo', () => {
    const play = (boss: string) => {
      const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 7, { boss });
      const w = run.startWave();
      for (let t = 0; t < 60 * 15; t++) w.step(TICK, { x: 0, y: 0 });
      return runDigest(run, w, true);
    };
    expect(play('golem')).toBe(play('jefe'));
    expect(play('arana')).toBe(play('jefe'));
  });
});

describe('la araña', () => {
  it('deja zonas que frenan a MAIA y llama crías', () => {
    let zones = 0, crias = 0;
    const { self } = fight('arana', 16, (w) => {
      zones = Math.max(zones, w.zones.length);
      crias = Math.max(crias, w.enemies.filter((e) => e.def.id === 'cria').length);
    });
    expect(zones).toBeGreaterThan(0);
    expect(crias).toBeGreaterThan(0);
    expect(self.alive).toBe(true);
  });

  it('la zona frena a MAIA solo mientras la pisa', () => {
    const go = (zone: boolean) => {
      const { w } = bossWave('arana');
      const x0 = w.player.x;
      if (zone) w.addZone(x0, w.player.y, 200, 10, 0.5);
      for (let t = 0; t < 30; t++) { w.player.hp = w.player.maxHp; w.step(TICK, { x: 1, y: 0 }); }
      return Math.abs(w.player.x - x0);
    };
    const free = go(false), slowed = go(true);
    expect(free).toBeGreaterThan(0);
    expect(slowed).toBeLessThan(free * 0.7);
  });
});

describe('el gólem', () => {
  it('golpea con anillos y lanza trozos', () => {
    // Los trozos se cuentan al nacer: con el gólem pegado a MAIA, la dan en el mismo paso y no llegan a verse volando
    let rings = 0, pieces = 0, hooked = false;
    fight('golem', 16, (w) => {
      if (!hooked) {
        hooked = true;
        const add = w.addProjectile.bind(w);
        w.addProjectile = (p) => { if (p.source === 'enemy:golem') pieces++; add(p); };
      }
      rings = Math.max(rings, w.rings.length);
    });
    expect(rings, 'anillos').toBeGreaterThan(0);
    expect(pieces, 'trozos').toBeGreaterThan(0);
  });

  it('el anillo daña al cruzarlo y no por sus huecos', () => {
    const cross = (start: number) => {
      const { w } = bossWave('golem');
      const c = w.bodyCenter;
      // Un anillo centrado a 30 vóxeles al oeste: MAIA queda en ángulo 0 desde su centro
      w.addRing({ x: c.x - 30, y: c.y, speed: 60, maxR: 60, gaps: 1, gapWidth: 1, start, damage: 2, source: 'enemy:golem' });
      const hp = w.player.hp;
      for (let t = 0; t < 40; t++) w.step(TICK, { x: 0, y: 0 });
      return hp - w.player.hp;
    };
    expect(cross(2)).toBeGreaterThan(0);      // el hueco está lejos
    expect(cross(-0.5)).toBe(0);              // MAIA dentro del hueco
  });
});

describe('poses y aspectos', () => {
  it('todo jefe declara sus poses y el resto de los enemigos no', () => {
    for (const e of registry.enemies()) expect(Object.keys(e.poses).length > 0, e.id).toBe(e.boss);
  });
});

describe('encajada', () => {
  it('si MAIA no cabe donde está y no puede andar, sale al punto libre más cercano', () => {
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 3);
    const w = run.startWave();
    // Un sitio donde no cabe, dentro de una mampara
    const pillar = [...run.arena.state.objects].find((o) => o.kind === 'pillar')!;
    let spot: { x: number; y: number } | null = null;
    for (let dx = 0; dx < 16 && !spot; dx++) for (let dy = 0; dy < 16 && !spot; dy++) {
      if (!run.arena.fits(pillar.x + dx, pillar.y + dy, 1, run.body.radius)) spot = { x: pillar.x + dx, y: pillar.y + dy };
    }
    expect(spot).not.toBeNull();
    Object.assign(w.player, { ...spot!, z: 1 });
    for (let t = 0; t < 90; t++) { w.player.hp = w.player.maxHp; w.step(TICK, { x: 1, y: 0 }); }
    expect(run.arena.fits(w.player.x, w.player.y, w.player.z, run.body.radius)).toBe(true);
  });
});
