import { describe, expect, it } from 'vitest';
import { StatSheet, type StatDef } from '../../src/game/brotato/stats/StatSheet';

const defs = new Map<string, StatDef>([
  ['damage-pct', { id: 'damage-pct', base: 0, min: -100, max: 1000 }],
  ['speed-pct', { id: 'speed-pct', base: 0, min: -80, max: 300 }],
  ['max-hp', { id: 'max-hp', base: 10, min: 1, max: 9999 }],
]);

describe('StatSheet', () => {
  it('aplica la fórmula (base + Σadd) × (1 + Σpct/100) × Πmul', () => {
    const s = new StatSheet(defs);
    s.setSource('item:a', [{ stat: 'max-hp', add: 5 }, { stat: 'max-hp', pct: 20 }]);
    s.setSource('item:b', [{ stat: 'max-hp', mul: 0.5 }]);
    expect(s.get('max-hp')).toBeCloseTo((10 + 5) * 1.2 * 0.5);
  });

  it('quitar una fuente deshace su efecto', () => {
    const s = new StatSheet(defs);
    s.setSource('item:cafe#1', [{ stat: 'speed-pct', add: 10 }]);
    expect(s.get('speed-pct')).toBe(10);
    s.removeSource('item:cafe#1');
    expect(s.get('speed-pct')).toBe(0);
  });

  it('respeta min y max', () => {
    const s = new StatSheet(defs);
    s.setSource('x', [{ stat: 'speed-pct', add: -500 }]);
    expect(s.get('speed-pct')).toBe(-80);
  });

  it('"per" escala con un contador (el pasivo de MAIA)', () => {
    let distinct = 2;
    const s = new StatSheet(defs, {}, (c) => (c === 'distinct-weapons' ? distinct : 0));
    s.setSource('character:maia', [{ stat: 'damage-pct', add: 5, per: { counter: 'distinct-weapons', every: 1 } }]);
    expect(s.get('damage-pct')).toBe(10);
    distinct = 4;
    s.invalidate();
    expect(s.get('damage-pct')).toBe(20);
  });

  it('el base del personaje pisa el del módulo stat', () => {
    expect(new StatSheet(defs, { 'max-hp': 15 }).get('max-hp')).toBe(15);
  });
});

describe('StatSheet con weaponTag', () => {
  it('un modificador con weaponTag solo cuenta para las armas de ese tag', () => {
    const s = new StatSheet(defs);
    s.setSource('character:maia', [{ stat: 'damage-pct', add: -50, weaponTag: 'cuerpo-a-cuerpo' }, { stat: 'damage-pct', add: 10 }]);
    expect(s.get('damage-pct')).toBe(10);
    expect(s.get('damage-pct', ['distancia'])).toBe(10);
    expect(s.get('damage-pct', ['cuerpo-a-cuerpo'])).toBe(-40);
  });
});
