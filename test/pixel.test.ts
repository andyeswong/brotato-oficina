import { describe, expect, it } from 'vitest';
import { computeLayout } from '../src/engine/view/pixel';

// Los tamaños del encargo (DISENO.md 5.2)
describe('computeLayout', () => {
  it.each([
    ['escritorio 1920×1080', 1920, 1080, { scale: 4, width: 480, height: 270 }],
    ['portátil 1366×768', 1366, 768, { scale: 2, width: 480, height: 384 }],
    ['tapa del Flip', 747.25, 654.5, { scale: 2, width: 373, height: 327 }],
    ['Flip abierto', 1080, 2640, { scale: 4, width: 270, height: 480 }],
  ])('%s', (_name, w, h, expected) => {
    expect(computeLayout(w, h)).toMatchObject(expected);
  });

  it('centra el sobrante en píxeles físicos enteros', () => {
    const l = computeLayout(1080, 2640);
    expect(l.top).toBe(360);
    expect(l.left).toBe(0);
  });

  it('una pantalla diminuta usa s=1 y lo que quepa', () => {
    expect(computeLayout(200, 150)).toMatchObject({ scale: 1, width: 200, height: 150 });
  });
});
