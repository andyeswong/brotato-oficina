import type { Light, LightField, Occluder, Region } from '../lighting';
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

// El recuadro donde un cuerpo puede dar sombra: para cada luz que lo alcanza, el cono que va de la luz al
// recuadro del cuerpo, desde el cuerpo hasta el radio de la luz. Fuera de él, la luz con y sin el cuerpo es
// la misma (lo comprueba test/lightBands.test.ts). Sin ninguna luz que lo alcance, null.
export function shadowBox(lights: readonly Light[], body: Occluder): Region | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => [body.x + sx! * body.rx, body.y + sy! * body.ry] as const);
  for (const l of lights) {
    const toBody = Math.hypot(body.x - l.x, body.y - l.y);
    if (l.radius <= 0 || toBody - Math.hypot(body.rx, body.ry) >= l.radius) continue;
    // Luz pegada al cuerpo: el cono se abre demasiado, vale todo su círculo
    if (Math.abs(l.x - body.x) <= body.rx && Math.abs(l.y - body.y) <= body.ry) {
      take(l.x - l.radius, l.y - l.radius); take(l.x + l.radius, l.y + l.radius);
      continue;
    }
    const mid = Math.atan2(body.y - l.y, body.x - l.x);
    let lo = 0, hi = 0;
    for (const [cx, cy] of corners) {
      let a = Math.atan2(cy - l.y, cx - l.x) - mid;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      lo = Math.min(lo, a); hi = Math.max(hi, a);
      take(cx, cy);
    }
    // El arco del final del cono, con puntos cada 10°: entre dos, el arco sobresale menos de un 0,4 % del radio
    const steps = Math.max(1, Math.ceil((hi - lo) / (Math.PI / 18)));
    for (let i = 0; i <= steps; i++) {
      const a = mid + lo + ((hi - lo) * i) / steps;
      take(l.x + Math.cos(a) * l.radius, l.y + Math.sin(a) * l.radius);
    }
  }
  if (x1 < x0) return null;
  const pad = 2 + 0.004 * Math.max(...lights.map((l) => l.radius), 0);
  return { x: x0 - pad, y: y0 - pad, width: x1 - x0 + 2 * pad, height: y1 - y0 + 2 * pad };
}
