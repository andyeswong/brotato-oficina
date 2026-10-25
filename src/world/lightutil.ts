// Una luz del mundo resuelta: el preset de su tipo con sus ajustes, y su intensidad con parpadeo en un instante.
// La usan todos (horneado, entidades, agua, modo vóxel), así la misma luz se ve igual en todas partes.
import { SOURCE_PRESETS, lightIntensity, lightOf } from '../lighting';
import type { WorldLight } from './build';

export interface ResolvedLight {
  x: number; y: number; z: number;
  radius: number;
  color: readonly [number, number, number];
  intensity: number;           // con el parpadeo de ese instante
  base: number;                // sin parpadeo
}

export function resolveLight(l: WorldLight, time: number): ResolvedLight {
  const p = SOURCE_PRESETS[l.kind];
  const base = l.intensity ?? p.intensity;
  // El parpadeo sale de la semilla del id (como en el juego) y escala la intensidad propia de esta luz
  const flick = lightIntensity(lightOf({ id: String(l.id), kind: l.kind, x: 0, y: 0 }), time) / p.intensity;
  return { x: l.x, y: l.y, z: l.z, radius: l.radius ?? p.radius, color: l.color ?? p.color, intensity: base * flick, base };
}
