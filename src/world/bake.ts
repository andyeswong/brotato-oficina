// Horneado de un mundo de vóxeles para jugarlo en 2D: se renderiza UNA vez (imagen + profundidad + qué vóxel hay
// en cada píxel) y, por cada luz, su peso en cada píxel de su zona, con la caída del juego, el ángulo con la
// cara y la sombra de los propios vóxeles. Por cuadro solo queda sumar las luces con su parpadeo (lightView).
import { render, camera, unkey, DIR_VECTORS, type RenderOptions, type Camera } from '../core';
import { SOURCE_PRESETS, lightIntensity, lightOf } from '../lighting';
import type { World, WorldLight } from './build';

export interface BakedLight {
  light: WorldLight;
  color: readonly [number, number, number];
  intensity: number;
  rect: { x: number; y: number; w: number; h: number };   // zona de la imagen donde alumbra
  weight: Float32Array;                                    // peso por píxel de la zona (con la intensidad base)
}

export interface Baked {
  width: number;
  height: number;
  rgba: Uint8ClampedArray<ArrayBuffer>;
  depth: Float32Array;
  options: RenderOptions;
  cam: Camera;
  lights: BakedLight[];
  ms: { render: number; light: number };
}

const facing = (ndl: number) => (ndl > 0 ? 0.35 + 0.65 * ndl : 0);
const BASIN_DEPTH = 10;   // las cuencas del agua bajan hasta z = -8: la imagen se alarga por abajo

// Proyección oblicua 3/4: la altura sube 1:1 y el suelo se acorta por `incline` (1 = sin acortar, como los tiles
// del juego; 0.5 = losetas de 16x8, que deja ver a los personajes de frente con un poco de cabeza). Personajes y
// escenario usan la MISMA proyección. La imagen tiene el norte arriba.
export function bakeWorld(world: World, opts: { topZ?: number; incline?: number } = {}): Baked {
  const topZ = opts.topZ ?? 40;
  const incline = opts.incline ?? 0.5;
  const originY = Math.ceil(world.depth * incline) + topZ;
  const options: RenderOptions = {
    width: world.width + 2, height: originY + 2 + BASIN_DEPTH, originX: 0, originY,
    yaw: 0, oblique: { y: incline, z: 1 }, pivot: [0, 0, 0], smooth: 0, shadows: false, ao: true, outline: 'none', pick: true,
  };
  const t0 = performance.now();
  const img = render(world.model, options);
  const t1 = performance.now();
  const cam = camera(options);

  // Rejilla densa de ocupación para los rayos de sombra
  const GW = world.width, GD = world.depth, GZ = topZ + 2 + BASIN_DEPTH, Z0 = -BASIN_DEPTH;
  const occ = new Uint8Array(GW * GD * GZ);
  for (const [x, y, z0] of world.model.entries()) { const z = z0 - Z0; if (x >= 0 && y >= 0 && z >= 0 && x < GW && y < GD && z < GZ) occ[(z * GD + y) * GW + x] = 1; }
  const filled = (x: number, y: number, z0: number) => { const z = z0 - Z0; return x >= 0 && y >= 0 && z >= 0 && x < GW && y < GD && z < GZ && occ[(z * GD + y) * GW + x] === 1; };

  function occluded(px: number, py: number, pz: number, lx: number, ly: number, lz: number): boolean {
    const dx = lx - px, dy = ly - py, dz = lz - pz;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const tx = Math.floor(lx), ty = Math.floor(ly), tz = Math.floor(lz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const ddx = sx ? Math.abs(1 / dx) : Infinity, ddy = sy ? Math.abs(1 / dy) : Infinity, ddz = sz ? Math.abs(1 / dz) : Infinity;
    let mx = sx ? (sx > 0 ? x + 1 - px : px - x) * ddx : Infinity;
    let my = sy ? (sy > 0 ? y + 1 - py : py - y) * ddy : Infinity;
    let mz = sz ? (sz > 0 ? z + 1 - pz : pz - z) * ddz : Infinity;
    for (let i = 0; i < 1024; i++) {
      if (x === tx && y === ty && z === tz) return false;
      if (mx <= my && mx <= mz) { if (mx > 1) return false; x += sx; mx += ddx; }
      else if (my <= mz) { if (my > 1) return false; y += sy; my += ddy; }
      else { if (mz > 1) return false; z += sz; mz += ddz; }
      if (x === tx && y === ty && z === tz) return false;
      if (filled(x, y, z)) return true;
    }
    return false;
  }

  const lights: BakedLight[] = [];
  for (const l of world.lights) {
    const p = SOURCE_PRESETS[l.kind];
    const r = p.radius;
    // Zona de la imagen: la proyección de la caja que rodea la esfera de la luz
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const dx of [-r, r]) for (const dy of [-r, r]) for (const z of [0, Math.min(topZ, l.z + r)]) {
      const [sx, sy] = cam.project(l.x + dx, l.y + dy, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const rx = Math.max(0, Math.floor(x0)), ry = Math.max(0, Math.floor(y0));
    const rect = { x: rx, y: ry, w: Math.min(img.width, Math.ceil(x1)) - rx, h: Math.min(img.height, Math.ceil(y1)) - ry };
    if (rect.w <= 0 || rect.h <= 0) continue;
    const weight = new Float32Array(rect.w * rect.h);
    const cache = new Map<number, number>();
    for (let j = 0; j < rect.h; j++) for (let i = 0; i < rect.w; i++) {
      const idx = (rect.y + j) * img.width + rect.x + i;
      const k = img.pickKey![idx]!;
      if (Number.isNaN(k)) continue;
      const f = img.pickFace![idx]!;
      const ck = k * 8 + f;
      let w = cache.get(ck);
      if (w === undefined) {
        const [vx, vy, vz] = unkey(k);
        const n = DIR_VECTORS[f]!;
        const cx = vx + 0.5 + n[0] * 0.5, cy = vy + 0.5 + n[1] * 0.5, cz = vz + 0.5 + n[2] * 0.5;
        const ax = l.x - cx, ay = l.y - cy, az = l.z - cz;
        const d = Math.hypot(ax, ay, az);
        w = 0;
        if (d < r) {
          const fa = d < 1e-6 ? 1 : facing((n[0] * ax + n[1] * ay + n[2] * az) / d);
          const k2 = 1 - d / r;
          if (fa > 0 && !occluded(vx + 0.5 + n[0], vy + 0.5 + n[1], vz + 0.5 + n[2], l.x, l.y, l.z)) w = k2 * k2 * fa * p.intensity;
        }
        cache.set(ck, w);
      }
      weight[j * rect.w + i] = w;
    }
    lights.push({ light: l, color: p.color, intensity: p.intensity, rect, weight });
  }
  const t2 = performance.now();
  return { width: img.width, height: img.height, rgba: img.rgba, depth: img.depth, options, cam, lights, ms: { render: Math.round(t1 - t0), light: Math.round(t2 - t1) } };
}

// Luz total (ambiente + fuentes con su parpadeo en `time`) de una ventana de la imagen horneada
export function lightView(b: Baked, vx: number, vy: number, vw: number, vh: number, ambient: readonly [number, number, number], time: number): Float32Array {
  const total = new Float32Array(vw * vh * 3);
  for (let i = 0; i < vw * vh; i++) { total[i * 3] = ambient[0]; total[i * 3 + 1] = ambient[1]; total[i * 3 + 2] = ambient[2]; }
  for (const bl of b.lights) {
    const r = bl.rect;
    const ix0 = Math.max(vx, r.x), iy0 = Math.max(vy, r.y), ix1 = Math.min(vx + vw, r.x + r.w), iy1 = Math.min(vy + vh, r.y + r.h);
    if (ix0 >= ix1 || iy0 >= iy1) continue;
    const k = lightIntensity(lightOf({ id: bl.light.id, kind: bl.light.kind, x: 0, y: 0 }), time) / bl.intensity;
    const [cr, cg, cb] = bl.color;
    for (let y = iy0; y < iy1; y++) {
      const src = (y - r.y) * r.w - r.x, dst = (y - vy) * vw - vx;
      for (let x = ix0; x < ix1; x++) {
        const w = bl.weight[src + x]!;
        if (!w) continue;
        const o = (dst + x) * 3, kw = w * k;
        total[o] = total[o]! + cr * kw; total[o + 1] = total[o + 1]! + cg * kw; total[o + 2] = total[o + 2]! + cb * kw;
      }
    }
  }
  return total;
}
