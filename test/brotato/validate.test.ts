import { describe, expect, it } from 'vitest';
import { ENGINE_STATS } from '../../src/game/brotato/registry/schemas';
import { validateContent, type DiscoveredModule } from '../../src/game/brotato/registry/validate';

const stat = (id: string): DiscoveredModule => ({
  path: `/src/content/brotato/stats/${id}/module.ts`,
  value: { format: 1, kind: 'stat', id, name: id, base: 0, min: 0, max: 10, display: 'number' },
});

const character = (over: Record<string, unknown> = {}): DiscoveredModule => ({
  path: '/src/content/brotato/characters/maia/module.ts',
  value: {
    format: 1, kind: 'character', id: 'maia', name: 'MAIA',
    body: { radius: 5, centerY: 10, speed: 67 },
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
      { path: '/src/content/brotato/levels/oficina/module.ts', value: { format: 1, kind: 'level', id: 'oficina', name: 'x', arena: { width: -1, height: 10 } } },
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

  it('el cuerpo del personaje se escribe (ya no sale de una hoja de sprites)', () => {
    expect(validateContent([...base, character({ body: undefined })]).errors.map((e) => e.field)).toEqual(['body']);
    expect(validateContent([...base, character({ body: { radius: 5, speed: 67 } })]).errors.map((e) => e.field)).toEqual(['body.centerY']);
    // Y lo que antes eran hojas de sprites ya no se acepta: el dibujo es un modelo de vóxeles de la vista
    expect(validateContent([...base, character({ sprites: {} })]).errors.length).toBeGreaterThan(0);
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
    const { errors } = validateContent([...base, { path: '/src/content/brotato/items/cafe/module.ts', value: { kind: 'upgrade' } }]);
    expect(errors[0]?.message).toContain('declara kind "upgrade"');
  });
});

describe('mapa del nivel', () => {
  const generator = {
    floors: [{ anim: 'piso' }], caps: ['muro-tapa', 'muro-tapa'],
    facade: { fill: [{ anim: 'muro-liso' }], neutral: 'muro-liso', door: 'muro-puerta', emits: { 'muro-aplique': 'lamp' } },
  };
  const level = (over: Record<string, unknown>): DiscoveredModule => ({
    path: '/src/content/brotato/levels/charca/module.ts',
    value: { format: 1, kind: 'level', id: 'charca', name: 'x', arena: { width: 64, height: 48 }, waves: ['w'], theme: 'oficina', generator, ...over },
  });
  // Solo los errores del mapa: la oleada 'w' no existe y aquí no importa
  const map = (mod: DiscoveredModule) =>
    validateContent([...base, mod]).errors.filter((e) => /^(arena|generator|theme)/.test(e.field ?? '')).map((e) => e.field);

  it('un nivel con su tema y su generador es válido', () => {
    expect(map(level({}))).toEqual([]);
  });

  it('el tema es uno de los del mundo de vóxeles, y hace falta', () => {
    expect(map(level({ theme: 'selva' }))).toEqual(['theme']);
    expect(map(level({ theme: undefined }))).toEqual(['theme']);
  });

  it('el mapa es generado: sin generador no hay nivel', () => {
    expect(map(level({ generator: undefined }))).toEqual(['generator']);
  });

  it('la arena mide múltiplos de 16 px (una celda del generador)', () => {
    expect(map(level({ arena: { width: 60, height: 48 } }))).toEqual(['arena']);
  });

  it('las fuentes de luz de la fachada son de un tipo que existe', () => {
    expect(map(level({ generator: { ...generator, facade: { ...generator.facade, emits: { 'muro-aplique': 'farola' } } } }))).toEqual(['generator.facade.emits.muro-aplique']);
  });
});

describe('params de comportamiento', () => {
  it('llegan al juego con los valores por defecto del esquema aplicados', async () => {
    const { discoverContent } = await import('../../src/game/brotato/registry/discover');
    const { registry } = validateContent(discoverContent());
    // bicho-clip no escribe "recover"; el esquema de dash lo pone a 0.8
    expect(registry.enemy('bicho-clip').params.recover).toBe(0.8);
    // buzon no escribe "count"; el esquema de projectile lo pone a 1
    expect(registry.weapon('buzon').params.count).toBe(1);
  });
});
