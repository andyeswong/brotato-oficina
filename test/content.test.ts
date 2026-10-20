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
