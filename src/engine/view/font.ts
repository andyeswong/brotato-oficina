import Phaser from 'phaser';

// Fuente de píxel de relleno, 5×7 con una fila de acento encima, generada en código y montada como
// RetroFont (bitmap, a tamaño nativo). La O es redonda y el 0 lleva barra, para que no se confundan.
// Cuando BETA dibuje la buena, se sustituye esta textura.
export const FONT = 'pixel';
const GLYPH_W = 5;
const GLYPH_H = 7;
const CELL_W = GLYPH_W + 1;   // 1 px de separación entre letras
const CELL_H = GLYPH_H + 2;   // fila de acento + 7 filas + 1 de separación
export const FONT_SIZE = CELL_H;

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
  '»': '..... #.#.. .#.#. ..#.# .#.#. #.#.. .....',
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

// La fuente solo tiene mayúsculas: todo texto pasa por aquí. scale es entero (UI x1, x2…)
export function text(scene: Phaser.Scene, x: number, y: number, value: string, scale = 1): Phaser.GameObjects.BitmapText {
  return scene.add.bitmapText(x, y, FONT, value.toUpperCase(), FONT_SIZE * scale);
}

// Escala entera de la interfaz: x1 hasta 539 px lógicos de lado corto, x2 desde 540…
export function uiScale(scene: Phaser.Scene): number {
  return Math.max(1, Math.floor(Math.min(scene.scale.width, scene.scale.height) / 270));
}
