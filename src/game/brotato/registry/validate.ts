import { formatField, suggest, type ContentError } from './ContentError';
import {
  ENGINE_STATS,
  MAX_WEAPONS,
  TERRAIN_TILE,
  HOOK_EVENTS,
  KIND_FOLDERS,
  MODULE_KINDS,
  SCHEMAS,
  type BehaviorModule,
  type CharacterModule,
  type ContentModule,
  type EnemyModule,
  type ItemModule,
  type LevelModule,
  type ModuleKind,
  type Modifier,
  type StatModule,
  type SupportedKind,
  type WaveModule,
  type WeaponModule,
} from './schemas';

export interface DiscoveredModule {
  path: string;   // '/src/content/characters/maia/module.ts'
  value: unknown; // el export default del módulo
}

export class Registry {
  private readonly byKind = new Map<ModuleKind, Map<string, ContentModule>>();

  add(mod: ContentModule): void {
    const list = this.byKind.get(mod.kind) ?? new Map<string, ContentModule>();
    list.set(mod.id, mod);
    this.byKind.set(mod.kind, list);
  }

  has(kind: ModuleKind, id: string): boolean {
    return this.byKind.get(kind)?.has(id) ?? false;
  }

  ids(kind: ModuleKind): string[] {
    return [...(this.byKind.get(kind)?.keys() ?? [])];
  }

  stats(): StatModule[] { return this.all('stat') as StatModule[]; }
  characters(): CharacterModule[] { return this.all('character') as CharacterModule[]; }
  levels(): LevelModule[] { return this.all('level') as LevelModule[]; }

  enemies(): EnemyModule[] { return this.all('enemy') as EnemyModule[]; }
  weapons(): WeaponModule[] { return this.all('weapon') as WeaponModule[]; }
  items(): ItemModule[] { return this.all('item') as ItemModule[]; }

  character(id: string): CharacterModule { return this.get('character', id) as CharacterModule; }
  level(id: string): LevelModule { return this.get('level', id) as LevelModule; }
  wave(id: string): WaveModule { return this.get('wave', id) as WaveModule; }
  enemy(id: string): EnemyModule { return this.get('enemy', id) as EnemyModule; }
  behavior(id: string): BehaviorModule { return this.get('behavior', id) as BehaviorModule; }
  weapon(id: string): WeaponModule { return this.get('weapon', id) as WeaponModule; }
  item(id: string): ItemModule { return this.get('item', id) as ItemModule; }

  // Acceso genérico: el de cada tipo (character, weapon…) ya viene tipado; este sirve para recorrerlos todos
  get(kind: ModuleKind, id: string): ContentModule {
    const mod = this.byKind.get(kind)?.get(id);
    if (!mod) throw new Error(`Registry: no existe ningún ${kind} "${id}"`);
    return mod;
  }

  private all(kind: ModuleKind): ContentModule[] {
    return [...(this.byKind.get(kind)?.values() ?? [])];
  }
}

const FOLDER_TO_KIND = new Map(MODULE_KINDS.map((k) => [KIND_FOLDERS[k], k]));
const PATH_RE = /\/content\/brotato\/([^/]+)\/([^/]+)\/module\.ts$/;

// Junta TODOS los errores antes de devolver: un módulo roto no esconde a los demás
export function validateContent(found: readonly DiscoveredModule[]): { registry: Registry; errors: ContentError[] } {
  const errors: ContentError[] = [];
  const registry = new Registry();
  const paths = new Map<ContentModule, string>();

  for (const { path, value } of found) {
    const err = (message: string, field?: string) => errors.push({ path, field, message });
    const m = PATH_RE.exec(path);
    if (!m) {
      err('el módulo tiene que estar en src/content/<tipo>/<id>/module.ts');
      continue;
    }
    const [, folder, folderId] = m as unknown as [string, string, string];
    const kind = FOLDER_TO_KIND.get(folder);
    if (!kind) {
      err(`"${folder}" no es una carpeta de contenido.${suggest(folder, FOLDER_TO_KIND.keys())}`);
      continue;
    }
    if (typeof value !== 'object' || value === null) {
      err('el módulo no exporta nada por defecto: falta "export default define…({ … })"');
      continue;
    }
    const declared = (value as { kind?: unknown }).kind;
    if (declared !== kind) {
      err(`está en la carpeta de ${folder} pero declara kind "${String(declared)}": usa el define* de su tipo`, 'kind');
      continue;
    }
    const schema = SCHEMAS[kind as SupportedKind];
    if (!schema) {
      err(`el motor todavía no sabe cargar módulos de tipo "${kind}" (llegan en F1)`);
      continue;
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) err(issue.message, formatField(issue.path) || undefined);
      continue;
    }
    const mod = parsed.data as ContentModule;
    if (mod.id !== folderId) {
      err(`el id "${mod.id}" no coincide con el nombre de su carpeta "${folderId}"`, 'id');
      continue;
    }
    if (registry.has(kind, mod.id)) {
      err(`ya existe otro ${kind} con id "${mod.id}"`, 'id');
      continue;
    }
    registry.add(mod);
    paths.set(mod, path);
  }

  // Segunda pasada: referencias entre módulos, ya con todos registrados
  const statIds = registry.ids('stat');
  for (const stat of ENGINE_STATS) {
    if (!statIds.includes(stat)) {
      errors.push({ path: `src/content/brotato/stats/${stat}/module.ts`, message: `falta la estadística "${stat}", que el motor necesita para funcionar` });
    }
  }

  for (const [mod, path] of paths) {
    const err = (message: string, field?: string) => errors.push({ path, field, message });
    const ref = (kind: ModuleKind, id: string, field: string) => {
      if (!registry.has(kind, id)) err(`no existe ningún ${kind} "${id}".${suggest(id, registry.ids(kind))}`, field);
    };

    mod.requires?.forEach((r, i) => {
      const [kind, id] = r.split(':') as [string, string];
      if (!(MODULE_KINDS as readonly string[]).includes(kind)) err(`"${kind}" no es un tipo de módulo.${suggest(kind, MODULE_KINDS)}`, `requires[${i}]`);
      else ref(kind as ModuleKind, id, `requires[${i}]`);
    });

    if (mod.kind === 'character') {
      checkModifiers(mod.modifiers ?? [], statIds, err);
      for (const key of Object.keys(mod.baseStats ?? {})) {
        if (!statIds.includes(key)) err(`no existe la estadística "${key}".${suggest(key, statIds)}`, `baseStats.${key}`);
      }
      mod.startingWeapons?.forEach((w, i) => ref('weapon', w, `startingWeapons[${i}]`));
      if ((mod.startingWeapons?.length ?? 0) > MAX_WEAPONS) err(`como mucho ${MAX_WEAPONS} armas`, 'startingWeapons');
      checkHooks(mod.hooks, err);
    }

    if (mod.kind === 'enemy') {
      checkBehavior(registry, mod, 'enemy', err);
    }

    if (mod.kind === 'weapon') {
      checkBehavior(registry, mod, 'weapon', err);
      for (const key of Object.keys(mod.scaling)) {
        if (!statIds.includes(key)) err(`no existe la estadística "${key}".${suggest(key, statIds)}`, `scaling.${key}`);
      }
    }

    if (mod.kind === 'item') {
      checkModifiers(mod.modifiers, statIds, err);
      checkHooks(mod.hooks, err);
    }

    if (mod.kind === 'wave') {
      mod.groups.forEach((g, i) => ref('enemy', g.enemy, `groups[${i}].enemy`));
    }

    if (mod.kind === 'level') {
      mod.waves.forEach((w, i) => ref('wave', w, `waves[${i}]`));
      checkGrid(mod.arena, err);
    }
  }

  return { registry, errors };
}

type Report = (message: string, field?: string) => void;

// El comportamiento existe, es del tipo correcto, y los params cumplen el esquema que él mismo trae.
// Los params se sustituyen por los ya resueltos, con los valores por defecto del esquema aplicados:
// si no, un default que el módulo no escribe llega como undefined al comportamiento.
function checkBehavior(registry: Registry, mod: { behavior: string; params: Record<string, unknown> }, target: 'enemy' | 'weapon', err: Report): void {
  const id = mod.behavior;
  if (!registry.has('behavior', id)) {
    err(`no existe ningún behavior "${id}".${suggest(id, registry.ids('behavior'))}`, 'behavior');
    return;
  }
  const behavior = registry.behavior(id);
  if (behavior.target !== target) {
    err(`"${id}" es un comportamiento de ${behavior.target === 'enemy' ? 'enemigo' : 'arma'}, no de ${target === 'enemy' ? 'enemigo' : 'arma'}`, 'behavior');
    return;
  }
  const parsed = behavior.params.safeParse(mod.params);
  if (!parsed.success) for (const issue of parsed.error.issues) err(issue.message, formatField(['params', ...issue.path]));
  else mod.params = parsed.data as Record<string, unknown>;
}

// El mapa generado parte la arena en celdas de TERRAIN_TILE px
function checkGrid(arena: { width: number; height: number }, err: Report): boolean {
  if (arena.width % TERRAIN_TILE === 0 && arena.height % TERRAIN_TILE === 0) return true;
  err(`con el mapa generado, la arena tiene que medir múltiplos de ${TERRAIN_TILE} px (mide ${arena.width}×${arena.height})`, 'arena');
  return false;
}

function checkModifiers(mods: readonly Modifier[], statIds: string[], err: Report): void {
  mods.forEach((m, i) => {
    if (!statIds.includes(m.stat)) err(`no existe la estadística "${m.stat}".${suggest(m.stat, statIds)}`, `modifiers[${i}].stat`);
  });
}

function checkHooks(hooks: Record<string, unknown> | undefined, err: Report): void {
  for (const name of Object.keys(hooks ?? {})) {
    if (!(HOOK_EVENTS as readonly string[]).includes(name)) {
      err(`"${name}" no es un evento: este hook no se llamaría nunca.${suggest(name, HOOK_EVENTS)}`, `hooks.${name}`);
    }
  }
}
