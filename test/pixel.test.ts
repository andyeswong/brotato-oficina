import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/engine/view/pixel';

// Los tamaños del encargo con la regla vigente, 216/384 (DISENO.md 5.2)
describe('computeLayout 216/384', () => {
  it.each([
    ['escritorio 1920×1080', 1920, 1080, { scale: 5, width: 384, height: 216 }],
    ['portátil 1366×768', 1366, 768, { scale: 3, width: 384, height: 256 }],
    ['monitor 2560×1440', 2560, 1440, { scale: 6, width: 384, height: 240 }],
    ['tapa del Flip', 747.25, 654.5, { scale: 3, width: 249, height: 218 }],
    ['Flip abierto', 1080, 2640, { scale: 5, width: 216, height: 384 }],
  ])('%s', (_name, w, h, expected) => {
    expect(computeLayout(w, h)).toMatchObject(expected);
  });

  it('centra el sobrante en píxeles físicos enteros', () => {
    const l = computeLayout(1080, 2640);
    expect(l.top).toBe(360);   // 2640 − 384 × 5 = 720, la mitad arriba
    expect(l.left).toBe(0);
  });

  it('una pantalla diminuta usa s=1 y lo que quepa', () => {
    expect(computeLayout(200, 150)).toMatchObject({ scale: 1, width: 200, height: 150 });
  });
});

// El mecanismo no depende de los números: con otra regla (270/480), salen los suyos
describe('computeLayout con otra regla', () => {
  it.each([
    ['escritorio 1920×1080', 1920, 1080, { scale: 4, width: 480, height: 270 }],
    ['tapa del Flip', 747.25, 654.5, { scale: 2, width: 373, height: 327 }],
    ['Flip abierto', 1080, 2640, { scale: 4, width: 270, height: 480 }],
  ])('%s', (_name, w, h, expected) => {
    expect(computeLayout(w, h, { minShortSide: 270, maxVisible: 480 })).toMatchObject(expected);
  });
});
