// Gotas de agua (salpicaduras y el chorro de la fuente): puntos en 3D con velocidad y gravedad, dibujados con la
// misma cámara y prueba de profundidad que el resto. Al caer al agua devuelven su agua al fluido y hacen una onda.
import type { Baked } from './bake';
import type { WaterLayer } from './water';

const MAX = 1200;
const GRAVITY = 260;          // vóxeles/s²

export class Drops {
  // x, y (del juego, píxeles), z (vóxeles), vx, vy, vz, vida, agua que lleva
  private d = new Float32Array(MAX * 8);
  private n = 0;
  private seed = 1;

  private rand(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return this.seed / 4294967296;
  }

  get count(): number { return this.n; }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, water = 0.02): void {
    if (this.n >= MAX) return;
    const o = this.n++ * 8;
    this.d.set([x, y, z, vx, vy, vz, 2, water], o);
  }

  // Salpicadura: `count` gotas hacia arriba y hacia fuera desde (x, y) a la altura de la superficie
  splash(x: number, y: number, z: number, count: number, force: number): void {
    for (let k = 0; k < count; k++) {
      const ang = this.rand() * Math.PI * 2, sp = force * (0.3 + this.rand() * 0.7);
      this.emit(x + Math.cos(ang) * 2, y + Math.sin(ang) * 2, z + 0.5, Math.cos(ang) * sp * 0.5, Math.sin(ang) * sp * 0.5, force * (0.6 + this.rand() * 0.6));
    }
  }

  step(dt: number, water: WaterLayer | null): void {
    const d = this.d;
    for (let k = 0; k < this.n; k++) {
      const o = k * 8;
      d[o + 5] = d[o + 5]! - GRAVITY * dt;
      d[o] = d[o]! + d[o + 3]! * dt; d[o + 1] = d[o + 1]! + d[o + 4]! * dt; d[o + 2] = d[o + 2]! + d[o + 5]! * dt;
      d[o + 6] = d[o + 6]! - dt;
      const floor = water ? Math.max(water.surfaceAt(d[o]!, d[o + 1]!), water.groundAt(d[o]!, d[o + 1]!)) : 0;
      if (d[o + 2]! <= floor || d[o + 6]! <= 0) {
        if (water && d[o + 2]! <= floor) {
          if (d[o + 7]! > 0) water.pour(d[o]!, d[o + 1]!, d[o + 7]!);
          if (water.depthAt(d[o]!, d[o + 1]!) > 0.3) water.disturb(d[o]!, d[o + 1]!, 0.03, 1);
        }
        // quitar: la última ocupa su sitio
        this.n--;
        if (k !== this.n) d.copyWithin(o, this.n * 8, this.n * 8 + 8);
        k--;
      }
    }
  }

  // Dibuja las gotas en la vista con prueba de profundidad. `color` es el tono claro del agua.
  draw(b: Baked, worldDepth: number, view: Uint8ClampedArray, depthBuf: Float32Array, total: Float32Array | null, vx: number, vy: number, vw: number, vh: number,
    color: readonly [number, number, number], light: readonly [number, number, number]): void {
    const d = this.d;
    for (let k = 0; k < this.n; k++) {
      const o = k * 8;
      const [sx, sy, depth] = b.cam.project(d[o]!, worldDepth - 1 - d[o + 1]!, d[o + 2]!);
      const tx = Math.floor(sx) - vx, ty = Math.floor(sy) - vy;
      if (tx < 0 || ty < 0 || tx >= vw || ty >= vh) continue;
      const t = ty * vw + tx;
      if (depth >= depthBuf[t]! - 0.3) continue;
      view[t * 4] = color[0]; view[t * 4 + 1] = color[1]; view[t * 4 + 2] = color[2];
      depthBuf[t] = depth;
      if (total) { total[t * 3] = light[0]; total[t * 3 + 1] = light[1]; total[t * 3 + 2] = light[2]; }
    }
  }
}
