import { describe, expect, it } from 'vitest';
import { formatErrors } from '../src/engine/registry/ContentError';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';

// La red de seguridad: todo lo que hay en src/content/ valida. Corre en "npm run validate" y antes de cada build.
describe('contenido', () => {
  it('todo el contenido valida', () => {
    const { errors } = validateContent(discoverContent());
    if (errors.length > 0) throw new Error(`\n${formatErrors(errors)}`);
  });

  it('encuentra al menos un personaje y un nivel', () => {
    const { registry } = validateContent(discoverContent());
    expect(registry.characters().length).toBeGreaterThan(0);
    expect(registry.levels().length).toBeGreaterThan(0);
  });
});

describe('textos del contenido', () => {
  it('todo carácter de nombres y descripciones existe en la fuente (si no, desaparece en pantalla)', async () => {
    const { vi } = await import('vitest');
    vi.doMock('phaser', () => ({ default: {} }));
    const { FONT_CHARS, normalize } = await import('../src/engine/view/font');
    const { registry } = validateContent(discoverContent());
    const kinds = ['stat', 'character', 'weapon', 'item', 'enemy', 'level'] as const;
    const missing: string[] = [];
    for (const kind of kinds) {
      for (const id of registry.ids(kind)) {
        const mod = registry.get(kind, id);
        for (const ch of normalize(`${mod.name} ${mod.description ?? ''}`)) {
          if (!FONT_CHARS.includes(ch)) missing.push(`${kind}:${id} → "${ch}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
