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
export const ENGINE_STATS = ['max-hp', 'speed-pct', 'armor', 'dodge-pct'] as const;

// Animaciones que el motor pide a cada tipo
export const CHARACTER_ANIMS = ['idle', 'walk'] as const;
export const ENEMY_ANIMS = ['walk'] as const;
export const WEAPON_ANIMS = ['idle'] as const;
export const ITEM_ANIMS = ['icon'] as const;
export const LEVEL_ANIMS = ['material'] as const;
export const MAX_WEAPONS = 6;

// Contadores de partida que un modificador "per" puede usar
export const COUNTERS = ['distinct-weapons', 'wave', 'kills', 'materials', 'items'] as const;
export type CounterId = (typeof COUNTERS)[number];

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
    // Solo aplica al calcular las armas que llevan este tag (p. ej. "cuerpo-a-cuerpo")
    weaponTag: z.string().optional(),
    per: z
      .strictObject({
        counter: z.enum(COUNTERS),
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
  // El cuerpo en píxeles lógicos. Lo que no se dé sale de la celda de su animación idle (ver body.ts)
  body: z
    .strictObject({
      radius: z.number().positive().optional(),    // círculo de colisión
      centerY: z.number().min(0).optional(),       // altura del centro del cuerpo sobre los pies
      speed: z.number().positive().optional(),     // píxeles lógicos por segundo con speed-pct = 0
    })
    .optional(),
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
  waves: z.array(idSchema).min(1, 'un nivel necesita al menos una oleada'),
  // Distancias de aparición, en píxeles lógicos: escalan con el mundo, así que son del nivel, no del motor
  spawn: z
    .strictObject({
      minDistance: z.number().min(0).default(64),   // nunca más cerca del jugador que esto (random, cluster)
      edgeMargin: z.number().min(0).default(12),    // separación del borde (edge)
      ringRadius: z.number().positive().default(120), // radio del anillo alrededor del jugador (ring)
      clusterSpread: z.number().min(0).default(40), // tamaño del grupo (cluster)
    })
    .default({ minDistance: 64, edgeMargin: 12, ringRadius: 120, clusterSpread: 40 }),
  // Reglas de la tienda entre oleadas: viven en el nivel para poder hacer un modo fácil o corto sin código
  shop: z
    .strictObject({
      slots: z.number().int().min(1).max(8).default(4),
      reroll: z
        .strictObject({ base: z.number().min(0), perWave: z.number().min(0), step: z.number().min(0) })
        .default({ base: 1, perWave: 0.5, step: 1 }),
      priceScale: z.strictObject({ perWave: z.number().min(0) }).default({ perWave: 0.1 }),
    })
    .default({ slots: 4, reroll: { base: 1, perWave: 0.5, step: 1 }, priceScale: { perWave: 0.1 } }),
  // Hoja del nivel: losetas del suelo y el material que sueltan los enemigos
  sprites: spritesSchema,
  floor: z
    .array(z.strictObject({ anim: z.string(), weight: z.number().positive().default(1) }))
    .min(1, 'el suelo necesita al menos una loseta'),
});

// Un esquema de zod que trae el propio comportamiento para validar los params de quien lo usa
const paramsSchema = z.custom<z.ZodType>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { safeParse?: unknown }).safeParse === 'function',
  'params tiene que ser un esquema de zod (z.object({ … }))',
);

export const behaviorSchema = z
  .strictObject({
    ...manifest,
    kind: z.literal('behavior'),
    target: z.enum(['enemy', 'weapon']),
    params: paramsSchema,
    update: hookFn.optional(),
    fire: hookFn.optional(),
  })
  .refine((b) => (b.target === 'enemy' ? b.update !== undefined : b.fire !== undefined), {
    message: 'un comportamiento de enemigo necesita update(); uno de arma, fire()',
  });

export const enemySchema = z.strictObject({
  ...manifest,
  kind: z.literal('enemy'),
  hp: z.number().positive(),
  hpPerWave: z.number().min(0).default(0),
  contactDamage: z.number().min(0),
  damagePerWave: z.number().min(0).default(0),
  speed: z.number().min(0),          // píxeles lógicos por segundo
  radius: z.number().positive(),     // círculo de colisión
  behavior: idSchema,
  params: z.record(z.string(), z.unknown()).default({}),
  loot: z
    .strictObject({
      materials: z.number().int().min(0),
      consumableChance: z.number().min(0).max(1).default(0),
    })
    .default({ materials: 1, consumableChance: 0 }),
  sprites: spritesSchema,
});

const shopEntrySchema = z.strictObject({
  price: z.number().int().positive(),
  weight: z.number().positive().default(1),
  minWave: z.number().int().min(1).default(1),
});

const tierSchema = z.strictObject({
  damage: z.number().min(0),
  cooldown: z.number().positive(),   // segundos entre ataques
  range: z.number().positive(),      // píxeles lógicos
  critChance: z.number().min(0).max(1).default(0),
  critMult: z.number().min(1).default(2),
});

export const weaponSchema = z.strictObject({
  ...manifest,
  kind: z.literal('weapon'),
  behavior: idSchema,
  params: z.record(z.string(), z.unknown()).default({}),
  // Cuánto suma de cada stat del jugador al daño: { 'ranged-damage': 1 } = 100 %
  scaling: z.record(idSchema, z.number()).default({}),
  tiers: z.array(tierSchema).min(1).max(4, 'un arma tiene como mucho 4 niveles (I–IV)'),
  // Direcciones en que se DIBUJA el arma: 0 = giro libre; 16 = pasos de 22,5°. La puntería no cambia.
  aimSteps: z.number().int().min(0).default(0),
  // Punto de agarre en píxeles de la celda idle; por defecto, el borde izquierdo a media altura
  grip: z.strictObject({ x: z.number(), y: z.number() }).optional(),
  shop: shopEntrySchema.optional(),
  sprites: spritesSchema,
});

export const itemSchema = z.strictObject({
  ...manifest,
  kind: z.literal('item'),
  modifiers: z.array(modifierSchema).default([]),
  maxStack: z.number().int().positive().default(99),
  shop: shopEntrySchema.optional(),
  // Opcional mientras no haya arte: sin icono, la tienda pinta la inicial sobre un cuadro
  sprites: spritesSchema.optional(),
  hooks,
});

export const SPAWN_PATTERNS = ['random', 'edge', 'ring', 'cluster'] as const;

export const waveSchema = z
  .strictObject({
    ...manifest,
    kind: z.literal('wave'),
    duration: z.number().positive(),  // segundos
    groups: z
      .array(
        z
          .strictObject({
            enemy: idSchema,
            from: z.number().min(0),
            to: z.number().positive(),
            every: z.number().positive(),
            count: z.number().int().positive(),
            pattern: z.enum(SPAWN_PATTERNS).default('random'),
          })
          .refine((g) => g.from < g.to, { message: 'from tiene que ser menor que to', path: ['from'] }),
      )
      .min(1, 'una oleada necesita al menos un grupo de enemigos'),
  })
  .refine((w) => w.groups.every((g) => g.to <= w.duration), {
    message: 'algún grupo termina después de que acabe la oleada (to > duration)',
    path: ['groups'],
  });

// Tipos que el motor ya sabe cargar. El resto llega en F1.
export const SCHEMAS = {
  stat: statSchema,
  behavior: behaviorSchema,
  character: characterSchema,
  weapon: weaponSchema,
  item: itemSchema,
  enemy: enemySchema,
  wave: waveSchema,
  level: levelSchema,
} as const satisfies Partial<Record<ModuleKind, z.ZodType>>;

export type SupportedKind = keyof typeof SCHEMAS;
export type StatModule = z.infer<typeof statSchema>;
export type BehaviorModule = z.infer<typeof behaviorSchema>;
export type CharacterModule = z.infer<typeof characterSchema>;
export type EnemyModule = z.infer<typeof enemySchema>;
export type WeaponModule = z.infer<typeof weaponSchema>;
export type WeaponTier = z.infer<typeof tierSchema>;
export type ItemModule = z.infer<typeof itemSchema>;
export type WaveModule = z.infer<typeof waveSchema>;
export type LevelModule = z.infer<typeof levelSchema>;
export type ContentModule = StatModule | BehaviorModule | CharacterModule | WeaponModule | ItemModule | EnemyModule | WaveModule | LevelModule;
