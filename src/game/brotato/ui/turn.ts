// Girar la cámara del juego en cuartos de vuelta, sobre la vista girada de VoxPix (WorldView, NARUTO). La simulación no
// se entera: la partida sigue en ejes del mundo y solo la vista, la entrada y los efectos pasan por la cámara girada.
//   - inputToWorld: la dirección pulsada en pantalla ("arriba" = lejos de la cámara) a la dirección del mundo.
//   - viewProjector: proyectar un punto del mundo (efectos, cámara) en la imagen horneada de un giro.
//   - dressWalls: las paredes según el lado de la cámara. Son CONTENIDO del juego, no del motor: el nivel del Brotato
//     se construyó para mirar desde el sur (la pared norte alta y con fachada, las de los lados bajas, la sur más baja
//     aún). Girado, la de delante taparía la arena; aquí se rebaja en la copia girada de la vista, nunca en el mundo.
//   - bakeInBackground: cuándo se hornean los giros que faltan. En los momentos sin juego (el respiro tras una oleada y
//     la tienda), nunca en mitad de una oleada: un horneado son ~0,7-0,85 s en el Flip y rompería la puerta de los
//     16,8 ms (MAIA).
import { TILE, WALL, type Layout } from '@voxpix/worldgen';
import type { ViewCamera, WorldView, Quarter } from '@voxpix/world/view';
import type { Phase } from '../play';
import type { Projector } from './fx';

export const QUARTERS: readonly Quarter[] = [0, 1, 2, 3];
// Las alturas de build.ts para la pared de delante (la sur) y las de los lados
export const NEAR_WALL_H = 6;
export const SIDE_WALL_H = 12;
// En el respiro, cuántos ticks se deja ver "oleada superada" antes de hornear (el cuadro de horneado se queda quieto)
export const CLEARED_SETTLE_TICKS = 12;

export function turnQuarter(q: Quarter, step: 1 | -1): Quarter {
  return (((q + step) % 4) + 4) % 4 as Quarter;
}

export function inputToWorld(cam: ViewCamera, dx: number, dy: number): [number, number] {
  return dx === 0 && dy === 0 ? [0, 0] : cam.dirToWorld(dx, dy);
}

export function viewProjector(cam: ViewCamera, baked: Projector): Projector {
  return { project: (x, y, z) => { const [vx, vy] = cam.pointToView(x, y); return baked.project(vx, vy, z); } };
}

// ¿Se puede hornear ahora un giro que falta? Solo sin juego: el respiro (ya pintado) y la tienda
export function bakeInBackground(phase: Phase, phaseTick: number): boolean {
  return phase === 'shop' || (phase === 'cleared' && phaseTick >= CLEARED_SETTLE_TICKS);
}

// Las celdas de pared del nivel según el lado de la cámara: delante (entre la cámara y el suelo), a un lado o al fondo.
// La celda (cx, cy) del nivel tiene la fila 0 al norte; en el mundo, y crece hacia el norte.
export function wallSides(layout: Layout, cam: ViewCamera, depth: number): Map<number, 'near' | 'side' | 'far'> {
  const center = (cx: number, cy: number) => cam.cellToView(cx * TILE + TILE / 2, depth - 1 - (cy * TILE + TILE / 2));
  let fx0 = Infinity, fx1 = -Infinity, fy0 = Infinity, fy1 = -Infinity;
  for (let cy = 0; cy < layout.rows; cy++) for (let cx = 0; cx < layout.cols; cx++) {
    if (layout.wall[cy * layout.cols + cx] !== WALL.none) continue;
    const [vx, vy] = center(cx, cy);
    fx0 = Math.min(fx0, vx); fx1 = Math.max(fx1, vx); fy0 = Math.min(fy0, vy); fy1 = Math.max(fy1, vy);
  }
  const out = new Map<number, 'near' | 'side' | 'far'>();
  for (let cy = 0; cy < layout.rows; cy++) for (let cx = 0; cx < layout.cols; cx++) {
    const i = cy * layout.cols + cx;
    if (layout.wall[i] === WALL.none) continue;
    const [vx, vy] = center(cx, cy);
    out.set(i, vy < fy0 ? 'near' : vx < fx0 || vx > fx1 ? 'side' : 'far');
  }
  return out;
}

// Rebaja en la vista girada las paredes de delante y de los lados, y devuelve los ids de las luces que colgaban de lo
// rebajado (la fachada norte, cuando queda delante): sin pared, flotarían. Con el giro 0 no hace nada (la vista es el
// mundo de verdad, sin copia).
export function dressWalls(view: WorldView, layout: Layout): Set<string | number> {
  const dropped = new Set<string | number>();
  if (view.quarter === 0) return dropped;
  const st = view.state, depth = st.solid.depth, cam = view.camera, s = view.static;
  const sides = wallSides(layout, cam, depth);
  const capOf = new Map<number, number>();
  for (const [i, side] of sides) if (side !== 'far') capOf.set(i, side === 'near' ? NEAR_WALL_H : SIDE_WALL_H);
  for (const [i, cap] of capOf) {
    const cx = i % layout.cols, cy = Math.floor(i / layout.cols);
    for (let ty = 0; ty < TILE; ty++) for (let tx = 0; tx < TILE; tx++) {
      const [vx, vy] = cam.cellToView(cx * TILE + tx, depth - 1 - (cy * TILE + ty));
      for (let z = Math.max(cap, s.zMin); z <= s.zMax; z++) if (s.get(vx, vy, z)) s.set(vx, vy, z, 0);
    }
  }
  // Las luces de la fachada (worldgen las llama facade-<n>) cuelgan delante de la pared, en la primera fila de suelo:
  // se quitan si la fachada de su columna se rebajó por debajo de ellas. Las demás, si están dentro de una pared rebajada
  const facadeCap = (cx: number): number | undefined => {
    for (let cy = 0; cy < layout.rows; cy++) {
      const i = cy * layout.cols + cx, w = layout.wall[i];
      if ((w === WALL.facadeTop || w === WALL.facadeBottom) && capOf.has(i)) return capOf.get(i);
    }
    return undefined;
  };
  for (const l of st.lights) {
    const cx = Math.floor(l.x / TILE), cy = Math.floor((depth - 1 - l.y) / TILE);
    if (cx < 0 || cy < 0 || cx >= layout.cols || cy >= layout.rows) continue;
    const cap = String(l.id).startsWith('facade-') ? facadeCap(cx) : capOf.get(cy * layout.cols + cx);
    if (cap !== undefined && l.z >= cap) dropped.add(l.id);
  }
  return dropped;
}
