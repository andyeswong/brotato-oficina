import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
const { FONT_CHARS, glyphRows } = await import('../src/engine/view/font');

describe('fuente de píxel', () => {
  it('cada glifo son 6 filas de 3 píxeles', () => {
    for (const ch of FONT_CHARS) {
      const rows = glyphRows(ch);
      expect(rows, ch).toHaveLength(6);
      for (const r of rows) expect(r, ch).toMatch(/^[.#]{3}$/);
    }
  });

  it('cubre el español en mayúsculas', () => {
    for (const ch of 'ÁÉÍÓÚÑÜ¿¡') expect(FONT_CHARS).toContain(ch);
  });
});
