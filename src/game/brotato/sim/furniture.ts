// Los muebles que se empujan y se rompen (Andrés, 2026-10-27: "muebles sí, columnas no"; "muebles sí, columnas solo el
// boss"). Son objetos de VoxPix (world/objects.ts, look.objects): dormidos son vóxeles del mundo; al empujarlos
// despiertan y son un sprite hasta que se quedan quietos. Aquí van las reglas del juego encima:
//   - lo que pesa más de STRUCTURE_KG es estructura (columnas, pilares): ni se empuja (pesa demasiado para cualquier
//     fuerza de MAIA) ni se rompe;
//   - como mucho MAX_AWAKE despiertos a la vez: cada uno es una capa del atlas de sprites del compositor (1024,
//     compartido con la oleada); con el tope lleno, un mueble dormido hace de pared;
//   - un mueble no se puede empujar a menos de KEEP_CLEAR de la salida, la entrada a la tienda ni el sitio donde se
//     aparece: la partida no puede quedarse sin camino;
//   - los disparos de MAIA que dan en un mueble le quitan vida y, a 0, se desmorona (escombro que desaparece). Solo donde ya
//     paraban (MAIA: que el balance no cambie): la mampara entera, pero del escritorio solo las patas (vuelan a 8 de
//     altura y el tablero está a 10; medido el 2026-10-27: el 1 % de su planta).
import { VoxelFall } from '@voxpix/world/fall';
import type { WorldState } from '@voxpix/world/state';

export const STRUCTURE_KG = 500;
export const MAX_AWAKE = 16;
export const FURNITURE_HP = 40;
export const KEEP_CLEAR = 12;
// Lo más rápido que se mueve un mueble empujado, vóxeles/s, empuje quien empuje. MAIA anda a ~67 y su velocidad sube
// sin tope con los objetos; el tope deja acotado lo que avanza un mueble en un tick, que es lo que el repaso del camino
// (arena.pathDir) cubre con su margen (MAIA, 2026-10-29: que una prueba lo vigile)
export const MAX_PUSH_SPEED = 150;
const DEBRIS_PIECE = 6;
// Lo que suelta un mueble roto (Andrés, 2026-10-29: "materiales según el peso"): uno por cada tantos kg, al menos uno.
// Con 20 kg (mampara 2, escritorio 3) las victorias con el árbol al máximo subían 5 puntos sobre calib (72,7 -> 77,7 %,
// 512 semillas); con 25, 5,2; con 40, 1,9, dentro de los 3 que admite MAIA. Mampara y escritorio sueltan 1
export const LOOT_KG = 40;
export const furnitureLoot = (kg: number) => Math.max(1, Math.round(kg / LOOT_KG));

export interface Rect { x0: number; y0: number; x1: number; y1: number }
const overlaps = (a: Rect, b: Rect) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

export class Furniture {
  // Los escombros que caen (una VoxelFall por mueble roto), hasta que acaban
  readonly debris: VoxelFall[] = [];
  private readonly size = new Map<number, { w: number; d: number }>();
  // Por mueble, la caja (en vóxeles) de lo que se movió o rompió desde la última vez que se miró: dónde estaba y dónde
  // está. El camino de la prórroga (arena.pathDir) rehace solo las celdas que tocan esas cajas: rehacer la rejilla entera
  // con muebles despiertos costaba 400 ms por vez en un S25 FE (2026-10-29), porque cada celda pregunta el suelo a todos
  // los despiertos. Una caja por mueble y no una que los junte a todos: seis muebles repartidos ya cubren casi el mapa
  readonly dirty = new Map<number, Rect>();
  get changed(): boolean { return this.dirty.size > 0; }
  // Cuántas veces se movió o rompió algo (para quien guarde su propia rejilla de caminos: el piloto de la curva)
  version = 0;

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
    const top = Math.min(maxSpeed, MAX_PUSH_SPEED);
    if (!this.canPush(id, dx, dy, top * dt)) return 0;
    const before = this.rect(id);
    const r = this.state.objects.push(id, dx, dy, force, dt, { maxSpeed: top });
    if (r.moved > 0) { this.mark(id, before); this.mark(id, this.rect(id)); this.version++; }
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

  // Un disparo da en (x, y): si hay un mueble (no estructura), le quita vida. Si lo rompe, lo que pesaba (kg); si no, 0
  hit(x: number, y: number, damage: number): number {
    const id = this.at(x, y);
    if (id === null) return 0;
    const o = this.state.objects.get(id)!;
    if (o.mass > STRUCTURE_KG) return 0;
    const kg = o.mass;
    const before = this.rect(id);
    const fall = new VoxelFall(this.state);
    const r = this.state.objects.damage(id, damage, fall, { piece: DEBRIS_PIECE, settle: 'vanish' });
    if (!r.destroyed) return 0;
    this.size.delete(id);
    this.mark(id, before);
    this.version++;
    if (!fall.done) this.debris.push(fall);
    return kg;
  }

  private mark(id: number, r: Rect | null): void {
    if (!r) return;
    const d = this.dirty.get(id);
    this.dirty.set(id, d ? { x0: Math.min(d.x0, r.x0), y0: Math.min(d.y0, r.y0), x1: Math.max(d.x1, r.x1), y1: Math.max(d.y1, r.y1) } : { ...r });
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
