// Un cuadro del modo 2D del juego a partir del ESTADO DEL MUNDO: lo estático horneado (una vez por nivel), y
// encima, con la misma cámara, prueba de profundidad y luz: las entidades, el agua y las gotas.
import { render, camera, lightField3D, rgbOf, type PointLight3D } from '../core';
import { SOURCE_PRESETS, lightIntensity, lightOf } from '../lighting';
import { buildLayers, applyLayers } from '../lighting/shade';
import { lightView, type Baked } from './bake';
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

  for (const e of state.entities) drawEntity(state, b, e, view, depthBuf, total, o, a);

  // El agua (tapa lo sumergido) y las gotas
  state.water?.draw(b, view, depthBuf, total, vx, vy, vw, vh, ambient, o.time);
  const wr = state.palette.ramps.find((r) => r.name === 'agua');
  if (wr) state.drops.draw(b, state.depth, view, depthBuf, total, vx, vy, vw, vh, rgbOf(wr.colors[4] ?? wr.colors[0]!), [ambient[0] * 1.7, ambient[1] * 1.7, ambient[2] * 1.8]);

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
  // Sombra en el suelo: una elipse bajo los pies que se come la luz
  const feet = b.cam.project(X + 0.5, Y, Z);
  const fx = Math.floor(feet[0]), fy = Math.floor(feet[1]);
  const sry = Math.max(1.5, 3.5 * a);
  if (total) for (let y = -Math.ceil(sry); y <= Math.ceil(sry); y++) for (let x = -8; x <= 8; x++) {
    if ((x / 8.5) ** 2 + (y / sry) ** 2 > 1) continue;
    const sx = fx - vx + x, sy = fy - vy + y;
    if (sx < 0 || sy < 0 || sx >= vw || sy >= vh) continue;
    const q = (sy * vw + sx) * 3;
    total[q] = total[q]! * 0.5; total[q + 1] = total[q + 1]! * 0.5; total[q + 2] = total[q + 2]! * 0.55;
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
      const p = SOURCE_PRESETS[l.kind];
      const dx = l.x - (X + 0.5), dy = l.y - Y;
      return { x: dx * c + dy * sn + 0.5, y: -dx * sn + dy * c, z: l.z - bob - Z, radius: p.radius, color: p.color,
        intensity: lightIntensity(lightOf({ id: l.id, kind: l.kind, x: 0, y: 0 }), o.time) };
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
