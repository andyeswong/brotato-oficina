// Los personajes: la portada los ordena con MAIA primera, cada uno juega con su ficha, y añadirlos no cambia a MAIA.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { drawSelect, roster } from '../../src/game/brotato/ui/select';
import type { Painter } from '../../src/game/brotato/ui/paint';

const { registry } = validateContent(discoverContent());
const lv = registry.level('oficina');

describe('personajes', () => {
  it('la portada empieza por MAIA, que sigue siendo la elegida por defecto', () => {
    expect(roster(registry).map((c) => c.id)).toEqual(['maia', 'becario', 'conserje']);
  });

  it('cada personaje que no es MAIA tiene su modelo', () => {
    for (const c of roster(registry).filter((x) => x.id !== 'maia')) {
      for (const s of ['', '-andar0', '-andar1', '-andar2', '-andar3']) expect(existsSync(`models/brotato/personajes/${c.id}${s}.json`), c.id + s).toBe(true);
    }
  });

  it('nadie es más ancho que MAIA: los mapas garantizan el paso con su radio', () => {
    for (const c of roster(registry)) expect(c.body.radius, c.id).toBeLessThanOrEqual(registry.character('maia').body.radius);
  });

  it('cada uno empieza con su arma y sus estadísticas', () => {
    const b = new Run(registry, registry.character('becario'), lv, 1);
    const c = new Run(registry, registry.character('conserje'), lv, 1);
    const m = new Run(registry, registry.character('maia'), lv, 1);
    expect(b.weapons.map((w) => w.id)).toEqual(['tiro']);
    expect(c.weapons.map((w) => w.id)).toEqual(['barrido']);
    expect(b.stats.get('speed-pct')).toBeGreaterThan(m.stats.get('speed-pct'));
    expect(b.stats.get('pickup-range')).toBeGreaterThan(m.stats.get('pickup-range'));
    expect(b.stats.get('max-hp')).toBeLessThan(m.stats.get('max-hp'));
    expect(c.stats.get('max-hp')).toBeGreaterThan(m.stats.get('max-hp'));
    expect(c.stats.get('armor')).toBeGreaterThan(m.stats.get('armor'));
    expect(c.stats.get('speed-pct')).toBeLessThan(m.stats.get('speed-pct'));
  });

  it('las flechas de la portada son grandes, y el retrato y el nombre no cambian de sitio entre agentes', () => {
    for (const [W, H] of [[269, 384], [384, 216]] as const) {
      const icons: number[][] = [];
      const firstText: number[] = [];
      roster(registry).forEach((_c, i) => {
        const fills: number[][] = [];
        const p: Painter = { width: W, height: H, fill: (x, y, w, h, color) => { if (color === '#fdf6ff') fills.push([x, y, w, h]); }, icon: (_r, x, y) => { icons.push([x, y]); return true; } };
        const zones = drawSelect(p, registry, i, 'oficina');
        const arrows = zones.filter((z) => z.action.type === 'move');
        expect(arrows.length, `${W}x${H}`).toBe(2);
        for (const a of arrows) {
          expect(a.w).toBeGreaterThanOrEqual(W > H ? 18 : 30);
          expect(a.h).toBeGreaterThanOrEqual(40);
          expect(a.x).toBeGreaterThanOrEqual(0);
          expect(a.x + a.w).toBeLessThanOrEqual(W);
        }
        const [l, r] = arrows as [typeof arrows[0], typeof arrows[0]];
        expect(l.x + l.w).toBeLessThanOrEqual(icons[icons.length - 1]![0]!);
        expect(r.x).toBeGreaterThan(l.x + l.w);
        firstText.push(fills.length);
      });
      expect(new Set(icons.slice(-3).map((c) => c.join())).size, `${W}x${H}`).toBe(1);
    }
  });
});
