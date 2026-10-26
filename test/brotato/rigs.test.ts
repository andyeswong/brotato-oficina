// Los rigs de andar de los bichos (src/anim/rigs-brotato.ts) con sus modelos: cumplen las reglas del pivote del rig
// genérico de VoxPix (src/anim/rig.ts). Venían en test/rig.test.ts del motor; las reglas son las mismas.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Model, type ModelFile } from '@voxpix/core';
import { rigFrames, rigFromSpec, type Rig, type RigSpec } from '@voxpix/anim/rig';
import { BROTATO_RIGS, BROTATO_RIG_SPECS } from '../../src/anim/rigs-brotato';

function ground(m: Model): { n: number; cx: number; cy: number } {
  let n = 0, sx = 0, sy = 0;
  for (const [x, y, z] of m.entries()) if (z === 0) { n++; sx += x; sy += y; }
  return { n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
}

// Las reglas del pivote para un modelo y su rig
function checkRig(name: string, base: Model, rig: Rig): void {
  const frames = rigFrames(base, rig);
  expect(frames).toHaveLength(rig.frames.length);
  const g0 = ground(base);
  let cx = 0, cy = 0, k = 0;
  frames.forEach((f, i) => {
    const b = f.bounds()!;
    if (rig.frames[i]!.airborne) {
      // En el aire: nada por debajo del suelo y sube poco (un salto, no un vuelo)
      expect(b.minZ, `${name} cuadro ${i}`).toBeGreaterThanOrEqual(0);
      expect(b.minZ, `${name} cuadro ${i}`).toBeLessThanOrEqual(2);
      return;
    }
    // Apoyado: algo toca z = 0 y nada baja de ahí
    expect(b.minZ, `${name} cuadro ${i}`).toBe(0);
    const g = ground(f);
    cx += g.cx; cy += g.cy; k++;
  });
  // De media en el ciclo, el apoyo está donde el del quieto (medio vóxel de margen)
  expect(Math.abs(cx / k - g0.cx), `${name} x`).toBeLessThan(0.75);
  expect(Math.abs(cy / k - g0.cy), `${name} y`).toBeLessThan(0.75);
  // Cada parte avanza lo mismo que retrocede
  for (const p of rig.parts) expect(rig.frames.reduce((s, f) => s + (f.moves[p.name]?.stride ?? 0), 0), `${name} ${p.name}`).toBe(0);
  // El cuerpo no se desplaza en planta
  for (const f of rig.frames) { expect(f.moves.body?.dx ?? 0).toBe(0); }
  // Ni pierde ni inventa masa (más del 8 %: un bicho pequeño pierde proporcionalmente más al doblar una pata)
  for (const f of frames) expect(Math.abs(f.size - base.size) / base.size, name).toBeLessThan(0.08);
}

describe('los rigs de los bichos', () => {
  for (const [name, r] of Object.entries(BROTATO_RIGS)) {
    const file = `models/brotato/${name}/${name}.json`;
    it(`${name} existe y cumple las reglas del pivote`, () => {
      expect(existsSync(file), file).toBe(true);
      const m = Model.fromJSON(JSON.parse(readFileSync(file, 'utf8')) as ModelFile);
      checkRig(name, m, r);
    });
  }
});

// Los rigs como eran antes de RigSpec (VoxPix a6c1723), con has() en código. Los RigSpec tienen que dar, cuadro a
// cuadro, exactamente los mismos vóxeles; si alguien toca una caja, esto lo dice.
const tripodA = (x: number, y: number) => (x < 0 ? Math.abs(y) >= 2 : Math.abs(y) < 2);
const HAS_PARTS: Record<string, Rig['parts']> = {
  'bicho-grapa': [
    { name: 'L', has: (x, _y, z) => x <= -5 && z <= 7, pivotZ: 7, footZ: 0 },
    { name: 'R', has: (x, _y, z) => x >= 5 && z <= 7, pivotZ: 7, footZ: 0 },
  ],
  'bicho-clip': [
    { name: 'A', has: (x, y, z) => z <= 2 && Math.abs(x) >= 4 && tripodA(x, y), pivotZ: 2, footZ: 0 },
    { name: 'B', has: (x, y, z) => z <= 2 && Math.abs(x) >= 4 && !tripodA(x, y), pivotZ: 2, footZ: 0 },
  ],
  'bicho-taza': [{ name: 'top', has: (_x, _y, z) => z >= 6 }],
};

const voxels = (m: Model) => JSON.stringify([...m.entries()].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]));

describe('los rigs como RigSpec', () => {
  for (const [name, spec] of Object.entries(BROTATO_RIG_SPECS)) {
    it(`${name}: mismos cuadros que con has(), también tras pasar por JSON`, () => {
      const m = Model.fromJSON(JSON.parse(readFileSync(`models/brotato/${name}/${name}.json`, 'utf8')) as ModelFile);
      const old = rigFrames(m, { frameMs: spec.frameMs, frames: spec.frames, parts: HAS_PARTS[name]! });
      const viaJson = rigFromSpec(JSON.parse(JSON.stringify(spec)) as RigSpec);
      const now = rigFrames(m, viaJson);
      expect(now.map(voxels)).toEqual(old.map(voxels));
      // y que el rig mueve algo de verdad: algún cuadro distinto del quieto
      expect(now.some((f) => voxels(f) !== voxels(m)), name).toBe(true);
    });
  }
});
