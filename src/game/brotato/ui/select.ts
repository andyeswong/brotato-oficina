// Elegir agente, portada de la SelectScene del Brotato en Phaser. Un personaje nuevo aparece aquí solo con existir su
// módulo: la ficha (ventajas, desventajas, arma inicial) se escribe sola desde sus datos. El mundo de la partida ya
// sale de la semilla, así que la ficha dice cuál es y nombra las armas con su aspecto de ese mundo.
// Teclado: 1–9 elige, Intro elige el marcado, las flechas lo mueven, C cambia la cámara (ui/camera.ts) y M quita o pone
// el sonido (el botón de abajo a la izquierda, para el dedo en el Flip).
import type { CharacterModule, StatModule, ThemeId } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import { describeModifier } from '../stats/describe';
import { lookOf } from '../looks';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import { COLORS, type Painter, type Zone } from './paint';
import { ACCENTS, UI, button, panel } from './theme';

export type SelectAction = { type: 'start'; index: number } | { type: 'move'; delta: number } | { type: 'camera'; delta: number } | { type: 'sound' };

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
  if (e.key === 'c' || e.key === 'C') return { type: 'camera', delta: e.key === 'C' ? -1 : 1 };
  if (e.key === 'm' || e.key === 'M') return { type: 'sound' };
  return null;
}

export function drawSelect(p: Painter, registry: Registry, selected: number, theme: ThemeId, u = 1, camera?: string, sound?: boolean): Zone<SelectAction>[] {
  const zones: Zone<SelectAction>[] = [];
  const W = p.width, H = p.height;
  const line = FONT_SIZE * u;
  const pad = 6 * u;
  const accent = ACCENTS[theme];
  p.fill(0, 0, W, H, UI.panel);
  // Título con una línea de acento debajo (rediseño 2026-10-25, ver theme.ts)
  const tw = drawText(p, Math.floor(W / 2), pad, 'Elige agente', UI.text, { scale: u * 2, align: 'center' });
  p.fill(Math.floor((W - tw) / 2), pad + line * 2 - 2 * u, tw, u, accent);
  let y = pad + line * 2 + 2 * u;
  drawText(p, Math.floor(W / 2), y, `mundo: ${THEME_NAMES[theme]}`, UI.dim, { scale: u, align: 'center' });
  y += line + 2 * u;
  if (camera) {
    // La cámara, con flechas a los lados: tocar la mitad izquierda va a la anterior y la derecha a la siguiente
    const label = `« cámara: ${camera} »`;
    const w = drawText(p, Math.floor(W / 2), y, label, accent, { scale: u, align: 'center' });
    const x0 = Math.floor(W / 2) - Math.floor(w / 2) - 4 * u, h = line + 2 * u, half = Math.ceil((w + 8 * u) / 2);
    zones.push({ x: x0, y: y - u, w: half, h, action: { type: 'camera', delta: -1 } });
    zones.push({ x: x0 + half, y: y - u, w: half, h, action: { type: 'camera', delta: 1 } });
    y += line + 2 * u;
  }
  y += 2 * u;

  const cardW = Math.min(W - pad * 2, MAX_CARD_CHARS * CHAR_W * u);
  const x = Math.floor((W - cardW) / 2);
  registry.characters().forEach((c, i) => {
    y += card(p, zones, registry, c, i, i === selected, theme, x, y, cardW, u) + 4 * u;
  });
  // Abajo, el botón de empezar (con el dedo, en el Flip, es más claro que tocar la ficha); las teclas al lado si caben
  const btnH = line + 7 * u, btnW = 64 * u;
  // El sonido, abajo a la izquierda junto a empezar (si quien llama lo maneja)
  if (sound !== undefined) button(p, zones, pad, H - pad - btnH, sound ? 'sonido sí' : 'sonido no', { type: 'sound' } as SelectAction, { accent: ACCENTS[theme], h: btnH, w: textWidth('sonido no', u) + 8 * u });
  button(p, zones, Math.floor((W - btnW) / 2), H - pad - btnH, 'empezar', { type: 'start', index: selected } as SelectAction, { accent, primary: true, h: btnH, w: btnW });
  if (camera && W >= 300) drawText(p, W - pad, H - pad - line, 'intro · c: cámara', UI.dim, { scale: u, align: 'right' });
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

  panel(p, x, y, w, h, { fill: UI.panelHi, accent: marked ? ACCENTS[theme] : undefined, edge: marked ? ACCENTS[theme] : UI.edge });
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
