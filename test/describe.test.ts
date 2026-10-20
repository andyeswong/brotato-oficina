import { describe, expect, it } from 'vitest';
import { discoverContent } from '../src/engine/registry/discover';
import type { StatModule } from '../src/engine/registry/schemas';
import { validateContent } from '../src/engine/registry/validate';
import { describeModifier } from '../src/engine/stats/describe';

const { registry } = validateContent(discoverContent());
const stats = new Map<string, StatModule>(registry.stats().map((s) => [s.id, s]));

describe('describeModifier', () => {
  it('la ficha de MAIA se lee sola desde sus modificadores', () => {
    const lines = (registry.character('maia').modifiers ?? []).map((m) => describeModifier(m, stats));
    expect(lines).toEqual([
      { text: '+5 % de daño por cada arma distinta', good: true },
      { text: '+48 de alcance', good: true },
      { text: '-10 % de velocidad', good: false },
      { text: '-50 % de daño con armas cuerpo a cuerpo', good: false },
    ]);
  });

  it('mul y "per" con every > 1', () => {
    expect(describeModifier({ stat: 'armor', mul: 0.5 }, stats).text).toBe('armadura ×0,5');
    expect(describeModifier({ stat: 'max-hp', add: 1, per: { counter: 'kills', every: 20 } }, stats).text)
      .toBe('+1 de vida máxima por cada 20 bajas');
  });
});
