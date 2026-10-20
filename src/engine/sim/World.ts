import { angleTo, type EnemyApi, type EnemySelf, type Point, type WeaponApi, type WeaponShot } from '../api';
import type { BehaviorModule, EnemyModule, HookEvent, WaveModule, WeaponModule, WeaponTier } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import type { Rng } from './rng';
import { cellOf, keepInside, type Body } from './body';
import { SpatialHash } from './SpatialHash';

const TELEGRAPH_TIME = 1;              // aviso antes de que aparezca un enemigo
const MIN_SPAWN_DISTANCE = 64;
const IFRAMES = 0.6;                   // invulnerabilidad tras un golpe
const EDGE_MARGIN = 12;
const FIRE_ANIM_TIME = 0.15;           // cuánto se ve la animación de disparo
const MAGNET_SPEED_FACTOR = 3;         // los materiales vuelan a 3× la velocidad base del jugador

// Las formas que el validador ya garantizó para los comportamientos
type EnemyUpdate = (self: EnemySelf, dt: number, api: EnemyApi, params: unknown) => void;
type WeaponFire = (shot: WeaponShot, api: WeaponApi, params: unknown) => void;
export type StatReader = (id: string, weaponTags?: readonly string[]) => number;

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
  readonly cell: { w: number; h: number };
  hp: number;
  readonly maxHp: number;
  readonly contactDamage: number;
  alive: boolean;
}

export interface WeaponState {
  readonly slot: number;
  readonly def: WeaponModule;
  readonly tier: number;               // 0 = I … 3 = IV
  readonly behavior: BehaviorModule;
  readonly cell: { w: number; h: number };
  cooldown: number;
  angle: number;
  x: number;                           // punto de agarre en el mundo
  y: number;
  fireT: number;                       // > 0 mientras se ve la animación de disparo
  lunge: number;                       // 1 → 0 tras una estocada (lo pinta la vista)
}

export interface Projectile {
  readonly uid: number;
  readonly owner: 'player' | 'enemy';
  x: number;
  y: number;
  readonly vx: number;
  readonly vy: number;
  readonly angle: number;
  readonly damage: number;
  readonly critChance: number;
  readonly critMult: number;
  readonly radius: number;
  travel: number;                      // distancia que le queda por recorrer
  pierce: number;
  readonly hit: Set<number>;
  readonly source: string;             // "weapon:buzon" o "enemy:bicho-taza"
  readonly anim?: string;              // nombre semántico en sprites.anims del módulo source
}

export interface Material {
  readonly uid: number;
  x: number;
  y: number;
  readonly value: number;
  magnet: boolean;
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
  | { type: 'spawn'; uid: number }
  | { type: 'enemy-hit'; uid: number; x: number; y: number; amount: number; crit: boolean }
  | { type: 'enemy-die'; x: number; y: number }
  | { type: 'pickup'; value: number };

export type WorldStatus = 'playing' | 'dead' | 'cleared';

export interface WorldDeps {
  registry: Registry;
  wave: WaveModule;
  waveNumber: number;
  arena: { width: number; height: number };
  body: Body;
  weapons: ReadonlyArray<{ id: string; tier: number }>;
  rng: Rng;
  stat: StatReader;
  emit(event: HookEvent, data?: Record<string, unknown>): void;
  onKill(enemy: EnemyModule): void;
  onMaterials(amount: number): void;
}

// Estadísticas finales de un arma (DISENO.md 2.3): nivel + escalado con las stats del jugador + modificadores
export function weaponStats(def: WeaponModule, tierIndex: number, stat: StatReader) {
  const tier: WeaponTier = def.tiers[Math.min(tierIndex, def.tiers.length - 1)]!;
  const tags = def.tags ?? [];
  let flat = tier.damage;
  for (const [id, k] of Object.entries(def.scaling)) flat += k * stat(id);
  return {
    damage: Math.max(1, Math.round(flat * (1 + stat('damage-pct', tags) / 100))),
    cooldown: Math.max(0.05, tier.cooldown / (1 + stat('attack-speed-pct', tags) / 100)),
    range: Math.max(8, tier.range + stat('range', tags)),
    critChance: Math.min(1, tier.critChance + stat('crit-chance-pct', tags) / 100),
    critMult: tier.critMult,
  };
}

// Una oleada, a paso fijo y sin Phaser: se puede simular entera en un test
export class World {
  status: WorldStatus = 'playing';
  time = 0;
  readonly player: PlayerState;
  readonly enemies: EnemyState[] = [];
  readonly weapons: WeaponState[];
  readonly projectiles: Projectile[] = [];
  readonly materials: Material[] = [];
  readonly telegraphs: Telegraph[] = [];
  readonly fx: WorldFx[] = [];

  private readonly hash = new SpatialHash<EnemyState>(32); // tamaño de celda: solo rendimiento, vale a cualquier escala
  private maxEnemyRadius = 0;
  private readonly near: EnemyState[] = [];
  private readonly nextSpawn: number[];
  private uid = 0;
  private readonly enemyApi: EnemyApi;
  private readonly weaponApi: WorldWeaponApi;

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
    this.weapons = deps.weapons.map((w, slot) => {
      const def = deps.registry.weapon(w.id);
      return {
        slot,
        def,
        tier: w.tier,
        behavior: deps.registry.behavior(def.behavior),
        cell: cellOf(def.sprites, 'idle'),
        cooldown: 0.3 + slot * 0.1, // que no disparen todas en el mismo frame
        angle: 0,
        x: this.player.x,
        y: this.player.y,
        fireT: 0,
        lunge: 0,
      };
    });
    this.enemyApi = new WorldEnemyApi(this, deps.rng);
    this.weaponApi = new WorldWeaponApi(this, deps.rng);
  }

  get duration(): number {
    return this.deps.wave.duration;
  }

  get timeLeft(): number {
    return Math.max(0, this.deps.wave.duration - this.time);
  }

  get bodyCenter(): Point {
    return { x: this.player.x, y: this.player.y - this.deps.body.centerY };
  }

  step(dt: number, move: Point): void {
    if (this.status !== 'playing') return;
    this.time += dt;
    this.movePlayer(dt, move);
    this.spawn(dt);
    this.moveEnemies(dt);
    this.rebuildHash();
    this.contactDamage();
    this.fireWeapons(dt);
    this.moveProjectiles(dt);
    this.removeDead();
    this.collectMaterials(dt);

    if (this.status === 'playing' && this.time >= this.deps.wave.duration) {
      this.status = 'cleared';
      // Lo que quedó en el suelo se recoge solo al acabar la oleada
      const left = this.materials.reduce((sum, m) => sum + m.value, 0);
      if (left > 0) this.deps.onMaterials(left);
      this.materials.length = 0;
      this.enemies.length = 0;
      this.telegraphs.length = 0;
      this.projectiles.length = 0;
    }
  }

  heal(amount: number): void {
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(amount));
  }

  dropMaterials(at: Point, amount: number): void {
    for (let i = 0; i < amount; i++) {
      const pos = { x: at.x + (this.deps.rng() - 0.5) * 12, y: at.y + (this.deps.rng() - 0.5) * 12 };
      keepInside(pos, { w: 10, h: 10 }, this.deps.arena);
      this.materials.push({ uid: ++this.uid, x: pos.x, y: pos.y, value: 1, magnet: false });
    }
  }

  // ---------- jugador ----------

  private movePlayer(dt: number, move: Point): void {
    const p = this.player;
    const { body, arena } = this.deps;
    const speed = body.speed * (1 + this.deps.stat('speed-pct') / 100);
    p.vx = move.x * speed;
    p.vy = move.y * speed;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    keepInside(p, { w: body.cellW, h: body.cellH }, arena);
    if (p.iframes > 0) p.iframes -= dt;
  }

  private hitPlayer(raw: number, source: string): void {
    const p = this.player;
    if (p.iframes > 0 || this.status !== 'playing') return;
    p.iframes = IFRAMES;
    const dodge = Math.min(this.deps.stat('dodge-pct'), 60);
    if (this.deps.rng() * 100 < dodge) {
      this.fx.push({ type: 'dodge' });
      this.deps.emit('onDodge', { source });
      return;
    }
    const amount = Math.max(1, Math.round(raw * armorFactor(this.deps.stat('armor'))));
    p.hp = Math.max(0, p.hp - amount);
    this.fx.push({ type: 'player-hit', amount });
    this.deps.emit('onTakeDamage', { amount, source });
    if (p.hp <= 0) {
      this.deps.emit('onDeath', { source });
      this.status = 'dead';
    }
  }

  // ---------- enemigos ----------

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
      cell: cellOf(def.sprites, 'walk'),
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
    keepInside(e, e.cell, this.deps.arena);
    this.enemies.push(e);
    this.maxEnemyRadius = Math.max(this.maxEnemyRadius, def.radius);
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
    this.rebuildHash();
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

    for (const e of this.enemies) {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      keepInside(e, e.cell, this.deps.arena);
    }
  }

  private rebuildHash(): void {
    this.hash.clear();
    for (const e of this.enemies) if (e.alive) this.hash.insert(e);
  }

  private contactDamage(): void {
    if (this.player.iframes > 0) return;
    const { body } = this.deps;
    const c = this.bodyCenter;
    for (const e of this.hash.query(c.x, c.y, body.radius + this.maxEnemyRadius * 2, this.near)) {
      const dx = e.x - c.x;
      const dy = e.y - e.def.radius - c.y;
      const min = body.radius + e.def.radius;
      if (dx * dx + dy * dy >= min * min) continue;
      this.hitPlayer(e.contactDamage, `enemy:${e.def.id}`);
      return;
    }
  }

  damageEnemy(e: EnemyState, base: number, critChance: number, critMult: number, source: string): void {
    if (!e.alive) return;
    const crit = this.deps.rng() < critChance;
    const amount = Math.max(1, Math.round(base * (crit ? critMult : 1)));
    e.hp -= amount;
    this.fx.push({ type: 'enemy-hit', uid: e.uid, x: e.x, y: e.y - e.cell.h, amount, crit });
    this.deps.emit('onHit', { damage: amount, crit, enemy: e.def.id, source });
    if (e.hp > 0) return;
    e.alive = false;
    this.fx.push({ type: 'enemy-die', x: e.x, y: e.y - e.cell.h / 2 });
    this.dropMaterials({ x: e.x, y: e.y - e.cell.h / 2 }, e.def.loot.materials);
    this.deps.onKill(e.def);
    this.deps.emit('onKill', { enemy: e.def.id, source });
  }

  private removeDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i]!.alive) this.enemies.splice(i, 1);
  }

  // ---------- armas ----------

  // Las armas flotan en huecos fijos alrededor del cuerpo y apuntan solas al enemigo más cercano a su alcance
  private fireWeapons(dt: number): void {
    const n = this.weapons.length;
    const c = this.bodyCenter;
    const orbit = Math.max(12, Math.round(this.deps.body.cellW * 0.6));
    for (const w of this.weapons) {
      const slotAngle = n === 1 ? 0 : (w.slot / n) * Math.PI * 2;
      w.x = c.x + Math.cos(slotAngle) * orbit;
      w.y = c.y + Math.sin(slotAngle) * orbit * 0.6;
      if (w.fireT > 0) w.fireT -= dt;
      if (w.lunge > 0) w.lunge = Math.max(0, w.lunge - dt * 6);

      const stats = weaponStats(w.def, w.tier, this.deps.stat);
      const target = this.nearestEnemy(w.x, w.y, stats.range);
      if (target) w.angle = angleTo(w, { x: target.x, y: target.y - target.cell.h / 2 });
      w.cooldown -= dt;
      if (w.cooldown > 0 || !target) continue;

      const tipLen = w.cell.w - (w.def.grip?.x ?? 0);
      const shot: WeaponShot = {
        x: w.x + Math.cos(w.angle) * tipLen,
        y: w.y + Math.sin(w.angle) * tipLen,
        angle: w.angle,
        target: { x: target.x, y: target.y - target.cell.h / 2 },
        damage: stats.damage,
        range: stats.range,
        critChance: stats.critChance,
        critMult: stats.critMult,
      };
      try {
        this.weaponApi.source = `weapon:${w.def.id}`;
        (w.behavior.fire as WeaponFire)(shot, this.weaponApi, w.def.params);
      } catch (cause) {
        throw new Error(`El comportamiento "${w.behavior.id}" del arma "${w.def.id}" falló: ${(cause as Error).message}`, { cause });
      }
      w.cooldown = stats.cooldown;
      w.fireT = FIRE_ANIM_TIME;
    }
  }

  private nearestEnemy(x: number, y: number, range: number): EnemyState | null {
    let best: EnemyState | null = null;
    let bestD = range * range;
    for (const e of this.hash.query(x, y, range, this.near)) {
      const dx = e.x - x;
      const dy = e.y - e.cell.h / 2 - y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  addProjectile(p: Omit<Projectile, 'uid' | 'hit'>): void {
    this.projectiles.push({ ...p, uid: ++this.uid, hit: new Set() });
  }

  // Estocada o barrido: todo enemigo dentro de la franja recibe el golpe una vez
  meleeHit(shot: WeaponShot, reach: number, width: number, source: string): void {
    const cos = Math.cos(shot.angle);
    const sin = Math.sin(shot.angle);
    const weapon = this.weapons.find((w) => `weapon:${w.def.id}` === source);
    if (weapon) weapon.lunge = 1;
    const midX = shot.x + cos * (reach / 2);
    const midY = shot.y + sin * (reach / 2);
    for (const e of [...this.hash.query(midX, midY, reach / 2 + width + this.maxEnemyRadius * 2, this.near)]) {
      const ex = e.x - shot.x;
      const ey = e.y - e.cell.h / 2 - shot.y;
      const along = ex * cos + ey * sin;
      const across = Math.abs(-ex * sin + ey * cos);
      if (along < -e.def.radius || along > reach + e.def.radius || across > width / 2 + e.def.radius) continue;
      this.damageEnemy(e, shot.damage, shot.critChance, shot.critMult, source);
    }
  }

  private moveProjectiles(dt: number): void {
    const { arena } = this.deps;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]!;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.travel -= Math.hypot(p.vx, p.vy) * dt;
      let gone = p.travel <= 0 || p.x < 0 || p.y < 0 || p.x > arena.width || p.y > arena.height;

      if (!gone && p.owner === 'player') {
        for (const e of [...this.hash.query(p.x, p.y, p.radius + this.maxEnemyRadius * 2, this.near)]) {
          if (!e.alive || p.hit.has(e.uid)) continue;
          const dx = e.x - p.x;
          const dy = e.y - e.def.radius - p.y;
          const min = p.radius + e.def.radius;
          if (dx * dx + dy * dy >= min * min) continue;
          p.hit.add(e.uid);
          this.damageEnemy(e, p.damage, p.critChance, p.critMult, p.source);
          if (--p.pierce < 0) {
            gone = true;
            break;
          }
        }
      } else if (!gone) {
        const c = this.bodyCenter;
        const min = p.radius + this.deps.body.radius;
        if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < min * min) {
          this.hitPlayer(p.damage, p.source);
          gone = true;
        }
      }
      if (gone) this.projectiles.splice(i, 1);
    }
  }

  // ---------- materiales ----------

  private collectMaterials(dt: number): void {
    const c = this.bodyCenter;
    const range = this.deps.stat('pickup-range');
    const speed = this.deps.body.speed * MAGNET_SPEED_FACTOR;
    for (let i = this.materials.length - 1; i >= 0; i--) {
      const m = this.materials[i]!;
      const dx = c.x - m.x;
      const dy = c.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < range) m.magnet = true;
      if (!m.magnet) continue;
      if (d <= this.deps.body.radius + 4) {
        this.materials.splice(i, 1);
        this.deps.onMaterials(m.value);
        this.fx.push({ type: 'pickup', value: m.value });
        this.deps.emit('onPickup', { value: m.value });
        continue;
      }
      const step = Math.min(d, speed * dt);
      m.x += (dx / d) * step;
      m.y += (dy / d) * step;
    }
  }

  // ---------- spawns ----------

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

// Lo que ve un comportamiento de enemigo: la posición del jugador, el reloj y disparar
class WorldEnemyApi implements EnemyApi {
  constructor(private readonly world: World, readonly rng: () => number) {}

  get player(): Point {
    return this.world.bodyCenter;
  }

  get time(): number {
    return this.world.time;
  }

  shoot(self: EnemySelf, angle: number, speed: number, opts: { radius?: number; range?: number } = {}): void {
    const e = self as EnemyState;
    this.world.addProjectile({
      owner: 'enemy',
      x: e.x,
      y: e.y - e.cell.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      damage: e.contactDamage,
      critChance: 0,
      critMult: 1,
      radius: opts.radius ?? 3,
      travel: opts.range ?? 400,
      pierce: 0,
      source: `enemy:${e.def.id}`,
      anim: 'projectile',
    });
  }
}

// Lo que ve un comportamiento de arma: crear proyectiles o golpear cuerpo a cuerpo, nada más
class WorldWeaponApi implements WeaponApi {
  source = ''; // el arma que está disparando; lo pone el World antes de llamar a fire()

  constructor(private readonly world: World, readonly rng: () => number) {}

  projectile(shot: WeaponShot, opts: { angle?: number; speed: number; pierce?: number; radius?: number; anim?: string }): void {
    const angle = opts.angle ?? shot.angle;
    this.world.addProjectile({
      owner: 'player',
      x: shot.x,
      y: shot.y,
      vx: Math.cos(angle) * opts.speed,
      vy: Math.sin(angle) * opts.speed,
      angle,
      damage: shot.damage,
      critChance: shot.critChance,
      critMult: shot.critMult,
      radius: opts.radius ?? 3,
      travel: shot.range,
      pierce: opts.pierce ?? 0,
      source: this.source,
      anim: opts.anim,
    });
  }

  melee(shot: WeaponShot, opts: { reach: number; width: number }): void {
    this.world.meleeHit(shot, opts.reach, opts.width, this.source);
  }
}

// Armadura de Brotato: cada punto reduce menos que el anterior; la negativa aumenta el daño
export function armorFactor(armor: number): number {
  return armor >= 0 ? 15 / (15 + armor) : (15 - armor) / 15;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
