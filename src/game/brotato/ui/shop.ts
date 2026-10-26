// La tienda entre oleadas (rediseño 2026-10-25, ver theme.ts): cartas sobre el mundo oscurecido, como el Brotato, con
// el estilo de paneles de la interfaz. Solo pinta y traduce toques y teclas a acciones: las reglas viven en sim/Shop.ts.
// 4 cartas en fila si caben; si no (el Flip), en rejilla de 2×2. Abajo, las armas en sus casillas y los botones.
// Teclado: 1–8 compra, Mayús+número pone/quita candado, R vuelve a tirar, Intro o Espacio sigue.
import { MAX_WEAPONS, type ThemeId } from '../registry/schemas';
import type { Run } from '../sim/Run';
import type { Offer } from '../sim/Shop';
import { lookOf } from '../looks';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import type { Painter, Zone } from './paint';
import { ACCENTS, ICON, UI, button, icon, panel } from './theme';

export type ShopAction = { type: 'buy'; index: number } | { type: 'lock'; index: number } | { type: 'reroll' } | { type: 'next' };

export const ICON_W = 24;   // caja de un icono pequeño (las casillas de armas): las armas, de perfil, son más largas
export const ICON_H = 16;
export const MATERIAL_ICON = 9;    // caja del icono del material, junto a una cuenta
const TIERS = ['I', 'II', 'III', 'IV'];
const LOCK_ZONE = 15;              // la esquina de la carta que fija la oferta (en el Flip, con el dedo)

export interface ShopMessage {
  text: string;
  color: string;
}

export function shopKey(e: { code: string; key: string; shiftKey: boolean }, run: Run): ShopAction | null {
  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) {
    const index = Number(digit[2]) - 1;
    if (index < 0 || index >= run.shop.offers.length) return null;
    return { type: e.shiftKey ? 'lock' : 'buy', index };
  }
  if (e.key === 'r' || e.key === 'R') return { type: 'reroll' };
  if (e.key === 'Enter' || e.key === ' ') return { type: 'next' };
  return null;
}

// Hace la acción sobre la tienda y devuelve el mensaje que hay que enseñar ('next' lo hace quien llama: salir)
export function applyShop(run: Run, action: ShopAction): ShopMessage | null {
  switch (action.type) {
    case 'buy': {
      const r = run.shop.buy(action.index);
      return r.ok ? { text: 'comprado', color: UI.gold } : { text: r.reason, color: UI.bad };
    }
    case 'lock':
      run.shop.toggleLock(action.index);
      return null;
    case 'reroll': {
      const r = run.shop.reroll();
      return r.ok ? null : { text: r.reason, color: UI.bad };
    }
    case 'next':
      return null;
  }
}

// Se pinta entera sobre un velo que oscurece el mundo; devuelve las zonas táctiles
export function drawShop(p: Painter, run: Run, theme: ThemeId, message: ShopMessage | null): Zone<ShopAction>[] {
  const zones: Zone<ShopAction>[] = [];
  const W = p.width, H = p.height, pad = 4, accent = ACCENTS[theme];
  p.fill(0, 0, W, H, UI.veil);

  // Cabecera: TIENDA, la oleada y los materiales
  const headH = FONT_SIZE + 9;
  panel(p, pad, pad, W - 2 * pad, headH, { accent });
  const hy = pad + 5;
  const titleW = drawText(p, pad + 6, hy, 'tienda', accent);
  const money = String(run.materials);
  const moneyW = textWidth(money, 1);
  drawText(p, W - pad - 6, hy, money, UI.gold, { align: 'right' });
  p.icon({ kind: 'material', id: theme }, W - pad - 6 - moneyW - 2 - MATERIAL_ICON, hy - 1, MATERIAL_ICON, MATERIAL_ICON);
  const sub = `oleada ${run.waveIndex} superada`;
  if (pad + 6 + titleW + 8 + textWidth(sub, 1) < W - pad - 6 - moneyW - MATERIAL_ICON - 8) drawText(p, pad + 6 + titleW + 8, hy, sub, UI.dim);

  // Pie (de abajo arriba): botones, armas y mensaje
  const narrow = W < 300;
  const btnH = FONT_SIZE + 7;
  const slotW = ICON_W + 2, slotH = ICON_H + 2;
  const slotsW = MAX_WEAPONS * (slotW + 2) - 2;
  const rerollPrice = run.shop.rerollPrice();
  const rerollLabel = `tirar · ${rerollPrice}`;
  const nextLabel = 'seguir »';
  let footTop: number, slotsY: number;
  if (narrow || slotsW + textWidth(rerollLabel, 1) + textWidth(nextLabel, 1) + 40 > W - 2 * pad) {
    footTop = H - pad - btnH;
    slotsY = footTop - 3 - slotH;
  } else {
    footTop = H - pad - Math.max(btnH, slotH);
    slotsY = footTop;
  }
  const nw = button(p, zones, W - pad, footTop, nextLabel, { type: 'next' }, { accent, primary: true, alignRight: true });
  button(p, zones, W - pad - nw - 4, footTop, rerollLabel, { type: 'reroll' }, { accent, enabled: run.materials >= rerollPrice, alignRight: true });
  weaponSlots(p, run, pad, slotsY, slotW, slotH);
  const msgTop = slotsY - FONT_SIZE - 2;
  if (message?.text) drawText(p, pad + 2, msgTop, message.text, message.color);

  // Cartas: el espacio que quede entre la cabecera y el mensaje
  const n = run.shop.offers.length;
  const cols = W >= 340 ? Math.min(4, n) : 2;
  const rows = Math.ceil(n / cols);
  const gap = 4;
  const top = pad + headH + 4, bottom = msgTop - 3;
  const cw = Math.floor((W - 2 * pad - gap * (cols - 1)) / cols);
  const ch = Math.floor((bottom - top - gap * (rows - 1)) / rows);
  run.shop.offers.forEach((offer, i) => {
    const cx = pad + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
    card(p, zones, run, theme, offer, i, cx, cy, cw, ch);
  });
  return zones;
}

function card(p: Painter, zones: Zone<ShopAction>[], run: Run, theme: ThemeId, offer: Offer | null, i: number, x: number, y: number, w: number, h: number): void {
  const accent = ACCENTS[theme], line = FONT_SIZE;
  if (!offer) {
    panel(p, x, y, w, h, { fill: UI.panel });
    drawText(p, x + Math.floor(w / 2), y + Math.floor((h - line) / 2), 'vendido', UI.dim, { align: 'center' });
    return;
  }
  const look = offer.kind === 'weapon' ? lookOf(run.registry.weapon(offer.id), theme) : lookOf(run.registry.item(offer.id), theme);
  const mod = offer.kind === 'weapon' ? run.registry.weapon(offer.id) : run.registry.item(offer.id);
  panel(p, x, y, w, h, { accent: offer.locked ? UI.gold : accent, edge: offer.locked ? UI.gold : UI.edge });

  // Arriba: el número de tecla y el candado
  drawText(p, x + 4, y + 3, String(i + 1), UI.dim);
  icon(p, offer.locked ? 'lock' : 'unlock', x + w - 4 - ICON, y + 3, offer.locked ? UI.gold : UI.dim);

  // El icono grande, en su casilla
  const boxW = Math.min(w - 12, 44), boxH = Math.min(26, Math.max(14, h - 4 * line - 14));
  const bx = x + Math.floor((w - boxW) / 2), by = y + 4;
  panel(p, bx, by, boxW, boxH, { fill: UI.panelHi });
  if (!p.icon({ kind: offer.kind, id: offer.id }, bx + 1, by + 1, boxW - 2, boxH - 2)) {
    drawText(p, bx + Math.floor(boxW / 2), by + Math.floor((boxH - line) / 2), look.name[0]!, accent, { align: 'center' });
  }

  // Nombre (1 o 2 líneas), tipo y descripción en las líneas que quepan; abajo, el precio
  const maxChars = Math.max(4, Math.floor((w - 8) / CHAR_W));
  const priceH = line + 5;
  const priceTop = y + h - 4 - priceH;
  let ty = by + boxH + 3;
  const room = Math.floor((priceTop - 2 - ty) / line);   // líneas que caben entre el icono y el precio
  const nameLines = wrapText(look.name, maxChars, room >= 4 ? 2 : 1);
  for (const l of nameLines) { drawText(p, x + Math.floor(w / 2), ty, l, UI.text, { align: 'center' }); ty += line; }
  const kind = offer.kind === 'weapon' ? `arma ${TIERS[offer.tier]}` : 'objeto';
  drawText(p, x + Math.floor(w / 2), ty, kind, accent, { align: 'center' });
  ty += line + 1;
  const descLines = Math.max(1, Math.floor((priceTop - 2 - ty) / line));
  wrapText(look.description ?? mod.description ?? '', maxChars, descLines).forEach((l) => {
    if (ty + line <= priceTop) drawText(p, x + 4, ty, l, UI.dim);
    ty += line;
  });

  // El precio, como un botón con el icono del material (en rojo si no alcanza)
  const affordable = run.materials >= offer.price;
  panel(p, x + 3, priceTop, w - 6, priceH, { fill: affordable ? UI.panelHi : UI.hpBack, edge: affordable ? accent : UI.edge });
  const price = String(offer.price);
  const pw = textWidth(price, 1) + MATERIAL_ICON + 3;
  const px = x + Math.floor((w - pw) / 2);
  p.icon({ kind: 'material', id: theme }, px, priceTop + Math.floor((priceH - MATERIAL_ICON) / 2), MATERIAL_ICON, MATERIAL_ICON);
  drawText(p, px + MATERIAL_ICON + 3, priceTop + 3, price, affordable ? UI.gold : UI.bad);

  // Zonas: la carta compra; la esquina del candado (va después: gana) la fija
  zones.push({ x, y, w, h, action: { type: 'buy', index: i } });
  zones.push({ x: x + w - LOCK_ZONE, y, w: LOCK_ZONE, h: LOCK_ZONE, action: { type: 'lock', index: i } });
}

// Las armas en sus casillas, como el Brotato: una por hueco (los vacíos, tenues), con el nivel en la esquina
function weaponSlots(p: Painter, run: Run, x: number, y: number, sw: number, sh: number): void {
  for (let k = 0; k < MAX_WEAPONS; k++) {
    const sx = x + k * (sw + 2), weapon = run.weapons[k];
    panel(p, sx, y, sw, sh, { fill: weapon ? UI.panelHi : UI.panel });
    if (!weapon) continue;
    p.icon({ kind: 'weapon', id: weapon.id }, sx + 1, y + 1, sw - 2, sh - 2);
    if (weapon.tier > 0) drawText(p, sx + sw - 2, y + 1, TIERS[weapon.tier]!, UI.gold, { align: 'right' });
  }
}
