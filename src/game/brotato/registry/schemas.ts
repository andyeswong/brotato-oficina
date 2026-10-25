import { z } from 'zod';
import { SOURCE_PRESETS, type SourceKind } from '@voxpix/lighting/lights';

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
export const ENGINE_STATS = ['max-hp', 'speed-pct', 'armor', 'dodge-pct', 'hp-regen', 'life-steal-pct'] as const;

export const MAX_WEAPONS = 6;
// Lado de una celda del mapa de terreno, en píxeles lógicos (el mismo que las piezas de agua)
export const TERRAIN_TILE = 16;

// Contadores de partida que un modificador "per" puede usar
export const COUNTERS = ['distinct-weapons', 'wave', 'kills', 'materials', 'items'] as const;
export type CounterId = (typeof COUNTERS)[number];

// Los mundos (temas de nivel). Armas y enemigos tienen un aspecto por mundo (looks) que la simulación no mira.
export const THEME_IDS = ['oficina', 'medieval', 'cyberpunk'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

// El aspecto de un arma o un enemigo en un mundo: nombre y descripción que se enseñan, y su modelo de vóxeles
// (models/brotato/<model>.json). Solo lo lee la vista: el papel en el juego (stats, comportamiento, tamaño) es el
// mismo en todos los mundos (MAIA, 2026-10-25), y lo comprueba test/brotato/looks.test.ts.
const modelRef = z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'el modelo se escribe "carpeta/nombre", relativo a models/brotato');
export const lookSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  model: modelRef,
  projectile: modelRef.optional(),   // armas: el modelo de lo que dispara
});
export type Look = z.infer<typeof lookSchema>;
const looksSchema = z.strictObject({ oficina: lookSchema, medieval: lookSchema.optional(), cyberpunk: lookSchema.optional() });

// La luz que lleva el personaje en cada mundo (linterna, antorcha...): solo de aspecto, siempre equipada y fuera de
// la tienda (MAIA, 2026-10-25). model es el objeto en la mano; kind, el tipo de luz del núcleo; cone, si es un foco,
// su apertura en grados (sin él, luz puntual); hand y emit, dónde se coge y de dónde sale la luz. La simulación no
// la lee.
const carryLightSchema = z.strictObject({
  model: modelRef,
  kind: z.enum(Object.keys(SOURCE_PRESETS) as [SourceKind, ...SourceKind[]]),
  cone: z.number().min(1).max(180).optional(),
  // Ajustes sobre el preset, por mundo (NARUTO: no en el preset, que también usan las luces fijas del mapa). Con un
  // ambiente alto a la luz le queda poco margen hasta 1, y hay que compensarlo con la intensidad.
  intensity: z.number().positive().optional(),
  radius: z.number().positive().optional(),
  color: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  hand: z.tuple([z.number(), z.number(), z.number()]),       // dónde va el agarre, desde los pies del personaje (mirando al frente, y negativo)
  emit: z.tuple([z.number(), z.number(), z.number()]),       // de dónde sale la luz, desde el agarre del modelo (la lente, la llama)
});
export type CarryLight = z.infer<typeof carryLightSchema>;

// El aspecto de un ítem en un mundo: nombre y descripción que se enseñan en la tienda, y su icono (un modelo de
// vóxeles, cuando llegue la interfaz). Como las armas: la simulación no lo lee.
const itemLookSchema = z.strictObject({ name: z.string().min(1), description: z.string().optional(), icon: modelRef.optional() });
const itemLooksSchema = z.strictObject({ oficina: itemLookSchema, medieval: itemLookSchema.optional(), cyberpunk: itemLookSchema.optional() });

export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'el id va en kebab-case: minúsculas, números y guiones');

const manifest = {
  format: z.literal(1),
  id: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  requires: z.array(z.string().regex(/^[a-z]+:[a-z0-9-]+$/, 'se escribe "tipo:id", por ejemplo "weapon:tiro"')).optional(),
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
  // El cuerpo, en vóxeles (1 vóxel = 1 px del juego). En el Brotato salía de la hoja de sprites; aquí se escribe.
  body: z.strictObject({
    radius: z.number().positive(),               // círculo de colisión, en el suelo
    centerY: z.number().min(0),                  // altura del centro del cuerpo sobre los pies (z)
    speed: z.number().positive(),                // vóxeles por segundo con speed-pct = 0
    orbit: z.number().positive().default(14),    // radio del círculo en que flotan sus armas
  }),
  carryLight: z.strictObject({ oficina: carryLightSchema, medieval: carryLightSchema.optional(), cyberpunk: carryLightSchema.optional() }).optional(),
  hooks,
});

const pickSchema = z.strictObject({ anim: z.string(), weight: z.number().positive().default(1) });
const sourceKindSchema = z.enum(Object.keys(SOURCE_PRESETS) as [SourceKind, ...SourceKind[]]);

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
  // Tema del mundo de vóxeles (paleta y materiales de src/world/build.ts)
  theme: z.enum(THEME_IDS),
  // Mapa generado (src/worldgen): uno distinto en cada partida, sacado de la semilla de la partida, y construido en
  // vóxeles (src/world/build.ts). El tamaño sale de la arena (una celda cada 16 px).
  generator: z
    .strictObject({
      floors: z.array(pickSchema).min(1),
      caps: z.tuple([z.string(), z.string()]),                 // tapa de las paredes, alternadas
      facade: z.strictObject({                                  // la pared norte, de 16x32 por columna
        fill: z.array(pickSchema).min(1),
        neutral: z.string(),
        door: z.string(),
        flank: z.string().optional(),
        banner: z.string().optional(),
        crest: z.string().optional(),
        emits: z.record(z.string(), sourceKindSchema).default({}),   // qué piezas son fuente de luz
      }),
      water: z
        .strictObject({ ocean: z.boolean().default(false), lake: z.boolean().default(false), puddles: z.number().int().min(0).default(0) })
        .default({ ocean: false, lake: false, puddles: 0 }),
      pillars: z.number().int().min(0).default(0),
      props: z.array(z.strictObject({
        anim: z.string(),                 // con el pie en la fila de abajo de su huella
        w: z.number().int().positive(),   // huella, en celdas
        h: z.number().int().positive(),
        count: z.number().int().min(0),
        emits: sourceKindSchema.optional(),
        edge: z.boolean().optional(),     // pegado a una pared
      })).default([]),
    }),
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
  height: z.number().positive().default(14),   // alto del cuerpo: dónde salen los números de daño (vista)
  looks: looksSchema,                          // su aspecto en cada mundo (el de la oficina, obligatorio)
});

const shopEntrySchema = z.strictObject({
  price: z.number().int().positive(),
  weight: z.number().positive().default(1),
  minWave: z.number().int().min(1).default(1),
  // Puesto en la lista de la que sale cada oferta (las armas antes que los ítems, cada grupo por este número). Sin
  // él, el orden dependería del nombre de la carpeta: renombrar un módulo cambiaría qué sale en la tienda con la
  // misma semilla. Empate o sin número: por id.
  order: z.number().int().min(0).optional(),
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
  // Del agarre a la punta, en vóxeles: de ahí sale el disparo o empieza el golpe (en el Brotato, ancho de la celda
  // menos el agarre)
  length: z.number().positive().default(16),
  shop: shopEntrySchema.optional(),
  looks: looksSchema,                          // su aspecto en cada mundo (el de la oficina, obligatorio)
});

export const itemSchema = z.strictObject({
  ...manifest,
  kind: z.literal('item'),
  modifiers: z.array(modifierSchema).default([]),
  maxStack: z.number().int().positive().default(99),
  shop: shopEntrySchema.optional(),
  looks: itemLooksSchema,                      // su aspecto en cada mundo (el de la oficina, obligatorio)
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
