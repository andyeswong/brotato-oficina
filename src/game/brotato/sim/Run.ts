import type { GameApi, HookFn, Point } from '../api';
import { metaDashCharges, metaModifiers, metaStartMaterials } from '../meta/upgrades';
import { MAX_WEAPONS, type CharacterModule, type CounterId, type HookEvent, type LevelModule } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import { StatSheet, type StatDef } from '../stats/StatSheet';
import { Arena } from './arena';
import { createRng, type Rng } from './rng';
import { Shop, type ShopResult } from './Shop';
import { World, type Body } from './World';

interface HookSource {
  id: string; // "character:maia", "item:cafe#2"…
  hooks: Partial<Record<HookEvent, HookFn>>;
}

// El estado de una partida entera, fuera de las escenas: cambiar de escena no pierde nada
export class Run {
  readonly rng: Rng;
  readonly stats: StatSheet;
  readonly body: Body;
  waveIndex = 0;
  kills = 0;
  materials = 0;
  // Armas equipadas (hasta 6): id y nivel (0 = I)
  readonly weapons: Array<{ id: string; tier: number }>;
  readonly startingWeaponIds: string[];
  // Ítems comprados, uno por unidad (tres cafés = tres entradas)
  readonly items: string[] = [];
  readonly shop: Shop;
  world: World | null = null;
  // El mundo de vóxeles de la partida: sale de la semilla y dura todas las oleadas
  readonly arena: Arena;
  // Cargas de dash que da el árbol de mejoras (0: sin dash); cada oleada empieza con todas
  readonly dashCharges: number;

  // La vista se engancha aquí
  onFloatingText: (text: string, at?: Point) => void = () => {};
  onHookError: (message: string) => void = () => {};

  private readonly disabledHooks = new Set<string>();
  private readonly api: GameApi;


  constructor(
    readonly registry: Registry,
    readonly character: CharacterModule,
    readonly level: LevelModule,
    readonly seed: number,
    // meta: los niveles de las mejoras entre partidas (meta/upgrades.ts); una entrada como la semilla
    options: { weapons?: string[]; foliage?: boolean; glass?: boolean; bushes?: boolean; meta?: Readonly<Record<string, number>> } = {},
  ) {
    this.rng = createRng(seed);
    this.arena = new Arena(level, seed, { foliage: options.foliage, glass: options.glass, bushes: options.bushes });
    this.body = character.body;
    const defs = new Map<string, StatDef>(registry.stats().map((s) => [s.id, s]));
    this.stats = new StatSheet(defs, character.baseStats, (c) => this.counter(c as CounterId));
    this.stats.setSource(`character:${character.id}`, character.modifiers ?? []);
    if (options.meta) {
      this.stats.setSource('meta', metaModifiers(options.meta));
      this.materials = metaStartMaterials(options.meta);
    }
    this.dashCharges = options.meta ? metaDashCharges(options.meta) : 0;
    this.startingWeaponIds = (options.weapons ?? character.startingWeapons ?? []).slice(0, 6);
    this.weapons = this.startingWeaponIds.map((id) => ({ id, tier: 0 }));
    this.shop = new Shop(this);

    this.api = new RunApi(this);
  }

  get waveNumber(): number {
    return this.waveIndex + 1;
  }

  get totalWaves(): number {
    return this.level.waves.length;
  }

  get isLastWave(): boolean {
    return this.waveIndex === this.level.waves.length - 1;
  }

  counter(id: CounterId): number {
    switch (id) {
      case 'wave': return this.waveNumber;
      case 'kills': return this.kills;
      case 'materials': return this.materials;
      case 'distinct-weapons': return new Set(this.weapons.map((w) => w.id)).size;
      case 'items': return this.items.length;
    }
  }

  startWave(): World {
    const wave = this.registry.wave(this.level.waves[this.waveIndex]!);
    this.stats.invalidate();
    this.world = new World({
      registry: this.registry,
      wave,
      waveNumber: this.waveNumber,
      spawn: this.level.spawn,
      arena: this.arena,
      final: this.isLastWave,
      body: this.body,
      dashCharges: this.dashCharges,
      weapons: this.weapons,
      rng: this.rng,
      stat: (id, tags) => this.stats.get(id, tags),
      emit: (event, data) => this.emit(event, data),
      onKill: () => {
        this.kills++;
        this.stats.invalidate(); // por si algún modificador escala con las muertes
      },
      onMaterials: (amount) => {
        this.materials += amount;
        this.stats.invalidate();
      },
    });
    if (this.waveIndex === 0) this.emit('onRunStart');
    this.emit('onWaveStart', { wave: this.waveNumber });
    return this.world;
  }

  // Tras una oleada superada: 'victory' si era la última, 'next' si queda otra
  finishWave(): 'next' | 'victory' {
    this.emit('onWaveEnd', { wave: this.waveNumber });
    if (this.isLastWave) {
      this.emit('onRunEnd', { result: 'victory' });
      return 'victory';
    }
    this.waveIndex++;
    return 'next';
  }

  spend(amount: number): void {
    this.materials -= amount;
    this.stats.invalidate();
  }

  itemCount(id: string): number {
    return this.items.filter((i) => i === id).length;
  }

  // Cada unidad de un ítem es una fuente de modificadores propia: venderla será quitar solo esa
  addItem(id: string): ShopResult {
    const item = this.registry.item(id);
    if (this.itemCount(id) >= item.maxStack) return { ok: false, reason: `Ya tienes el máximo de ${item.name}` };
    this.items.push(id);
    this.stats.setSource(`item:${id}#${this.itemCount(id)}`, item.modifiers);
    return { ok: true };
  }

  // Con hueco, el arma entra; con las 6 llenas, se fusiona con una igual del mismo nivel (sube de nivel)
  addWeapon(id: string, tier = 0): ShopResult {
    if (this.weapons.length < MAX_WEAPONS) {
      this.weapons.push({ id, tier });
      this.stats.invalidate();
      return { ok: true };
    }
    const maxTier = this.registry.weapon(id).tiers.length - 1;
    const twin = this.weapons.find((w) => w.id === id && w.tier === tier && w.tier < maxTier);
    if (!twin) return { ok: false, reason: `Ya llevas ${MAX_WEAPONS} armas` };
    twin.tier++;
    return { ok: true };
  }

  // ¿Entra sin quitar otra? (hay hueco, o una igual del mismo nivel con la que fusionarse)
  fitsWeapon(id: string, tier = 0): boolean {
    if (this.weapons.length < MAX_WEAPONS) return true;
    const maxTier = this.registry.weapon(id).tiers.length - 1;
    return this.weapons.some((w) => w.id === id && w.tier === tier && w.tier < maxTier);
  }

  // Con las 6 llenas, la jugadora elige cuál deja (Andrés, 2026-10-26): la nueva ocupa su casilla. Sin devolución
  replaceWeapon(slot: number, id: string, tier = 0): ShopResult {
    if (!this.weapons[slot]) return { ok: false, reason: 'Esa casilla está vacía' };
    this.weapons[slot] = { id, tier };
    this.stats.invalidate();
    return { ok: true };
  }

  lose(): void {
    this.emit('onRunEnd', { result: 'defeat' });
  }

  emit(event: HookEvent, data: Record<string, unknown> = {}): void {
    for (const source of this.hookSources()) {
      const fn = source.hooks[event];
      const key = `${source.id}.${event}`;
      if (!fn || this.disabledHooks.has(key)) continue;
      try {
        fn(data, this.api);
      } catch (e) {
        // Nunca en silencio: se desactiva ese hook y se avisa con el módulo que lo causó
        this.disabledHooks.add(key);
        const message = `El hook ${event} de ${source.id} falló y se desactivó: ${(e as Error).message}`;
        console.error(message, e);
        this.onHookError(message);
      }
    }
  }

  private hookSources(): HookSource[] {
    const sources: HookSource[] = [];
    if (this.character.hooks) sources.push({ id: `character:${this.character.id}`, hooks: this.character.hooks as HookSource['hooks'] });
    // Un hook por unidad de ítem, como sus modificadores
    this.items.forEach((id, i) => {
      const hooks = this.registry.item(id).hooks;
      if (hooks) sources.push({ id: `item:${id}#${i}`, hooks: hooks as HookSource['hooks'] });
    });
    return sources;
  }
}

// La fachada que reciben los hooks
class RunApi implements GameApi {
  constructor(private readonly run: Run) {}

  get wave(): number {
    return this.run.waveNumber;
  }

  get isLastWave(): boolean {
    return this.run.isLastWave;
  }

  get player(): Point {
    const p = this.run.world?.player;
    return { x: p?.x ?? 0, y: p?.y ?? 0 };
  }

  stat(id: string): number {
    return this.run.stats.get(id);
  }

  counter(id: CounterId): number {
    return this.run.counter(id);
  }

  rng(): number {
    return this.run.rng();
  }

  floatingText(text: string, at?: Point): void {
    this.run.onFloatingText(text, at);
  }

  heal(amount: number): void {
    this.run.world?.heal(amount);
  }

  dropMaterials(at: Point, amount: number): void {
    this.run.world?.dropMaterials(at, amount);
  }
}
