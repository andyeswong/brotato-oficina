// Elegir agente, portada de la SelectScene del Brotato en Phaser. Un personaje nuevo aparece aquí solo con existir su
// módulo: la ficha (ventajas, desventajas, arma inicial) se escribe sola desde sus datos. El mundo de la partida ya
// sale de la semilla, así que la ficha dice cuál es y nombra las armas con su aspecto de ese mundo.
// Teclado: 1–9 elige, Intro elige el marcado, las flechas lo mueven.
import type { CharacterModule, StatModule, ThemeId } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import { describeModifier } from '../stats/describe';
import { lookOf } from '../looks';
import { CHAR_W, FONT_SIZE, drawText, wrapText } from './font';
import { COLORS, stroke, type Painter, type Zone } from './paint';

export type SelectAction = { type: 'start'; index: number } | { type: 'move'; delta: number };

const MAX_CARD_CHARS = 56;   // ancho máximo de una ficha, en letras
export const PORTRAIT_W = 32; // caja del retrato a escala x1
export const PORTRAIT_H = 48;
export const THEME_NAMES: Record<ThemeId, string> = { oficina: 'Oficina', medieval: 'Medieval', cyberpunk: 'Cyberpunk' };

export function selectKey(e: { code: string; key: string }, count: number, selected: number): SelectAction | null {
  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digit && Number(digit[2]) >= 1 && Number(digit[2]) <= count) return { type: 'start', index: Number(digit[2]) - 1 };
  if (e.key === 'Enter' || e.key === ' ') return { type: 'start', index: selected };
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return { type: 'move', delta: 1 };
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return { type: 'move', delta: -1 };
  return null;
}

export function drawSelect(p: Painter, registry: Registry, selected: number, theme: ThemeId, u = 1): Zone<SelectAction>[] {
  const zones: Zone<SelectAction>[] = [];
  const W = p.width, H = p.height;
  const line = FONT_SIZE * u;
  const pad = 6 * u;
  p.fill(0, 0, W, H, COLORS.bg);
  drawText(p, Math.floor(W / 2), pad, 'Elige agente', COLORS.text, { scale: u * 2, align: 'center' });
  let y = pad + line * 2 + 2 * u;
  drawText(p, Math.floor(W / 2), y, `mundo: ${THEME_NAMES[theme]}`, COLORS.dim, { scale: u, align: 'center' });
  y += line + 4 * u;

  const cardW = Math.min(W - pad * 2, MAX_CARD_CHARS * CHAR_W * u);
  const x = Math.floor((W - cardW) / 2);
  registry.characters().forEach((c, i) => {
    y += card(p, zones, registry, c, i, i === selected, theme, x, y, cardW, u) + 4 * u;
  });
  drawText(p, Math.floor(W / 2), H - pad - line, 'toca la ficha o pulsa intro', COLORS.dim, { scale: u, align: 'center' });
  return zones;
}

// Devuelve el alto que ocupó. Se pinta primero el texto en una pasada de medida y luego todo sobre el fondo
function card(p: Painter, zones: Zone<SelectAction>[], registry: Registry, c: CharacterModule, i: number, marked: boolean, theme: ThemeId, x: number, y: number, w: number, u: number): number {
  const pad = 5 * u;
  const pw = PORTRAIT_W * u, ph = PORTRAIT_H * u;
  const tx = x + pad + pw + 5 * u;
  const maxChars = Math.max(8, Math.floor((x + w - pad - tx) / (CHAR_W * u)));

  const lines: Array<{ text: string; color: string; scale: number; gap?: number }> = [{ text: c.name, color: COLORS.text, scale: u * 2, gap: 2 * u }];
  for (const l of wrapText(c.description ?? '', maxChars)) lines.push({ text: l, color: COLORS.dim, scale: u });
  const stats = new Map<string, StatModule>(registry.stats().map((s) => [s.id, s]));
  (c.modifiers ?? []).forEach((m, k) => {
    const d = describeModifier(m, stats);
    wrapText(d.text, maxChars).forEach((l, j) => lines.push({ text: l, color: d.good ? COLORS.good : COLORS.bad, scale: u, gap: k === 0 && j === 0 ? 3 * u : 0 }));
  });
  const weapons = (c.startingWeapons ?? []).map((id) => lookOf(registry.weapon(id), theme).name);
  if (weapons.length > 0) {
    wrapText(`empieza con: ${weapons.join(', ')}`, maxChars).forEach((l, j) => lines.push({ text: l, color: COLORS.gold, scale: u, gap: j === 0 ? 3 * u : 0 }));
  }
  const textH = lines.reduce((sum, l) => sum + (l.gap ?? 0) + FONT_SIZE * l.scale, 0);
  const h = Math.max(textH + pad * 2, ph + pad * 2);

  p.fill(x, y, w, h, COLORS.row);
  stroke(p, x, y, w, h, marked ? COLORS.accent : COLORS.edge, u);
  p.icon({ kind: 'character', id: c.id }, x + pad, y + pad, pw, ph);
  let ty = y + pad;
  for (const l of lines) {
    ty += l.gap ?? 0;
    drawText(p, tx, ty, l.text, l.color, { scale: l.scale });
    ty += FONT_SIZE * l.scale;
  }
  zones.push({ x, y, w, h, action: { type: 'start', index: i } });
  return h;
}
