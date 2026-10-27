// La vegetación de la arena (decisión de Andrés, 2026-10-25): solo en el tema medieval. Hierba alta y flores sobre las
// manchas de hierba del suelo, juncos en la orilla y nenúfares en el agua, con planFoliage de VoxPix (el agua de
// partida la da worldWaterDepth, que funciona dentro de decorate, antes de que exista el WaterLayer). Los nenúfares no
// son vóxeles sino flotantes (world.floaters): los mueve el agua y los apartan los pisotones. VoxPix garantiza que no
// bloquean, no gastan el azar del mundo y llevan ids propios (flota-N): la partida es la misma con y sin ellos. Todo se atraviesa (groundAt,
// solidAt y raycast no la ven): es solo aspecto, así que la colisión, los disparos y la curva F1 no cambian.
// Arbustos (decisión de Andrés): estos SÍ bloquean el paso y los disparos (material arbusto; la luz los atraviesa), así
// que cambian la partida. Se siembran fuera de un cuadrado despejado alrededor de la salida, y la arena quita los puntos
// de aparición que caen sobre uno (arena.ts). La curva F1 de medieval se midió con ellos.
import { planFoliage, lilyPadModels, FOLIAGE_RAMPS, type FoliagePlan } from '@voxpix/core';
import { worldWaterDepth, type World } from '@voxpix/world/build';
import type { ThemeId } from '../registry/schemas';

export const FOLIAGE_THEMES: ReadonlySet<ThemeId> = new Set(['medieval']);
const RAMPS = ['hierba-alta', 'flor-roja', 'flor-amarilla', 'flor-blanca', 'junco', 'nenufar', 'arbusto'] as const;
export const BUSH_DENSITY = 0.004;      // la de la demo de VoxPix (la de serie es 0,005)
export const START_CLEAR = 32;          // medio lado del cuadrado sin arbustos alrededor de la salida, en vóxeles

// Añade la vegetación al mundo recién construido (antes de crear el agua y el estado: decorate de buildWorldState)
// start: dónde sale la jugadora (ejes del modelo); bushes: false los deja fuera (para las pruebas que comparan)
export function addFoliage(world: World, seed: number, start: { x: number; y: number }, opts: { bushes?: boolean } = {}): Record<string, number> {
  const m = world.model;
  const base = m.palette;
  // La paleta tiene que ser un objeto NUEVO (NARUTO): el motor la compara por identidad
  m.palette = { ...base, ramps: [...base.ramps, ...RAMPS.map((n) => structuredClone(FOLIAGE_RAMPS[n]!))] };
  const idx = (name: string) => m.palette.ramps.findIndex((r) => r.name === name);
  const area = [0, 0, world.width - 1, world.depth - 1] as const;
  const s = (salt: number) => (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  const water = worldWaterDepth(world);
  const plans: Record<string, FoliagePlan> = {
    grass: planFoliage(m, ...area, m.zMax, { type: 'grass', ramp: idx('hierba-alta'), seed: s(11), zMin: m.zMin }),
    flowers: planFoliage(m, ...area, m.zMax, { type: 'flowers', ramp: idx('hierba-alta'), heads: [idx('flor-roja'), idx('flor-amarilla'), idx('flor-blanca')], seed: s(12), zMin: m.zMin }),
    reeds: planFoliage(m, ...area, m.zMax, { type: 'reeds', ramp: idx('junco'), seed: s(13), zMin: m.zMin, waterDepth: water }),
    lilies: planFoliage(m, ...area, m.zMax, { type: 'lilies', ramp: idx('nenufar'), seed: s(14), zMin: m.zMin, waterDepth: water }),
  };
  // Los arbustos, en los cuatro rectángulos que rodean el cuadrado despejado de la salida (no se parte ninguna planta)
  if (opts.bushes !== false) {
    const [W, D] = [world.width - 1, world.depth - 1];
    const cx0 = Math.max(0, Math.floor(start.x - START_CLEAR)), cx1 = Math.min(W, Math.ceil(start.x + START_CLEAR));
    const cy0 = Math.max(0, Math.floor(start.y - START_CLEAR)), cy1 = Math.min(D, Math.ceil(start.y + START_CLEAR));
    const rects: Array<[number, number, number, number]> = [[0, 0, W, cy0 - 1], [0, cy1 + 1, W, D], [0, cy0, cx0 - 1, cy1], [cx1 + 1, cy0, W, cy1]];
    const bush: FoliagePlan = { voxels: [], plants: 0, floats: [] };
    rects.filter(([x0, y0, x1, y1]) => x1 >= x0 && y1 >= y0).forEach((r, k) => {
      const p = planFoliage(m, ...r, m.zMax, { type: 'bush', ramp: idx('arbusto'), seed: s(20 + k), zMin: m.zMin, density: BUSH_DENSITY });
      bush.voxels.push(...p.voxels); bush.plants += p.plants;
    });
    plans.bushes = bush;
  }
  // Las plantas de cada tipo (para las pruebas)
  const plants: Record<string, number> = {};
  // Solo lo que cae dentro del mundo: con una salida de piso abierta al este o al oeste hay suelo en la columna del
  // borde, y la hierba de ahí se salía un vóxel (planFoliage no recorta al mundo)
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < world.width && y < world.depth;
  for (const [k, p] of Object.entries(plans)) { plants[k] = p.plants; for (const [x, y, z, v] of p.voxels) if (inside(x, y)) m.set(x, y, z, v); }
  // Los nenúfares, como flotantes: su forma y un giro que sale de la posición (sin azar)
  const pads = lilyPadModels(FOLIAGE_RAMPS['nenufar']!);
  world.floaters = plans.lilies!.floats.map(([x, y, k]) => ({ x, y, model: pads[k]!, yaw: ((Math.floor(x) * 7 + Math.floor(y) * 13) % 8) * 45 }));
  return plants;
}
