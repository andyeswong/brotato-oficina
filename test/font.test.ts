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

  it('la O y el 0 no se confunden', () => {
    expect(glyphRows('O')).not.toEqual(glyphRows('0'));
  });

  it('cubre el español en mayúsculas', () => {
    for (const ch of 'ÁÉÍÓÚÑÜ¿¡') expect(FONT_CHARS).toContain(ch);
  });
});
