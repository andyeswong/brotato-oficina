import type { LightField, Region } from '../lighting';
import { buildLayers, type ShadeOptions } from '../lighting/shade';

// Sombrea solo las filas [y0, y1) de un recuadro de luz. y0 tiene que ser múltiplo de 4: así la trama (4×4) y
// las celdas del mapa de luz caen igual que al sombrear el recuadro entero, y las bandas juntas son idénticas a él
// (lo comprueba test/lightBands.test.ts). Sirve para repartir un repintado caro entre varios cuadros.
export function shadeBand(
  field: LightField, region: Region, y0: number, y1: number, shade?: Partial<ShadeOptions>,
): { multiply: Uint8ClampedArray; add: Uint8ClampedArray } {
  if (y0 % 4 !== 0 || y0 % field.cell !== 0) throw new Error(`la banda tiene que empezar en una fila múltiplo de 4 (empieza en ${y0})`);
  const c0 = y0 / field.cell;
  const c1 = Math.min(field.rows, Math.ceil(y1 / field.cell));
  return buildLayers(
    { ...field, rows: c1 - c0, total: field.total.subarray(c0 * field.cols * 3, c1 * field.cols * 3) },
    { x: region.x, y: region.y + y0, width: region.width, height: y1 - y0 },
    shade,
  );
}
