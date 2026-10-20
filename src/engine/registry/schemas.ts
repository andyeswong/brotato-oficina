import { z } from 'zod';

// Los mensajes de zod salen en español: los lee quien escribe contenido, no solo quien programa
z.config(z.locales.es());

export const MODULE_KINDS = ['stat', 'behavior', 'character', 'weapon', 'item', 'enemy', 'wave', 'level'] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

// Carpeta de src/content/ donde vive cada tipo
export const KIND_FOLDERS: Record<ModuleKind, string> = {
  stat: 'stats',
  behavior: 'behaviors',
  character: 'characters',
  weapon: 'weapons',
  item: 'items',
  enemy: 'enemies',
  wave: 'waves',
  level: 'levels',
};

export const HOOK_EVENTS = [
  'onRunStart', 'onRunEnd', 'onWaveStart', 'onWaveEnd',
  'onHit', 'onKill', 'onTakeDamage', 'onDodge', 'onDeath',
  'onPickup', 'onBuy', 'onShopEnter',
] as const;
export type HookEvent = (typeof HOOK_EVENTS)[number];

// Estadísticas que el motor lee por su id: el contenido base tiene que traerlas
export const ENGINE_STATS = ['max-hp', 'speed-pct'] as const;

// Animaciones que el motor pide a cada personaje
export const CHARACTER_ANIMS = ['idle', 'walk'] as const;

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'el id va en kebab-case: minúsculas, números y guiones');

const manifest = {
  format: z.literal(1),
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requires: z.array(z.string().regex(/^[a-z]+:[a-z0-9-]+$/, 'se escribe "tipo:id", por ejemplo "weapon:buzon"')).optional(),
};

const hookFn = z.custom<(...args: never[]) => unknown>((v) => typeof v === 'function', 'un hook tiene que ser una función');
// El nombre de cada hook se comprueba en validate.ts, para poder sugerir el correcto
const hooks = z.record(z.string(), hookFn).optional();

export const modifierSchema = z
  .strictObject({
    stat: idSchema,
    add: z.number().optional(),
    pct: z.number().optional(),
    mul: z.number().optional(),
    per: z
      .strictObject({
        counter: z.string(),
        every: z.number().positive(),
        max: z.number().optional(),
      })
      .optional(),
  })
  .refine((m) => m.add !== undefined || m.pct !== undefined || m.mul !== undefined, {
    message: 'un modificador necesita al menos add, pct o mul',
  });
export type Modifier = z.infer<typeof modifierSchema>;

// JSON que saca claude-pxl (estilo TexturePacker, frames como hash + frameTags de Aseprite)
const rect = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export const atlasSchema = z.looseObject({
  frames: z.record(z.string(), z.looseObject({ frame: rect, duration: z.number().optional() })),
  meta: z.looseObject({
    image: z.string(),
    frameTags: z.array(
      z.looseObject({
        name: z.string(),
        from: z.number().int().min(0),
        to: z.number().int().min(0),
        direction: z.string().optional(),
      }),
    ),
  }),
});
export type AtlasData = z.infer<typeof atlasSchema>;

export const spritesSchema = z.strictObject({
  image: z.string().min(1),
  atlas: atlasSchema,
  // nombre semántico del motor → frameTag de la hoja
  anims: z.record(z.string(), z.string()),
  portrait: z.string().optional(),
});
export type Sprites = z.infer<typeof spritesSchema>;

export const statSchema = z
  .strictObject({
    ...manifest,
    kind: z.literal('stat'),
    base: z.number(),
    min: z.number(),
    max: z.number(),
    display: z.enum(['number', 'percent']),
  })
  .refine((s) => s.min <= s.max, { message: 'min no puede ser mayor que max', path: ['min'] });

export const characterSchema = z.strictObject({
  ...manifest,
  kind: z.literal('character'),
  baseStats: z.record(idSchema, z.number()).optional(),
  modifiers: z.array(modifierSchema).optional(),
  startingWeapons: z.array(idSchema).optional(),
  sprites: spritesSchema,
  hooks,
});

export const levelSchema = z.strictObject({
  ...manifest,
  kind: z.literal('level'),
  arena: z.strictObject({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  waves: z.array(idSchema).optional(),
});

// Tipos que el motor ya sabe cargar. El resto llega en F1.
export const SCHEMAS = {
  stat: statSchema,
  character: characterSchema,
  level: levelSchema,
} as const satisfies Partial<Record<ModuleKind, z.ZodType>>;

export type SupportedKind = keyof typeof SCHEMAS;
export type StatModule = z.infer<typeof statSchema>;
export type CharacterModule = z.infer<typeof characterSchema>;
export type LevelModule = z.infer<typeof levelSchema>;
export type ContentModule = StatModule | CharacterModule | LevelModule;
