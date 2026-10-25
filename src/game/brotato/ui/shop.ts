// La tienda entre oleadas, portada del ShopScene del Brotato en Phaser. Solo pinta y traduce toques y teclas a
// acciones: las reglas viven en sim/Shop.ts. Es una lista de filas que reparte el alto disponible.
// Teclado: 1–8 compra, Mayús+número pone/quita candado, R vuelve a tirar, Intro o Espacio sigue.
import { MAX_WEAPONS, type ThemeId } from '../registry/schemas';
import type { Run } from '../sim/Run';
import type { Offer } from '../sim/Shop';
import { lookOf } from '../looks';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import { COLORS, stroke, type Painter, type Zone } from './paint';

export type ShopAction = { type: 'buy'; index: number } | { type: 'lock'; index: number } | { type: 'reroll' } | { type: 'next' };

export const ICON_W = 24;   // caja de un icono a escala x1: las armas, de perfil, son más largas que altas
export const ICON_H = 16;
export const MATERIAL_ICON = 10;   // caja del icono del material, junto a la cuenta
const MAX_ROW_W = 100;      // ancho máximo de una fila, en letras: en pantallas anchas no se estira de lado a lado
const TIERS = ['I', 'II', 'III', 'IV'];

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
      return r.ok ? { text: 'comprado', color: COLORS.gold } : { text: r.reason, color: COLORS.bad };
    }
    case 'lock':
      run.shop.toggleLock(action.index);
      return null;
    case 'reroll': {
      const r = run.shop.reroll();
      return r.ok ? null : { text: r.reason, color: COLORS.bad };
    }
    case 'next':
      return null;
  }
}

// Se pinta entera sobre un panel que oscurece el mundo; devuelve las zonas táctiles
export function drawShop(p: Painter, run: Run, theme: ThemeId, message: ShopMessage | null, u = 1): Zone<ShopAction>[] {
  const zones: Zone<ShopAction>[] = [];
  const W = p.width, H = p.height;
  const line = FONT_SIZE * u;
  const pad = 6 * u;
  const rowW = Math.min(W - pad * 2, MAX_ROW_W * CHAR_W * u);
  const left = Math.floor((W - rowW) / 2);
  p.fill(0, 0, W, H, COLORS.panel);

  // Cabecera: título y materiales en una línea; debajo, la oleada
  let y = pad;
  drawText(p, left, y, 'Tienda', COLORS.text, { scale: u });
  const moneyW = drawText(p, left + rowW, y, String(run.materials), COLORS.gold, { scale: u, align: 'right' });
  const mat = MATERIAL_ICON * u;
  p.icon({ kind: 'material', id: theme }, left + rowW - moneyW - 2 * u - mat, y + Math.floor((line - u - mat) / 2), mat, mat);
  y += line;
  for (const l of wrapText(`oleada ${run.waveIndex} superada · viene la ${run.waveNumber} de ${run.totalWaves}`, Math.floor(rowW / (CHAR_W * u)))) {
    drawText(p, left, y, l, COLORS.dim, { scale: u });
    y += line;
  }
  y += 2 * u;

  // Pie (de abajo arriba): botones, armas y mensaje. Lo que sobra en medio es para las filas.
  const buttonH = line + 6 * u;
  const rerollLabel = `volver a tirar · ${run.shop.rerollPrice()}`;
  const nextLabel = 'seguir »';
  // Los dos botones en una línea si caben; si no (pantallas estrechas), uno encima del otro
  const fits = textWidth(rerollLabel, u) + textWidth(nextLabel, u) + 24 * u <= rowW;
  const footerTop = H - pad - buttonH * (fits ? 1 : 2) - (fits ? 0 : 3 * u);
  const rerollColor = run.materials >= run.shop.rerollPrice() ? COLORS.text : COLORS.dim;
  button(p, zones, left, footerTop, rerollLabel, rerollColor, u, buttonH, { type: 'reroll' });
  button(p, zones, left + rowW, fits ? footerTop : footerTop + buttonH + 3 * u, nextLabel, COLORS.gold, u, buttonH, { type: 'next' }, true);
  const weaponsTop = footerTop - 4 * u - ICON_H * u;
  weaponsBar(p, run, left, weaponsTop, rowW, u);
  const messageTop = weaponsTop - line - 2 * u;
  if (message?.text) drawText(p, left, messageTop, message.text, message.color, { scale: u });

  // Filas: el alto que quede, repartido; como mucho el que necesita una descripción de 4 líneas
  const n = run.shop.offers.length;
  const gap = 2 * u;
  const space = messageTop - gap - y;
  const rowH = Math.min(Math.floor((space - gap * (n - 1)) / n), line * 6 + 6 * u);
  run.shop.offers.forEach((offer, i) => row(p, zones, run, theme, offer, i, left, y + i * (rowH + gap), rowW, rowH, u));
  return zones;
}

function row(p: Painter, zones: Zone<ShopAction>[], run: Run, theme: ThemeId, offer: Offer | null, i: number, x: number, y: number, w: number, h: number, u: number): void {
  const line = FONT_SIZE * u;
  const pad = 3 * u;
  if (!offer) {
    stroke(p, x, y, w, h, COLORS.edge, u);
    drawText(p, x + Math.floor(w / 2), y + Math.floor((h - line) / 2), 'vendido', COLORS.dim, { scale: u, align: 'center' });
    return;
  }
  p.fill(x, y, w, h, offer.locked ? COLORS.rowLocked : COLORS.row);
  stroke(p, x, y, w, h, offer.locked ? COLORS.edgeLocked : COLORS.edge, u);

  // Icono: el modelo del módulo; un ítem sin modelo lleva su inicial en un cuadro
  const mod = offer.kind === 'weapon' ? run.registry.weapon(offer.id) : run.registry.item(offer.id);
  const look = offer.kind === 'weapon' ? lookOf(run.registry.weapon(offer.id), theme) : lookOf(run.registry.item(offer.id), theme);
  const iw = ICON_W * u, ih = ICON_H * u;
  if (!p.icon({ kind: offer.kind, id: offer.id }, x + pad, y + pad, iw, ih)) {
    p.fill(x + pad + Math.floor((iw - ih) / 2), y + pad, ih, ih, COLORS.accent);
    drawText(p, x + pad + Math.floor(iw / 2), y + pad + Math.floor((ih - line) / 2) + u, look.name[0]!, COLORS.text, { scale: u, align: 'center' });
  }

  // A la derecha, de arriba abajo: número de tecla, precio y candado
  const affordable = run.materials >= offer.price;
  const right = x + w - pad;
  const priceW = drawText(p, right, y + pad, `${offer.price}`, affordable ? COLORS.gold : COLORS.bad, { scale: u, align: 'right' });
  drawText(p, right - priceW - 2 * CHAR_W * u, y + pad, `${i + 1}`, COLORS.dim, { scale: u, align: 'right' });
  const lockLabel = offer.locked ? 'fijada' : 'fijar';
  const lockW = drawText(p, right, y + h - pad - line, lockLabel, offer.locked ? COLORS.gold : COLORS.dim, { scale: u, align: 'right' });

  // En medio: nombre y tipo en una línea, y la descripción en las que quepan (a 384×216 una fila mide 32 px: con el
  // tipo en su propia línea, como en Phaser, no quedaba ninguna para la descripción)
  const tx = x + pad + iw + 3 * u;
  const ty = y + 2 * u;
  const textW = right - lockW - 3 * u - tx;
  const maxChars = Math.max(4, Math.floor(textW / (CHAR_W * u)));
  const kind = offer.kind === 'weapon' ? `arma ${TIERS[offer.tier]}` : 'ítem';
  const name = wrapText(look.name, Math.max(4, maxChars - kind.length - 3), 1)[0] ?? '';
  const nameW = drawText(p, tx, ty, name, COLORS.text, { scale: u });
  drawText(p, tx + nameW + CHAR_W * u, ty, `· ${kind}`, COLORS.accent, { scale: u });
  const descLines = Math.floor((y + h - 2 * u - ty - line) / line);
  wrapText(look.description ?? mod.description ?? '', maxChars, descLines).forEach((l, k) => {
    drawText(p, tx, ty + line * (1 + k), l, COLORS.dim, { scale: u });
  });

  // Zonas táctiles: la fila compra, salvo la esquina del candado (va después: gana)
  const lockZoneW = lockW + pad * 2;
  const lockZoneH = line + pad * 2;
  zones.push({ x, y, w, h, action: { type: 'buy', index: i } });
  zones.push({ x: x + w - lockZoneW, y: y + h - lockZoneH, w: lockZoneW, h: lockZoneH, action: { type: 'lock', index: i } });
}

// Las armas en sus casillas, como el Brotato: una por hueco (los vacíos, tenues), con el nivel en la esquina; y la
// cuenta de ítems detrás si cabe
function weaponsBar(p: Painter, run: Run, x: number, y: number, w: number, u: number): void {
  const iw = ICON_W * u, ih = ICON_H * u;
  const sw = iw + 2 * u, sh = ih + 2 * u, gap = 2 * u;
  for (let k = 0; k < MAX_WEAPONS; k++) {
    const sx = x + k * (sw + gap), weapon = run.weapons[k];
    if (weapon) {
      p.fill(sx, y - u, sw, sh, COLORS.row);
      stroke(p, sx, y - u, sw, sh, COLORS.edge, u);
      p.icon({ kind: 'weapon', id: weapon.id }, sx + u, y, iw, ih);
      if (weapon.tier > 0) drawText(p, sx + sw - u, y, TIERS[weapon.tier]!, COLORS.gold, { scale: u, align: 'right' });
    } else stroke(p, sx, y - u, sw, sh, COLORS.slot, u);
  }
  const after = x + MAX_WEAPONS * (sw + gap) + 2 * u;
  const items = `${run.items.length} ítems`;
  if (run.items.length > 0 && after + textWidth(items, u) <= x + w) drawText(p, after, y + Math.floor((ih - FONT_SIZE * u) / 2), items, COLORS.dim, { scale: u });
}

function button(p: Painter, zones: Zone<ShopAction>[], x: number, y: number, label: string, color: string, u: number, h: number, action: ShopAction, alignRight = false): void {
  const bw = textWidth(label, u) + 8 * u;
  const bx = alignRight ? x - bw : x;
  drawText(p, bx + 4 * u, y + 3 * u, label, color, { scale: u });
  stroke(p, bx, y, bw, h, color, u);
  zones.push({ x: bx, y, w: bw, h, action });
}
