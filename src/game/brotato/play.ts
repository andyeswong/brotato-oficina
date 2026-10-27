// RUNTIME DEL BROTATO (FERN): una partida (el Run del Brotato sobre el mundo de vóxeles) y su reflejo en el mundo.
// Cada cosa de la simulación que se ve es una entidad del mundo: MAIA con su luz, los enemigos con el aspecto del tema
// y su rig de andar, las armas en su órbita, los disparos y los materiales. Determinista: sin reloj ni azar del
// navegador (la vista solo pinta y lee la entrada). El tick es uno solo: entrada -> oleada (simulación) -> entidades
// -> world.step().
import type { VoxelSource } from '@voxpix/core';
import type { EntityId } from '@voxpix/world/state';
import { TICK } from '@voxpix/world/state';
import type { Registry } from './registry/validate';
import type { LevelModule, ThemeId } from './registry/schemas';
import { Run } from './sim/Run';
import type { World as Wave, WorldFx } from './sim/World';
import { pickLevel } from './sim/arena';
import { lookOf } from './looks';
import { turn, type CarryConfig, type TickInput } from '@voxpix/runtime/runtime';

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

// wave: se juega, y también con la oleada limpia (current.status 'open'): MAIA anda hasta la entrada a la tienda y
// pulsa F. shop: la tienda (el mundo sigue debajo). dead / victory: la partida acabó.
export type Phase = 'wave' | 'shop' | 'dead' | 'victory';

// La entrada de un tick: la de la escena más la tecla de entrar (F, o el botón en el Flip) y la del dash (espacio, o
// su botón), las dos pulsadas en este tick
export type GameInput = TickInput & { interact?: boolean; dash?: boolean };

// Pone a MAIA junto a la entrada de la tienda, por el lado por el que llega (para ?ir= y las pruebas, nunca en una
// partida normal)
export function placeAtShop(p: { x: number; y: number }, shop: { x: number; y: number; reach: number }): void {
  const dx = p.x - shop.x, dy = p.y - shop.y, len = Math.hypot(dx, dy) || 1;
  p.x = shop.x + (dx / len) * (shop.reach - 1);
  p.y = shop.y + (dy / len) * (shop.reach - 1);
}

const WEAPON_Z = 5;       // a qué altura sobre los pies flotan las armas
const SHOT_Z = 7;         // y vuelan los disparos
// Los efectos que se guardan si la vista no los recoge (las pruebas, o ?ir= que simula sin pintar): los más viejos se tiran
const FX_KEEP = 256;

// Todo giro de una entidad va a uno de los 8 rumbos (múltiplos de 45°), como MAIA y los rigs. El compositor guarda
// un sprite por modelo y giro: con giros continuos (armas apuntando, enemigos y disparos según su velocidad) cada
// cuadro creaba sprites nuevos que no se soltaban nunca, unos 220 MB por partida hasta agotar la memoria.
export function heading(deg: number): number {
  return (((Math.round(deg / 45) * 45) % 360) + 360) % 360;
}

// Los 8 rumbos (los de HEADINGS en el núcleo, que el precalentado usa por defecto)
export { HEADINGS } from '@voxpix/world/frame2d';

// Para medir (fase 4), nunca en una partida normal: empezar en una oleada más avanzada y que MAIA no caiga, para
// tener cientos de enemigos en pantalla el tiempo que dure la medida. Apagadas, la partida y su huella no cambian
export interface TestOptions {
  startWave?: number;   // 1 = la primera
  immortal?: boolean;   // tras cada paso, MAIA recupera toda la vida
  meta?: Readonly<Record<string, number>>;   // no es de pruebas: las mejoras entre partidas que se compraron
  // Tampoco: con vista (app/src/juego), al llegar a un piso nuevo la partida espera quieta a que la vista lo hornee
  // (floorReady), para que el horneado no caiga nunca dentro de una oleada (regla de MAIA). Sin vista, sigue sola
  waitFloor?: boolean;
}

export class BrotatoGame {
  readonly run: Run;
  readonly theme: ThemeId;
  tick = 0;
  phase: Phase = 'wave';
  phaseTick = 0;                 // ticks dados en esta fase (el del cambio no cuenta)
  playerId!: EntityId;           // cambia con cada piso (otro mundo, otras entidades)
  // Piso nuevo montado y sin hornear todavía por la vista: la oleada no avanza (waitFloor)
  awaitingFloor = false;
  private wave: Wave;
  private facing = 0;            // 8 direcciones, como el runtime de la escena: sur 0, este 2, norte 4
  private walked = 0;            // segundos andando: elige el cuadro del walk
  private moving = false;
  private carryId: EntityId | null = null;
  private weaponIds: EntityId[] = [];
  private readonly enemyIds = new Map<number, EntityId>();
  private readonly shotIds = new Map<number, EntityId>();
  private readonly materialIds = new Map<number, EntityId>();
  private fx: WorldFx[] = [];

  constructor(registry: Registry, seed: number, private readonly models: Models, private readonly player: PlayerLooks, level?: LevelModule,
    private readonly test: TestOptions = {}) {
    const lv = level ?? pickLevel(registry.levels(), seed);
    this.run = new Run(registry, registry.character('maia'), lv, seed, test.meta ? { meta: test.meta } : {});
    this.theme = lv.theme;
    if (test.startWave) this.run.waveIndex = Math.max(0, Math.min(lv.waves.length, test.startWave) - 1);
    this.wave = this.run.startWave();
    this.addMaia();
    this.placeWeapons();
    this.sync();
  }

  // MAIA (y lo que lleve en la mano, con su luz) en el mundo de la oleada: al empezar y en cada piso nuevo
  private addMaia(): void {
    const p = this.wave.player, player = this.player;
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
  }

  // Todo lo que esta partida puede poner en el mundo, para Compositor.prewarm (NARUTO): cada modelo se ve solo en los
  // 8 HEADINGS, y casts dice si da sombra (MAIA y los enemigos). MAIA (quieta y su walk) y lo que lleva en la mano;
  // todas las armas que pueden salir (iniciales y de tienda) con su disparo; los enemigos de las oleadas del nivel con
  // los cuadros de su rig; el escupitajo y el material del tema.
  preloadModels(): Array<{ model: VoxelSource; casts: boolean }> {
    const out = new Map<VoxelSource, boolean>();
    const add = (m: VoxelSource, casts: boolean) => out.set(m, casts || (out.get(m) ?? false));
    for (const m of [this.player.model, ...this.player.walk]) add(m, true);
    if (this.player.carry && typeof this.player.carry.model !== 'number') add(this.player.carry.model, false);
    const reg = this.run.registry;
    for (const w of reg.weapons()) {
      const look = lookOf(w, this.theme);
      add(this.models.model(look.model), false);
      if (look.projectile) add(this.models.model(look.projectile), false);
    }
    const enemies = new Set(this.run.level.waves.flatMap((id) => reg.wave(id).groups.map((g) => g.enemy)));
    for (const id of enemies) {
      const e = reg.enemy(id), look = lookOf(e, this.theme);
      const walk = this.models.walk(look.model, e.id);
      for (const m of walk ? walk.frames : [this.models.model(look.model)]) add(m, true);
    }
    add(this.models.model(`efectos/escupitajo-${this.theme}`), false);
    add(this.models.model(`efectos/material-${this.theme}`), false);
    // Lo que flota en el agua (los nenúfares de la vegetación): no da sombra
    for (const f of this.run.arena.world.floaters ?? []) add(f.model, false);
    return [...out].map(([model, casts]) => ({ model, casts }));
  }

  get state() {
    return this.run.arena.state;
  }

  get current(): Wave {
    return this.wave;
  }

  step(input: GameInput): void {
    if (this.phase === 'wave' && this.awaitingFloor) {
      // El piso nuevo está montado y la vista aún no lo ha horneado: nada avanza (ni el reloj de la oleada)
      this.moving = false;
    } else if (this.phase === 'wave') {
      const len = Math.hypot(input.dx, input.dy);
      this.moving = len > 0;
      if (this.moving) this.walked += TICK;
      this.wave.step(TICK, this.moving ? { x: input.dx / len, y: input.dy / len } : { x: 0, y: 0 }, input.interact ?? false, input.dash ?? false);
      // MAIA mira a lo que disparan sus armas (el más cercano al alcance de la de más alcance); sin nadie a tiro, hacia
      // donde anda (Andrés, 2026-10-25). Solo aspecto: no entra en la simulación
      const target = this.wave.status === 'playing' ? this.wave.aimTarget : null;
      const p = this.wave.player;
      const look = target ? { dx: target.x - p.x, dy: target.y - p.y } : this.moving ? input : null;
      if (look) this.facing = ((Math.round(Math.atan2(look.dx, -look.dy) / (Math.PI / 4)) % 8) + 8) % 8;
      if (this.test.immortal) { const me = this.wave.player; me.hp = me.maxHp; if (this.wave.status === 'dead') this.wave.status = 'playing'; }
      this.collectFx();
      this.phaseTick++;
      if (this.wave.status === 'dead') {
        this.setPhase('dead');
        this.run.lose();
      } else if (this.wave.status === 'cleared') {
        // MAIA entró en la tienda (o era la última oleada: la victoria)
        if (this.run.finishWave() === 'victory') this.setPhase('victory');
        else { this.run.shop.open(); this.setPhase('shop'); }
      } else if (this.wave.status === 'left') {
        // Cruzó la salida: el piso siguiente y su oleada
        this.nextFloor();
        return;
      }
      this.sync();
    } else {
      this.moving = false;
      this.phaseTick++;
    }
    // El mundo sigue (agua, gotas, parpadeo) aunque la oleada esté parada
    this.state.step();
    this.tick++;
  }

  // Los efectos anunciados desde la última llamada (golpes, muertes...), para que la vista los pinte. Se vacían al leerlos
  takeFx(): WorldFx[] {
    const out = this.fx;
    this.fx = [];
    return out;
  }

  // La entidad que dibuja a un enemigo de la oleada (por su uid de la simulación), si sigue en el mundo
  enemyEntity(uid: number): EntityId | undefined {
    return this.enemyIds.get(uid);
  }

  // La simulación los anuncia en World.fx y no los vacía: se pasan aquí cada tick
  private collectFx(): void {
    const list = this.wave.fx;
    if (!list.length) return;
    this.fx.push(...list);
    list.length = 0;
    if (this.fx.length > FX_KEEP) this.fx.splice(0, this.fx.length - FX_KEEP);
  }

  // Salir de la tienda: con pisos, se abre la salida y MAIA anda hasta ella (la oleada sigue en 'exit'); sin ellos, la
  // siguiente oleada en el mismo mapa. Con las armas que haya ahora
  leaveShop(): void {
    if (this.phase !== 'shop') return;
    this.setPhase('wave');
    if (!this.run.openExit()) this.wave = this.run.startWave();
    this.placeWeapons();
    this.sync();
  }

  // La vista ya horneó el piso nuevo: la oleada puede empezar
  floorReady(): void {
    this.awaitingFloor = false;
  }

  // El piso siguiente: otro mundo de vóxeles, así que todo lo que se veía se vuelve a poner en él. El paso en que se
  // cruzó la salida acaba aquí; la oleada nueva empieza en el siguiente (o cuando la vista lo haya horneado)
  private nextFloor(): void {
    this.wave = this.run.startWave();
    this.weaponIds = [];
    this.enemyIds.clear();
    this.shotIds.clear();
    this.materialIds.clear();
    this.carryId = null;
    this.addMaia();
    this.placeWeapons();
    this.awaitingFloor = !!this.test.waitFloor;
    this.phaseTick = 0;
    this.sync();
    this.state.step();
    this.tick++;
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
