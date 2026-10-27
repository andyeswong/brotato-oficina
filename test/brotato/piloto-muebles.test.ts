// El piloto de la curva y los muebles: su rejilla de caminos (goTo) se rehace cuando un mueble se mueve o se rompe.
// Si no, se queda con el mapa de antes y se mete contra un mueble que ya no está donde creía (MAIA, 2026-10-27)
import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run, PUSH_FORCE } from '../../src/game/brotato/sim/Run';
import { goTo, pilotFree } from './pilot';

const { registry } = validateContent(discoverContent());
const TICK = 1 / 60, SPEED = 67;

describe('el piloto y los muebles', () => {
  it('un escritorio movido en medio de su camino: lo rodea y llega', () => {
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 7);
    const a = run.arena, R = run.body.radius;
    // Un escritorio con pasillo libre al norte (por donde va el piloto) y sitio para subirlo hasta él
    const desk = [...a.state.objects].find((o) => {
      if (!o.name?.startsWith('escritorio')) return false;
      const r = a.furniture.rect(o.id)!, y = r.y1 + 14;
      for (let x = r.x0 - 24; x <= r.x1 + 24; x += 2) if (!a.fits(x, y, a.floorZ, R + 2)) return false;
      return a.furniture.canPush(o.id, 0, 1, 16);
    })!;
    expect(desk).toBeDefined();
    const r0 = a.furniture.rect(desk.id)!, y = r0.y1 + 14;
    const from = { x: r0.x0 - 20, y, z: a.restZ(r0.x0 - 20, y, R) }, to = { x: r0.x1 + 20, y };
    // El piloto ya conoce el mapa (su rejilla está hecha) con el pasillo libre
    expect(goTo(run, { ...from }, to).x).toBeGreaterThan(0.9);
    const before = new Map<string, boolean>();
    for (let cy = Math.floor((r0.y0 - 8) / 8); cy <= Math.floor((r0.y1 + 40) / 8); cy++) for (let cx = Math.floor((r0.x0 - 8) / 8); cx <= Math.floor((r0.x1 + 8) / 8); cx++) before.set(`${cx},${cy}`, a.fits(cx * 8 + 4, cy * 8 + 4, a.floorZ, R));
    // El escritorio sube 16 vóxeles y queda atravesado en el pasillo
    for (let t = 0; t < 200 && a.furniture.rect(desk.id)!.y1 < y + 2; t++) { a.furniture.push(desk.id, 0, 1, PUSH_FORCE, TICK, SPEED); a.stepObjects(); }
    const r1 = a.furniture.rect(desk.id)!;
    expect(r1.y0 - R).toBeLessThan(y);
    expect(r1.y1 + R).toBeGreaterThan(y);
    // Lo que el piloto cree del mapa coincide con el mapa de ahora en las celdas de donde estaba y de donde está
    // (su rejilla es de 8 px, con el centro de cada celda); y alguna cambió
    let checked = 0, changedCells = 0;
    for (let cy = Math.floor((r0.y0 - 8) / 8); cy <= Math.floor((r1.y1 + 8) / 8); cy++) for (let cx = Math.floor((r0.x0 - 8) / 8); cx <= Math.floor((r0.x1 + 8) / 8); cx++) {
      const x = cx * 8 + 4, yy = cy * 8 + 4;
      const now = a.fits(x, yy, a.floorZ, R);
      expect(pilotFree(run, x, yy), `celda ${cx},${cy}`).toBe(now);
      checked++;
      if (now !== before.get(`${cx},${cy}`)) changedCells++;
    }
    expect(checked).toBeGreaterThan(10);
    expect(changedCells).toBeGreaterThan(0);
    // Anda con goTo (sin empujar): tiene que rodearlo y llegar
    const p = { ...from };
    let t = 0;
    for (; t < 60 * 8 && Math.hypot(p.x - to.x, p.y - to.y) > 6; t++) {
      const d = goTo(run, p, to);
      a.move(p, R, d.x * SPEED * TICK, d.y * SPEED * TICK);
    }
    expect(Math.hypot(p.x - to.x, p.y - to.y)).toBeLessThanOrEqual(6);
  });
});
