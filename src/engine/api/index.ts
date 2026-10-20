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
  waveSchema,
} from '../registry/schemas';

export { z } from 'zod';
export type { Modifier, HookEvent, CounterId } from '../registry/schemas';

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
}

export interface EnemyApi {
  readonly player: Point;
  readonly time: number;           // segundos desde que empezó la oleada
  rng(): number;
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

export function defineWave(def: Input<typeof waveSchema>) {
  return { ...def, kind: 'wave' as const };
}

export function defineLevel(def: Input<typeof levelSchema>) {
  return { ...def, kind: 'level' as const };
}

// Utilidades pequeñas que comparten los comportamientos
export function steerTowards(self: EnemySelf, target: Point, speed: number): void {
  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const len = Math.hypot(dx, dy) || 1;
  self.vx = (dx / len) * speed;
  self.vy = (dy / len) * speed;
}
