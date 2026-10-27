// Los muebles que se empujan y se rompen (Andrés, 2026-10-27; reglas en sim/furniture.ts, motor en VoxPix
// world/objects.ts). Se empujan los muebles, no las columnas; los rompen los disparos; nunca más de MAX_AWAKE
// despiertos; nunca tapan la salida, la tienda ni la entrada; y el camino de la prórroga se entera.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Arena } from '../../src/game/brotato/sim/arena';
import { PUSH_FORCE } from '../../src/game/brotato/sim/Run';
import { decode } from '@voxpix/core';
import { Furniture, MAX_AWAKE, STRUCTURE_KG, FURNITURE_HP } from '../../src/game/brotato/sim/furniture';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());
const TICK = 1 / 60, SPEED = 67, R = 5;

function desks(a: Arena) {
  return [...a.state.objects].filter((o) => o.name?.startsWith('escritorio'));
}
// MAIA pegada al lado oeste de un objeto, empujando hacia el este con `force` durante `ticks`
function pushEast(a: Arena, id: number, force: number, ticks: number): { x: number; y: number } {
  const r = a.furniture.rect(id)!;
  const m = { x: r.x0 - R - 0.5, y: (r.y0 + r.y1) / 2, z: 0 };
  m.z = a.restZ(m.x, m.y, R);
  for (let t = 0; t < ticks; t++) { a.move(m, R, SPEED * TICK, 0, { force, dt: TICK, maxSpeed: SPEED }); a.stepObjects(); }
  return m;
}
// Un escritorio con sitio libre al oeste para MAIA y al este para moverse, lejos de las zonas protegidas
function freeDesk(a: Arena): number {
  for (const o of desks(a)) {
    const r = a.furniture.rect(o.id)!, y = (r.y0 + r.y1) / 2;
    if (!a.fits(r.x0 - R - 0.5, y, a.floorZ, R)) continue;
    if (!a.furniture.canPush(o.id, 1, 0, 12)) continue;
    let room = true;
    for (let dx = 1; dx <= 14 && room; dx++) for (let yy = r.y0; yy <= r.y1; yy += 2) if (a.state.groundAt(r.x1 + dx, yy) > a.floorZ + 1) room = false;
    if (room) return o.id;
  }
  throw new Error('no hay escritorio libre');
}

describe('los muebles', () => {
  it('pesan lo que deben: los muebles de la oficina se empujan, columnas y pilares no', () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    for (const o of desks(a)) expect(o.mass).toBeGreaterThan(40), expect(o.mass).toBeLessThan(70);
    for (const o of a.state.objects) if (o.kind === 'pillar') expect(o.mass).toBeLessThan(60);   // mamparas
    for (const level of ['medieval', 'cyberpunk']) {
      const b = new Arena(registry.level(level), 3, { floor: 0 });
      expect(b.state.objects.size).toBeGreaterThan(0);
      for (const o of b.state.objects) {
        expect(o.mass, level).toBeGreaterThan(STRUCTURE_KG);
        expect(b.state.objects.forceToMove(o.id), level).toBeGreaterThan(PUSH_FORCE + 3 * 150);   // ni con la mejora al máximo
      }
    }
  });

  it('MAIA empuja un escritorio; sin fuerza no se mueve; una columna no se mueve', () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    const id = freeDesk(a), before = a.furniture.rect(id)!;
    pushEast(a, id, 0.01, 30);
    expect(a.furniture.rect(id)).toEqual(before);
    pushEast(a, id, PUSH_FORCE, 30);
    expect(a.furniture.rect(id)!.x0).toBeGreaterThan(before.x0);

    const m = new Arena(registry.level('medieval'), 3, { floor: 0 });
    const col = [...m.state.objects][0]!, rc = m.furniture.rect(col.id)!;
    pushEast(m, col.id, PUSH_FORCE + 3 * 150, 30);
    expect(m.furniture.rect(col.id)).toEqual(rc);
    expect(col.awake).toBe(false);
  });

  it(`como mucho ${MAX_AWAKE} despiertos: con el tope lleno, un mueble dormido hace de pared`, () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    expect(a.furniture.maxAwake).toBe(MAX_AWAKE);
    expect(MAX_AWAKE).toBeLessThanOrEqual(32);   // de 1024 capas del atlas, compartidas con la oleada
    // Con un piso hay unos 6 muebles: el tope se prueba con uno de 3 sobre los mismos objetos
    const f = new Furniture(a.state, [], a.floorZ + 8, 3);
    const all = [...a.state.objects].filter((o) => o.mass <= STRUCTURE_KG);
    expect(all.length).toBeGreaterThan(3);
    for (const o of all.slice(0, 3)) expect(a.state.objects.wake(o.id)).toBe(true);
    const next = all[3]!;
    expect(f.canPush(next.id, 1, 0, 1)).toBe(false);
    expect(f.push(next.id, 1, 0, PUSH_FORCE, TICK, SPEED)).toBe(0);
    expect(next.awake).toBe(false);
    // Uno ya despierto sí se sigue empujando
    expect(f.canPush(all[0]!.id, 1, 0, 1)).toBe(true);
  });

  it('un mueble no se empuja a menos de KEEP_CLEAR de una zona protegida', () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    const id = freeDesk(a), r = a.furniture.rect(id)!;
    // Una zona justo al este del escritorio (a 2 vóxeles): hacia ella no; hacia el oeste sí
    const f = new Furniture(a.state, [{ x0: r.x1 + 3, y0: r.y0, x1: r.x1 + 20, y1: r.y1 }], a.floorZ + 8);
    expect(f.canPush(id, 1, 0, 1)).toBe(true);
    expect(f.canPush(id, 1, 0, 4)).toBe(false);
    expect(f.canPush(id, -1, 0, 4)).toBe(true);
    // Las zonas de la arena: salida, tienda y entrada, con su margen
    const s = a.shop;
    for (const o of a.state.objects) {
      const ro = a.furniture.rect(o.id)!;
      const inShop = ro.x0 <= s.x + s.reach && s.x - s.reach <= ro.x1 && ro.y0 <= s.y + s.reach && s.y - s.reach <= ro.y1;
      expect(inShop).toBe(false);
    }
  });

  it('los disparos de MAIA rompen una mampara (no los de los enemigos, ni una columna) y el camino de la prórroga pasa por donde estaba', () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    const mamparas = [...a.state.objects].filter((o) => o.kind === 'pillar');
    expect(mamparas.length).toBeGreaterThan(0);
    const id = mamparas[0]!.id, r = a.furniture.rect(id)!;
    // Un punto de la mampara que para disparos, y dos que la rodean de oeste a este a su altura
    let hx = -1, hy = -1;
    for (let y = r.y0; y <= r.y1 && hx < 0; y++) for (let x = r.x0; x <= r.x1; x++) if (a.shotBlocked(x + 0.5, y + 0.5)) { hx = x + 0.5; hy = y + 0.5; break; }
    expect(hx).toBeGreaterThan(0);
    const west = { x: r.x0 - 10, y: hy }, east = { x: r.x1 + 10, y: hy };
    expect(a.fits(west.x, west.y, a.floorZ, 5) && a.fits(east.x, east.y, a.floorZ, 5)).toBe(true);
    const around = a.pathDir(west, east, 4)!;
    expect(Math.abs(around.y)).toBeGreaterThan(0.3);   // rodea la mampara
    // Las balas de los enemigos no le hacen nada; las de MAIA, sí
    for (let k = 0; k < 100; k++) expect(a.hitShot(hx, hy, 10, 'enemy')).toBe(false);
    expect(a.state.objects.get(id)!.hp).toBe(FURNITURE_HP);
    let broke = false, hits = 0;
    while (!broke && hits < 100) { broke = a.hitShot(hx, hy, 10, 'player'); hits++; }
    expect(broke).toBe(true);
    expect(hits).toBe(FURNITURE_HP / 10);
    expect(a.state.objects.get(id)).toBeUndefined();
    expect(a.shotBlocked(hx, hy)).toBe(false);
    // Los escombros caen y desaparecen
    expect(a.furniture.debris.length).toBe(1);
    for (let t = 0; t < 60 * 5 && a.furniture.debris.length; t++) a.stepObjects();
    expect(a.furniture.debris.length).toBe(0);
    // El camino se rehace (como mucho cada 1/4 s) y va recto
    for (let t = 0; t < 15; t++) a.stepObjects();
    expect(a.pathDir(west, east, 4)!.x).toBeGreaterThan(0.9);

    const m = new Arena(registry.level('medieval'), 3, { floor: 0 });
    const col = [...m.state.objects][0]!, rc = m.furniture.rect(col.id)!;
    let cx = -1, cyy = -1;
    for (let y = rc.y0; y <= rc.y1 && cx < 0; y++) for (let x = rc.x0; x <= rc.x1; x++) if (m.shotBlocked(x + 0.5, y + 0.5)) { cx = x + 0.5; cyy = y + 0.5; break; }
    for (let k = 0; k < 100; k++) expect(m.hitShot(cx, cyy, 50)).toBe(false);
    expect(m.state.objects.get(col.id)).toBeDefined();
  });

  it('un escritorio empujado: el camino se entera de que ya no está donde estaba', () => {
    const a = new Arena(registry.level('oficina'), 7, { floor: 0 });
    const id = freeDesk(a), r = a.furniture.rect(id)!;
    // De oeste a este por la mitad del escritorio: mientras está, rodea
    const y = Math.floor((r.y0 + r.y1) / 2) + 0.5, west = { x: r.x0 - 10, y }, east = { x: r.x1 + 10, y };
    expect(a.fits(west.x, west.y, a.floorZ, 5) && a.fits(east.x, east.y, a.floorZ, 5)).toBe(true);
    expect(Math.abs(a.pathDir(west, east, 4)!.y)).toBeGreaterThan(0.3);
    // Lo empuja 16 vóxeles al este y se queda al otro lado: por donde estaba ya se pasa
    pushEast(a, id, PUSH_FORCE, 90);
    expect(a.furniture.rect(id)!.x0).toBeGreaterThan(r.x0 + 8);
    for (let t = 0; t < 15; t++) a.stepObjects();
    const mid = { x: r.x0 + 4, y };
    expect(a.fits(mid.x, mid.y, a.floorZ, 5)).toBe(true);
  });

  it('la vegetación que pisa MAIA se tumba; los arbustos no pierden nada aunque camine contra ellos', () => {
    const a = new Arena(registry.level('medieval'), 3, { floor: 0 });
    const s = a.state.solid, pal = s.palette;
    const count = (name: string) => {
      let n = 0;
      for (let z = s.zMin; z <= s.zMax; z++) for (let y = 0; y < s.depth; y++) for (let x = 0; x < s.width; x++) {
        const v = s.get(x, y, z);
        if (v && pal.ramps[decode(v).ramp]!.name === name) n++;
      }
      return n;
    };
    const tall0 = count('hierba-alta'), bush0 = count('arbusto');
    expect(tall0).toBeGreaterThan(0);
    expect(bush0).toBeGreaterThan(0);
    // MAIA recorre la arena en zigzag pisando hierba, y luego va derecha contra los arbustos más cercanos
    const m = { x: a.start.x, y: a.start.y, z: a.restZ(a.start.x, a.start.y, R) };
    let changed = 0;
    for (let k = 0; k < 40; k++) {
      const dx = Math.cos(k * 2.4), dy = Math.sin(k * 2.4);
      for (let t = 0; t < 90; t++) { a.move(m, R, dx * SPEED * TICK, dy * SPEED * TICK); changed += a.crushUnder(m.x, m.y, R); }
    }
    const bushes: Array<[number, number]> = [];
    for (let y = 0; y < s.depth; y += 3) for (let x = 0; x < s.width; x += 3) {
      for (let z = s.zMin; z <= s.zMax; z++) { const v = s.get(x, y, z); if (v && pal.ramps[decode(v).ramp]!.name === 'arbusto') { bushes.push([x, y]); break; } }
    }
    bushes.sort((p, q) => Math.hypot(p[0] - a.start.x, p[1] - a.start.y) - Math.hypot(q[0] - a.start.x, q[1] - a.start.y));
    let touched = 0;
    for (const [bx, by] of bushes.slice(0, 8)) {
      const w = { x: a.start.x, y: a.start.y, z: a.restZ(a.start.x, a.start.y, R) };
      for (let t = 0; t < 600; t++) {
        const dx = bx + 0.5 - w.x, dy = by + 0.5 - w.y, d = Math.hypot(dx, dy) || 1;
        const step = a.pathDir(w, { x: bx + 0.5, y: by + 0.5 }, R + 2) ?? { x: dx / d, y: dy / d };
        a.move(w, R, step.x * SPEED * TICK, step.y * SPEED * TICK);
        changed += a.crushUnder(w.x, w.y, R);
      }
      if (Math.hypot(bx + 0.5 - w.x, by + 0.5 - w.y) < R + 4) touched++;
    }
    expect(touched).toBeGreaterThan(0);   // llegó a pegarse a algún arbusto
    expect(changed).toBeGreaterThan(0);
    expect(count('hierba-alta')).toBeLessThan(tall0);
    expect(count('arbusto')).toBe(bush0);
    // Pisar otra vez lo ya tumbado no cambia nada
    expect(a.crushUnder(m.x, m.y, R)).toBe(0);
  });
});
