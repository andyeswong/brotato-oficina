// Girar la cámara del juego en cuartos de vuelta, sobre la vista girada de VoxPix (WorldView, NARUTO). La simulación no
// se entera: la partida sigue en ejes del mundo y solo la vista, la entrada y los efectos pasan por la cámara girada.
//   - inputToWorld: la dirección pulsada en pantalla ("arriba" = lejos de la cámara) a la dirección del mundo.
//   - viewProjector: proyectar un punto del mundo (efectos, cámara) en la imagen horneada de un giro.
//   - dressWalls: las paredes según el lado de la cámara. Son CONTENIDO del juego, no del motor: el nivel del Brotato
//     se construyó para mirar desde el sur (la pared norte alta y con fachada, las de los lados bajas, la sur más baja
//     aún). Girado, la de delante taparía la arena; aquí se rebaja en la copia girada de la vista, nunca en el mundo.
//   - wallDress: ese vestido como gancho de la vista (ViewDress de VoxPix): el motor lo llama al copiar la vista y otra
//     vez cuando vuelve a copiar trozos que cambiaron, así la pared rebajada no vuelve a salir alta.
// Los giros que faltan se preparan en segundo plano con prepareViewJob (por pasos, con el presupuesto por cuadro).
import { TILE, WALL, type Layout } from '@voxpix/worldgen';
import type { ViewCamera, ViewDress, WorldView, Quarter } from '@voxpix/world/view';
import type { Projector } from './fx';

export const QUARTERS: readonly Quarter[] = [0, 1, 2, 3];
// Presupuesto por cuadro del segundo plano de los giros: en la oleada, los 3 ms de siempre (compartidos con el
// rehorneado, que va antes); sin juego (respiro, tienda, fin), 8 ms. Medido en el Flip: a 3 ms los 3 giros tardaban
// 34 s en quedar listos (NARUTO lo propuso igual)
export const BG_WAVE_MS = 3;
export const BG_IDLE_MS = 8;
// Cuadros seguidos sin presupuesto en la oleada antes de dar igualmente un paso mínimo (como FrameBudget)
export const BG_STARVE_FRAMES = 4;
// Las alturas de build.ts para la pared de delante (la sur) y las de los lados
export const NEAR_WALL_H = 6;
export const SIDE_WALL_H = 12;

export function turnQuarter(q: Quarter, step: 1 | -1): Quarter {
  return (((q + step) % 4) + 4) % 4 as Quarter;
}

export interface BgJob { run(deadline: number): boolean }

// Los trabajos de segundo plano de los giros, en orden, con su propio presupuesto según la fase. spentMs: lo que ya
// gastó este cuadro el rehorneado (en la oleada cuenta contra los mismos 3 ms). Devuelve los que siguen sin acabar.
export class TurnBackground {
  private starved = 0;
  constructor(private readonly now: () => number = () => performance.now()) {}

  run(jobs: BgJob[], playing: boolean, spentMs: number): BgJob[] {
    if (!jobs.length) return jobs;
    const start = this.now();
    let deadline = start + (playing ? BG_WAVE_MS - spentMs : BG_IDLE_MS);
    if (deadline <= start) {
      if (++this.starved < BG_STARVE_FRAMES) return jobs;
      deadline = start;          // un paso mínimo: el primero hace una unidad y para
    }
    this.starved = 0;
    // En orden: el primero siempre avanza (aunque sea un paso); el siguiente empieza solo si el anterior acabó y queda
    // tiempo; el que no acaba corta la ronda
    for (let i = 0; i < jobs.length; i++) {
      if (i > 0 && this.now() >= deadline) return jobs.slice(i);
      if (!jobs[i]!.run(deadline)) return jobs.slice(i);
    }
    return [];
  }
}

export function inputToWorld(cam: ViewCamera, dx: number, dy: number): [number, number] {
  return dx === 0 && dy === 0 ? [0, 0] : cam.dirToWorld(dx, dy);
}

export function viewProjector(cam: ViewCamera, baked: Projector): Projector {
  return { project: (x, y, z) => { const [vx, vy] = cam.pointToView(x, y); return baked.project(vx, vy, z); } };
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

// Rebaja en la vista girada las paredes de delante y de los lados, y esconde (view.hideLight) las luces que colgaban de
// lo rebajado (la fachada norte, cuando queda delante): sin pared, flotarían. Devuelve sus ids. Con el giro 0 no hace
// nada: desde el sur las paredes ya están como deben, y sin vestido la vista es el mundo de la simulación (sin copia).
export function dressWalls(view: WorldView, layout: Layout): Set<string | number> {
  const dropped = new Set<string | number>();
  if (view.quarter === 0 || view.static === view.state.solid) return dropped;
  const st = view.state, depth = st.solid.depth, cam = view.camera, s = view.static;
  const sides = wallSides(layout, cam, depth);
  const capOf = new Map<number, number>();
  for (const [i, side] of sides) if (side !== 'far') capOf.set(i, side === 'near' ? NEAR_WALL_H : SIDE_WALL_H);
  for (const [i, cap] of capOf) {
    const cx = i % layout.cols, cy = Math.floor(i / layout.cols);
    for (let ty = 0; ty < TILE; ty++) for (let tx = 0; tx < TILE; tx++) {
      const [vx, vy] = cam.cellToView(cx * TILE + tx, depth - 1 - (cy * TILE + ty));
      // Solo de la altura tope a la cima de la columna (la rejilla de alturas): las paredes que ya miden eso, como las de
      // los lados, no se recorren. De abajo arriba, así set() solo reajusta la altura al vaciar la de arriba del todo
      const top = s.height[vy * s.width + vx]!;
      for (let z = Math.max(cap, s.zMin); z < top; z++) if (s.get(vx, vy, z)) s.set(vx, vy, z, 0);
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
  view.hideLight = dropped.size ? (l) => dropped.has(l.id) : null;
  return dropped;
}

// El vestido como gancho de la vista. Se viste entero cada vez (también cuando el motor vuelve a copiar trozos que
// cambiaron): son pocos miles de columnas de pared y en el Brotato el mundo casi no cambia
export function wallDress(layout: Layout): ViewDress {
  return (view) => { dressWalls(view, layout); };
}
