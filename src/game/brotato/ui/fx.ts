// Los efectos de la oleada (FERN, fase 3.3): números de daño, avisos de aparición, muertes y lo que le pasa a MAIA
// (golpe, esquiva, curación). La simulación los anuncia en World.fx; BrotatoGame los junta tick a tick y la vista los
// pasa aquí. Se pintan sobre un Painter en la capa de efectos, proyectados con la cámara del mundo: lo que vive en el
// suelo (la X del aviso, el anillo de la muerte) se proyecta desde el plano del suelo, así que con inclinación 0,5 sale
// acortado a la mitad en vertical, como las losetas (regla de MAIA). Sin reloj ni azar: el tiempo lo da quien llama.
import type { WorldFx } from '../sim/World';
import { FONT_SIZE, drawText } from './font';
import { COLORS, type Painter } from './paint';

// Lo que hace falta de la cámara del horneado: de ejes del modelo (x este, y norte, z arriba) a píxel de la imagen
export interface Projector {
  project(x: number, y: number, z: number): readonly number[];
}

// Un aviso de aparición, como lo deja la simulación (World.telegraphs): t es lo que le falta, en segundos
export interface TelegraphView {
  x: number;
  y: number;
  t: number;
}

// Dónde está MAIA (sus pies) y cuánto miden ella y un enemigo: los textos salen justo encima de la cabeza
export interface FxScene {
  player: { x: number; y: number; z: number };
  playerHeight: number;
  enemyHeight: number;
  // La altura del suelo en (x, y): la X del aviso se apoya en él
  groundZ(x: number, y: number): number;
}

// Duraciones, en segundos (las del Brotato en Phaser)
export const FLOAT_ENEMY_S = 0.7;
export const FLOAT_PLAYER_S = 1.4;
export const PUFF_S = 0.25;
const RISE_PX_S = 10;                // lo que sube un texto por segundo
const FADE_S = 0.3;                  // el último tramo de un texto se pinta atenuado
const PUFF_R0 = 3, PUFF_GROW = 40;   // el anillo nace de 3 vóxeles y crece 40 por segundo
// El brazo de la X de aviso, en vóxeles del suelo: a 0,5 sale de 14x7 px, el alto de la X del Brotato a 1x (7 px).
// Con 3 salía de 7x4 y no se leía (MAIA: la legibilidad pesa más que la fidelidad)
export const TELEGRAPH_ARM = 7;
const SCRAPS = 6;                    // trocitos que suelta un enemigo al morir
const SCRAP_GRAVITY = 260;           // vóxeles/s², la de las gotas del mundo
// Los trocitos NO son rojos: el material de la oficina es una chincheta roja y se confundirían con él al caer
const SCRAP_COLORS = ['#fdf6ff', '#c9c3d9', '#8a94a6'] as const;
const DIM = '#fdf6ff80';
// El destello de un golpe, como en el Brotato: el enemigo en blanco 60 ms y MAIA en rojo 90 ms
export const FLASH_ENEMY = { color: [1, 1, 1] as const, s: 0.06 };
export const FLASH_PLAYER = { color: [1, 0.2, 0.2] as const, s: 0.09 };

interface Floating {
  text: string;
  color: string;
  life: number;
  readonly total: number;
  at: { x: number; y: number; z: number } | null;   // null: sigue a MAIA
}

interface Puff {
  x: number;
  y: number;
  z: number;
  t: number;
}

interface Scrap {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  floor: number;
  life: number;
  color: string;
}

// Un punto del suelo proyectado al píxel de la imagen, redondeado
function ground(cam: Projector, x: number, y: number, z: number): [number, number] {
  const p = cam.project(x, y, z);
  return [Math.round(p[0]!), Math.round(p[1]!)];
}

// Los píxeles de un anillo de radio r en el suelo, alrededor de (x, y): la circunferencia del mundo proyectada
export function groundRing(cam: Projector, x: number, y: number, z: number, r: number): Array<[number, number]> {
  const n = Math.max(12, Math.ceil(2 * Math.PI * r));
  const out = new Map<string, [number, number]>();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const p = ground(cam, x + Math.cos(a) * r, y + Math.sin(a) * r, z);
    out.set(`${p[0]},${p[1]}`, p);
  }
  return [...out.values()];
}

// Los píxeles de una X tumbada en el suelo, de brazo `arm` vóxeles: las dos diagonales del cuadrado del mundo
export function groundX(cam: Projector, x: number, y: number, z: number, arm: number): Array<[number, number]> {
  const out = new Map<string, [number, number]>();
  for (const [sx, sy] of [[1, 1], [1, -1]] as const) {
    for (let i = -arm * 2; i <= arm * 2; i++) {
      const s = i / 2;
      const p = ground(cam, x + sx * s, y + sy * s, z);
      out.set(`${p[0]},${p[1]}`, p);
    }
  }
  return [...out.values()];
}

// Hash entero de un número: el reparto de los trocitos sale de dónde murió el enemigo, no del azar
function hash(a: number, b: number): number {
  let h = (Math.imul(Math.round(a * 16) | 0, 0x9e3779b1) ^ Math.imul(Math.round(b * 16) | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return h;
}

type Rgb = readonly [number, number, number];

// Los destellos vivos, por entidad: `apply` pone el tinte (o lo quita con null) en el mundo. Un golpe sobre una
// entidad ya teñida alarga su destello. Lo que ya no existe (un enemigo que murió del golpe) se olvida sin tocarlo
export class Flashes<Id> {
  private live = new Map<Id, number>();

  constructor(private readonly apply: (id: Id, color: Rgb | null) => void, private readonly exists: (id: Id) => boolean) {}

  get count(): number {
    return this.live.size;
  }

  flash(id: Id, color: Rgb, s: number): void {
    if (!this.exists(id)) return;
    this.apply(id, color);
    this.live.set(id, Math.max(s, this.live.get(id) ?? 0));
  }

  update(dt: number): void {
    for (const [id, t] of this.live) {
      const left = t - dt;
      if (left > 0) { this.live.set(id, left); continue; }
      this.live.delete(id);
      if (this.exists(id)) this.apply(id, null);
    }
  }

  clear(): void {
    for (const id of this.live.keys()) if (this.exists(id)) this.apply(id, null);
    this.live.clear();
  }
}

export class Effects {
  private floating: Floating[] = [];
  private puffs: Puff[] = [];
  private scraps: Scrap[] = [];

  get count(): number {
    return this.floating.length + this.puffs.length + this.scraps.length;
  }

  // Lo que anunció la simulación desde el último cuadro
  add(list: readonly WorldFx[], scene: FxScene): void {
    for (const fx of list) {
      switch (fx.type) {
        case 'player-hit': this.float(`-${fx.amount}`, COLORS.bad, null); break;
        case 'dodge': this.float('esquiva', COLORS.text, null); break;
        case 'heal': this.float(`+${fx.amount}`, COLORS.good, null); break;
        case 'enemy-hit':
          this.float(String(fx.amount), fx.crit ? COLORS.gold : COLORS.text, { x: fx.x, y: fx.y, z: fx.z + scene.enemyHeight });
          break;
        case 'enemy-die': this.die(fx.x, fx.y, fx.z, scene.enemyHeight); break;
        case 'dash': this.puffs.push({ x: fx.x, y: fx.y, z: fx.z, t: PUFF_S }); break;   // el polvo de donde salió
        default: break;   // spawn y pickup no se dibujan (el enemigo y el contador ya se ven)
      }
    }
  }

  // El paso del tiempo de la vista (no de la simulación: los efectos no cuentan en la huella)
  update(dt: number): void {
    this.floating = this.floating.filter((f) => (f.life -= dt) > 0);
    this.puffs = this.puffs.filter((f) => (f.t -= dt) > 0);
    this.scraps = this.scraps.filter((s) => {
      s.life -= dt;
      s.vz -= SCRAP_GRAVITY * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.z <= s.floor) { s.z = s.floor; s.vx = 0; s.vy = 0; s.vz = 0; }
      return s.life > 0;
    });
  }

  clear(): void {
    this.floating = []; this.puffs = []; this.scraps = [];
  }

  // Pinta todo en la vista: (vx, vy) es la esquina de la vista en la imagen del horneado
  paint(p: Painter, cam: Projector, vx: number, vy: number, scene: FxScene, telegraphs: readonly TelegraphView[]): void {
    const dot = (x: number, y: number, color: string) => {
      const px = x - vx, py = y - vy;
      if (px >= 0 && py >= 0 && px < p.width && py < p.height) p.fill(px, py, 1, 1, color);
    };
    // Avisos: la X parpadea, y más deprisa en su último 0,4 s (como el Brotato)
    for (const t of telegraphs) {
      if (Math.floor(t.t * (t.t < 0.4 ? 16 : 8)) % 2 === 1) continue;
      for (const [x, y] of groundX(cam, t.x, t.y, scene.groundZ(t.x, t.y), TELEGRAPH_ARM)) dot(x, y, COLORS.bad);
    }
    for (const f of this.puffs) {
      const r = PUFF_R0 + (PUFF_S - f.t) * PUFF_GROW;
      for (const [x, y] of groundRing(cam, f.x, f.y, f.z, r)) dot(x, y, f.t > PUFF_S / 2 ? COLORS.text : DIM);
    }
    for (const s of this.scraps) {
      const [x, y] = ground(cam, s.x, s.y, s.z);
      dot(x, y, s.color);
    }
    const me = scene.player;
    for (const f of this.floating) {
      const at = f.at ?? { x: me.x, y: me.y, z: me.z + scene.playerHeight };
      const [x, y] = ground(cam, at.x, at.y, at.z);
      const rise = Math.round((f.total - f.life) * RISE_PX_S);
      const color = f.life < FADE_S ? `${f.color}80` : f.color;
      const clip: Painter = {
        width: p.width, height: p.height, icon: () => false,
        fill: (fx, fy, w, h, c) => {
          const x0 = Math.max(0, fx), y0 = Math.max(0, fy), x1 = Math.min(p.width, fx + w), y1 = Math.min(p.height, fy + h);
          if (x1 > x0 && y1 > y0) p.fill(x0, y0, x1 - x0, y1 - y0, c);
        },
      };
      drawText(clip, x - vx + 1, y - vy - rise - FONT_SIZE + 1, f.text, '#000000', { align: 'center' });
      drawText(clip, x - vx, y - vy - rise - FONT_SIZE, f.text, color, { align: 'center' });
    }
  }

  private float(text: string, color: string, at: Floating['at']): void {
    const total = at ? FLOAT_ENEMY_S : FLOAT_PLAYER_S;
    this.floating.push({ text, color, life: total, total, at });
  }

  private die(x: number, y: number, z: number, height: number): void {
    this.puffs.push({ x, y, z, t: PUFF_S });
    const h = hash(x, y);
    for (let k = 0; k < SCRAPS; k++) {
      const a = ((k + ((h >>> (k * 4)) & 15) / 16) / SCRAPS) * Math.PI * 2;
      const sp = 30 + ((h >>> (k * 3)) & 7) * 6;
      this.scraps.push({
        x, y, z: z + height / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 60 + ((h >>> (k * 5)) & 7) * 8,
        floor: z, life: 0.6, color: SCRAP_COLORS[k % SCRAP_COLORS.length]!,
      });
    }
  }
}
