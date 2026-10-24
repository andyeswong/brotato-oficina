import { describe, expect, it } from 'vitest';
import { computeLight } from '../src/engine/lighting/lightmap';
import { buildLayers } from '../src/engine/lighting/shade';
import { shadeBand } from '../src/engine/view/lightBands';

// El repintado de un parche de luz se reparte en bandas, una por cuadro: juntas tienen que dar lo mismo que
// el parche sombreado de una vez, o se vería una costura cada pocas filas.
describe('parche de luz por bandas', () => {
  const region = { x: 36, y: 20, width: 150, height: 98 };
  const lights = [
    { x: 80, y: 30, radius: 90, color: [1, 0.6, 0.3] as const, intensity: 1.3 },
    { x: 150, y: 60, radius: 60, color: [0.3, 0.9, 1] as const, intensity: 0.8 },
  ];
  const field = computeLight(region, lights, { color: [0.4, 0.46, 0.64] }, (tx, ty) => tx === 5 && ty === 4, 0);

  it.each([
    ['por defecto', {}],
    ['brillo suave, 8 niveles', { steps: 8, softGlow: true }],
    ['sin trama', { dither: false }],
  ])('%s: las bandas juntas son idénticas al parche entero', (_name, shade) => {
    const whole = buildLayers(field, region, shade);
    for (const rows of [4, 12, 28, 100]) {
      const multiply = new Uint8ClampedArray(whole.multiply.length);
      const add = new Uint8ClampedArray(whole.add.length);
      for (let y0 = 0; y0 < region.height; y0 += rows) {
        const band = shadeBand(field, region, y0, Math.min(region.height, y0 + rows), shade);
        multiply.set(band.multiply, y0 * region.width * 4);
        add.set(band.add, y0 * region.width * 4);
      }
      expect(multiply, `bandas de ${rows} filas`).toEqual(whole.multiply);
      expect(add, `bandas de ${rows} filas`).toEqual(whole.add);
    }
  });

  it('una banda que no empieza en múltiplo de 4 se rechaza', () => {
    expect(() => shadeBand(field, region, 6, 10)).toThrow(/múltiplo de 4/);
  });
});
