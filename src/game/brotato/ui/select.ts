// La portada (Andrés, 2026-10-26: "el inicio no me gusta"; antes era un panel con la ficha y nada más). Título grande,
// la agente en grande con su ficha (ventajas, desventajas, arma inicial, escrita sola desde sus datos) y el menú:
// jugar, mejoras (el árbol entre partidas, con las fichas que hay), la cámara y el sonido. Apaisado, la ficha a la
// izquierda y el menú a la derecha; en vertical (el Flip abierto), el menú abajo. El mundo de la partida ya sale de
// la semilla, así que se dice cuál es y las armas se nombran con su aspecto de ese mundo.
// Teclado: 1–9 elige, Intro juega, las flechas cambian de agente, C la cámara, M el sonido, U las mejoras.
import type { CharacterModule, StatModule, ThemeId } from '../registry/schemas';
import type { Registry } from '../registry/validate';
import { describeModifier } from '../stats/describe';
import { lookOf } from '../looks';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import { COLORS, type Painter, type Zone } from './paint';
import { ACCENTS, UI, button, panel, shadowText } from './theme';

export type SelectAction = { type: 'start'; index: number } | { type: 'move'; delta: number } | { type: 'camera'; delta: number }
  | { type: 'sound' } | { type: 'meta' };

export const PORTRAIT_W = 32; // caja del retrato a escala x1
export const PORTRAIT_H = 48;
// Las flechas de cambiar de agente: su zona de toque, a escala x1 (un dedo, en la vista del Flip)
export const ARROW_W = 32;
// Apaisada caben menos píxeles de ficha y cada uno se ve más grande en pantalla: 18 son 40 px CSS en un móvil tumbado
export const ARROW_W_WIDE = 18;
const ARROW_MIN_H = 44;
export const THEME_NAMES: Record<ThemeId, string> = { oficina: 'Oficina', medieval: 'Medieval', cyberpunk: 'Cyberpunk' };
export const GAME_TITLE = 'Brotato';
export const GAME_SUBTITLE = 'de la oficina';

export function selectKey(e: { code: string; key: string }, count: number, selected: number): SelectAction | null {
  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digit && Number(digit[2]) >= 1 && Number(digit[2]) <= count) return { type: 'start', index: Number(digit[2]) - 1 };
  if (e.key === 'Enter' || e.key === ' ') return { type: 'start', index: selected };
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return { type: 'move', delta: 1 };
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return { type: 'move', delta: -1 };
  if (e.key === 'c' || e.key === 'C') return { type: 'camera', delta: e.key === 'C' ? -1 : 1 };
  if (e.key === 'm' || e.key === 'M') return { type: 'sound' };
  if (e.key === 'u' || e.key === 'U') return { type: 'meta' };
  return null;
}

// Las agentes en el orden de la portada
export function roster(registry: Registry): CharacterModule[] {
  return [...registry.characters()].sort((a, b) => a.order - b.order);
}

// camera, sound y fichas: si quien llama los maneja, su línea o su botón en el menú
export function drawSelect(p: Painter, registry: Registry, selected: number, theme: ThemeId, u = 1, camera?: string, sound?: boolean, fichas?: number): Zone<SelectAction>[] {
  const zones: Zone<SelectAction>[] = [];
  const W = p.width, H = p.height;
  const line = FONT_SIZE * u, pad = 6 * u, accent = ACCENTS[theme];
  backdrop(p, accent, u);

  // El título, con el subtítulo en el acento del mundo
  const big = (W >= 300 ? 3 : 2) * u;
  shadowText(p, Math.floor(W / 2), pad, GAME_TITLE.toUpperCase(), UI.text, { scale: big, align: 'center' });
  let y = pad + FONT_SIZE * big + 2 * u;
  const sub = `${GAME_SUBTITLE} · mundo: ${THEME_NAMES[theme]}`;
  if (textWidth(sub, u) <= W - 2 * pad) {
    const sw = textWidth(GAME_SUBTITLE, u), sx = Math.floor((W - textWidth(sub, u)) / 2);
    drawText(p, sx, y, GAME_SUBTITLE, accent, { scale: u });
    drawText(p, sx + sw, y, ` · mundo: ${THEME_NAMES[theme]}`, UI.dim, { scale: u });
  } else {
    drawText(p, Math.floor(W / 2), y, GAME_SUBTITLE, accent, { scale: u, align: 'center' });
    y += line;
    drawText(p, Math.floor(W / 2), y, `mundo: ${THEME_NAMES[theme]}`, UI.dim, { scale: u, align: 'center' });
  }
  y += line + 5 * u;

  // El menú: botones apilados (jugar el primero y relleno) y la línea de la cámara
  const items: Array<{ label: string; action: SelectAction; primary?: boolean }> = [{ label: 'jugar', action: { type: 'start', index: selected }, primary: true }];
  if (fichas !== undefined) items.push({ label: `mejoras · ${fichas}`, action: { type: 'meta' } });
  if (sound !== undefined) items.push({ label: sound ? 'sonido sí' : 'sonido no', action: { type: 'sound' } });
  const btnH = line + 7 * u, step = btnH + 4 * u;
  const camH = camera ? line + 6 * u : 0;
  const menuH = items.length * step + camH;
  const wide = W > H;
  const btnW = wide ? Math.min(118 * u, Math.floor(W * 0.4)) : Math.min(W - 2 * pad, 150 * u);
  const hint = camera && W >= 300 ? 'intro · c: cámara · u: mejoras' : '';
  const bottom = H - pad - (hint ? line + 2 * u : 0);
  let menuX: number, menuY: number, card: { x: number; y: number; w: number; h: number };
  if (wide) {
    menuX = W - pad - btnW;
    menuY = Math.max(y, Math.floor((y + bottom - menuH) / 2));
    card = { x: pad, y, w: menuX - 6 * u - pad, h: bottom - y };
  } else {
    menuX = Math.floor((W - btnW) / 2);
    menuY = bottom - menuH;
    card = { x: pad, y, w: W - 2 * pad, h: menuY - 6 * u - y };
  }
  items.forEach((it, k) => {
    button(p, zones, menuX, menuY + k * step, it.label, it.action, { accent, primary: it.primary, h: btnH, w: btnW });
  });
  if (camera) {
    // La cámara, con flechas a los lados: tocar la mitad izquierda va a la anterior y la derecha a la siguiente
    const label = `« cámara: ${camera} »`;
    // Centrada bajo los botones, sin salirse por la derecha si es más ancha que ellos (la tapa del Flip)
    const lw = textWidth(label, u), cy = menuY + items.length * step + 2 * u;
    const cx = Math.min(menuX + Math.floor(btnW / 2), W - pad - Math.ceil(lw / 2));
    const w = drawText(p, cx, cy, label, accent, { scale: u, align: 'center' });
    const x0 = cx - Math.floor(w / 2) - 4 * u, h = line + 2 * u, half = Math.ceil((w + 8 * u) / 2);
    zones.push({ x: x0, y: cy - u, w: half, h, action: { type: 'camera', delta: -1 } });
    zones.push({ x: x0 + half, y: cy - u, w: half, h, action: { type: 'camera', delta: 1 } });
  }
  if (hint) drawText(p, W - pad, H - pad - line, hint, UI.dim, { scale: u, align: 'right' });

  const all = roster(registry), c = all[selected];
  if (c) agentCard(p, zones, registry, c, selected, theme, card.x, card.y, card.w, card.h, u, all.length > 1, !wide);
  return zones;
}

// El fondo: el panel oscuro con un suelo de losetas abajo y unos puntos del acento, como un patio visto desde arriba
function backdrop(p: Painter, accent: string, u: number): void {
  const W = p.width, H = p.height, t = 16 * u;
  p.fill(0, 0, W, H, UI.panel);
  const floor = Math.floor(H * 0.55);
  for (let ty = floor; ty < H; ty += t) for (let tx = 0; tx < W; tx += t) {
    if (((tx / t) + (ty - floor) / t) % 2 === 0) p.fill(tx, ty, Math.min(t, W - tx), Math.min(t, H - ty), UI.panelHi);
  }
  p.fill(0, floor, W, u, UI.edge);
  for (let k = 0; k < 24; k++) {
    const x = (k * 97 + 13) % W, y = (k * 53 + 7) % floor;
    p.fill(x, y, u, u, k % 3 === 0 ? accent : UI.edge);
  }
}

// La ficha: el retrato tan grande como quepa y nombre, descripción, ventajas y desventajas y arma inicial (lo que no
// quepa se corta por el final). Apaisada, el retrato a la izquierda y el texto al lado; stacked (en vertical), el
// retrato arriba en el centro y el texto debajo. Toda ella empieza la partida
function agentCard(p: Painter, zones: Zone<SelectAction>[], registry: Registry, c: CharacterModule, i: number, theme: ThemeId,
  x: number, y: number, w: number, h: number, u: number, several: boolean, stacked: boolean): void {
  const pad = 5 * u, accent = ACCENTS[theme];
  panel(p, x, y, w, h, { fill: UI.panelHi, accent, edge: accent });
  // Las flechas van a los lados del retrato y con sitio para el dedo: apaisada les hace falta su propio hueco
  const aw = (stacked ? ARROW_W : ARROW_W_WIDE) * u, side = several && !stacked ? aw : 0;
  const ps = stacked
    ? Math.max(1, Math.min(3, Math.floor((w - 2 * pad - 2 * ARROW_W * u) / (PORTRAIT_W * u)), Math.floor((h * 0.45) / (PORTRAIT_H * u))))
    : Math.max(1, Math.min(3, Math.floor((h - 2 * pad) / (PORTRAIT_H * u)), Math.floor((w * 0.3) / (PORTRAIT_W * u))));
  const pw = PORTRAIT_W * u * ps, ph = PORTRAIT_H * u * ps;
  const tx = stacked ? x + pad : x + pad + 2 * side + pw + 5 * u;
  const maxChars = Math.max(6, Math.floor((x + w - pad - tx) / (CHAR_W * u)));
  const stats = new Map<string, StatModule>(registry.stats().map((s) => [s.id, s]));
  const linesOf = (who: CharacterModule) => {
    const lines: Array<{ text: string; color: string; scale: number; gap?: number }> = [];
    const nameScale = textWidth(who.name, 2 * u) <= x + w - pad - tx ? 2 * u : u;
    lines.push({ text: who.name, color: COLORS.text, scale: nameScale, gap: 0 });
    for (const l of wrapText(who.description ?? '', maxChars)) lines.push({ text: l, color: COLORS.dim, scale: u });
    // Lo que su base cambia frente a la de la estadística (la vida del Becario y de la Conserje) también es ventaja o desventaja
    const fromBase = Object.entries(who.baseStats ?? {}).flatMap(([stat, v]) => { const add = v - (stats.get(stat)?.base ?? v); return add ? [{ stat, add }] : []; });
    [...fromBase, ...(who.modifiers ?? [])].forEach((m, k) => {
      const d = describeModifier(m, stats);
      wrapText(d.text, maxChars).forEach((l, j) => lines.push({ text: l, color: d.good ? COLORS.good : COLORS.bad, scale: u, gap: k === 0 && j === 0 ? 3 * u : 0 }));
    });
    const weapons = (who.startingWeapons ?? []).map((id) => lookOf(registry.weapon(id), theme).name);
    if (weapons.length > 0) {
      // Cada arma en su línea, para que el nombre no se parta
      lines.push({ text: 'empieza con:', color: COLORS.gold, scale: u, gap: 3 * u });
      for (const name of weapons) for (const l of wrapText(name, maxChars)) lines.push({ text: l, color: COLORS.gold, scale: u });
    }
    return lines;
  };
  // Lo que cabe en alto
  const room = h - 2 * pad - (stacked ? ph + 4 * u : 0);
  const heightOf = (l: { scale: number; gap?: number }) => (l.gap ?? 0) + FONT_SIZE * l.scale;
  const shown: ReturnType<typeof linesOf> = [];
  let used = 0;
  for (const l of linesOf(c)) {
    if (used + heightOf(l) > room) break;
    shown.push(l); used += heightOf(l);
  }
  // Centrado según la ficha más alta de todas, para que el retrato y el nombre no se muevan al cambiar de agente
  const tallest = Math.max(...roster(registry).map((who) => linesOf(who).reduce((sum, l) => sum + heightOf(l), 0)));
  let ty = y + pad + Math.max(0, Math.floor((room - tallest) / 2));
  let portraitY: number, leftX: number, rightX: number;
  if (stacked) {
    const px = x + Math.floor((w - pw) / 2);
    p.icon({ kind: 'character', id: c.id }, px, ty, pw, ph);
    portraitY = ty;
    leftX = px - aw;
    rightX = px + pw;
    ty += ph + 4 * u;
  } else {
    portraitY = y + Math.floor((h - ph) / 2);
    p.icon({ kind: 'character', id: c.id }, x + pad + side, portraitY, pw, ph);
    leftX = x + pad;
    rightX = x + pad + side + pw;
  }
  for (const l of shown) {
    ty += l.gap ?? 0;
    drawText(p, tx, ty, l.text, l.color, { scale: l.scale });
    ty += FONT_SIZE * l.scale;
  }
  zones.push({ x, y, w, h, action: { type: 'start', index: i } });
  // Con más de una agente, flechas para cambiar (van después: ganan a la ficha)
  if (several) {
    const cy = portraitY + Math.floor(ph / 2), zh = Math.max(ARROW_MIN_H * u, ph);
    chevron(p, leftX + Math.floor(aw / 2), cy, -1, u, accent);
    chevron(p, rightX + Math.floor(aw / 2), cy, 1, u, accent);
    zones.push({ x: leftX, y: cy - Math.floor(zh / 2), w: aw, h: zh, action: { type: 'move', delta: -1 } });
    zones.push({ x: rightX, y: cy - Math.floor(zh / 2), w: aw, h: zh, action: { type: 'move', delta: 1 } });
  }
}

// Una flecha grande: dos trazos en ángulo que apuntan a dir (-1, izquierda; 1, derecha)
function chevron(p: Painter, cx: number, cy: number, dir: -1 | 1, u: number, color: string): void {
  const size = 7 * u, thick = 3 * u;
  for (let k = -size; k < size; k += u) {
    const off = size - Math.abs(k);
    p.fill(cx + dir * off - Math.floor(thick / 2), cy + k, thick, u, color);
  }
}
