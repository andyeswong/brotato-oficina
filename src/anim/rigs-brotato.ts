// Rigs de andar de los bichos del Brotato (NARUTO), sobre los borradores de FERN (models/brotato/*). Las partes se
// eligen por geometría, no por vóxeles sueltos: si el modelo cambia sin cambiar de forma general (patas a los lados,
// borde de la taza arriba), el rig sigue valiendo.
// Desde VoxPix a6c1723 son RigSpec: datos que se pueden guardar en un .voxpix.json y editar en el editor. Cada parte es
// la unión de sus cajas [x0, y0, z0, x1, y1, z1] (null = abierto por ese lado); lo que no cae en ninguna es 'body'.
// test/brotato/rigs.test.ts comprueba que dan los mismos cuadros que las versiones con has() de antes.
import { rigFromSpec, type Rig, type RigSpec } from '@voxpix/anim/rig';

// Grapa: anda como un compás. Las dos puntas son las patas (|x| >= 5, por debajo de la corona); se alternan hacia
// delante y hacia atrás, y la que pasa se dobla (sube 1).
export const SPEC_GRAPA: RigSpec = {
  frameMs: 110,
  parts: [
    { name: 'L', boxes: [[null, null, null, -5, null, 7]], pivotZ: 7, footZ: 0 },
    { name: 'R', boxes: [[5, null, null, null, null, 7]], pivotZ: 7, footZ: 0 },
  ],
  frames: [
    { moves: { L: { stride: 1 }, R: { stride: -1 } } },
    { moves: { R: { dz: 1 } } },
    { moves: { L: { stride: -1 }, R: { stride: 1 } } },
    { moves: { L: { dz: 1 } } },
  ],
};

// Clip: insecto en trípode. Tres patas de alambre por lado (y = -3, 0, 3); un trípode (izquierda delante y detrás,
// derecha en medio) pasa mientras el otro empuja, y luego al revés. Patas: z <= 2 y |x| >= 4.
export const SPEC_CLIP: RigSpec = {
  frameMs: 80,
  parts: [
    { name: 'A', boxes: [[null, null, null, -4, -2, 2], [null, 2, null, -4, null, 2], [4, -1, null, null, 1, 2]], pivotZ: 2, footZ: 0 },
    { name: 'B', boxes: [[null, -1, null, -4, 1, 2], [4, null, null, null, -2, 2], [4, 2, null, null, null, 2]], pivotZ: 2, footZ: 0 },
  ],
  frames: [
    { moves: { A: { dz: 1 } } },
    { moves: { A: { stride: 1 }, B: { stride: -1 } } },
    { moves: { B: { dz: 1 } } },
    { moves: { A: { stride: -1 }, B: { stride: 1 } } },
  ],
};

// Taza: sin patas, va a saltitos. Se aplasta (el borde baja 1), salta (todo sube 1, inclinada hacia delante) y cae.
export const SPEC_TAZA: RigSpec = {
  frameMs: 120,
  parts: [{ name: 'top', boxes: [[null, null, 6, null, null, null]] }],
  frames: [
    { moves: {} },
    { moves: { top: { dz: -1 } } },
    { moves: { body: { dz: 1 }, top: { dz: 1, dy: -1 } }, airborne: true },
    { moves: { body: { dz: 1 }, top: { dz: 1 } }, airborne: true },
  ],
};

export const RIG_GRAPA: Rig = rigFromSpec(SPEC_GRAPA);
export const RIG_CLIP: Rig = rigFromSpec(SPEC_CLIP);
export const RIG_TAZA: Rig = rigFromSpec(SPEC_TAZA);

export const BROTATO_RIG_SPECS: Record<string, RigSpec> = { 'bicho-grapa': SPEC_GRAPA, 'bicho-clip': SPEC_CLIP, 'bicho-taza': SPEC_TAZA };
export const BROTATO_RIGS: Record<string, Rig> = { 'bicho-grapa': RIG_GRAPA, 'bicho-clip': RIG_CLIP, 'bicho-taza': RIG_TAZA };
