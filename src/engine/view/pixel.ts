import Phaser from 'phaser';

// Un píxel del juego ocupa siempre s×s píxeles FÍSICOS, con s entero. Nunca se escala por fracciones.
// 216/384 (MAIA, 2026-10-20): con personajes de 24 px, MAIA ocupa un 9–11 % del lado corto en
// escritorio (s=5), portátil, monitor grande, tapa del Flip (s=3) y abierto (s=5). Ver DISENO.md 5.2.
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

export function currentLayout(): PixelLayout {
  const dpr = window.devicePixelRatio || 1;
  return computeLayout(window.innerWidth * dpr, window.innerHeight * dpr);
}

// El canvas se queda a resolución lógica y el navegador lo amplía con image-rendering: pixelated.
// zoom = s / dpr hace que el tamaño CSS (con decimales si hace falta) caiga en píxeles físicos exactos.
export function applyLayout(game: Phaser.Game, layout: PixelLayout): void {
  const dpr = window.devicePixelRatio || 1;
  game.scale.resize(layout.width, layout.height);
  game.scale.setZoom(layout.scale / dpr);
  const style = game.canvas.style;
  style.left = `${layout.left / dpr}px`;
  style.top = `${layout.top / dpr}px`;
}

export function watchLayout(game: Phaser.Game, onChange: (layout: PixelLayout) => void): void {
  const update = () => {
    const layout = currentLayout();
    applyLayout(game, layout);
    onChange(layout);
  };
  window.addEventListener('resize', update);
  window.matchMedia?.(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', update);
  update();
}
