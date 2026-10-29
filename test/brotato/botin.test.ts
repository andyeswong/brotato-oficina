// Lo que sueltan los muebles al romperse y el embestidor que los arrastra (Andrés, 2026-10-29: "materiales según el
// peso" y "solo el embestidor")
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { furnitureLoot } from '../../src/game/brotato/sim/furniture';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());

// Una oleada de la oficina recién empezada, sin enemigos (los que vayan saliendo se quitan en cada paso)
function quiet(seed = 7) {
  const run = new Run(registry, registry.character('maia'), registry.level('oficina'), seed);
  const w = run.startWave();
  const clear = () => { w.enemies.length = 0; w['telegraphs'].length = 0; };
  return { run, w, a: run.arena, clear };
}

describe('el botín de los muebles', () => {
  it('uno por cada 20 kg, al menos uno: mampara 2, escritorio 3', () => {
    expect(furnitureLoot(46)).toBe(2);
    expect(furnitureLoot(55)).toBe(3);
    expect(furnitureLoot(3)).toBe(1);
  });

  it('una mampara rota de un disparo de MAIA suelta sus materiales donde se rompió', () => {
    const { w, a, clear } = quiet();
    const m = [...a.state.objects].find((o) => o.kind === 'pillar')!, r = a.furniture.rect(m.id)!;
    let hx = -1, hy = -1;
    for (let y = r.y0; y <= r.y1 && hx < 0; y++) for (let x = r.x0; x <= r.x1; x++) if (a.shotBlocked(x + 0.5, y + 0.5)) { hx = x + 0.5; hy = y + 0.5; break; }
    const before = w.materials.length;
    w.addProjectile({ owner: 'player', x: hx - 10, y: hy, vx: 300, vy: 0, angle: 0, damage: 100, critChance: 0, critMult: 1, radius: 2, travel: 400, pierce: 0, source: 'prueba' });
    for (let t = 0; t < 30 && a.state.objects.get(m.id); t++) { clear(); w.step(1 / 60, { x: 0, y: 0 }); }
    expect(a.state.objects.get(m.id)).toBeUndefined();
    const got = w.materials.slice(before);
    expect(got.length).toBe(furnitureLoot(m.mass));
    for (const g of got) expect(Math.hypot(g.x - hx, g.y - hy)).toBeLessThan(16);
  });
});

describe('el embestidor arrastra muebles', () => {
  // Un escritorio libre, MAIA al este y un embestidor al oeste, en la misma línea: embiste a través del escritorio
  function setup(enemy: string) {
    const { w, a, clear } = quiet();
    const desk = [...a.state.objects].filter((o) => o.name?.startsWith('escritorio'))
      .find((o) => { const r = a.furniture.rect(o.id)!; const y = (r.y0 + r.y1) / 2; return a.fits(r.x0 - 20, y, a.floorZ, 7) && a.fits(r.x1 + 14, y, a.floorZ, 7) && a.furniture.canPush(o.id, 1, 0, 6); })!;
    const r = a.furniture.rect(desk.id)!, y = (r.y0 + r.y1) / 2;
    Object.assign(w.player, { x: r.x1 + 14, y });   // a menos de triggerRange (72): embiste
    clear();
    w['addEnemy'](registry.enemy(enemy), r.x0 - 20, y);
    return { w, a, desk, x0: r.x0, keep: w.enemies[0]! };
  }
  const run = (s: ReturnType<typeof setup>) => {
    for (let t = 0; t < 60 * 3; t++) {
      s.w.enemies.length = 0; s.w.enemies.push(s.keep); s.w['telegraphs'].length = 0;
      s.w.player.hp = s.w.player.maxHp;
      s.w.step(1 / 60, { x: 0, y: 0 });
    }
    const r = s.a.furniture.rect(s.desk.id)!;
    return r.x0 - s.x0;
  };

  it('embistiendo mueve el escritorio hacia donde embiste', () => {
    const moved = run(setup('embestidor'));
    console.log(`EMPUJE embestidor: ${moved} vóxeles en 3 s`);
    expect(moved).toBeGreaterThanOrEqual(3);
  });

  it('el perseguidor no lo mueve: lo rodea', () => {
    expect(run(setup('perseguidor'))).toBe(0);
  });
});
