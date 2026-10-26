// La entrada a la tienda en los temas sin fuente (Andrés, 2026-10-25): un adorno del mapa (models/brotato/tienda) que
// se estampa en el mundo antes de crear su estado, en el sitio de shopSpot. Así es sólido como un mueble (bloquea el
// paso y los disparos) y se hornea con el escenario, y el resalte de VoxPix lo rodea igual que a la fuente.
// Sus rampas se añaden a la paleta del mundo (como las de la vegetación), con su luz propia.
import { Model, type ModelFile } from '@voxpix/core';
import type { World } from '@voxpix/world/build';
import type { ThemeId } from '../registry/schemas';
import impresora from '../../../../models/brotato/tienda/impresora.json';
import servidor from '../../../../models/brotato/tienda/servidor.json';

const PROPS: Partial<Record<ThemeId, ModelFile>> = { oficina: impresora as ModelFile, cyberpunk: servidor as ModelFile };
export const SHOP_PROP_THEMES = new Set(Object.keys(PROPS) as ThemeId[]);

// Lo estampa con su centro en (x, y) del modelo del mundo, de pie sobre el suelo de ese punto. Devuelve la caja que
// ocupa [x0, y0, z0, x1, y1, z1] en celdas del mundo (la del resalte empieza en z = 1, por encima del suelo)
export function stampShopProp(world: World, theme: ThemeId, at: { x: number; y: number }): [number, number, number, number, number, number] | null {
  const file = PROPS[theme];
  if (!file) return null;
  const prop = Model.fromJSON(file);
  const b = prop.bounds()!;
  const m = world.model;
  const base = m.palette.ramps.length;
  m.palette = { ...m.palette, ramps: [...m.palette.ramps, ...prop.palette.ramps.map((r) => structuredClone(r))] };
  const ox = Math.round(at.x - (b.minX + b.maxX + 1) / 2), oy = Math.round(at.y - (b.minY + b.maxY + 1) / 2);
  // El suelo: lo más alto que haya en el centro, por debajo de lo que pueda ser un mueble
  let floor = 0;
  for (let z = 0; z < 8; z++) if (m.get(Math.round(at.x), Math.round(at.y), z)) floor = z + 1;
  const oz = floor - b.minZ;
  for (const [x, y, z, v] of prop.entries()) {
    const ramp = Math.floor((v - 1) / 16), tone = (v - 1) % 16;
    m.set(x + ox, y + oy, z + oz, (base + ramp) * 16 + tone + 1);
  }
  return [b.minX + ox, b.minY + oy, floor, b.maxX + ox, b.maxY + oy, b.maxZ + oz];
}
