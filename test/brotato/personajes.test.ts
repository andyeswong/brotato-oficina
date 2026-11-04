// Los personajes: la portada los ordena con MAIA primera, cada uno juega con su ficha, y añadirlos no cambia a MAIA.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { roster } from '../../src/game/brotato/ui/select';

const { registry } = validateContent(discoverContent());
const lv = registry.level('oficina');

describe('personajes', () => {
  it('la portada empieza por MAIA, que sigue siendo la elegida por defecto', () => {
    expect(roster(registry).map((c) => c.id)).toEqual(['maia', 'becario', 'conserje']);
  });

  it('cada personaje que no es MAIA tiene su modelo', () => {
    for (const c of roster(registry).filter((x) => x.id !== 'maia')) {
      expect(existsSync(`models/brotato/personajes/${c.id}.json`), c.id).toBe(true);
    }
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
});
