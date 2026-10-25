// Lo que las pantallas del Brotato (tienda, selección, fin, HUD) necesitan para pintarse: rectángulos, iconos y un
// aviso de cada texto. Las pantallas son funciones puras de la partida que pintan sobre un Painter y devuelven sus
// zonas táctiles; la vista pone el lienzo, las pruebas uno que solo apunta.

// Un icono: el modelo de un arma, de un ítem, el retrato de un personaje o el material de un mundo (id = el tema)
export type IconRef = { kind: 'weapon' | 'item' | 'character' | 'material'; id: string };

export interface Painter {
  readonly width: number;
  readonly height: number;
  fill(x: number, y: number, w: number, h: number, color: string): void;
  // Centrado en la caja. false si no hay icono: la pantalla pone en su lugar la inicial
  icon(ref: IconRef, x: number, y: number, w: number, h: number): boolean;
  // Cada texto pintado, con su caja (para las pruebas y la accesibilidad)
  onText?(text: string, x: number, y: number, w: number, h: number): void;
}

export interface Zone<A> {
  x: number;
  y: number;
  w: number;
  h: number;
  action: A;
}

// La zona bajo un punto: la última pintada gana (las de encima van después)
export function hit<A>(zones: readonly Zone<A>[], x: number, y: number): A | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]!;
    if (x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) return z.action;
  }
  return null;
}

// Un borde de 1 px por escala
export function stroke(p: Painter, x: number, y: number, w: number, h: number, color: string, s = 1): void {
  p.fill(x, y, w, s, color);
  p.fill(x, y + h - s, w, s, color);
  p.fill(x, y + s, s, h - 2 * s, color);
  p.fill(x + w - s, y + s, s, h - 2 * s, color);
}

export const COLORS = {
  bg: '#12101c', panel: '#12101ce6', row: '#1f1c30', rowLocked: '#2c2645', edge: '#4a4463', slot: '#2e2a42', edgeLocked: '#f0b951',
  text: '#fdf6ff', dim: '#8a94a6', gold: '#f0b951', bad: '#ff4d5e', good: '#7bd88f', accent: '#7a5bd6',
} as const;
