import type { CharacterModule } from '../registry/schemas';

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
  const { atlas, anims } = character.sprites;
  const tag = atlas.meta.frameTags.find((t) => t.name === anims.idle);
  const first = tag ? Object.values(atlas.frames)[tag.from] : undefined;
  const cellW = first?.frame.w ?? 32;
  const cellH = first?.frame.h ?? 32;
  return {
    radius: character.body?.radius ?? Math.round(cellW * 0.2),
    centerY: character.body?.centerY ?? Math.round(cellH * 0.3),
    speed: character.body?.speed ?? Math.round(cellH * 2.8),
    cellW,
    cellH,
  };
}
