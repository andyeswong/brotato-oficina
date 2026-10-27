// El letrero de carga (al empezar la partida, al cambiar de piso, al girar la cámara): un panel centrado con el texto
// en la fuente de píxel, como el resto de la interfaz (Andrés, 2026-10-27: "los textos deberían ser pixel art como el
// gui del juego"). Va sobre el velo oscuro de #loading, que se pinta antes de que el horneado bloquee el hilo.
import { textWidth, FONT_SIZE, wrapText, CHAR_W } from './font';
import { panel, shadowText, UI } from './theme';
import type { Painter } from './paint';

const PAD = 8;          // margen del texto dentro del panel, a escala x1
const MARGIN = 12;      // lo que deja libre el panel hasta el borde de la pantalla
const MAX_SCALE = 3;

// La escala entera más grande a la que el texto cabe en una línea; si ni a x1 cabe, x1 partido en líneas
export function signLayout(text: string, width: number): { scale: number; lines: string[] } {
  const room = width - 2 * MARGIN - 2 * PAD;
  for (let s = MAX_SCALE; s >= 1; s--) if (textWidth(text, s) <= room - 2 * PAD * (s - 1)) return { scale: s, lines: [text] };
  return { scale: 1, lines: wrapText(text, Math.max(1, Math.floor((room + 1) / CHAR_W)), 3) };
}

export function drawSign(p: Painter, text: string, opts: { accent?: string } = {}): void {
  const { scale: s, lines } = signLayout(text, p.width);
  const pad = PAD * s, lineH = FONT_SIZE * s;
  const w = Math.max(...lines.map((l) => textWidth(l, s))) + 2 * pad;
  const h = lines.length * lineH + 2 * pad - s;
  const x = Math.floor((p.width - w) / 2), y = Math.floor((p.height - h) / 2);
  panel(p, x, y, w, h, { accent: opts.accent });
  lines.forEach((l, i) => shadowText(p, Math.floor(p.width / 2), y + pad + i * lineH, l, UI.text, { scale: s, align: 'center' }));
}
