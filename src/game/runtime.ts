// RUNTIME DEL JUEGO (FERN): el tick. Uno solo para todo, a 1/60 s fijos, en este orden: entrada -> mover cuerpos y
// resolver colisiones -> eventos sobre el mundo -> world.step(). Determinista: la misma semilla y la misma entrada por
// tick dan la misma partida, byte a byte (lo comprueba test/game/determinism.test.ts). Sin reloj ni Math.random:
// el azar, si hace falta, sale de world.random().
import { TICK, type EntityId, type ShadowMode, type WorldState } from '../world/state';
import type { VoxelSource } from '../core';
import { DEFAULT_RULES, moveBody, restZ, WADE, waterFactor, type Body, type MoveRules } from './body';
import { WALK_FRAME_MS } from '../anim/walk';

// Lo que llega de los mandos en un tick. dx, dy en ejes del modelo (dy > 0 = norte); se normaliza la dirección.
export interface TickInput {
  dx: number;
  dy: number;
  stomp: boolean;
}

export const NO_INPUT: TickInput = { dx: 0, dy: 0, stomp: false };

export interface PlayerConfig {
  radius: number;
  speed: number;        // vóxeles por segundo en seco
  model?: VoxelSource | number;   // su modelo (o su id en world.models): el runtime crea la entidad que lo dibuja
  walk?: ReadonlyArray<VoxelSource | number>;
  shadow?: ShadowMode;          // su sombra real: 'always' la reserva siempre (MAIA), true compite por cercanía   // los cuadros del walk, en orden del ciclo (WALK_FRAME_MS cada uno); sin ellos anda con el quieto
  rules?: MoveRules;
}

export type Player = Body & { facing: number; inWater: boolean; walked: number; moving: boolean };

export interface RuntimeSnapshot {
  tick: number;
  player: Player;
  world: ReturnType<WorldState['snapshot']>;
}

const RIPPLE_HZ = 12;                     // ondas al andar por el agua

export class Runtime {
  tick = 0;
  readonly player: Player;
  readonly entityId: EntityId | null;     // la entidad del mundo que lo dibuja, si tiene modelo
  private readonly rules: MoveRules;
  private readonly idleModel: number | null = null;   // ids en world.models: se registran una vez, al crear la partida
  private readonly walkModels: number[] = [];

  constructor(readonly world: WorldState, spawn: { x: number; y: number }, readonly config: PlayerConfig) {
    this.rules = config.rules ?? DEFAULT_RULES;
    const r = config.radius;
    this.player = { x: spawn.x, y: spawn.y, z: restZ(world, spawn.x, spawn.y, r), r, facing: 0, inWater: false, walked: 0, moving: false };
    const p = this.player;
    const id = (m: VoxelSource | number) => (typeof m === 'number' ? m : world.models.register(m));
    if (config.model !== undefined) {
      this.idleModel = id(config.model);
      this.walkModels = (config.walk ?? []).map(id);
    }
    this.entityId = this.idleModel === null ? null
      : world.entities.add({ model: this.idleModel, x: Math.round(p.x), y: Math.round(p.y), z: p.z, facing: 0, castsShadow: config.shadow ?? true });
  }

  step(input: TickInput): void {
    const w = this.world, p = this.player;
    // 1. Mover y resolver colisiones
    const len = Math.hypot(input.dx, input.dy);
    p.moving = len > 0;
    if (len > 0) {
      const depth = w.waterAt(p.x, p.y)?.depth ?? 0;
      const v = this.config.speed * TICK * waterFactor(depth);
      moveBody(w, p, (input.dx / len) * v, (input.dy / len) * v, this.rules);
      p.facing = ((Math.round(Math.atan2(input.dx, -input.dy) / (Math.PI / 4)) % 8) + 8) % 8;   // sur 0, este 2, norte 4
      // 2. Eventos: ondas y salpicaduras al andar por el agua, a RIPPLE_HZ
      const before = Math.floor(p.walked * RIPPLE_HZ);
      p.walked += TICK;
      const wa = w.waterAt(p.x, p.y);
      if (wa && wa.depth > WADE && Math.floor(p.walked * RIPPLE_HZ) !== before) {
        w.events.disturb(p.x, p.y, 0.35);
        w.events.splash(p.x, p.y, wa.surface, 3, 38);
      }
    }
    const wa = w.waterAt(p.x, p.y);
    const inWater = (wa?.depth ?? 0) > WADE;
    if (wa && inWater && !p.inWater) { w.events.disturb(p.x, p.y, 0.7, 2); w.events.splash(p.x, p.y, wa.surface, 14, 70); }
    if (wa && inWater && input.stomp) { w.events.disturb(p.x, p.y, 2.8, 3); w.events.splash(p.x, p.y, wa.surface, 40, 105); }
    p.inWater = inWater;
    this.syncEntity();
    // 3. El mundo
    w.step();
    this.tick++;
  }

  // La entidad que lo dibuja va donde el cuerpo (público para colocarlo a mano fuera de un tick, p. ej. ?pos y ?dir)
  syncEntity(): void {
    if (this.entityId === null) return;
    const p = this.player;
    this.world.entities.move(this.entityId, Math.round(p.x), Math.round(p.y), p.z, p.facing * 45);
    this.world.entities.setModel(this.entityId, this.modelNow());
  }

  // El modelo que toca: andando, el cuadro del walk por lo que lleva andado (determinista, entra en la huella);
  // parado, el quieto
  private modelNow(): number {
    const n = this.walkModels.length;
    if (!this.player.moving || !n) return this.idleModel!;
    return this.walkModels[Math.floor((this.player.walked * 1000) / WALK_FRAME_MS + 1e-9) % n]!;
  }

  snapshot(): RuntimeSnapshot {
    return { tick: this.tick, player: { ...this.player }, world: this.world.snapshot() };
  }

  restore(s: RuntimeSnapshot): void {
    this.tick = s.tick;
    Object.assign(this.player, s.player);
    this.world.restore(s.world);
  }

  // Huella de la partida: la del mundo más la del runtime (FNV-1a de 32 bits)
  hash(): string {
    const p = this.player;
    const view = new DataView(new ArrayBuffer(8 * 8));
    [this.tick, p.x, p.y, p.z, p.facing, p.inWater ? 1 : 0, p.walked, p.moving ? 1 : 0].forEach((v, i) => view.setFloat64(i * 8, v));
    let h = 0x811c9dc5;
    const feed = (u: Uint8Array) => { for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i]!, 0x01000193); };
    feed(new TextEncoder().encode(this.world.hash()));
    feed(new Uint8Array(view.buffer));
    return (h >>> 0).toString(16).padStart(8, '0');
  }
}

// El bucle de la vista: convierte tiempo real en ticks fijos. La partida depende solo de la entrada de cada tick, no
// del ritmo de cuadros. Con un cuadro muy largo (pestaña en segundo plano) se hacen como mucho maxTicks y se suelta
// el resto: la partida se frena en vez de encadenar cuadros cada vez más lentos.
export class FixedLoop {
  private acc = 0;

  constructor(private readonly runtime: Runtime, private readonly input: (tick: number) => TickInput, private readonly maxTicks = 5) {}

  // seconds: tiempo real desde el cuadro anterior. Devuelve cuántos ticks dio.
  advance(seconds: number): number {
    this.acc += seconds;
    let n = 0;
    while (this.acc >= TICK - 1e-9 && n < this.maxTicks) {
      this.runtime.step(this.input(this.runtime.tick));
      this.acc -= TICK;
      n++;
    }
    if (n === this.maxTicks && this.acc >= TICK) this.acc = 0;
    return n;
  }
}
