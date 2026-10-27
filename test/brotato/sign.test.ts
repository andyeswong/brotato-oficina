import { describe, expect, it } from 'vitest';
import { drawSign, signLayout } from '../../src/game/brotato/ui/sign';
import { FONT_CHARS, normalize } from '../../src/game/brotato/ui/font';
import type { Painter } from '../../src/game/brotato/ui/paint';

// El letrero de carga en la fuente de píxel: cabe en las tres medidas de la interfaz y solo usa letras de la fuente
const SIZES = [['escritorio', 384, 216], ['tapa del Flip', 249, 218], ['Flip abierto', 216, 384]] as const;
const TEXTS = ['Piso 2', 'Piso 10', 'Girando…', 'Construyendo el mundo en vóxeles…'];

function record(width: number, height: number) {
  const fills: Array<[number, number, number, number]> = [], texts: string[] = [];
  const p: Painter = { width, height, fill: (x, y, w, h) => { fills.push([x, y, w, h]); }, icon: () => false, onText: (t) => texts.push(t) };
  return { p, fills, texts };
}

describe('el letrero de carga', () => {
  for (const [name, W, H] of SIZES) {
    it(`cabe y usa la fuente de píxel (${name} ${W}×${H})`, () => {
      for (const t of TEXTS) {
        const { p, fills, texts } = record(W, H);
        drawSign(p, t);
        for (const [x, y, w, h] of fills) {
          expect(x, t).toBeGreaterThanOrEqual(0); expect(y, t).toBeGreaterThanOrEqual(0);
          expect(x + w, t).toBeLessThanOrEqual(W); expect(y + h, t).toBeLessThanOrEqual(H);
        }
        // Todo el texto se pinta (aunque vaya partido) y con letras que la fuente tiene. Cada línea dos veces: sombra y texto
        expect(texts.filter((_, i) => i % 2 === 1).join(' ').replace(/\s+/g, ' '), t).toBe(t.replace(/\s+/g, ' '));
        for (const ch of normalize(texts.join(''))) if (ch !== ' ') expect(FONT_CHARS, `${t}: ${ch}`).toContain(ch);
      }
    });
  }

  it('el número del piso va grande; el texto largo, a x1 y partido si no cabe', () => {
    expect(signLayout('Piso 2', 384).scale).toBe(3);
    expect(signLayout('Piso 10', 216).scale).toBeGreaterThanOrEqual(2);
    const long = signLayout('Construyendo el mundo en vóxeles…', 216);
    expect(long.scale).toBe(1);
    expect(long.lines.length).toBeGreaterThan(1);
  });
});
