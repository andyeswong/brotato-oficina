// Lo ÚNICO que importa el contenido. Los define* solo etiquetan el objeto para que TypeScript
// autocomplete; la validación de verdad la hace el registro al arrancar.
import type { z } from 'zod';
import type {
  characterSchema,
  CounterId,
  enemySchema,
  HookEvent,
  levelSchema,
  statSchema,
  itemSchema,
  waveSchema,
  weaponSchema,
} from './registry/schemas';

export { z } from 'zod';
export type { Modifier, HookEvent, CounterId } from './registry/schemas';

type Input<S extends z.ZodType> = Omit<z.input<S>, 'kind'>;

// ---------- Hooks: lo que recibe un personaje, arma o ítem cuando pasa algo ----------

export interface Point {
  readonly x: number;
  readonly y: number;
}

// La fachada: lo único que un hook puede hacer con la partida. Si falta algo, se agrega AQUÍ una vez.
export interface GameApi {
  readonly wave: number;          // 1, 2, 3…
  readonly isLastWave: boolean;
  readonly player: Point;
  stat(id: string): number;
  counter(id: CounterId): number;
  rng(): number;                  // [0, 1), con la semilla de la partida
  floatingText(text: string, at?: Point): void;
  heal(amount: number): void;
  dropMaterials(at: Point, amount: number): void;
}

export type HookFn = (event: Record<string, unknown>, api: GameApi) => void;
export type Hooks = Partial<Record<HookEvent, HookFn>>;

// ---------- Comportamientos de enemigo ----------

// Lo que un comportamiento puede tocar de su enemigo: decide la velocidad deseada y guarda memoria propia
export interface EnemySelf {
  readonly x: number;
  readonly y: number;
  vx: number;
  vy: number;
  readonly speed: number;          // la del módulo del enemigo
  readonly mem: Record<string, number>;
  // Con cuánta fuerza (N) empuja los muebles en este paso; 0, no empuja. Lo pone su comportamiento: el embestidor
  // mientras embiste (Andrés, 2026-10-29: "solo el embestidor"); los demás los rodean
  push: number;
  readonly hp: number;
  readonly maxHp: number;
  // El paso anterior lo frenó algo en seco: una pared, una columna (que rompió) o un mueble que no pudo arrastrar. Lo
  // pone el mundo después de moverlo
  readonly blocked: boolean;
  // Rompe la estructura (columnas) que tenga delante en este paso; lo pone su comportamiento (el jefe embistiendo)
  smash: boolean;
}

export interface EnemyApi {
  readonly player: Point;
  readonly time: number;           // segundos desde que empezó la oleada
  rng(): number;
  // Dispara un proyectil enemigo desde el centro del cuerpo de self, con el daño de contacto del enemigo
  shoot(self: EnemySelf, angle: number, speed: number, opts?: { radius?: number; range?: number }): void;
  // Llama a `count` enemigos del módulo `enemy` alrededor de self, ya (sin aviso)
  summon(self: EnemySelf, enemy: string, count: number): void;
}

// ---------- Comportamientos de arma ----------

// Lo que el motor ya calculó para este ataque: daño con escalado y modificadores, alcance, crítico
export interface WeaponShot {
  readonly x: number;              // punta del arma
  readonly y: number;
  readonly angle: number;          // hacia el objetivo, en radianes
  readonly target: Point;
  readonly damage: number;
  readonly range: number;
  readonly critChance: number;
  readonly critMult: number;
}

export interface WeaponApi {
  rng(): number;
  // Un proyectil del jugador. anim: nombre semántico en sprites.anims del arma (p. ej. 'projectile')
  // returns: al acabar el alcance o chocar vuelve al cuerpo, volviendo a golpear por el camino
  projectile(shot: WeaponShot, opts: { angle?: number; speed: number; pierce?: number; radius?: number; anim?: string; returns?: boolean }): void;
  // Tiro en arco al objetivo: no choca en el aire y al caer hace daño en área de radio radius (daño por factor)
  lob(shot: WeaponShot, opts: { speed: number; radius: number; factor?: number }): void;
  // Golpe a todo lo que esté en un cono desde el arma: half es el medio ángulo, en radianes
  cone(shot: WeaponShot, opts: { reach: number; half: number }): void;
  // Golpe cuerpo a cuerpo con onda: la franja recibe el daño entero y lo demás a radius del impacto, el daño por factor
  slam(shot: WeaponShot, opts: { reach: number; width: number; radius: number; factor: number }): void;
  // Golpe cuerpo a cuerpo instantáneo: una franja desde el arma hacia angle, de largo reach y ancho width
  melee(shot: WeaponShot, opts: { reach: number; width: number }): void;
}

// ---------- define* ----------

export function defineStat(def: Input<typeof statSchema>) {
  return { ...def, kind: 'stat' as const };
}

export function defineCharacter(def: Omit<Input<typeof characterSchema>, 'hooks'> & { hooks?: Hooks }) {
  return { ...def, kind: 'character' as const };
}

export function defineEnemy(def: Input<typeof enemySchema>) {
  return { ...def, kind: 'enemy' as const };
}

export function defineEnemyBehavior<P extends z.ZodType>(def: {
  format: 1;
  id: string;
  name: string;
  description?: string;
  params: P;
  update(self: EnemySelf, dt: number, api: EnemyApi, params: z.infer<P>): void;
}) {
  return { ...def, kind: 'behavior' as const, target: 'enemy' as const };
}

export function defineItem(def: Omit<Input<typeof itemSchema>, 'hooks'> & { hooks?: Hooks }) {
  return { ...def, kind: 'item' as const };
}

export function defineWeapon(def: Input<typeof weaponSchema>) {
  return { ...def, kind: 'weapon' as const };
}

export function defineWeaponBehavior<P extends z.ZodType>(def: {
  format: 1;
  id: string;
  name: string;
  description?: string;
  params: P;
  fire(shot: WeaponShot, api: WeaponApi, params: z.infer<P>): void;
}) {
  return { ...def, kind: 'behavior' as const, target: 'weapon' as const };
}

export function defineWave(def: Input<typeof waveSchema>) {
  return { ...def, kind: 'wave' as const };
}

export function defineLevel(def: Input<typeof levelSchema>) {
  return { ...def, kind: 'level' as const };
}

// Utilidades pequeñas que comparten los comportamientos
export function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function steerTowards(self: EnemySelf, target: Point, speed: number): void {
  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  self.vx = (dx / len) * speed;
  self.vy = (dy / len) * speed;
}
