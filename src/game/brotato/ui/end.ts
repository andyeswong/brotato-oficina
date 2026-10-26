// Fin de la partida (victoria o derrota), rediseño 2026-10-25 (ver theme.ts): un panel en el centro con el título
// grande, lo que se consiguió y cómo volver. Cualquier tecla o toque vuelve a la elección de agente, tras medio segundo
// de gracia (que una tecla pulsada al caer no salte la pantalla).
import type { Run } from '../sim/Run';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import type { Painter } from './paint';
import { ACCENTS, UI, panel } from './theme';

export const END_GRACE_S = 0.5;

export function drawEnd(p: Painter, run: Run, result: 'victory' | 'defeat'): void {
  const W = p.width, H = p.height, line = FONT_SIZE, pad = 6;
  const accent = ACCENTS[run.level.theme];
  p.fill(0, 0, W, H, UI.panel);
  const title = result === 'victory' ? '¡Victoria!' : 'Has caído';
  const detail = result === 'victory' ? `${run.totalWaves} oleadas superadas` : `en la oleada ${run.waveNumber} de ${run.totalWaves}`;
  const maxChars = Math.max(8, Math.floor((Math.min(W - 4 * pad, 260) - 2 * pad) / CHAR_W));
  const lines = wrapText(`${run.character.name} · ${detail} · ${run.kills} bajas`, maxChars);
  const pw = Math.min(W - 2 * pad, Math.max(textWidth(title, 2), ...lines.map((l) => textWidth(l, 1))) + 4 * pad);
  const ph = line * 2 + 8 + lines.length * line + 10;
  const px = Math.floor((W - pw) / 2), py = Math.floor((H - ph) / 2) - line;
  panel(p, px, py, pw, ph, { accent: result === 'victory' ? UI.gold : accent });
  const cx = Math.floor(W / 2);
  drawText(p, cx, py + 6, title, result === 'victory' ? UI.gold : UI.bad, { scale: 2, align: 'center' });
  let y = py + 6 + line * 2 + 2;
  for (const l of lines) { drawText(p, cx, y, l, UI.text, { align: 'center' }); y += line; }
  const hint = 'pulsa una tecla o toca para volver';
  const hintLines = wrapText(hint, Math.max(8, Math.floor((W - 2 * pad) / CHAR_W)));
  let hy = py + ph + line;
  for (const l of hintLines) { drawText(p, cx, hy, l, UI.dim, { align: 'center' }); hy += line; }
}
