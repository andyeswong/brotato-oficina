import type { CharacterModule, Sprites } from '../registry/schemas';

export interface Body {
  radius: number;
  centerY: number;
  speed: number;
  cellW: number;
  cellH: number;
}

// Nada en el motor asume una celda de 32: el cuerpo sale del personaje, y lo que no declare,
// de las proporciones de su animación idle. Con 32×32 da radio 6, centro a 10 px y 90 px/s;
// con 64×64, radio 13, centro a 19 px y 179 px/s.
export function resolveBody(character: CharacterModule): Body {
  const { w: cellW, h: cellH } = cellOf(character.sprites, 'idle');
  return {
    radius: character.body?.radius ?? Math.round(cellW * 0.2),
    centerY: character.body?.centerY ?? Math.round(cellH * 0.3),
    speed: character.body?.speed ?? Math.round(cellH * 2.8),
    cellW,
    cellH,
  };
}

// Tamaño de la celda de una animación, leído del JSON de la hoja
export function cellOf(sprites: Sprites, anim: string): { w: number; h: number } {
  const tag = sprites.atlas.meta.frameTags.find((t) => t.name === sprites.anims[anim]);
  const first = tag ? Object.values(sprites.atlas.frames)[tag.from] : undefined;
  return { w: first?.frame.w ?? 32, h: first?.frame.h ?? 32 };
}

// Mantiene el SPRITE entero dentro de la arena (no solo el círculo de colisión): x es el centro, y los pies
export function keepInside(
  pos: { x: number; y: number },
  cell: { w: number; h: number },
  arena: { width: number; height: number },
): void {
  const half = cell.w / 2;
  pos.x = Math.min(Math.max(pos.x, half), arena.width - half);
  pos.y = Math.min(Math.max(pos.y, cell.h), arena.height);
}
