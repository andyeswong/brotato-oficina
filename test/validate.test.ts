import { describe, expect, it } from 'vitest';
import { ENGINE_STATS } from '../src/engine/registry/schemas';
import { validateContent, type DiscoveredModule } from '../src/engine/registry/validate';

const stat = (id: string): DiscoveredModule => ({
  path: `/src/content/stats/${id}/module.ts`,
  value: { format: 1, kind: 'stat', id, name: id, base: 0, min: 0, max: 10, display: 'number' },
});

const atlas = {
  frames: {
    a_0: { frame: { x: 0, y: 0, w: 32, h: 32 }, duration: 100 },
    a_1: { frame: { x: 32, y: 0, w: 32, h: 32 }, duration: 100 },
    b_0: { frame: { x: 0, y: 32, w: 34, h: 34 }, duration: 100 },
    b_1: { frame: { x: 34, y: 32, w: 32, h: 32 }, duration: 100 },
  },
  meta: { image: 'x.png', frameTags: [{ name: 'a', from: 0, to: 1 }, { name: 'b', from: 2, to: 3 }] },
};

const character = (over: Record<string, unknown> = {}): DiscoveredModule => ({
  path: '/src/content/characters/maia/module.ts',
  value: {
    format: 1, kind: 'character', id: 'maia', name: 'MAIA',
    sprites: { image: 'x.png', atlas, anims: { idle: 'a', walk: 'a' } },
    ...over,
  },
});

// Las estadísticas que el motor exige, sacadas de la lista del propio motor
const base = ENGINE_STATS.map((id) => stat(id));

describe('validateContent', () => {
  it('acepta un contenido correcto', () => {
    expect(validateContent([...base, character()]).errors).toEqual([]);
  });

  it('junta TODOS los errores, con archivo y campo', () => {
    const { errors } = validateContent([
      ...base,
      character({ modifiers: [{ stat: 'speed-pc', add: 'mucho' }] }),
      { path: '/src/content/levels/oficina/module.ts', value: { format: 1, kind: 'level', id: 'oficina', name: 'x', arena: { width: -1, height: 10 } } },
    ]);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.path.includes('characters/maia') && e.field === 'modifiers[0].add')).toBe(true);
    expect(errors.some((e) => e.path.includes('levels/oficina') && e.field === 'arena.width')).toBe(true);
  });

  it('sugiere el id correcto en una referencia rota', () => {
    const { errors } = validateContent([...base, character({ modifiers: [{ stat: 'speed-pc', add: 1 }] })]);
    expect(errors[0]?.message).toContain('¿Querías decir "speed-pct"?');
  });

  it('detecta un hook mal escrito', () => {
    const { errors } = validateContent([...base, character({ hooks: { onKil: () => {} } })]);
    expect(errors[0]?.field).toBe('hooks.onKil');
    expect(errors[0]?.message).toContain('"onKill"');
  });

  it('detecta frameTags que no existen y frames de tamaños distintos', () => {
    const { errors } = validateContent([...base, character({ sprites: { image: 'x.png', atlas, anims: { idle: 'a', walk: 'caminar' }, portrait: 'b' } })]);
    expect(errors.map((e) => e.field)).toEqual(['sprites.anims.walk', 'sprites.portrait']);
  });

  it('el id tiene que coincidir con la carpeta', () => {
    const bad = character({ id: 'eo' });
    expect(validateContent([...base, bad]).errors[0]?.field).toBe('id');
  });

  it('el motor exige sus estadísticas', () => {
    const { errors } = validateContent([...ENGINE_STATS.filter((id) => id !== 'speed-pct').map((id) => stat(id)), character()]);
    expect(errors.some((e) => e.message.includes('"speed-pct"'))).toBe(true);
  });

  it('un kind que no corresponde a su carpeta da un error claro, no se ignora', () => {
    const { errors } = validateContent([...base, { path: '/src/content/items/cafe/module.ts', value: { kind: 'upgrade' } }]);
    expect(errors[0]?.message).toContain('declara kind "upgrade"');
  });
});

describe('params de comportamiento', () => {
  it('llegan al juego con los valores por defecto del esquema aplicados', async () => {
    const { discoverContent } = await import('../src/engine/registry/discover');
    const { registry } = validateContent(discoverContent());
    // bicho-clip no escribe "recover"; el esquema de dash lo pone a 0.8
    expect(registry.enemy('bicho-clip').params.recover).toBe(0.8);
    // buzon no escribe "count"; el esquema de projectile lo pone a 1
    expect(registry.weapon('buzon').params.count).toBe(1);
  });
});
