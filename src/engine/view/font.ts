import Phaser from 'phaser';
import { currentLayout } from './pixel';

// Fuente de píxel de relleno, 5×7 con una fila de acento encima, generada en código y montada como
// RetroFont (bitmap, a tamaño nativo). La O es redonda y el 0 lleva barra, para que no se confundan.
// Cuando BETA dibuje la buena, se sustituye esta textura.
export const FONT = 'pixel';
const GLYPH_W = 5;
const GLYPH_H = 7;
const CELL_W = GLYPH_W + 1;   // 1 px de separación entre letras
const CELL_H = GLYPH_H + 2;   // fila de acento + 7 filas + 1 de separación
export const FONT_SIZE = CELL_H; // alto de línea a escala x1 (no es el "size" de Phaser: ver fontSizeFor)

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

// Se llama una vez en Boot
export function createPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT)) return;
  const chars = [...FONT_CHARS];
  const perRow = 16;
  const rowsN = Math.ceil(chars.length / perRow);
  const canvas = document.createElement('canvas');
  canvas.width = perRow * CELL_W;
  canvas.height = rowsN * CELL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  chars.forEach((ch, i) => {
    const ox = (i % perRow) * CELL_W;
    const oy = Math.floor(i / perRow) * CELL_H;
    glyphRows(ch).forEach((row, y) => {
      for (let x = 0; x < GLYPH_W; x++) if (row[x] === '#') ctx.fillRect(ox + x, oy + y, 1, 1);
    });
  });
  scene.textures.addCanvas(`${FONT}-tex`, canvas);
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: `${FONT}-tex`,
    width: CELL_W,
    height: CELL_H,
    chars: FONT_CHARS,
    charsPerRow: perRow,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(FONT, data);
}

// En RetroFont, el "size" de la fuente es el ANCHO de la celda: Phaser escala por fontSize / size.
// Para una escala entera hay que pedir CELL_W × escala; pedir el alto daría ×1,5 y rompería el pixel-perfect.
export function fontSizeFor(scale: number): number {
  return CELL_W * scale;
}

// La fuente solo tiene mayúsculas: todo texto pasa por aquí. scale es entero (UI x1, x2…)
export function text(scene: Phaser.Scene, x: number, y: number, value: string, scale = 1): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(x, y, FONT, normalize(value), fontSizeFor(scale));
}

// Mayúsculas, y los signos tipográficos que la fuente no tiene, a su equivalente (−3 % → -3 %)
const SUBSTITUTES: Record<string, string> = { '−': '-', '–': '-', '—': '-', '…': '...', '“': '"', '”': '"', '‘': "'", '’': "'" };

export function normalize(value: string): string {
  return [...value.toUpperCase()].map((ch) => SUBSTITUTES[ch] ?? ch).join('');
}

// Escala entera de la interfaz. La UI se diseña para caber en UI_DESIGN_H × UI_DESIGN_W píxeles lógicos a x1
// (la tienda con 4 filas de 2+ líneas de descripción es lo más alto) y se amplía al mayor entero que quepa.
// Con 540/960: escritorio x2 (960×540), tapa del Flip x2 (747×654), Flip abierto x3 (540×960).
const UI_DESIGN_H = 250;
const UI_DESIGN_W = 180;

export function uiScale(): number {
  const { width, height } = currentLayout();
  return uiScaleFor(width, height);
}

export function uiScaleFor(width: number, height: number): number {
  return Math.max(1, Math.min(Math.floor(height / UI_DESIGN_H), Math.floor(width / UI_DESIGN_W)));
}

export const CHAR_W = CELL_W; // ancho de una letra a escala x1, en píxeles lógicos

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
