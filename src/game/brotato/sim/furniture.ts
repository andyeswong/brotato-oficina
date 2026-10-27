// Los muebles que se empujan y se rompen (Andrés, 2026-10-27: "muebles sí, columnas no"; "muebles sí, columnas solo el
// boss"). Son objetos de VoxPix (world/objects.ts, look.objects): dormidos son vóxeles del mundo; al empujarlos
// despiertan y son un sprite hasta que se quedan quietos. Aquí van las reglas del juego encima:
//   - lo que pesa más de STRUCTURE_KG es estructura (columnas, pilares): ni se empuja (pesa demasiado para cualquier
//     fuerza de MAIA) ni se rompe;
//   - como mucho MAX_AWAKE despiertos a la vez: cada uno es una capa del atlas de sprites del compositor (1024,
//     compartido con la oleada); con el tope lleno, un mueble dormido hace de pared;
//   - un mueble no se puede empujar a menos de KEEP_CLEAR de la salida, la entrada a la tienda ni el sitio donde se
//     aparece: la partida no puede quedarse sin camino;
//   - los disparos que dan en un mueble le quitan vida y, a 0, se desmorona (escombro que desaparece). Solo donde ya
//     paraban (MAIA: que el balance no cambie): la mampara entera, pero del escritorio solo las patas (vuelan a 8 de
//     altura y el tablero está a 10; medido el 2026-10-27: el 1 % de su planta).
import { VoxelFall } from '@voxpix/world/fall';
import type { WorldState } from '@voxpix/world/state';

export const STRUCTURE_KG = 500;
export const MAX_AWAKE = 16;
export const FURNITURE_HP = 40;
export const KEEP_CLEAR = 12;
const DEBRIS_PIECE = 6;

export interface Rect { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Rect, b: Rect) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

export class Furniture {
  // Los escombros que caen (una VoxelFall por mueble roto), hasta que acaban
  readonly debris: VoxelFall[] = [];
  private readonly size = new Map<number, { w: number; d: number }>();
  // Algo se movió, despertó o rompió desde la última vez que se miró (el camino de la prórroga se rehace)
  changed = false;

  // zones: lo que no se puede tapar, ya ensanchado en KEEP_CLEAR. shotZ: la altura a la que vuelan los disparos
  constructor(private readonly state: WorldState, private readonly zones: readonly Rect[], private readonly shotZ: number,
    readonly maxAwake = MAX_AWAKE) {
    for (const o of state.objects) {
      let w = 0, d = 0;
      for (let i = 0; i < o.cells.length; i += 4) { w = Math.max(w, o.cells[i]! + 1); d = Math.max(d, o.cells[i + 1]! + 1); }
      this.size.set(o.id, { w, d });
      if (o.mass <= STRUCTURE_KG) { o.hp = FURNITURE_HP; o.maxHp = FURNITURE_HP; }
    }
  }

  // Dónde está ahora (planta, vóxeles)
  rect(id: number): Rect | null {
    const o = this.state.objects.get(id), s = this.size.get(id);
    if (!o || !s) return null;
    const x = Math.floor(o.awake ? o.px : o.x), y = Math.floor(o.awake ? o.py : o.y);
    return { x0: x, y0: y, x1: x + s.w - 1, y1: y + s.d - 1 };
  }

  // ¿Se puede empujar `dist` vóxeles hacia (dx, dy)? Con el tope de despiertos lleno, o si acabaría tapando una zona, no
  canPush(id: number, dx: number, dy: number, dist: number): boolean {
    const o = this.state.objects.get(id), r = this.rect(id);
    if (!o || !r || o.mass > STRUCTURE_KG) return false;
    if (!o.awake && this.state.objects.awake.length >= this.maxAwake) return false;
    const len = Math.hypot(dx, dy) || 1, mx = (dx / len) * dist, my = (dy / len) * dist;
    const next = { x0: Math.floor(r.x0 + Math.min(0, mx)), y0: Math.floor(r.y0 + Math.min(0, my)), x1: Math.ceil(r.x1 + Math.max(0, mx)), y1: Math.ceil(r.y1 + Math.max(0, my)) };
    return !this.zones.some((z) => overlaps(next, z));
  }

  // Empuja (VoxPix objects.push) y apunta si se movió
  push(id: number, dx: number, dy: number, force: number, dt: number, maxSpeed: number): number {
    if (!this.canPush(id, dx, dy, maxSpeed * dt)) return 0;
    const r = this.state.objects.push(id, dx, dy, force, dt, { maxSpeed });
    if (r.moved > 0) this.changed = true;
    return r.moved;
  }

  // El mueble en (x, y) a la altura de los disparos: dormido, por su vóxel; despierto, por su planta
  at(x: number, y: number): number | null {
    const o = this.state.objects.at(Math.floor(x), Math.floor(y), this.shotZ);
    if (o) return o.id;
    for (const a of this.state.objects.awake) {
      const r = this.rect(a.id);
      if (r && x >= r.x0 && x < r.x1 + 1 && y >= r.y0 && y < r.y1 + 1) return a.id;
    }
    return null;
  }

  // ¿Para algo un disparo en (x, y)? Los despiertos no están en los vóxeles del mundo, pero también paran
  blocksShot(x: number, y: number): boolean {
    return this.state.objects.awake.length > 0 && this.at(x, y) !== null;
  }

  // Un disparo da en (x, y): si hay un mueble (no estructura), le quita vida. true si lo rompe
  hit(x: number, y: number, damage: number): boolean {
    const id = this.at(x, y);
    if (id === null) return false;
    const o = this.state.objects.get(id)!;
    if (o.mass > STRUCTURE_KG) return false;
    const fall = new VoxelFall(this.state);
    const r = this.state.objects.damage(id, damage, fall, { piece: DEBRIS_PIECE, settle: 'vanish' });
    if (!r.destroyed) return false;
    this.size.delete(id);
    this.changed = true;
    if (!fall.done) this.debris.push(fall);
    return true;
  }

  // Un tick: los escombros caen
  step(): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const f = this.debris[i]!;
      f.step();
      if (f.done) this.debris.splice(i, 1);
    }
  }
}
