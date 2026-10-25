// El HUD de la oleada en la fuente de píxel: oleada, tiempo, vida, materiales y bajas arriba a la izquierda, y el
// aviso de oleada superada en el centro. hudText() es la misma línea en texto (para lectores de pantalla y verify).
import type { BrotatoGame } from '../play';
import { FONT_SIZE, drawText } from './font';
import { COLORS, type Painter } from './paint';

export function hudText(game: BrotatoGame): string {
  const w = game.current, run = game.run;
  if (game.phase === 'shop') return `Tienda · oleada ${run.waveIndex} superada · materiales ${run.materials}`;
  const waveN = game.phase === 'cleared' ? run.waveIndex : run.waveNumber;   // cerrada la oleada, waveIndex ya subió
  return `Oleada ${waveN}/${run.totalWaves} · ${Math.ceil(w.timeLeft)} s · vida ${w.player.hp}/${w.player.maxHp} · materiales ${run.materials} · bajas ${run.kills}`;
}

export function drawHud(p: Painter, game: BrotatoGame, u = 1): void {
  const w = game.current, run = game.run;
  const pad = 4 * u, line = FONT_SIZE * u;
  // Una sombra de 1 px detrás del texto, para que se lea sobre cualquier suelo
  const shadowed = (x: number, y: number, text: string, color: string, opts: Parameters<typeof drawText>[5] = {}) => {
    drawText(p, x + u, y + u, text, '#000000', opts);
    return drawText(p, x, y, text, color, opts);
  };
  const waveN = game.phase === 'cleared' ? run.waveIndex : run.waveNumber;   // cerrada la oleada, waveIndex ya subió
  shadowed(pad, pad, `oleada ${waveN}/${run.totalWaves} · ${Math.ceil(w.timeLeft)} s`, COLORS.text, { scale: u });
  const hpColor = w.player.hp * 3 <= w.player.maxHp ? COLORS.bad : COLORS.text;
  shadowed(pad, pad + line, `vida ${w.player.hp}/${w.player.maxHp}`, hpColor, { scale: u });
  shadowed(pad, pad + line * 2, `materiales ${run.materials} · bajas ${run.kills}`, COLORS.gold, { scale: u });
  if (game.phase === 'cleared') {
    shadowed(Math.floor(p.width / 2), Math.floor(p.height * 0.4), `oleada ${waveN} superada`, COLORS.gold, { scale: u * 2, align: 'center' });
  }
}
