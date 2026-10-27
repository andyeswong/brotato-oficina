// La caída del piso nuevo (Andrés: "cada ronda me abra la puerta a un nuevo piso"): al llegar, lo que hay sobre el suelo
// cae desde el cielo y se monta (VoxPix VoxelFall.rebuild, commit 'end'). Las piezas en el aire son entidades, y con
// 'end' las que llegan siguen siéndolo hasta que llega la última: todas a la vez en el atlas de sprites del compositor
// (MAX_SPRITE_LAYERS = 1024, compartido con enemigos, armas y lo precalentado). Medido en el Flip 6 (2026-10-27):
// con 678 piezas el cuadro va bien, con 1077 se llena el atlas y cada cuadro tarda 350 ms. De ahí el tope.

// Tope de piezas: la mitad del atlas, la otra mitad para lo que la partida tiene a la vista
export const FALL_MAX_PIECES = 512;
// Tallas de pieza (lado en vóxeles), de la preferida a la más gruesa. 16 es la medida en el Flip
export const FALL_PIECES = [16, 20, 24] as const;

// La talla para la caída: la primera de FALL_PIECES con count(talla) <= max. Si ni la más gruesa baja del tope, null:
// no hay animación y el piso se monta de golpe (detrás del letrero), antes que llenar el atlas
export function fallPiece(count: (piece: number) => number, max = FALL_MAX_PIECES): number | null {
  for (const n of FALL_PIECES) if (count(n) <= max) return n;
  return null;
}

export interface SolidRead { get(x: number, y: number, z: number): number }
export interface Box3 { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

// Cuántas piezas de lado n salen de la caja (las que tienen algún vóxel), como las corta VoxelFall: desde la esquina
// baja, en cubos de n. Para en cuanto pasa de stop
export function countPieces(solid: SolidRead, box: Box3, n: number, stop = Infinity): number {
  let count = 0;
  for (let pz = box.z0; pz <= box.z1; pz += n) for (let py = box.y0; py <= box.y1; py += n) for (let px = box.x0; px <= box.x1; px += n) {
    let any = false;
    for (let z = pz; z < pz + n && z <= box.z1 && !any; z++) for (let y = py; y < py + n && y <= box.y1 && !any; y++)
      for (let x = px; x < px + n && x <= box.x1; x++) if (solid.get(x, y, z)) { any = true; break; }
    if (any && ++count > stop) return count;
  }
  return count;
}
