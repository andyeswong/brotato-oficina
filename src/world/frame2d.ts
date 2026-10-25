// Un cuadro del modo 2D del juego a partir del ESTADO DEL MUNDO: lo estático horneado (una vez por nivel), y
// encima, con la misma cámara, prueba de profundidad y luz: las entidades, el agua y las gotas.
import { render, camera, lightField3D, rgbOf, type PointLight3D } from '../core';
import { resolveLight } from './lightutil';
import { buildLayers, applyLayers } from '../lighting/shade';
import { lightView, worldPointAt, type Baked } from './bake';
import { key, DIR_VECTORS, type VoxelSource } from '../core';
import type { WorldLight } from './build';
import type { WorldState, Entity } from './state';

export interface Frame2DOptions {
  vx: number; vy: number; vw: number; vh: number;      // ventana de la imagen horneada
  time: number;
  lights: boolean;
  ambient: readonly [number, number, number];
  bob?: (e: Entity) => number;                          // saltito al andar (píxeles)
  background?: readonly [number, number, number];
}

// Lienzo del render de una entidad y dónde caen sus pies
const EW = 48, EH = 72, EOX = 24, EOY = 60;
// El render de una entidad no cambia mientras no cambie su modelo, su giro ni la proyección: se guarda
const entityCache = new WeakMap<object, Map<string, ReturnType<typeof render>>>();

export function frame2D(state: WorldState, b: Baked, o: Frame2DOptions): Uint8ClampedArray {
  const { vx, vy, vw, vh, ambient } = o;
  const view = new Uint8ClampedArray(vw * vh * 4);
  const depthBuf = new Float32Array(vw * vh);
  for (let y = 0; y < vh; y++) {
    depthBuf.set(b.depth.subarray((vy + y) * b.width + vx, (vy + y) * b.width + vx + vw), y * vw);
    view.set(b.rgba.subarray(((vy + y) * b.width + vx) * 4, ((vy + y) * b.width + vx + vw) * 4), y * vw * 4);
  }
  const bg = o.background ?? [13, 12, 18];
  for (let i = 3; i < view.length; i += 4) if (!view[i]) { view[i - 3] = bg[0]; view[i - 2] = bg[1]; view[i - 1] = bg[2]; view[i] = 255; }
  const total = o.lights ? lightView(b, vx, vy, vw, vh, ambient, o.time) : null;
  const a = b.options.oblique?.y ?? 1;
  if (total) {
    // Luces dinámicas (las añadidas en partida): por cuadro, en su radio
    for (const l of state.lights) if (l.baked === false) addDynamicLight(b, l, total, o);
    // Sombras de las entidades: lo que su cuerpo tapa de cada luz
    for (const e of state.entities) if (e.castsShadow) castShadow(state, b, e, total, o);
  }

  for (const e of state.entities) drawEntity(state, b, e, view, depthBuf, total, o, a);

  // El agua (tapa lo sumergido) y las gotas
  state.water?.draw(b, view, depthBuf, total, vx, vy, vw, vh, ambient, o.time, state.lights);
  const wr = state.palette.ramps.find((r) => r.name === 'agua');
  if (wr) state.drops.draw(b, view, depthBuf, total, vx, vy, vw, vh, rgbOf(wr.colors[4] ?? wr.colors[0]!), [ambient[0] * 1.7, ambient[1] * 1.7, ambient[2] * 1.8]);

  return total
    ? applyLayers(view, buildLayers({ cell: 1, cols: vw, rows: vh, ambient, total }, { x: 0, y: 0, width: vw, height: vh }, { steps: 8, softGlow: true }))
    : view;
}

// Una entidad del mundo con la misma cámara que el escenario, iluminada por cara con las fuentes del mundo y con
// su sombra en el suelo. Su profundidad se pasa a la del mundo y lo que tiene delante la tapa.
function drawEntity(state: WorldState, b: Baked, e: Entity, view: Uint8ClampedArray, depthBuf: Float32Array, total: Float32Array | null, o: Frame2DOptions, a: number): void {
  const { vx, vy, vw, vh, ambient } = o;
  const X = Math.round(e.x), Y = Math.round(e.y), Z = e.z;
  const bob = o.bob ? o.bob(e) : 0;
  // Sombra de contacto bajo los pies (la de las luces la hace castShadow con el cuerpo de verdad)
  const feet = b.cam.project(X + 0.5, Y, Z);
  const fx = Math.floor(feet[0]), fy = Math.floor(feet[1]);
  const sry = Math.max(1.2, 2.5 * a);
  if (total) for (let y = -Math.ceil(sry); y <= Math.ceil(sry); y++) for (let x = -6; x <= 6; x++) {
    if ((x / 6.5) ** 2 + (y / sry) ** 2 > 1) continue;
    const sx = fx - vx + x, sy = fy - vy + y;
    if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
    const q = (sy * vw + sx) * 3;
    total[q] = total[q]! * 0.7; total[q + 1] = total[q + 1]! * 0.7; total[q + 2] = total[q + 2]! * 0.72;
  }
  const lo = { width: EW, height: EH, originX: EOX, originY: EOY, pivot: [0.5, 0, 0] as [number, number, number], yaw: e.yaw,
    oblique: b.options.oblique ?? { y: 1, z: 1 }, flat: true, outline: 'none' as const, pick: !!total };
  let cache = entityCache.get(e.model);
  if (!cache) entityCache.set(e.model, (cache = new Map()));
  const ck = `${e.yaw}|${lo.oblique.y}|${lo.oblique.z}|${lo.pick}`;
  let img = cache.get(ck);
  if (!img) { img = render(e.model, lo); cache.set(ck, img); }
  let etotal: Float32Array | null = null;
  if (total) {
    // Las luces del mundo en los ejes del modelo de la entidad (sin girar)
    const c = Math.cos((e.yaw * Math.PI) / 180), sn = Math.sin((e.yaw * Math.PI) / 180);
    const lights: PointLight3D[] = state.lights.map((l) => {
      const p = resolveLight(l, o.time);
      const dx = l.x - (X + 0.5), dy = l.y - Y;
      return { x: dx * c + dy * sn + 0.5, y: -dx * sn + dy * c, z: l.z - bob - Z, radius: p.radius, color: p.color, intensity: p.intensity };
    }).filter((l) => Math.hypot(l.x, l.y) < l.radius + 20);
    etotal = lightField3D(e.model, img, camera(lo), lights, ambient, { floor: false });
  }
  const offX = X - EOX, offY = Math.round(b.options.originY - a * Y - Z) - EOY - bob;
  const dOff = Y * b.cam.fwd[1] + Z * b.cam.fwd[2];
  for (let j = 0; j < EH; j++) for (let i = 0; i < EW; i++) {
    const s = j * EW + i;
    if (!img.rgba[s * 4 + 3]) continue;
    const sx = i + offX - vx, sy = j + offY - vy;
    if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
    const t = sy * vw + sx;
    const d = img.depth[s]! + dOff;
    if (d >= depthBuf[t]! - 0.5) continue;                           // lo que hay delante la tapa
    depthBuf[t] = d;
    view[t * 4] = img.rgba[s * 4]!; view[t * 4 + 1] = img.rgba[s * 4 + 1]!; view[t * 4 + 2] = img.rgba[s * 4 + 2]!;
    if (total && etotal) { total[t * 3] = etotal[s * 3]!; total[t * 3 + 1] = etotal[s * 3 + 1]!; total[t * 3 + 2] = etotal[s * 3 + 2]!; }
  }
}

// ---- luces dinámicas y sombras de entidades (sobre la imagen horneada: cada píxel sabe qué punto del mundo es y
// qué cara se ve)

const facing = (ndl: number) => (ndl > 0 ? 0.35 + 0.65 * ndl : 0);

// Aportación (color * peso) de una luz en el punto P con normal n, sin sombras. La misma fórmula que el horneado.
function contribution(l: { x: number; y: number; z: number; radius: number; intensity: number }, P: [number, number, number], n: readonly number[]): number {
  const dx = l.x - P[0], dy = l.y - P[1], dz = l.z - P[2];
  const d = Math.hypot(dx, dy, dz);
  if (d >= l.radius) return 0;
  const k = 1 - d / l.radius;
  return k * k * l.intensity * (d < 1e-6 ? 1 : facing((n[0]! * dx + n[1]! * dy + n[2]! * dz) / d));
}

// Recuadro de la vista que puede tocar una esfera de radio r alrededor de (x, y, z)
function screenBox(b: Baked, x: number, y: number, z: number, r: number, o: Frame2DOptions): [number, number, number, number] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const dx of [-r, r]) for (const dy of [-r, r]) for (const zz of [-10, z + r]) {
    const [sx, sy] = b.cam.project(x + dx, y + dy, zz);
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const ix0 = Math.max(o.vx, Math.floor(x0)), iy0 = Math.max(o.vy, Math.floor(y0));
  const ix1 = Math.min(o.vx + o.vw - 1, Math.ceil(x1)), iy1 = Math.min(o.vy + o.vh - 1, Math.ceil(y1));
  return ix0 > ix1 || iy0 > iy1 ? null : [ix0, iy0, ix1, iy1];
}

function addDynamicLight(b: Baked, l: WorldLight, total: Float32Array, o: Frame2DOptions): void {
  const p = resolveLight(l, o.time);
  const box = screenBox(b, l.x, l.y, l.z, p.radius, o);
  if (!box) return;
  const [x0, y0, x1, y1] = box;
  for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) {
    const f = b.face[sy * b.width + sx]!;
    if (f < 0) continue;
    const P = worldPointAt(b, sx, sy);
    if (!P) continue;
    const w = contribution(p, P, DIR_VECTORS[f]!);
    if (!w) continue;
    const q = ((sy - o.vy) * o.vw + (sx - o.vx)) * 3;
    total[q] = total[q]! + p.color[0] * w; total[q + 1] = total[q + 1]! + p.color[1] * w; total[q + 2] = total[q + 2]! + p.color[2] * w;
  }
}

// El cuerpo de una entidad como conjunto de vóxeles locales (girado al cuarto de vuelta más cercano) y su caja
const occCache = new WeakMap<VoxelSource, Map<number, { set: Set<number>; min: [number, number, number]; max: [number, number, number] }>>();
function occupancy(model: VoxelSource, yaw: number) {
  const turns = ((Math.round(yaw / 90) % 4) + 4) % 4;
  let m = occCache.get(model);
  if (!m) occCache.set(model, (m = new Map()));
  let o = m.get(turns);
  if (!o) {
    const c = [1, 0, -1, 0][turns]!, s = [0, 1, 0, -1][turns]!;
    const set = new Set<number>();
    const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const [x, y, z] of model.entries()) {
      const rx = x * c - y * s, ry = x * s + y * c;
      set.add(key(rx, ry, z));
      min[0] = Math.min(min[0], rx); min[1] = Math.min(min[1], ry); min[2] = Math.min(min[2], z);
      max[0] = Math.max(max[0], rx + 1); max[1] = Math.max(max[1], ry + 1); max[2] = Math.max(max[2], z + 1);
    }
    m.set(turns, (o = { set, min, max }));
  }
  return o;
}

// ¿El segmento de P a la luz L (en coordenadas locales de la entidad) cruza un vóxel de su cuerpo?
function blockedByBody(occ: ReturnType<typeof occupancy>, P: [number, number, number], L: [number, number, number]): boolean {
  // Recorte a la caja (método de las losas)
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const d = L[i]! - P[i]!;
    if (Math.abs(d) < 1e-9) { if (P[i]! < occ.min[i]! || P[i]! > occ.max[i]!) return false; continue; }
    let a = (occ.min[i]! - P[i]!) / d, b = (occ.max[i]! - P[i]!) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  // Pasos de medio vóxel dentro de la caja
  const len = Math.hypot(L[0] - P[0], L[1] - P[1], L[2] - P[2]) * (t1 - t0);
  const steps = Math.max(1, Math.ceil(len * 2));
  for (let k = 0; k <= steps; k++) {
    const t = t0 + ((t1 - t0) * k) / steps;
    const x = P[0] + (L[0] - P[0]) * t, y = P[1] + (L[1] - P[1]) * t, z = P[2] + (L[2] - P[2]) * t;
    if (occ.set.has(key(Math.floor(x), Math.floor(y), Math.floor(z)))) return true;
  }
  return false;
}

const SHADOW_REACH = 48;     // hasta dónde se busca sombra alrededor de la entidad (en planta)

function castShadow(state: WorldState, b: Baked, e: Entity, total: Float32Array, o: Frame2DOptions): void {
  const occ = occupancy(e.model, e.yaw);
  const ex = Math.round(e.x), ey = Math.round(e.y), ez = e.z;
  // Las luces que llegan a la zona de la entidad
  const near = state.lights.filter((l) => Math.hypot(l.x - ex, l.y - ey) < resolveLight(l, 0).radius + SHADOW_REACH);
  if (!near.length) return;
  const box = screenBox(b, ex, ey, ez, SHADOW_REACH, o);
  if (!box) return;
  const baked = new Map(b.lights.map((bl) => [bl.light.id, bl] as const));
  const [x0, y0, x1, y1] = box;
  for (let sy = y0; sy <= y1; sy++) for (let sx = x0; sx <= x1; sx++) {
    const f = b.face[sy * b.width + sx]!;
    if (f < 0) continue;
    const P = worldPointAt(b, sx, sy);
    if (!P || Math.abs(P[0] - ex) > SHADOW_REACH || Math.abs(P[1] - ey) > SHADOW_REACH) continue;
    const n = DIR_VECTORS[f]!;
    // En los ejes de la entidad (sus pies en el origen; el cuerpo ya está girado en `occ`)
    const Pl: [number, number, number] = [P[0] + n[0] * 0.05 - ex, P[1] + n[1] * 0.05 - ey, P[2] + n[2] * 0.05 - ez];
    const q = ((sy - o.vy) * o.vw + (sx - o.vx)) * 3;
    for (const l of near) {
      if (!blockedByBody(occ, Pl, [l.x - ex, l.y - ey, l.z - ez])) continue;
      // Quitar lo que esta luz aportaba aquí
      const p = resolveLight(l, o.time);
      let w = 0;
      const bl = baked.get(l.id);
      if (bl) {
        const r = bl.rect, lx = sx - r.x, ly = sy - r.y;
        if (lx >= 0 && ly >= 0 && lx < r.w && ly < r.h) w = bl.weight[ly * r.w + lx]! * (p.intensity / bl.intensity);
      } else w = contribution(p, P, n);
      if (!w) continue;
      total[q] = Math.max(0, total[q]! - p.color[0] * w);
      total[q + 1] = Math.max(0, total[q + 1]! - p.color[1] * w);
      total[q + 2] = Math.max(0, total[q + 2]! - p.color[2] * w);
    }
  }
}
