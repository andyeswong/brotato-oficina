import { describe, expect, it } from 'vitest';
import { computeLight } from '../src/engine/lighting/lightmap';
import { buildLayers } from '../src/engine/lighting/shade';
import { shadeBand, shadowBox } from '../src/engine/view/lightBands';

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

// La sombra del personaje se recalcula cada cuadro solo dentro de shadowBox: fuera de él, la luz con y sin el
// cuerpo tiene que ser la misma, o al moverse dejaría restos de sombra que nadie borra.
describe('recuadro de la sombra de un cuerpo', () => {
  const arena = { x: 0, y: 0, width: 320, height: 240 };
  const lights = [
    { x: 60, y: 50, radius: 110, color: [1, 0.62, 0.28] as const, intensity: 1.3 },
    { x: 250, y: 70, radius: 64, color: [0.21, 0.95, 1] as const, intensity: 1 },
    { x: 160, y: 200, radius: 52, color: [0.45, 0.7, 1] as const, intensity: 0.7 },
  ];
  const opaque = () => false;
  const free = computeLight(arena, lights, { color: [0.4, 0.46, 0.64] }, opaque, 0);
  let rng = 7;
  const rand = () => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const bodies = [
    { x: 64, y: 54, rx: 6, ry: 10 },     // con la luz dentro del recuadro del cuerpo
    { x: 70, y: 52, rx: 6, ry: 10 },     // pegado a la luz: el cono se abre casi 180°
    ...Array.from({ length: 40 }, () => ({ x: 10 + rand() * 300, y: 10 + rand() * 220, rx: 4 + rand() * 4, ry: 6 + rand() * 6 })),
  ];

  it.each(bodies.map((b, i) => [i, b] as const))('cuerpo %i: nada cambia fuera del recuadro', (_i, body) => {
    const shaded = computeLight(arena, lights, { color: [0.4, 0.46, 0.64] }, opaque, 0, { occluders: [body] });
    const box = shadowBox(lights, body);
    for (let r = 0; r < free.rows; r++) for (let c = 0; c < free.cols; c++) {
      const i = (r * free.cols + c) * 3;
      if (free.total[i] === shaded.total[i] && free.total[i + 1] === shaded.total[i + 1] && free.total[i + 2] === shaded.total[i + 2]) continue;
      const px = (c + 0.5) * free.cell, py = (r + 0.5) * free.cell;
      expect(box, `sombra en (${px}, ${py}) sin recuadro`).not.toBeNull();
      expect(px >= box!.x && px < box!.x + box!.width && py >= box!.y && py < box!.y + box!.height, `sombra en (${px}, ${py}) fuera de ${JSON.stringify(box)}`).toBe(true);
    }
    if (box) expect(box.width * box.height).toBeLessThan(arena.width * arena.height);
  });

  it('sin luz que lo alcance no hay recuadro', () => {
    expect(shadowBox(lights, { x: 300, y: 230, rx: 5, ry: 7 })).toBeNull();
  });

  it('algún cuerpo da sombra de verdad (el test no es vacío)', () => {
    const body = { x: 100, y: 80, rx: 6, ry: 10 };
    const shaded = computeLight(arena, lights, { color: [0.4, 0.46, 0.64] }, opaque, 0, { occluders: [body] });
    expect(shaded.total.some((v, i) => v !== free.total[i])).toBe(true);
  });
});
