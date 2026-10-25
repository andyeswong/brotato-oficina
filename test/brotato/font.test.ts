import { describe, expect, it } from 'vitest';
import { FONT_CHARS, glyphRows, normalize, textWidth, wrapText, CHAR_W, drawText } from '../../src/game/brotato/ui/font';

// Portadas del Brotato en Phaser (test/font.test.ts). No entran, por no aplicar ya: la escala de la interfaz
// (uiScaleFor: la vista es de 384×216 fija hasta la fase 4) y fontSizeFor (el "size" de RetroFont de Phaser).
describe('fuente de píxel', () => {
  it('cada glifo son 8 filas de 5 píxeles (acento + 7)', () => {
    for (const ch of FONT_CHARS) {
      const rows = glyphRows(ch);
      expect(rows, ch).toHaveLength(8);
      for (const r of rows) expect(r, ch).toMatch(/^[.#]{5}$/);
    }
  });

  it('todo glifo salvo el espacio tiene algún píxel encendido (uno vacío desaparecería en pantalla)', () => {
    for (const ch of FONT_CHARS) {
      if (ch === ' ') continue;
      expect(glyphRows(ch).join('').includes('#'), `"${ch}"`).toBe(true);
    }
  });

  it('el ";" se dibuja: un punto arriba y una coma abajo', () => {
    expect(glyphRows(';').slice(1)).toEqual(['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...']);
  });

  it('la O y el 0 no se confunden', () => {
    expect(glyphRows('O')).not.toEqual(glyphRows('0'));
  });

  it('cubre el español en mayúsculas', () => {
    for (const ch of 'ÁÉÍÓÚÑÜ¿¡') expect(FONT_CHARS).toContain(ch);
  });

  it('los signos que la fuente no tiene se sustituyen, no desaparecen', () => {
    const out = normalize('−3 % de velocidad… “sí”');
    for (const ch of out) expect(FONT_CHARS, ch).toContain(ch);
    expect(out.startsWith('-3 %')).toBe(true);
  });

  it('wrapText no deja cuatro puntos al recortar tras un punto', () => {
    expect(wrapText('Grapas rápidas. Ideal para muchos', 17, 1)).toEqual(['Grapas rápidas...']);
    // el caso real del Post-it en el Flip abierto
    expect(wrapText('Cada 10 bajas, el enemigo suelta un material extra. Lo apuntas todo.', 18, 3)[2]).toBe('material extra...');
  });

  it('wrapText parte por palabras y recorta con "..."', () => {
    expect(wrapText('uno dos tres cuatro', 8)).toEqual(['uno dos', 'tres', 'cuatro']);
    expect(wrapText('uno dos tres cuatro', 8, 2)).toEqual(['uno dos', 'tres...']);
  });

  // Nuevas, de la fuente sin Phaser: lo que se pinta es lo que dice el glifo, y del ancho que dice textWidth
  it('drawText pinta exactamente los píxeles del glifo, a escala entera, y ocupa textWidth', () => {
    const lit = new Set<string>();
    const p = { width: 100, height: 100, icon: () => false, fill(x: number, y: number, w: number, h: number) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) lit.add(`${x + i},${y + j}`); } };
    const w = drawText(p, 10, 20, 'ñ0', '#fff', { scale: 2 });
    expect(w).toBe(textWidth('ñ0', 2));
    expect(w).toBe((2 * CHAR_W - 1) * 2);
    const expected = new Set<string>();
    ['Ñ', '0'].forEach((ch, k) => glyphRows(ch).forEach((row, gy) => [...row].forEach((c, gx) => {
      if (c === '#') for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) expected.add(`${10 + (k * CHAR_W + gx) * 2 + i},${20 + gy * 2 + j}`);
    })));
    expect(lit).toEqual(expected);
  });
});
