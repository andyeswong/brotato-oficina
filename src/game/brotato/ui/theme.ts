// El estilo de la interfaz (rediseño de 2026-10-25, decisión de Andrés: un solo estilo para los tres mundos y un color
// de acento por tema). Referencias: Dome Keeper y 20 Minutes Till Dawn (paneles oscuros con borde fino y esquinas de
// acento, paleta corta, la selección en el acento) y Brotato (barra de vida con la cuenta dentro, materiales con su
// icono, la oleada y el tiempo grandes arriba). Aquí, las piezas: colores, paneles, barras, botones e iconos pequeños.
// Todo se pinta con rectángulos sobre un Painter, como las pantallas, para que las pruebas lo vean igual.
import type { ThemeId } from '../registry/schemas';
import { FONT_SIZE, drawText, textWidth } from './font';
import type { Painter, Zone } from './paint';

// El acento de cada mundo: oficina azul, medieval ámbar, cyberpunk neón
export const ACCENTS: Record<ThemeId, string> = { oficina: '#6aa8ff', medieval: '#f0b951', cyberpunk: '#ff4fd8' };

export const UI = {
  veil: '#0b0a14d9',     // lo que oscurece el mundo detrás de la tienda y los menús
  panel: '#15132a',      // fondo de un panel
  panelHi: '#1f1c3a',    // fondo de una carta o casilla dentro de un panel
  edge: '#3b3660',       // borde fino
  shadow: '#06050c',     // la sombra de 1 px bajo cada panel
  text: '#fdf6ff',
  dim: '#8f8aa8',
  gold: '#f0b951',
  bad: '#ff4d5e',
  good: '#7bd88f',
  hp: '#e8445a',
  hpBack: '#3a1420',
} as const;

// Un panel: fondo, borde fino, una esquina de acento en cada vértice (3 px por lado) y sombra debajo
export function panel(p: Painter, x: number, y: number, w: number, h: number, opts: { accent?: string; fill?: string; edge?: string } = {}): void {
  p.fill(x + 1, y + h, w - 1, 1, UI.shadow);
  p.fill(x, y, w, h, opts.fill ?? UI.panel);
  const e = opts.edge ?? UI.edge;
  p.fill(x, y, w, 1, e); p.fill(x, y + h - 1, w, 1, e);
  p.fill(x, y + 1, 1, h - 2, e); p.fill(x + w - 1, y + 1, 1, h - 2, e);
  if (opts.accent && w >= 8 && h >= 8) {
    const a = opts.accent, c = 3;
    for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]] as const) {
      p.fill(dx > 0 ? cx : cx - c + 1, cy, c, 1, a);
      p.fill(cx, dy > 0 ? cy : cy - c + 1, 1, c, a);
    }
  }
}

// Una barra con su fondo y la parte llena; el texto, si hay, centrado dentro con sombra
export function bar(p: Painter, x: number, y: number, w: number, h: number, frac: number, color: string, back: string, label?: string): void {
  p.fill(x, y, w, h, UI.shadow);
  p.fill(x + 1, y + 1, w - 2, h - 2, back);
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, frac)));
  if (fw > 0) {
    p.fill(x + 1, y + 1, fw, h - 2, color);
    p.fill(x + 1, y + 1, fw, 1, '#ffffff40');   // brillo de 1 px arriba
  }
  if (label) {
    const ty = y + Math.floor((h - FONT_SIZE) / 2);
    drawText(p, x + Math.floor(w / 2) + 1, ty + 1, label, UI.shadow, { align: 'center' });
    drawText(p, x + Math.floor(w / 2), ty, label, UI.text, { align: 'center' });
  }
}

// Un botón con marco: el principal va relleno del acento; uno apagado (sin materiales) en tenue. Devuelve su ancho
export function button<A>(p: Painter, zones: Zone<A>[], x: number, y: number, label: string, action: A,
  opts: { accent: string; primary?: boolean; enabled?: boolean; w?: number; h?: number; alignRight?: boolean }): number {
  const h = opts.h ?? FONT_SIZE + 7;
  const w = opts.w ?? textWidth(label, 1) + 12;
  const bx = opts.alignRight ? x - w : x;
  const on = opts.enabled !== false;
  const fill = opts.primary && on ? opts.accent : UI.panelHi;
  panel(p, bx, y, w, h, { fill, edge: on ? opts.accent : UI.edge });
  const color = opts.primary && on ? UI.panel : on ? UI.text : UI.dim;
  drawText(p, bx + Math.floor(w / 2), y + Math.floor((h - FONT_SIZE) / 2) + 1, label, color, { align: 'center' });
  zones.push({ x: bx, y, w, h, action });
  return w;
}

// Iconos pequeños de 7×7, como los glifos de la fuente ('#' = píxel encendido)
const ICONS = {
  heart: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  skull: ['.#####.', '#######', '#.###.#', '#######', '.##.##.', '.#####.', '.#.#.#.'],
  lock: ['..###..', '.#...#.', '.#...#.', '#######', '###.###', '###.###', '#######'],
  unlock: ['..###..', '.#...#.', '.....#.', '#######', '###.###', '###.###', '#######'],
} as const;
export type IconName = keyof typeof ICONS;
export const ICON = 7;

export function icon(p: Painter, name: IconName, x: number, y: number, color: string): void {
  ICONS[name].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.fill(x + i, y + j, 1, 1, color); }));
}

// Texto con sombra de 1 px (para lo que va encima del mundo)
export function shadowText(p: Painter, x: number, y: number, text: string, color: string, opts: { scale?: number; align?: 'left' | 'center' | 'right' } = {}): number {
  const s = opts.scale ?? 1;
  drawText(p, x + s, y + s, text, UI.shadow, opts);
  return drawText(p, x, y, text, color, opts);
}
