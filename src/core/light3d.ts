import type { VoxelSource } from './model';
import { unkey } from './model';
import { DIR_VECTORS, type Camera, type Rendered } from './render';

// Luces de punto en el ESPACIO DEL MODELO (2.5D): cada fuente está en una celda (x, y, z) en vóxeles, y la luz
// se calcula por cara de vóxel (distancia, ángulo con la cara y sombra contra los propios vóxeles) y por
// punto del suelo (z = 0). El resultado es la luz total por píxel (ambiente + fuentes), con la misma forma
// que el mapa de luz del juego, para pasarla por sus mismas capas MULTIPLY/ADD.
//
// Misma caída que el motor del juego: (1 - d/r)^2 * intensidad. La intensidad ya viene con el parpadeo
// resuelto (quien llama decide el instante).

export interface PointLight3D {
  x: number;
  y: number;
  z: number;
  radius: number;                           // en vóxeles (= píxeles del juego)
  color: readonly [number, number, number];  // 0..1
  intensity: number;
}

// Cuánto recibe una cara según su ángulo con la luz: de lado aún recibe algo, de espaldas nada
const facing = (ndl: number) => (ndl > 0 ? 0.35 + 0.65 * ndl : 0);

export function lightField3D(
  model: VoxelSource,
  img: Rendered,
  cam: Camera,
  lights: readonly PointLight3D[],
  ambient: readonly [number, number, number],
  options: { floor?: boolean } = {},
): Float32Array {
  if (!img.pickKey || !img.pickFace) throw new Error('lightField3D necesita un render con pick: true');
  const { width: W, height: H } = img;
  const total = new Float32Array(W * H * 3);
  const filled = (x: number, y: number, z: number) => model.get(x, y, z) !== 0;
  const faceCache = new Map<string, [number, number, number]>();

  // ¿Hay un vóxel entre el punto p (en el aire) y la luz? Recorre la rejilla (Amanatides-Woo).
  function occluded(px: number, py: number, pz: number, l: PointLight3D): boolean {
    const dx = l.x - px, dy = l.y - py, dz = l.z - pz;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const tx = Math.floor(l.x), ty = Math.floor(l.y), tz = Math.floor(l.z);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const ddx = sx ? Math.abs(1 / dx) : Infinity, ddy = sy ? Math.abs(1 / dy) : Infinity, ddz = sz ? Math.abs(1 / dz) : Infinity;
    let mx = sx ? (sx > 0 ? x + 1 - px : px - x) * ddx : Infinity;
    let my = sy ? (sy > 0 ? y + 1 - py : py - y) * ddy : Infinity;
    let mz = sz ? (sz > 0 ? z + 1 - pz : pz - z) * ddz : Infinity;
    for (let i = 0; i < 512; i++) {
      if (x === tx && y === ty && z === tz) return false;
      if (mx <= my && mx <= mz) { if (mx > 1) return false; x += sx; mx += ddx; }
      else if (my <= mz) { if (my > 1) return false; y += sy; my += ddy; }
      else { if (mz > 1) return false; z += sz; mz += ddz; }
      if (x === tx && y === ty && z === tz) return false;
      if (filled(x, y, z)) return true;
    }
    return false;
  }

  function lightAt(p: [number, number, number], n: readonly [number, number, number], start: [number, number, number]): [number, number, number] {
    const out: [number, number, number] = [ambient[0], ambient[1], ambient[2]];
    for (const l of lights) {
      const vx = l.x - p[0], vy = l.y - p[1], vz = l.z - p[2];
      const d = Math.hypot(vx, vy, vz);
      if (d >= l.radius || l.intensity <= 0) continue;
      const f = d < 1e-6 ? 1 : facing((n[0] * vx + n[1] * vy + n[2] * vz) / d);
      if (f <= 0) continue;
      const k = 1 - d / l.radius;
      const att = k * k * l.intensity * f;
      if (att < 0.002) continue;
      if (occluded(start[0], start[1], start[2], l)) continue;
      out[0] += l.color[0] * att; out[1] += l.color[1] * att; out[2] += l.color[2] * att;
    }
    return out;
  }

  for (let i = 0; i < W * H; i++) {
    const k = img.pickKey[i]!;
    let c: [number, number, number];
    if (!Number.isNaN(k)) {
      const f = img.pickFace[i]!;
      const ck = `${k}:${f}`;
      let hit = faceCache.get(ck);
      if (!hit) {
        // Luz plana por cara (pixel art): en el centro de la cara, empezando el rayo en la celda de aire de enfrente
        const [x, y, z] = unkey(k);
        const n = DIR_VECTORS[f]!;
        const p: [number, number, number] = [x + 0.5 + n[0] * 0.5, y + 0.5 + n[1] * 0.5, z + 0.5 + n[2] * 0.5];
        hit = lightAt(p, n, [x + 0.5 + n[0], y + 0.5 + n[1], z + 0.5 + n[2]]);
        faceCache.set(ck, hit);
      }
      c = hit;
    } else if (options.floor ?? true) {
      const g = cam.groundPoint((i % W) + 0.5, Math.floor(i / W) + 0.5);
      c = g ? lightAt([g[0], g[1], 0], [0, 0, 1], [g[0], g[1], 0.01]) : [ambient[0], ambient[1], ambient[2]];
    } else {
      c = [ambient[0], ambient[1], ambient[2]];
    }
    total[i * 3] = c[0]; total[i * 3 + 1] = c[1]; total[i * 3 + 2] = c[2];
  }
  return total;
}
