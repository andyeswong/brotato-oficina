// mulberry32: rápido, con semilla y reproducible. La misma semilla da la misma partida. Lleva su estado a la vista
// (state) para la huella de la partida: con la semilla escondida en un cierre no se podría comprobar.
export interface Rng {
  (): number;
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Object.defineProperty(next, 'state', { get: () => a }) as Rng;
}
