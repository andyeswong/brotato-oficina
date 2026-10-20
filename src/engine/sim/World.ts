import type { EnemyApi, EnemySelf, Point } from '../api';
import type { BehaviorModule, EnemyModule, HookEvent, WaveModule } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import type { Rng } from './rng';
import { SpatialHash } from './SpatialHash';

export const BASE_SPEED = 90;          // píxeles lógicos por segundo con speed-pct = 0
export const PLAYER_RADIUS = 6;
export const PLAYER_BODY_OFFSET = 10;  // el centro del cuerpo está 10 px por encima de los pies
const TELEGRAPH_TIME = 1;              // aviso antes de que aparezca un enemigo
const MIN_SPAWN_DISTANCE = 64;
const IFRAMES = 0.6;                   // invulnerabilidad tras un golpe
const EDGE_MARGIN = 12;

// La forma que el validador ya garantizó para el update de un comportamiento de enemigo
type EnemyUpdate = (self: EnemySelf, dt: number, api: EnemyApi, params: unknown) => void;

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  iframes: number;
  vx: number;
  vy: number;
}

export interface EnemyState extends EnemySelf {
  x: number;
  y: number;
  readonly uid: number;
  readonly def: EnemyModule;
  readonly behavior: BehaviorModule;
  hp: number;
  readonly maxHp: number;
  readonly contactDamage: number;
  alive: boolean;
}

export interface Telegraph {
  x: number;
  y: number;
  t: number;
  readonly enemy: EnemyModule;
}

// Lo que la vista necesita saber para pintar efectos; la vista lo vacía cada frame
export type WorldFx =
  | { type: 'player-hit'; amount: number }
  | { type: 'dodge' }
  | { type: 'spawn'; uid: number };

export type WorldStatus = 'playing' | 'dead' | 'cleared';

export interface WorldDeps {
  registry: Registry;
  wave: WaveModule;
  waveNumber: number;
  arena: { width: number; height: number };
  rng: Rng;
  stat(id: string): number;
  emit(event: HookEvent, data?: Record<string, unknown>): void;
}

// Una oleada, a paso fijo y sin Phaser: se puede simular entera en un test
export class World {
  status: WorldStatus = 'playing';
  time = 0;
  readonly player: PlayerState;
  readonly enemies: EnemyState[] = [];
  readonly telegraphs: Telegraph[] = [];
  readonly fx: WorldFx[] = [];

  private readonly hash = new SpatialHash<EnemyState>(32);
  private readonly near: EnemyState[] = [];
  private readonly nextSpawn: number[];
  private uid = 0;
  private readonly enemyApi: EnemyApi;

  constructor(private readonly deps: WorldDeps) {
    const maxHp = Math.round(deps.stat('max-hp'));
    this.player = {
      x: Math.floor(deps.arena.width / 2),
      y: Math.floor(deps.arena.height / 2),
      hp: maxHp,
      maxHp,
      iframes: 0,
      vx: 0,
      vy: 0,
    };
    this.nextSpawn = deps.wave.groups.map((g) => g.from);
    this.enemyApi = new WorldEnemyApi(this, deps.rng);
  }

  get duration(): number {
    return this.deps.wave.duration;
  }

  get timeLeft(): number {
    return Math.max(0, this.deps.wave.duration - this.time);
  }

  step(dt: number, move: Point): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.movePlayer(dt, move);
    this.spawn(dt);
    this.moveEnemies(dt);
    this.contactDamage();

    if (this.status === 'playing' && this.time >= this.deps.wave.duration) {
      this.status = 'cleared';
      this.enemies.length = 0;
      this.telegraphs.length = 0;
    }
  }

  private movePlayer(dt: number, move: Point): void {
    const p = this.player;
    const speed = BASE_SPEED * (1 + this.deps.stat('speed-pct') / 100);
    p.vx = move.x * speed;
    p.vy = move.y * speed;
    const { width, height } = this.deps.arena;
    p.x = clamp(p.x + p.vx * dt, 8, width - 8);
    p.y = clamp(p.y + p.vy * dt, PLAYER_BODY_OFFSET + PLAYER_RADIUS, height - 2);
    if (p.iframes > 0) p.iframes -= dt;
  }

  // Los grupos de la oleada piden enemigos; primero sale un aviso y al segundo aparece el enemigo
  private spawn(dt: number): void {
    const { wave, registry } = this.deps;
    wave.groups.forEach((g, i) => {
      while (this.time >= this.nextSpawn[i]! && this.nextSpawn[i]! < g.to) {
        const enemy = registry.enemy(g.enemy);
        const center = this.spawnPoint(g.pattern);
        for (let n = 0; n < g.count; n++) {
          const pos = this.patternPoint(g.pattern, center, n, g.count);
          this.telegraphs.push({ x: pos.x, y: pos.y, t: TELEGRAPH_TIME, enemy });
        }
        this.nextSpawn[i]! += g.every;
      }
    });

    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const tg = this.telegraphs[i]!;
      tg.t -= dt;
      if (tg.t > 0) continue;
      this.telegraphs.splice(i, 1);
      this.addEnemy(tg.enemy, tg.x, tg.y);
    }
  }

  private addEnemy(def: EnemyModule, x: number, y: number): void {
    const w = this.deps.waveNumber - 1;
    const maxHp = Math.round(def.hp + def.hpPerWave * w);
    const e: EnemyState = {
      uid: ++this.uid,
      def,
      behavior: this.deps.registry.behavior(def.behavior),
      x,
      y,
      vx: 0,
      vy: 0,
      speed: def.speed,
      mem: {},
      hp: maxHp,
      maxHp,
      contactDamage: Math.round(def.contactDamage + def.damagePerWave * w),
      alive: true,
    };
    this.enemies.push(e);
    this.fx.push({ type: 'spawn', uid: e.uid });
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      try {
        (e.behavior.update as EnemyUpdate)(e, dt, this.enemyApi, e.def.params);
      } catch (cause) {
        throw new Error(`El comportamiento "${e.behavior.id}" del enemigo "${e.def.id}" falló: ${(cause as Error).message}`, { cause });
      }
    }

    // Separación: los enemigos se empujan entre sí para no apilarse en un solo píxel
    this.hash.clear();
    for (const e of this.enemies) this.hash.insert(e);
    for (const e of this.enemies) {
      for (const o of this.hash.query(e.x, e.y, e.def.radius * 2, this.near)) {
        if (o.uid <= e.uid) continue;
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        const min = e.def.radius + o.def.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const push = ((min - d) / 2) * 0.5;
        e.x -= (dx / d) * push;
        e.y -= (dy / d) * push;
        o.x += (dx / d) * push;
        o.y += (dy / d) * push;
      }
    }

    const { width, height } = this.deps.arena;
    for (const e of this.enemies) {
      e.x = clamp(e.x + e.vx * dt, e.def.radius, width - e.def.radius);
      e.y = clamp(e.y + e.vy * dt, e.def.radius * 2, height - 1);
    }
  }

  private contactDamage(): void {
    const p = this.player;
    if (p.iframes > 0) return;
    const px = p.x;
    const py = p.y - PLAYER_BODY_OFFSET;
    this.hash.clear();
    for (const e of this.enemies) this.hash.insert(e);
    for (const e of this.hash.query(px, py, PLAYER_RADIUS + 16, this.near)) {
      const dx = e.x - px;
      const dy = e.y - e.def.radius - py;
      const min = PLAYER_RADIUS + e.def.radius;
      if (dx * dx + dy * dy >= min * min) continue;
      this.hitPlayer(e.contactDamage, e);
      return;
    }
  }

  private hitPlayer(raw: number, source: EnemyState): void {
    const p = this.player;
    p.iframes = IFRAMES;
    const dodge = Math.min(this.deps.stat('dodge-pct'), 60);
    if (this.deps.rng() * 100 < dodge) {
      this.fx.push({ type: 'dodge' });
      this.deps.emit('onDodge', { enemy: source.def.id });
      return;
    }
    const amount = Math.max(1, Math.round(raw * armorFactor(this.deps.stat('armor'))));
    p.hp = Math.max(0, p.hp - amount);
    this.fx.push({ type: 'player-hit', amount });
    this.deps.emit('onTakeDamage', { amount, enemy: source.def.id });
    if (p.hp <= 0) {
      this.deps.emit('onDeath', { enemy: source.def.id });
      this.status = 'dead';
    }
  }

  private spawnPoint(pattern: string): Point {
    const { width, height } = this.deps.arena;
    const rng = this.deps.rng;
    if (pattern === 'edge') {
      const side = Math.floor(rng() * 4);
      const along = (n: number) => EDGE_MARGIN + rng() * (n - EDGE_MARGIN * 2);
      if (side === 0) return { x: along(width), y: EDGE_MARGIN * 2 };
      if (side === 1) return { x: along(width), y: height - EDGE_MARGIN };
      if (side === 2) return { x: EDGE_MARGIN, y: along(height) };
      return { x: width - EDGE_MARGIN, y: along(height) };
    }
    if (pattern === 'ring') return { x: this.player.x, y: this.player.y };
    // random y cluster: un punto lejos del jugador
    let best = { x: 0, y: 0 };
    for (let i = 0; i < 10; i++) {
      best = { x: EDGE_MARGIN + rng() * (width - EDGE_MARGIN * 2), y: EDGE_MARGIN * 2 + rng() * (height - EDGE_MARGIN * 3) };
      if (Math.hypot(best.x - this.player.x, best.y - this.player.y) >= MIN_SPAWN_DISTANCE) break;
    }
    return best;
  }

  private patternPoint(pattern: string, center: Point, n: number, count: number): Point {
    const { width, height } = this.deps.arena;
    const rng = this.deps.rng;
    let x = center.x;
    let y = center.y;
    if (pattern === 'ring') {
      const angle = (n / count) * Math.PI * 2 + rng() * 0.3;
      x += Math.cos(angle) * 120;
      y += Math.sin(angle) * 120;
    } else if (pattern === 'cluster') {
      x += (rng() - 0.5) * 40;
      y += (rng() - 0.5) * 40;
    } else if (pattern === 'random' && n > 0) {
      return this.spawnPoint('random');
    } else if (pattern === 'edge' && n > 0) {
      return this.spawnPoint('edge');
    }
    return { x: clamp(x, EDGE_MARGIN, width - EDGE_MARGIN), y: clamp(y, EDGE_MARGIN * 2, height - EDGE_MARGIN) };
  }
}

// Lo que ve un comportamiento de enemigo: la posición del jugador y el reloj, nada más
class WorldEnemyApi implements EnemyApi {
  constructor(private readonly world: World, readonly rng: () => number) {}

  get player(): Point {
    return { x: this.world.player.x, y: this.world.player.y };
  }

  get time(): number {
    return this.world.time;
  }
}

// Armadura de Brotato: cada punto reduce menos que el anterior; la negativa aumenta el daño
export function armorFactor(armor: number): number {
  return armor >= 0 ? 15 / (15 + armor) : (15 - armor) / 15;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
