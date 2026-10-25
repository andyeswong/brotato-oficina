// RUNTIME DEL BROTATO (FERN): una partida (el Run del Brotato sobre el mundo de vóxeles) y su reflejo en el mundo.
// Cada cosa de la simulación que se ve es una entidad del mundo: MAIA con su luz, los enemigos con el aspecto del tema
// y su rig de andar, las armas en su órbita, los disparos y los materiales. Determinista: sin reloj ni azar del
// navegador (la vista solo pinta y lee la entrada). El tick es uno solo: entrada -> oleada (simulación) -> entidades
// -> world.step().
import type { VoxelSource } from '../../core';
import type { EntityId } from '../../world/state';
import { TICK } from '../../world/state';
import type { Registry } from './registry/validate';
import type { LevelModule, ThemeId } from './registry/schemas';
import { Run } from './sim/Run';
import type { World as Wave } from './sim/World';
import { pickLevel } from './sim/arena';
import { lookOf } from './looks';
import { turn, type CarryConfig, type TickInput } from '../runtime';

// Lo que la vista le da a la partida para dibujarse: los modelos (por su referencia en models/brotato) y los cuadros
// de andar de un enemigo (su rig), y el aspecto de MAIA
export interface Models {
  model(ref: string): VoxelSource;
  walk(ref: string, role: string): { frames: VoxelSource[]; ms: number } | null;
}
export interface PlayerLooks {
  model: VoxelSource;
  walk: VoxelSource[];
  walkMs: number;
  carry?: CarryConfig;
}

// wave: se juega. cleared: oleada superada, un respiro antes de la tienda. shop: la tienda (el mundo sigue debajo).
// dead / victory: la partida acabó.
export type Phase = 'wave' | 'cleared' | 'shop' | 'dead' | 'victory';

// El respiro entre la oleada superada y la tienda, en ticks (1,2 s, como el Brotato en Phaser)
export const CLEARED_TICKS = 72;

const WEAPON_Z = 5;       // a qué altura sobre los pies flotan las armas
const SHOT_Z = 7;         // y vuelan los disparos

// Todo giro de una entidad va a uno de los 8 rumbos (múltiplos de 45°), como MAIA y los rigs. El compositor guarda
// un sprite por modelo y giro: con giros continuos (armas apuntando, enemigos y disparos según su velocidad) cada
// cuadro creaba sprites nuevos que no se soltaban nunca, unos 220 MB por partida hasta agotar la memoria.
export function heading(deg: number): number {
  return (((Math.round(deg / 45) * 45) % 360) + 360) % 360;
}

// Los 8 rumbos que puede tener cualquier entidad de la partida
export const HEADINGS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

export class BrotatoGame {
  readonly run: Run;
  readonly theme: ThemeId;
  tick = 0;
  phase: Phase = 'wave';
  phaseTick = 0;                 // ticks dados en esta fase (el del cambio no cuenta)
  readonly playerId: EntityId;
  private wave: Wave;
  private facing = 0;            // 8 direcciones, como el runtime de la escena: sur 0, este 2, norte 4
  private walked = 0;            // segundos andando: elige el cuadro del walk
  private moving = false;
  private carryId: EntityId | null = null;
  private weaponIds: EntityId[] = [];
  private readonly enemyIds = new Map<number, EntityId>();
  private readonly shotIds = new Map<number, EntityId>();
  private readonly materialIds = new Map<number, EntityId>();

  constructor(registry: Registry, seed: number, private readonly models: Models, private readonly player: PlayerLooks, level?: LevelModule) {
    const lv = level ?? pickLevel(registry.levels(), seed);
    this.run = new Run(registry, registry.character('maia'), lv, seed);
    this.theme = lv.theme;
    this.wave = this.run.startWave();
    const p = this.wave.player;
    const state = this.state;
    this.playerId = state.entities.add({ model: player.model, x: Math.round(p.x), y: Math.round(p.y), z: p.z, facing: 0, castsShadow: 'always' });
    const carry = player.carry;
    if (carry) {
      this.carryId = state.entities.add({ model: carry.model, x: Math.round(p.x), y: Math.round(p.y), z: p.z, facing: 0, castsShadow: false });
      // La luz sigue al cuerpo, que así es su dueño y no la tapa (como en el runtime de la escena)
      const offset = [carry.hand[0] + carry.emit[0], carry.hand[1] + carry.emit[1], carry.hand[2] + carry.emit[2]] as const;
      state.lights.add({
        kind: carry.kind, x: p.x, y: p.y, z: p.z, ...(carry.cone ? { cone: carry.cone } : {}),
        ...(carry.intensity ? { intensity: carry.intensity } : {}), ...(carry.radius ? { radius: carry.radius } : {}),
        ...(carry.color ? { color: carry.color } : {}),
        follow: { entity: this.playerId, offset, ...(carry.cone ? { dir: [0, -1, -0.3] as const } : {}) },
      });
    }
    this.placeWeapons();
    this.sync();
  }

  // Todo lo que esta partida puede poner en el mundo, para precalentar el atlas al cargar (NARUTO): cada modelo se ve
  // solo en los 8 rumbos de HEADINGS. MAIA (quieta y su walk) y lo que lleva en la mano; todas las armas que pueden
  // salir (iniciales y de tienda) con su disparo; los enemigos de las oleadas del nivel con los cuadros de su rig; el
  // escupitajo y el material del tema.
  preloadModels(): VoxelSource[] {
    const out = new Set<VoxelSource>([this.player.model, ...this.player.walk]);
    if (this.player.carry && typeof this.player.carry.model !== 'number') out.add(this.player.carry.model);
    const reg = this.run.registry;
    for (const w of reg.weapons()) {
      const look = lookOf(w, this.theme);
      out.add(this.models.model(look.model));
      if (look.projectile) out.add(this.models.model(look.projectile));
    }
    const enemies = new Set(this.run.level.waves.flatMap((id) => reg.wave(id).groups.map((g) => g.enemy)));
    for (const id of enemies) {
      const e = reg.enemy(id), look = lookOf(e, this.theme);
      const walk = this.models.walk(look.model, e.id);
      for (const m of walk ? walk.frames : [this.models.model(look.model)]) out.add(m);
    }
    out.add(this.models.model(`efectos/escupitajo-${this.theme}`));
    out.add(this.models.model(`efectos/material-${this.theme}`));
    return [...out];
  }

  get state() {
    return this.run.arena.state;
  }

  get current(): Wave {
    return this.wave;
  }

  step(input: TickInput): void {
    if (this.phase === 'wave') {
      const len = Math.hypot(input.dx, input.dy);
      this.moving = len > 0;
      if (this.moving) {
        this.walked += TICK;
        this.facing = ((Math.round(Math.atan2(input.dx, -input.dy) / (Math.PI / 4)) % 8) + 8) % 8;
      }
      this.wave.step(TICK, this.moving ? { x: input.dx / len, y: input.dy / len } : { x: 0, y: 0 });
      this.phaseTick++;
      if (this.wave.status === 'dead') {
        this.setPhase('dead');
        this.run.lose();
      } else if (this.wave.status === 'cleared') {
        // Como el Brotato: la oleada se cierra en el acto (y la última es la victoria)
        this.setPhase(this.run.finishWave() === 'victory' ? 'victory' : 'cleared');
      }
      this.sync();
    } else {
      this.moving = false;
      this.phaseTick++;
      if (this.phase === 'cleared' && this.phaseTick >= CLEARED_TICKS) {
        this.run.shop.open();
        this.setPhase('shop');
      }
    }
    // El mundo sigue (agua, gotas, parpadeo) aunque la oleada esté parada
    this.state.step();
    this.tick++;
  }

  // Salir de la tienda: la siguiente oleada, con las armas que haya ahora
  leaveShop(): void {
    if (this.phase !== 'shop') return;
    this.wave = this.run.startWave();
    this.setPhase('wave');
    this.placeWeapons();
    this.sync();
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.phaseTick = 0;
  }

  // ---- el reflejo de la simulación en entidades

  // Las armas cambian entre oleadas (compras, fusiones): se rehacen al empezar cada una
  private placeWeapons(): void {
    for (const id of this.weaponIds) this.state.entities.remove(id);
    this.weaponIds = this.wave.weapons.map((w) =>
      this.state.entities.add({ model: this.models.model(lookOf(w.def, this.theme).model), x: Math.round(w.x), y: Math.round(w.y), z: 0, facing: 0, castsShadow: false }));
  }

  private sync(): void {
    const s = this.state, p = this.wave.player;
    // MAIA: su cuadro de andar, o el quieto
    const yaw = this.facing * 45;
    const n = this.player.walk.length;
    const model = this.moving && n ? this.player.walk[Math.floor((this.walked * 1000) / this.player.walkMs + 1e-9) % n]! : this.player.model;
    s.entities.move(this.playerId, Math.round(p.x), Math.round(p.y), p.z, yaw);
    s.entities.setModel(this.playerId, model);
    if (this.carryId !== null && this.player.carry) {
      const h = turn(this.player.carry.hand, yaw);
      s.entities.move(this.carryId, Math.round(p.x + h[0]), Math.round(p.y + h[1]), p.z + h[2], yaw);
    }
    // Armas: en su sitio de la órbita, apuntando (el modelo apunta a -y; el ángulo de la simulación es atan2(y, x))
    this.wave.weapons.forEach((w, i) => {
      const id = this.weaponIds[i];
      if (id !== undefined) s.entities.move(id, Math.round(w.x), Math.round(w.y), p.z + WEAPON_Z, heading((w.angle * 180) / Math.PI + 90));
    });
    // Enemigos: el modelo del tema y su cuadro de andar; cada uno con su desfase, para que no marchen al paso
    const alive = new Set<number>();
    for (const e of this.wave.enemies) {
      alive.add(e.uid);
      const look = lookOf(e.def, this.theme);
      const walk = this.models.walk(look.model, e.def.id);
      const frame = walk ? walk.frames[Math.floor((this.tick * TICK * 1000) / walk.ms + e.uid) % walk.frames.length]! : this.models.model(look.model);
      const eyaw = Math.hypot(e.vx, e.vy) > 1 ? heading((Math.atan2(e.vx, -e.vy) * 180) / Math.PI) : undefined;
      let id = this.enemyIds.get(e.uid);
      if (id === undefined) {
        id = s.entities.add({ model: frame, x: Math.round(e.x), y: Math.round(e.y), z: e.z, facing: eyaw ?? 0, castsShadow: true });
        this.enemyIds.set(e.uid, id);
      } else {
        s.entities.move(id, Math.round(e.x), Math.round(e.y), e.z, eyaw ?? s.entities.get(id)!.yaw);
        s.entities.setModel(id, frame);
      }
    }
    for (const [uid, id] of this.enemyIds) if (!alive.has(uid)) { s.entities.remove(id); this.enemyIds.delete(uid); }
    // Disparos: el proyectil del arma que lo lanzó, o el escupitajo del tema
    const flying = new Set<number>();
    for (const pr of this.wave.projectiles) {
      flying.add(pr.uid);
      let id = this.shotIds.get(pr.uid);
      const syaw = heading((Math.atan2(pr.vx, -pr.vy) * 180) / Math.PI);
      if (id === undefined) {
        id = s.entities.add({ model: this.models.model(this.shotModel(pr.source)), x: Math.round(pr.x), y: Math.round(pr.y), z: p.z + SHOT_Z, facing: syaw, castsShadow: false });
        this.shotIds.set(pr.uid, id);
      } else s.entities.move(id, Math.round(pr.x), Math.round(pr.y), p.z + SHOT_Z, syaw);
    }
    for (const [uid, id] of this.shotIds) if (!flying.has(uid)) { s.entities.remove(id); this.shotIds.delete(uid); }
    // Materiales sueltos
    const lying = new Set<number>();
    for (const m of this.wave.materials) {
      lying.add(m.uid);
      let id = this.materialIds.get(m.uid);
      if (id === undefined) {
        id = s.entities.add({ model: this.models.model(`efectos/material-${this.theme}`), x: Math.round(m.x), y: Math.round(m.y), z: p.z, facing: 0, castsShadow: false });
        this.materialIds.set(m.uid, id);
      } else s.entities.move(id, Math.round(m.x), Math.round(m.y), p.z, 0);
    }
    for (const [uid, id] of this.materialIds) if (!lying.has(uid)) { s.entities.remove(id); this.materialIds.delete(uid); }
  }

  private shotModel(source: string): string {
    const [kind, id] = source.split(':') as [string, string];
    if (kind === 'weapon') {
      const look = lookOf(this.run.registry.weapon(id), this.theme);
      if (look.projectile) return look.projectile;
    }
    return `efectos/escupitajo-${this.theme}`;
  }
}
