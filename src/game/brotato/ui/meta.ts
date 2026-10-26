// La pantalla de mejoras entre partidas (meta/upgrades.ts): el árbol en filas, cada una con su rama sangrada, su
// nivel en cuadritos y lo que cuesta el siguiente. Tocar una fila la compra. En 2 columnas si caben (el escritorio y
// la tapa del Flip), en 1 en el Flip abierto. Teclado: 1–9 y 0 compran por orden, Esc o Intro vuelven.
import type { ThemeId } from '../registry/schemas';
import { UPGRADES, levelOf, nextCost, unlocked, buyUpgrade, type Progress, type Upgrade } from '../meta/upgrades';
import { CHAR_W, FONT_SIZE, drawText, textWidth, wrapText } from './font';
import type { Painter, Zone } from './paint';
import { ACCENTS, UI, button, icon, panel, ICON } from './theme';

export type MetaAction = { type: 'upgrade'; id: string } | { type: 'back' };

export interface MetaMessage {
  text: string;
  color: string;
  ok: boolean;     // se compró (hay que guardar)
}

// El árbol en orden de lectura: cada mejora seguida de las que cuelgan de ella, con su profundidad
export function treeOrder(): Array<{ u: Upgrade; depth: number }> {
  const out: Array<{ u: Upgrade; depth: number }> = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const u of UPGRADES) if (u.requires === parent) { out.push({ u, depth }); walk(u.id, depth + 1); }
  };
  walk(undefined, 0);
  return out;
}

export function metaKey(e: { code: string; key: string }): MetaAction | null {
  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) {
    const k = Number(digit[2]), index = k === 0 ? 9 : k - 1, row = treeOrder()[index];
    return row ? { type: 'upgrade', id: row.u.id } : null;
  }
  if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') return { type: 'back' };
  return null;
}

// Hace la compra sobre el progreso y dice qué enseñar ('back' lo hace quien llama)
export function applyMeta(progress: Progress, action: MetaAction): MetaMessage | null {
  if (action.type !== 'upgrade') return null;
  const r = buyUpgrade(progress, action.id);
  const name = UPGRADES.find((u) => u.id === action.id)?.name ?? action.id;
  return r.ok ? { text: `${name} ${levelOf(progress, action.id)}`, color: UI.gold, ok: true } : { text: r.reason, color: UI.bad, ok: false };
}

export function drawMeta(p: Painter, progress: Progress, theme: ThemeId, message: MetaMessage | null): Zone<MetaAction>[] {
  const zones: Zone<MetaAction>[] = [];
  const W = p.width, H = p.height, pad = 4, line = FONT_SIZE, accent = ACCENTS[theme];
  p.fill(0, 0, W, H, UI.panel);

  // Cabecera: MEJORAS y las fichas
  const headH = line + 9;
  panel(p, pad, pad, W - 2 * pad, headH, { accent });
  drawText(p, pad + 6, pad + 5, 'mejoras', accent);
  drawText(p, W - pad - 6, pad + 5, `${progress.fichas} fichas`, UI.gold, { align: 'right' });

  // Pie: volver, y el mensaje de la última compra
  const btnH = line + 7, footTop = H - pad - btnH;
  button(p, zones, W - pad, footTop, 'volver', { type: 'back' }, { accent, primary: true, alignRight: true });
  if (message) drawText(p, pad + 2, footTop + 4, wrapText(message.text, Math.floor((W - 70) / CHAR_W), 1)[0] ?? '', message.color);

  // Las filas, en columnas
  const rows = treeOrder();
  const cols = W >= 300 || H < 300 ? 2 : 1;
  const perCol = Math.ceil(rows.length / cols);
  const gap = 3, top = pad + headH + 4, bottom = footTop - 4;
  const cw = Math.floor((W - 2 * pad - gap * (cols - 1)) / cols);
  const rh = Math.min(line * 2 + 8, Math.floor((bottom - top - gap * (perCol - 1)) / perCol));
  rows.forEach(({ u, depth }, i) => {
    const x = pad + Math.floor(i / perCol) * (cw + gap), y = top + (i % perCol) * (rh + gap);
    row(p, zones, progress, u, depth, x, y, cw, rh, accent);
  });
  return zones;
}

function row(p: Painter, zones: Zone<MetaAction>[], progress: Progress, u: Upgrade, depth: number, x: number, y: number, w: number, h: number, accent: string): void {
  const line = FONT_SIZE;
  const open = unlocked(progress, u.id), level = levelOf(progress, u.id), cost = nextCost(progress, u.id);
  const affordable = open && cost !== null && progress.fichas >= cost;
  panel(p, x, y, w, h, { fill: open ? UI.panelHi : UI.panel, edge: affordable ? accent : UI.edge });
  // La rama: una raya por nivel de profundidad
  for (let d = 0; d < depth; d++) p.fill(x + 3 + d * 3, y + 3, 1, h - 6, open ? accent : UI.edge);
  const tx = x + 4 + depth * 3 + (depth > 0 ? 2 : 0);

  // A la derecha: el precio (o «máx», o el candado) y debajo, el nivel en cuadritos
  let right = x + w - 4;
  if (!open) { icon(p, 'lock', right - ICON, y + 3, UI.dim); right -= ICON + 3; }
  else {
    const label = cost === null ? 'máx' : String(cost);
    drawText(p, right, y + 3, label, cost === null ? UI.good : affordable ? UI.gold : UI.bad, { align: 'right' });
    right -= textWidth(label, 1) + 3;
  }
  const pips = u.costs.length, pipX = x + w - 4 - pips * 4 + 1, pipY = y + 4 + line;
  if (h >= line * 2 + 4) for (let k = 0; k < pips; k++) p.fill(pipX + k * 4, pipY, 3, 3, k < level ? accent : UI.edge);

  // El nombre y lo que da, cortados a lo que quepa
  const nameChars = Math.max(3, Math.floor((right - tx - 2) / CHAR_W));
  drawText(p, tx, y + 3, wrapText(u.name, nameChars, 1)[0] ?? '', open ? UI.text : UI.dim);
  if (h >= line * 2 + 4) {
    const descChars = Math.max(3, Math.floor((pipX - tx - 3) / CHAR_W));
    drawText(p, tx, y + 3 + line, wrapText(u.description, descChars, 1)[0] ?? '', UI.dim);
  }
  if (open) zones.push({ x, y, w, h, action: { type: 'upgrade', id: u.id } });
}
