import { describe, expect, it } from 'vitest';
import { cameraScroll, computeLayout, scrollAxis } from '../../src/game/brotato/ui/layout';

// La pantalla del juego (src/game/brotato/ui/layout.ts). Las pruebas son las del Brotato en Phaser (test/pixel.test.ts
// y la cámara de test/bounds.test.ts), con los mismos números: la regla y la cámara no cambian al pasar a VoxPix.

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

describe('la cámara no enseña el vacío', () => {
  const view = { width: 480, height: 270 };
  const arena = { width: 640, height: 640 };

  it('en el centro, centra al jugador', () => {
    expect(cameraScroll({ x: 320, y: 320 }, view, arena)).toEqual({ x: 80, y: 185 });
  });

  it('en una esquina, se queda en el borde de la arena', () => {
    expect(cameraScroll({ x: 640, y: 640 }, view, arena)).toEqual({ x: 160, y: 370 });
    expect(cameraScroll({ x: 0, y: 0 }, view, arena)).toEqual({ x: 0, y: 0 });
  });

  it('el scroll siempre deja la vista dentro de la arena y es entero', () => {
    for (let x = 0; x <= 640; x += 7) {
      for (let y = 0; y <= 640; y += 11) {
        const s = cameraScroll({ x, y }, view, arena);
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + view.width).toBeLessThanOrEqual(arena.width);
        expect(s.y + view.height).toBeLessThanOrEqual(arena.height);
      }
    }
  });

  it('con el HUD arriba, la cámara sube lo que mide el HUD por encima de la arena y nada más', () => {
    expect(cameraScroll({ x: 320, y: 0 }, view, arena, 26)).toEqual({ x: 80, y: -26 });
    expect(cameraScroll({ x: 320, y: 320 }, view, arena, 26)).toEqual({ x: 80, y: 185 });
    expect(cameraScroll({ x: 640, y: 640 }, view, arena, 26)).toEqual({ x: 160, y: 370 });
  });

  it('si la arena es más pequeña que la vista en un eje, se centra en ese eje', () => {
    expect(cameraScroll({ x: 100, y: 300 }, { width: 270, height: 480 }, { width: 200, height: 640 }))
      .toEqual({ x: -35, y: 60 });
  });
});

// Lo nuevo de VoxPix: el tramo de un eje no empieza en 0 (la vista no sube de la tapa de la pared del norte) y las
// vistas del Flip tienen lados impares (249): el scroll sigue entero y dentro
describe('scrollAxis con el tramo de la imagen horneada', () => {
  it('no sube de la tapa del norte ni baja del final de la imagen, con vistas de lado par e impar', () => {
    for (const view of [216, 218, 249, 384]) {
      for (let t = -50; t <= 900; t += 13) {
        const s = scrollAxis(t, view, 40, 800);
        expect(Number.isInteger(s), `${view} ${t}`).toBe(true);
        expect(s).toBeGreaterThanOrEqual(40);
        expect(s + view).toBeLessThanOrEqual(800);
      }
    }
  });
});
