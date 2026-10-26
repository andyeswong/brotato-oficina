// El HUD de la oleada (rediseño 2026-10-25, ver theme.ts). Arriba a la izquierda, un panel con el corazón y la barra
// de vida (la cuenta dentro, como el Brotato) y debajo los materiales y las bajas con su icono; arriba en el centro, la
// oleada y el tiempo grande; arriba a la derecha, las armas en sus casillas (en pantallas estrechas, bajo la vida).
// hudText() es la misma información en una línea de texto (para lectores de pantalla y verify).
import type { BrotatoGame } from '../play';
import { FONT_SIZE, drawText, textWidth } from './font';
import type { Painter } from './paint';
import { ACCENTS, ICON, UI, bar, icon, panel, shadowText } from './theme';

export function hudText(game: BrotatoGame): string {
  const w = game.current, run = game.run;
  if (game.phase === 'shop') return `Tienda · oleada ${run.waveIndex} superada · materiales ${run.materials}`;
  const waveN = game.phase === 'cleared' ? run.waveIndex : run.waveNumber;   // cerrada la oleada, waveIndex ya subió
  return `Oleada ${waveN}/${run.totalWaves} · ${Math.ceil(w.timeLeft)} s · vida ${w.player.hp}/${w.player.maxHp} · materiales ${run.materials} · bajas ${run.kills}`;
}

const SLOT_W = 18, SLOT_H = 12;   // casilla de un arma en el HUD

export function drawHud(p: Painter, game: BrotatoGame): void {
  const w = game.current, run = game.run, accent = ACCENTS[game.theme];
  const W = p.width, pad = 3;
  const waveN = game.phase === 'cleared' ? run.waveIndex : run.waveNumber;
  const narrow = W < 300;

  // Vida, materiales y bajas
  const pw = 92, ph = 30;
  panel(p, pad, pad, pw, ph, { accent });
  icon(p, 'heart', pad + 4, pad + 5, UI.hp);
  const low = w.player.hp * 3 <= w.player.maxHp;
  bar(p, pad + 14, pad + 3, pw - 18, 11, w.player.hp / w.player.maxHp, low ? UI.bad : UI.hp, UI.hpBack, `${w.player.hp}/${w.player.maxHp}`);
  const row2 = pad + 17;
  const mat = 9;
  p.icon({ kind: 'material', id: game.theme }, pad + 3, row2 + Math.floor((FONT_SIZE - mat) / 2), mat, mat);
  const mw = drawText(p, pad + 14, row2 + 1, String(run.materials), UI.gold);
  const kx = pad + 14 + mw + 10;
  icon(p, 'skull', kx, row2 + 1, UI.dim);
  drawText(p, kx + ICON + 3, row2 + 1, String(run.kills), UI.text);

  // Oleada y tiempo, arriba en el centro; si centrados pisarían el panel de vida (el Flip en vertical), a la derecha
  const cx = Math.floor(W / 2);
  const waveLabel = `oleada ${waveN}/${run.totalWaves}`;
  const centered = cx - Math.ceil(textWidth(waveLabel, 1) / 2) >= pad + pw + 4;
  const tx = centered ? cx : W - pad - 1, align: 'center' | 'right' = centered ? 'center' : 'right';
  shadowText(p, tx, pad + 1, waveLabel, accent, { align });
  shadowText(p, tx, pad + 1 + FONT_SIZE, String(Math.max(0, Math.ceil(w.timeLeft))), UI.text, { scale: 2, align });

  // Armas en sus casillas: a la derecha, o bajo la vida si no caben
  const n = run.weapons.length;
  const rowW = n * (SLOT_W + 2) - 2;
  const sx = narrow ? pad : W - pad - rowW, sy = narrow ? pad + ph + 3 : pad;
  run.weapons.forEach((weapon, k) => {
    const x = sx + k * (SLOT_W + 2);
    panel(p, x, sy, SLOT_W, SLOT_H, { fill: UI.panelHi });
    p.icon({ kind: 'weapon', id: weapon.id }, x + 1, sy + 1, SLOT_W - 2, SLOT_H - 2);
  });

  if (game.phase === 'cleared') {
    const label = `oleada ${waveN} superada`;
    const bw = textWidth(label, 2) + 20, bh = FONT_SIZE * 2 + 10;
    const bx = Math.floor((W - bw) / 2), by = Math.floor(p.height * 0.38);
    if (bw <= W - 2 * pad) {
      panel(p, bx, by, bw, bh, { accent });
      drawText(p, cx, by + 6, label, UI.gold, { scale: 2, align: 'center' });
    } else {
      const sw = textWidth(label, 1) + 16;
      panel(p, Math.floor((W - sw) / 2), by, sw, FONT_SIZE + 8, { accent });
      drawText(p, cx, by + 4, label, UI.gold, { align: 'center' });
    }
  }
}
