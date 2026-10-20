import type { GameApi, HookFn, Point } from '../api';
import type { CharacterModule, CounterId, HookEvent, LevelModule } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import { StatSheet, type StatDef } from '../stats/StatSheet';
import { createRng, type Rng } from './rng';
import { World } from './World';

interface HookSource {
  id: string; // "character:maia", "item:cafe#2"…
  hooks: Partial<Record<HookEvent, HookFn>>;
}

// El estado de una partida entera, fuera de las escenas: cambiar de escena no pierde nada
export class Run {
  readonly rng: Rng;
  readonly stats: StatSheet;
  waveIndex = 0;
  kills = 0;
  materials = 0;
  world: World | null = null;

  // La vista se engancha aquí
  onFloatingText: (text: string, at?: Point) => void = () => {};
  onHookError: (message: string) => void = () => {};

  private readonly disabledHooks = new Set<string>();
  private readonly api: GameApi;


  constructor(
    readonly registry: Registry,
    readonly character: CharacterModule,
    readonly level: LevelModule,
    readonly seed = Date.now() >>> 0,
  ) {
    this.rng = createRng(seed);
    const defs = new Map<string, StatDef>(registry.stats().map((s) => [s.id, s]));
    this.stats = new StatSheet(defs, character.baseStats, (c) => this.counter(c as CounterId));
    this.stats.setSource(`character:${character.id}`, character.modifiers ?? []);

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
      case 'distinct-weapons': return 0; // llega con las armas (hito 2)
      case 'items': return 0;            // llega con la tienda (hito 3)
    }
  }

  startWave(): World {
    const wave = this.registry.wave(this.level.waves[this.waveIndex]!);
    this.stats.invalidate();
    this.world = new World({
      registry: this.registry,
      wave,
      waveNumber: this.waveNumber,
      arena: this.level.arena,
      rng: this.rng,
      stat: (id) => this.stats.get(id),
      emit: (event, data) => this.emit(event, data),
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
}
