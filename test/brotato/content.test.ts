import { describe, expect, it } from 'vitest';
import { formatErrors } from '../../src/game/brotato/registry/ContentError';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';

// La red de seguridad: todo lo que hay en src/content/ valida. Corre en "bun run validate" y antes de cada build.
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

// La prueba de que cada carácter de nombres y descripciones existe en la fuente pixel vuelve con la vista del juego
// (fase 3): la fuente es de la vista y todavía no está portada.
