import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { computeLight, type Region } from '../src/engine/lighting/lightmap';
import type { Ambient, Light } from '../src/engine/lighting/lights';
import { applyLayers, buildLayers } from '../src/engine/lighting/shade';
import { crop, decodePng, encodePng } from './pngio';

// Vista previa sobre el escenario medieval (hecho en Lua): PREVIEW=1 SCENE=<ruta al png> npx vitest run scripts/lighting-preview.test.ts
// Escribe out/light-*.png. La escena es un PNG plano: aquí sirve para ver la luz, no es como lo dibuja el juego.
const SCENE = process.env.SCENE ?? '../arte/escenarios/medieval/medieval_arena_con_paredes.png';

describe.runIf(process.env.PREVIEW)('vista previa de la iluminación', () => {
  it('antorchas, linterna de MAIA y columnas que proyectan sombra', () => {
    const scene = decodePng(readFileSync(SCENE));
    // Tres columnas de piedra, solo para esta vista: bloques planos sobre el suelo
    const pillars = [[8, 3], [5, 4], [11, 5]] as const;
    const pillarSet = new Set(pillars.map(([tx, ty]) => `${tx},${ty}`));
    for (const [tx, ty] of pillars) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const o = ((ty * 16 + y) * scene.width + tx * 16 + x) * 4;
        const lit = y === 0 || x === 0, dim = y === 15 || x === 15;
        const c = lit ? [138, 126, 106] : dim ? [52, 46, 38] : [102, 92, 78];
        scene.data[o] = c[0]!; scene.data[o + 1] = c[1]!; scene.data[o + 2] = c[2]!; scene.data[o + 3] = 255;
      }
    }
    const view: Region = { x: 0, y: 0, width: 384, height: 216 };
    const ambient: Ambient = { color: [0.3, 0.36, 0.52] };               // noche con luna
    const opaque = (tx: number, ty: number) => pillarSet.has(`${tx},${ty}`);
    const torch = (x: number, seed: number): Light => ({ x, y: 27, radius: 110, color: [1, 0.62, 0.28], intensity: 1.3, flicker: { amount: 0.25, speed: 9, seed } });
    const lantern = (x: number): Light => ({ x, y: 120, radius: 70, color: [0.6, 0.85, 1], intensity: 0.95 });
    mkdirSync('out', { recursive: true });
    const base = crop(scene, 0, 0, 384, 216);
    writeFileSync('out/light-0-apagada.png', encodePng(base, 3));
    const frames: Array<[string, number, number]> = [['a', 0.0, 166], ['b', 0.37, 230]];
    for (const [name, t, mx] of frames) {
      const lights = [torch(104, 1), torch(136, 2), lantern(mx)];
      const field = computeLight(view, lights, ambient, opaque, t);
      const layers = buildLayers(field, view, { steps: 6, glow: 0.45, dither: true });
      writeFileSync(`out/light-${name}.png`, encodePng({ ...base, data: applyLayers(base.data, layers) }, 3));
    }
  });
});
