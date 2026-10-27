// El HUD de la oleada (rediseño 2026-10-25, ver theme.ts). Arriba a la izquierda, un panel con el corazón y la barra
// de vida (la cuenta dentro, como el Brotato) y debajo los materiales y las bajas con su icono; arriba en el centro, la
// oleada y el tiempo grande; arriba a la derecha, las armas en sus casillas (en pantallas estrechas, bajo la vida).
// Al acabar el tiempo, «quedan N» hasta matar al último; con la oleada limpia, el aviso de ir a la entrada de la tienda
// (además de su brillo en el mapa: en el Flip un objeto pequeño pasa desapercibido) y, junto a ella, el botón de entrar.
// hudText() es la misma información en una línea de texto (para lectores de pantalla y verify).
import type { ThemeId } from '../registry/schemas';
import type { BrotatoGame } from '../play';
import { FONT_SIZE, drawText, textWidth } from './font';
import type { Painter, Zone } from './paint';
import { ACCENTS, ICON, UI, bar, button, icon, panel, shadowText } from './theme';
import { DASH_RECHARGE } from '../sim/World';

export type HudAction = { type: 'enter' } | { type: 'turn'; delta: 1 | -1 } | { type: 'dash' };

// Adónde ir para entrar en la tienda en cada tema (el objeto del mapa que brilla)
export const SHOP_PROPS: Record<ThemeId, string> = { medieval: 'a la fuente', oficina: 'a la impresora', cyberpunk: 'al servidor' };

export function hudText(game: BrotatoGame): string {
  const w = game.current, run = game.run;
  if (game.phase === 'shop') return `Tienda · oleada ${run.waveIndex} superada · materiales ${run.materials}`;
  const state = w.status === 'open' ? `ronda superada: ve ${SHOP_PROPS[game.theme]}${w.atShop ? ' y pulsa F' : ''}`
    : w.overtime ? `quedan ${w.enemies.length}` : `${Math.ceil(w.timeLeft)} s`;
  const dash = w.dash.max > 0 ? ` · dash ${w.dash.charges}/${w.dash.max}` : '';
  return `Oleada ${run.waveNumber}/${run.totalWaves} · ${state} · vida ${w.player.hp}/${w.player.maxHp} · materiales ${run.materials} · bajas ${run.kills}${dash}`;
}

const SLOT_W = 18, SLOT_H = 12;   // casilla de un arma en el HUD

// touch: en pantallas táctiles, los botones de girar la cámara (Q y E del teclado), abajo a la derecha, y encima el del
// dash (espacio) si el árbol lo tiene comprado
export function drawHud(p: Painter, game: BrotatoGame, opts: { touch?: boolean } = {}): Zone<HudAction>[] {
  const zones: Zone<HudAction>[] = [];
  const w = game.current, run = game.run, accent = ACCENTS[game.theme];
  const W = p.width, pad = 3;
  const waveN = run.waveNumber;
  const narrow = W < 300;

  // Vida, materiales y bajas
  // Con dash, una tercera fila con sus cargas: llenas en el acento, la que se recarga a medias
  const dash = w.dash;
  const pw = 92, ph = dash.max > 0 ? 38 : 30;
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
  if (dash.max > 0) {
    const row3 = row2 + FONT_SIZE + 1, cw = 12;
    for (let k = 0; k < dash.max; k++) {
      const x = pad + 14 + k * (cw + 2);
      p.fill(x, row3, cw, 3, UI.hpBack);
      const f = k < dash.charges ? 1 : k === dash.charges ? dash.rechargeT / DASH_RECHARGE : 0;
      if (f > 0) p.fill(x, row3, Math.max(1, Math.round(cw * f)), 3, f >= 1 ? accent : UI.dim);
    }
  }

  // Oleada y tiempo, arriba en el centro; si centrados pisarían el panel de vida (el Flip en vertical), a la derecha
  const cx = Math.floor(W / 2);
  const waveLabel = `oleada ${waveN}/${run.totalWaves}`;
  const centered = cx - Math.ceil(textWidth(waveLabel, 1) / 2) >= pad + pw + 4;
  const tx = centered ? cx : W - pad - 1, align: 'center' | 'right' = centered ? 'center' : 'right';
  shadowText(p, tx, pad + 1, waveLabel, accent, { align });
  if (w.overtime) shadowText(p, tx, pad + 1 + FONT_SIZE + 2, `quedan ${w.enemies.length}`, UI.bad, { align });
  else if (w.status !== 'open') shadowText(p, tx, pad + 1 + FONT_SIZE, String(Math.max(0, Math.ceil(w.timeLeft))), UI.text, { scale: 2, align });

  // Armas en sus casillas: a la derecha, o bajo la vida si no caben
  const n = run.weapons.length;
  const rowW = n * (SLOT_W + 2) - 2;
  const sx = narrow ? pad : W - pad - rowW, sy = narrow ? pad + ph + 3 : pad;
  run.weapons.forEach((weapon, k) => {
    const x = sx + k * (SLOT_W + 2);
    panel(p, x, sy, SLOT_W, SLOT_H, { fill: UI.panelHi });
    p.icon({ kind: 'weapon', id: weapon.id }, x + 1, sy + 1, SLOT_W - 2, SLOT_H - 2);
  });

  if (opts.touch) {
    const bh = FONT_SIZE + 9, bw = 20, by = p.height - pad - bh - 4;
    button(p, zones, W - pad - 2 * bw - 3, by, '«', { type: 'turn', delta: -1 }, { accent, w: bw, h: bh });
    button(p, zones, W - pad - bw, by, '»', { type: 'turn', delta: 1 }, { accent, w: bw, h: bh });
    if (dash.max > 0 && w.status !== 'open') {
      const dw = 2 * bw + 3, dh = bh + 6;
      button(p, zones, W - pad - dw, by - dh - 3, 'dash', { type: 'dash' }, { accent, primary: dash.charges > 0, w: dw, h: dh });
    }
  }

  // Oleada limpia: el aviso y, junto a la entrada, el botón (F con teclado; con el dedo en el Flip)
  if (w.status === 'open') {
    const lines = ['ronda superada', `ve ${SHOP_PROPS[game.theme]}`];
    const bw = Math.min(W - 2 * pad, Math.max(...lines.map((l) => textWidth(l, 1))) + 16), bh = FONT_SIZE * 2 + 8;
    // abajo: arriba o en medio taparía el objeto, que sale cerca de la salida, o a MAIA
    const bx = Math.floor((W - bw) / 2), by = Math.floor(p.height * 0.8) - bh;
    panel(p, bx, by, bw, bh, { accent });
    drawText(p, cx, by + 4, lines[0]!, UI.gold, { align: 'center' });
    drawText(p, cx, by + 4 + FONT_SIZE, lines[1]!, UI.text, { align: 'center' });
    if (w.atShop) {
      const label = 'entrar · F', bw2 = textWidth(label, 1) + 16, bh2 = FONT_SIZE + 9;
      button(p, zones, Math.floor((W - bw2) / 2), p.height - pad - bh2 - 4, label, { type: 'enter' }, { accent, primary: true, w: bw2, h: bh2 });
    }
  }
  return zones;
}
