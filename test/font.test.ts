import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const { FONT_CHARS, glyphRows } = await import('../src/engine/view/font');

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
});

describe('escala de la interfaz', async () => {
  const { uiScaleFor, wrapText } = await import('../src/engine/view/font');
  it.each([
    ['escritorio 960×540', 960, 540, 2],
    ['portátil 960×768', 960, 768, 3],
    ['tapa del Flip 747×654', 747, 654, 2],
    ['Flip abierto 540×960', 540, 960, 3],
    ['pantalla diminuta 200×150', 200, 150, 1],
  ])('%s → x%i', (_n, w, h, expected) => {
    expect(uiScaleFor(w, h)).toBe(expected);
  });

  it('los signos que la fuente no tiene se sustituyen, no desaparecen', async () => {
    const { normalize, FONT_CHARS } = await import('../src/engine/view/font');
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
});

describe('tamaño de fuente', async () => {
  const { fontSizeFor, CHAR_W } = await import('../src/engine/view/font');
  it('el size de Phaser es el ancho de celda × escala entera (RetroFont escala por fontSize / ancho)', () => {
    expect(fontSizeFor(1)).toBe(CHAR_W);
    expect(fontSizeFor(3) / CHAR_W).toBe(3);
  });
});
