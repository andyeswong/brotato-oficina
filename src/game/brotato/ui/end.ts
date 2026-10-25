// Fin de la partida (victoria o derrota), portada de la EndScene del Brotato en Phaser. Cualquier tecla o toque
// vuelve a la elección de agente, tras medio segundo de gracia (que una tecla pulsada al caer no salte la pantalla).
import type { Run } from '../sim/Run';
import { FONT_SIZE, drawText, wrapText, CHAR_W } from './font';
import { COLORS, type Painter } from './paint';

export const END_GRACE_S = 0.5;

export function drawEnd(p: Painter, run: Run, result: 'victory' | 'defeat', u = 1): void {
  const W = p.width, H = p.height;
  const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
  const line = FONT_SIZE * u;
  p.fill(0, 0, W, H, COLORS.panel);
  const title = result === 'victory' ? '¡Victoria!' : 'Has caído';
  const detail = result === 'victory' ? `${run.totalWaves} oleadas superadas` : `en la oleada ${run.waveNumber} de ${run.totalWaves}`;
  drawText(p, cx, cy - line * 3, title, result === 'victory' ? COLORS.gold : COLORS.bad, { scale: u * 2, align: 'center' });
  // En pantallas estrechas el texto se parte en líneas
  const maxChars = Math.floor((W - 8 * u) / (CHAR_W * u));
  let y = cy;
  for (const l of wrapText(`${run.character.name} · ${detail} · ${run.kills} bajas`, maxChars)) {
    drawText(p, cx, y, l, COLORS.text, { scale: u, align: 'center' });
    y += line;
  }
  drawText(p, cx, y + line, 'pulsa una tecla o toca para volver', COLORS.dim, { scale: u, align: 'center' });
}
