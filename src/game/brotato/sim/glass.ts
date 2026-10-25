// El vidrio (decisión de Andrés, 2026-10-25): en oficina y cyberpunk, las ventanas de la fachada y las pantallas de los
// muebles pasan al material «vidrio» de VoxPix, que deja pasar la luz (horneada y dinámica). Para el paso, los disparos
// y el agua es igual que lo sólido, y esas piezas ya eran sólidas: la partida no cambia, solo cómo pasa la luz.
// Se ve como un bloque de su color, no a través (así lo eligió Andrés).
import type { World } from '@voxpix/world/build';
import type { ThemeId } from '../registry/schemas';

export const GLASS_THEMES: ReadonlySet<ThemeId> = new Set(['oficina', 'cyberpunk']);
export const GLASS_RAMPS: readonly string[] = ['ventana cálida', 'ventana oscura', 'pantalla'];

// Cambia el material de esas rampas en una paleta NUEVA (el motor compara la paleta por identidad). Devuelve cuántas
export function addGlass(world: World): number {
  const m = world.model;
  let n = 0;
  m.palette = { ...m.palette, ramps: m.palette.ramps.map((r) => (GLASS_RAMPS.includes(r.name) ? (n++, { ...r, material: 'vidrio' }) : r)) };
  return n;
}
