// La pantalla del juego (portado del Brotato en Phaser, src/engine/view/pixel.ts y camera.ts): cuánto mundo se ve y
// dónde mira la cámara. Puro, sin DOM: la vista le pasa los píxeles físicos y la posición proyectada de MAIA.

// Un píxel del juego ocupa siempre s×s píxeles FÍSICOS, con s entero. Nunca se escala por fracciones.
// 216/384 (MAIA, 2026-10-20): con personajes de 24 px, MAIA ocupa un 9–11 % del lado corto en escritorio (s=5),
// portátil, monitor grande, tapa del Flip (s=3) y abierto (s=5). Ver DISENO.md 5.2.
export const PIXEL_RULES = {
  minShortSide: 216, // lado corto visible mínimo, en píxeles lógicos
  maxVisible: 384,   // tope del área visible por eje: una pantalla enorme no ve media arena
};

export interface PixelLayout {
  scale: number;  // s
  width: number;  // ancho visible, píxeles lógicos
  height: number;
  left: number;   // margen sobrante centrado, píxeles físicos
  top: number;
}

export function computeLayout(physW: number, physH: number, rules = PIXEL_RULES): PixelLayout {
  const pw = Math.floor(physW);
  const ph = Math.floor(physH);
  const scale = Math.max(1, Math.floor(Math.min(pw, ph) / rules.minShortSide));
  const width = Math.min(Math.floor(pw / scale), rules.maxVisible);
  const height = Math.min(Math.floor(ph / scale), rules.maxVisible);
  return {
    scale,
    width,
    height,
    left: Math.floor((pw - width * scale) / 2),
    top: Math.floor((ph - height * scale) / 2),
  };
}

// Scroll de un eje: centrado en target pero sin enseñar nada fuera de [lo, hi]. Si el tramo es más corto que la
// vista, se centra en él. Entero si target lo es (se parte de la posición YA redondeada: no vuelve el temblor de 1 px).
export function scrollAxis(target: number, view: number, lo: number, hi: number): number {
  if (hi - lo <= view) return lo + Math.floor((hi - lo - view) / 2);
  return Math.min(Math.max(target - Math.floor(view / 2), lo), hi - view);
}

// La cámara del Brotato: arena de (0, 0) a su tamaño. topPad: lo que mide el HUD de arriba; la cámara puede subir
// eso por encima de la arena, así arriba del todo el HUD queda sobre el fondo y no tapa la pared del norte.
export function cameraScroll(
  target: { x: number; y: number },   // punto a centrar, ya redondeado
  view: { width: number; height: number },
  arena: { width: number; height: number },
  topPad = 0,
): { x: number; y: number } {
  return {
    x: scrollAxis(target.x, view.width, 0, arena.width) + 0,   // + 0: con 0 daría -0
    y: scrollAxis(target.y, view.height, 0 - topPad, arena.height) + 0,
  };
}
