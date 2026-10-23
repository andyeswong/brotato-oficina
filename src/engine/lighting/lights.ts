// PARTE PURA (sim/ puede usarla): luces como datos. Sin Phaser, sin canvas, sin azar sin semilla.

// Una luz de punto. Las coordenadas son del mundo, en píxeles del juego.
export interface Light {
  x: number;
  y: number;
  radius: number;                           // a esta distancia ya no alumbra
  color: readonly [number, number, number]; // 0..1 por canal
  intensity: number;                        // 1 = alumbra al máximo; por encima, deslumbra (capa ADD)
  flicker?: { amount: number; speed: number; seed: number };  // amount 0..1, speed en cambios por segundo
}

// Lo que se ve donde no llega ninguna luz: un multiplicador por canal (0..1)
export interface Ambient {
  color: readonly [number, number, number];
}

// Ruido de valor determinista: la misma semilla y el mismo instante dan siempre lo mismo
function hash01(seed: number, n: number): number {
  let h = (Math.imul(n | 0, 374761393) + Math.imul(seed | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Intensidad de una luz en el instante `time` (segundos), con su parpadeo
export function lightIntensity(light: Light, time: number): number {
  const f = light.flicker;
  if (!f || f.amount === 0) return light.intensity;
  const t = time * f.speed;
  const i = Math.floor(t);
  const k = t - i;
  const s = k * k * (3 - 2 * k);                       // suavizado entre dos valores
  const n = hash01(f.seed, i) * (1 - s) + hash01(f.seed, i + 1) * s;
  return light.intensity * (1 + f.amount * (n * 2 - 1));
}
