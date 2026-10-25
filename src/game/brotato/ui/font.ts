// Fuente de píxel de la interfaz del Brotato, portada del juego en Phaser (src/engine/view/font.ts) sin Phaser:
// 5×7 con una fila de acento encima, generada en código y pintada a escala entera. La O es redonda y el 0 lleva
// barra, para que no se confundan. Solo mayúsculas: todo texto pasa por normalize().
import type { Painter } from './paint';

const GLYPH_W = 5;
const GLYPH_H = 7;
const CELL_W = GLYPH_W + 1;   // 1 px de separación entre letras
const CELL_H = GLYPH_H + 2;   // fila de acento + 7 filas + 1 de separación
export const FONT_SIZE = CELL_H; // alto de línea a escala x1
export const CHAR_W = CELL_W;    // ancho de una letra a escala x1

// Cada glifo: 7 filas de 5 píxeles separadas por espacios ('#' = píxel encendido).
// La fila de acento va aparte, en ACCENTED.
const ACUTE = '...#.';
const GLYPHS: Record<string, string> = {
  'A': '.###. #...# #...# ##### #...# #...# #...#', 'B': '####. #...# #...# ####. #...# #...# ####.',
  'C': '.###. #...# #.... #.... #.... #...# .###.', 'D': '####. #...# #...# #...# #...# #...# ####.',
  'E': '##### #.... #.... ####. #.... #.... #####', 'F': '##### #.... #.... ####. #.... #.... #....',
  'G': '.###. #...# #.... #.### #...# #...# .####', 'H': '#...# #...# #...# ##### #...# #...# #...#',
  'I': '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.', 'J': '..### ...#. ...#. ...#. ...#. #..#. .##..',
  'K': '#...# #..#. #.#.. ##... #.#.. #..#. #...#', 'L': '#.... #.... #.... #.... #.... #.... #####',
  'M': '#...# ##.## #.#.# #.#.# #...# #...# #...#', 'N': '#...# #...# ##..# #.#.# #..## #...# #...#',
  'O': '.###. #...# #...# #...# #...# #...# .###.', 'P': '####. #...# #...# ####. #.... #.... #....',
  'Q': '.###. #...# #...# #...# #.#.# #..#. .##.#', 'R': '####. #...# #...# ####. #.#.. #..#. #...#',
  'S': '.###. #...# #.... .###. ....# #...# .###.', 'T': '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  'U': '#...# #...# #...# #...# #...# #...# .###.', 'V': '#...# #...# #...# #...# #...# .#.#. ..#..',
  'W': '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.', 'X': '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..', 'Z': '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.', '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####', '3': '####. ....# ....# .###. ....# ....# ####.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.', '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '..##. .#... #.... ####. #...# #...# .###.', '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.', '9': '.###. #...# #...# .#### ....# ...#. .##..',
  ' ': '..... ..... ..... ..... ..... ..... .....', '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...', ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..', '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '¡': '..#.. ..... ..#.. ..#.. ..#.. ..#.. ..#..', '¿': '..#.. ..... ..#.. .#... #.... #...# .###.',
  '-': '..... ..... ..... .###. ..... ..... .....', '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  '%': '##..# ##..# ...#. ..#.. .#... #..## #..##', '/': '....# ....# ...#. ..#.. .#... #.... #....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.', ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....', '"': '.#.#. .#.#. ..... ..... ..... ..... .....',
  '×': '..... #...# .#.#. ..#.. .#.#. #...# .....', '·': '..... ..... ..... ..#.. ..... ..... .....',
  '=': '..... ..... ##### ..... ##### ..... .....', '«': '..... ..#.# .#.#. #.#.. .#.#. ..#.# .....',
  '»': '..... #.#.. .#.#. ..#.# .#.#. #.#.. .....', ';': '..... .##.. .##.. ..... .##.. ..#.. .#...',
  '&': '.##.. #..#. .##.. .#... #.#.# #..#. .##.#', '#': '.#.#. ##### .#.#. .#.#. .#.#. ##### .#.#.',
};
const ACCENTED: Record<string, [string, string]> = {
  'Á': ['A', ACUTE], 'É': ['E', ACUTE], 'Í': ['I', ACUTE], 'Ó': ['O', ACUTE], 'Ú': ['U', ACUTE],
  'Ñ': ['N', '.####'], 'Ü': ['U', '.#.#.'],
};

export const FONT_CHARS = [...Object.keys(GLYPHS), ...Object.keys(ACCENTED)].join('');

export function glyphRows(ch: string): string[] {
  const accented = ACCENTED[ch];
  const body = GLYPHS[accented ? accented[0] : ch] ?? GLYPHS['?']!;
  return [accented ? accented[1] : '.....', ...body.split(' ')];
}

// Los tramos encendidos de cada fila de cada glifo, ya calculados: pintar un texto son pocos rectángulos
const RUNS = new Map<string, Array<[number, number, number]>>();   // [x, y, largo]
function runsOf(ch: string): Array<[number, number, number]> {
  let r = RUNS.get(ch);
  if (!r) {
    r = [];
    glyphRows(ch).forEach((row, y) => {
      for (let x = 0; x < GLYPH_W; x++) {
        if (row[x] !== '#') continue;
        let n = 1;
        while (row[x + n] === '#') n++;
        r!.push([x, y, n]);
        x += n - 1;
      }
    });
    RUNS.set(ch, r);
  }
  return r;
}

// Mayúsculas, y los signos tipográficos que la fuente no tiene, a su equivalente (−3 % → -3 %)
const SUBSTITUTES: Record<string, string> = { '−': '-', '–': '-', '—': '-', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'" };

export function normalize(value: string): string {
  return [...value.toUpperCase()].map((ch) => SUBSTITUTES[ch] ?? ch).join('');
}

// Ancho en píxeles de un texto a escala entera (sin el hueco tras la última letra)
export function textWidth(value: string, scale = 1): number {
  const n = [...normalize(value)].length;
  return n === 0 ? 0 : (n * CELL_W - 1) * scale;
}

export type Align = 'left' | 'center' | 'right';

// Pinta un texto con la esquina superior en (x, y), o centrado / alineado a la derecha en x. Devuelve su ancho.
export function drawText(p: Painter, x: number, y: number, value: string, color: string, opts: { scale?: number; align?: Align } = {}): number {
  const s = opts.scale ?? 1;
  const w = textWidth(value, s);
  const left = opts.align === 'center' ? x - Math.floor(w / 2) : opts.align === 'right' ? x - w : x;
  [...normalize(value)].forEach((ch, i) => {
    for (const [gx, gy, n] of runsOf(ch)) p.fill(left + (i * CELL_W + gx) * s, y + gy * s, n * s, s, color);
  });
  p.onText?.(value, left, y, w, FONT_SIZE * s);
  return w;
}

// Parte un texto en líneas de como mucho maxChars, por palabras; si sobran líneas, la última acaba en "..."
export function wrapText(value: string, maxChars: number, maxLines = Infinity): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) current = next;
    else {
      if (current) lines.push(current);
      current = word.length > maxChars ? word.slice(0, maxChars) : word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, Math.max(0, maxLines));
  if (kept.length > 0) {
    const last = kept[kept.length - 1]!;
    // Se quitan palabras del final hasta que quepa "...", y luego la puntuación suelta ("extra." + "..." = 4 puntos)
    const words = last.split(' ');
    const trimmed = () => words.join(' ').replace(/[\s.,;:]+$/, '');
    while (words.length > 1 && trimmed().length + 3 > maxChars) words.pop();
    const base = trimmed();
    kept[kept.length - 1] = (base.length + 3 <= maxChars ? base : base.slice(0, maxChars - 3)) + '...';
  }
  return kept;
}
