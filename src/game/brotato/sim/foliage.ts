// La vegetación de la arena (decisión de Andrés, 2026-10-25): solo en el tema medieval. Hierba alta y flores sobre las
// manchas de hierba del suelo, juncos en la orilla y nenúfares en el agua, con planFoliage de VoxPix (el agua de
// partida la da worldWaterDepth, que funciona dentro de decorate, antes de que exista el WaterLayer). Todo se atraviesa (groundAt,
// solidAt y raycast no la ven): es solo aspecto, así que la colisión, los disparos y la curva F1 no cambian.
// Los arbustos de VoxPix (blocks) NO van aquí: bloquean el paso y los disparos, y cambiarían la partida (dónde aparecen
// los enemigos, los caminos, el balance). Si se quieren, van aparte con su curva.
import { planFoliage, FOLIAGE_RAMPS } from '@voxpix/core';
import { worldWaterDepth, type World } from '@voxpix/world/build';
import type { ThemeId } from '../registry/schemas';

export const FOLIAGE_THEMES: ReadonlySet<ThemeId> = new Set(['medieval']);
const RAMPS = ['hierba-alta', 'flor-roja', 'flor-amarilla', 'flor-blanca', 'junco', 'nenufar'] as const;

// Añade la vegetación al mundo recién construido (antes de crear el agua y el estado: decorate de buildWorldState)
export function addFoliage(world: World, seed: number): Record<string, number> {
  const m = world.model;
  const base = m.palette;
  // La paleta tiene que ser un objeto NUEVO (NARUTO): el motor la compara por identidad
  m.palette = { ...base, ramps: [...base.ramps, ...RAMPS.map((n) => structuredClone(FOLIAGE_RAMPS[n]!))] };
  const idx = (name: string) => m.palette.ramps.findIndex((r) => r.name === name);
  const area = [0, 0, world.width - 1, world.depth - 1] as const;
  const s = (salt: number) => (Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0;
  const water = worldWaterDepth(world);
  const plans = {
    grass: planFoliage(m, ...area, m.zMax, { type: 'grass', ramp: idx('hierba-alta'), seed: s(11), zMin: m.zMin }),
    flowers: planFoliage(m, ...area, m.zMax, { type: 'flowers', ramp: idx('hierba-alta'), heads: [idx('flor-roja'), idx('flor-amarilla'), idx('flor-blanca')], seed: s(12), zMin: m.zMin }),
    reeds: planFoliage(m, ...area, m.zMax, { type: 'reeds', ramp: idx('junco'), seed: s(13), zMin: m.zMin, waterDepth: water }),
    lilies: planFoliage(m, ...area, m.zMax, { type: 'lilies', ramp: idx('nenufar'), seed: s(14), zMin: m.zMin, waterDepth: water }),
  };
  // Las plantas de cada tipo (para las pruebas)
  const plants: Record<string, number> = {};
  for (const [k, p] of Object.entries(plans)) { plants[k] = p.plants; for (const [x, y, z, v] of p.voxels) m.set(x, y, z, v); }
  return plants;
}
