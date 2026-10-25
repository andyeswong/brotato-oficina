// Rigs de andar de los bichos del Brotato (NARUTO), sobre los borradores de FERN (models/brotato/*). Las partes se
// eligen por geometría, no por vóxeles sueltos: si el modelo cambia sin cambiar de forma general (patas a los lados,
// borde de la taza arriba), el rig sigue valiendo. FERN puede moverlos a su contenido cuando quiera.
import type { Rig } from '@voxpix/anim/rig';

// Grapa: anda como un compás. Las dos puntas son las patas (|x| >= 5, por debajo de la corona); se alternan hacia
// delante y hacia atrás, y la que pasa se dobla (sube 1).
export const RIG_GRAPA: Rig = {
  frameMs: 110,
  parts: [
    { name: 'L', has: (x, _y, z) => x <= -5 && z <= 7, pivotZ: 7, footZ: 0 },
    { name: 'R', has: (x, _y, z) => x >= 5 && z <= 7, pivotZ: 7, footZ: 0 },
  ],
  frames: [
    { moves: { L: { stride: 1 }, R: { stride: -1 } } },
    { moves: { R: { dz: 1 } } },
    { moves: { L: { stride: -1 }, R: { stride: 1 } } },
    { moves: { L: { dz: 1 } } },
  ],
};

// Clip: insecto en trípode. Tres patas de alambre por lado (y = -3, 0, 3); un trípode (izquierda delante y detrás,
// derecha en medio) pasa mientras el otro empuja, y luego al revés.
const tripodA = (x: number, y: number) => (x < 0 ? Math.abs(y) >= 2 : Math.abs(y) < 2);
export const RIG_CLIP: Rig = {
  frameMs: 80,
  parts: [
    { name: 'A', has: (x, y, z) => z <= 2 && Math.abs(x) >= 4 && tripodA(x, y), pivotZ: 2, footZ: 0 },
    { name: 'B', has: (x, y, z) => z <= 2 && Math.abs(x) >= 4 && !tripodA(x, y), pivotZ: 2, footZ: 0 },
  ],
  frames: [
    { moves: { A: { dz: 1 } } },
    { moves: { A: { stride: 1 }, B: { stride: -1 } } },
    { moves: { B: { dz: 1 } } },
    { moves: { A: { stride: -1 }, B: { stride: 1 } } },
  ],
};

// Taza: sin patas, va a saltitos. Se aplasta (el borde baja 1), salta (todo sube 1, inclinada hacia delante) y cae.
export const RIG_TAZA: Rig = {
  frameMs: 120,
  parts: [{ name: 'top', has: (_x, _y, z) => z >= 6 }],
  frames: [
    { moves: {} },
    { moves: { top: { dz: -1 } } },
    { moves: { body: { dz: 1 }, top: { dz: 1, dy: -1 } }, airborne: true },
    { moves: { body: { dz: 1 }, top: { dz: 1 } }, airborne: true },
  ],
};

export const BROTATO_RIGS: Record<string, Rig> = { 'bicho-grapa': RIG_GRAPA, 'bicho-clip': RIG_CLIP, 'bicho-taza': RIG_TAZA };
