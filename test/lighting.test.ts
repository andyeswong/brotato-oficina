import { describe, expect, it } from 'vitest';
import { blocked, computeLight, type Region } from '../src/engine/lighting/lightmap';
import { lightIntensity, type Light } from '../src/engine/lighting/lights';
import { applyLayers, buildLayers } from '../src/engine/lighting/shade';

const none = () => false;
const region: Region = { x: 0, y: 0, width: 160, height: 160 };
const dark = { color: [0.2, 0.2, 0.3] as const };
const lamp = (over: Partial<Light> = {}): Light => ({ x: 80, y: 80, radius: 60, color: [1, 1, 1], intensity: 1, ...over });
// Celda del mapa de luz que contiene el punto del mundo (x, y)
const at = (f: ReturnType<typeof computeLight>, x: number, y: number, ch = 0) => f.total[((Math.floor(y / f.cell)) * f.cols + Math.floor(x / f.cell)) * 3 + ch]!;

describe('mapa de luz', () => {
  it('sin luces solo hay ambiente', () => {
    const f = computeLight(region, [], dark, none, 0);
    expect(at(f, 10, 10, 0)).toBeCloseTo(0.2);
    expect(at(f, 100, 50, 2)).toBeCloseTo(0.3);
  });

  it('una luz alumbra más cerca y no llega más allá de su radio', () => {
    const f = computeLight(region, [lamp()], dark, none, 0);
    const near = at(f, 90, 80);
    const mid = at(f, 110, 80);
    const edge = at(f, 138, 80);
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(edge);
    expect(at(f, 150, 80)).toBeCloseTo(0.2);       // fuera del radio: ambiente
  });

  it('una luz más intensa que 1 pasa de 1 y deslumbra solo cerca', () => {
    const f = computeLight(region, [lamp({ intensity: 1.6 })], dark, none, 0);
    expect(at(f, 82, 80)).toBeGreaterThan(1);
    expect(at(f, 125, 80)).toBeLessThan(1);
  });

  it('el color de la luz tiñe: una luz roja sube el canal rojo más que el azul', () => {
    const f = computeLight(region, [lamp({ color: [1, 0.2, 0] })], dark, none, 0);
    expect(at(f, 90, 80, 0) - 0.2).toBeGreaterThan(at(f, 90, 80, 2) - 0.3 + 0.05);
  });

  it('una columna proyecta sombra y sus lados siguen alumbrados', () => {
    const pillar = (tx: number, ty: number) => tx === 6 && ty === 5;    // tile de x 96..112, y 80..96
    const f = computeLight(region, [lamp({ radius: 90 })], dark, pillar, 0);
    expect(at(f, 130, 88)).toBeCloseTo(0.2);                            // justo detrás: a oscuras
    expect(at(f, 130, 112)).toBeCloseTo(0.2);                           // a 33° bajo la horizontal: aún dentro de la sombra (llega hasta 45°)
    expect(at(f, 100, 130)).toBeGreaterThan(0.25);                      // a 68°: fuera de la sombra, alumbrado
    expect(at(f, 130, 56)).toBeGreaterThan(0.25);                       // más arriba, también alumbrado
    const sin = computeLight(region, [lamp({ radius: 90 })], dark, none, 0);
    expect(at(sin, 130, 88)).toBeGreaterThan(0.25);                     // sin columna, ahí sí llega
  });

  it('una luz pegada a un muro lo alumbra, y una pared recibe luz en su cara', () => {
    const wall = (_tx: number, ty: number) => ty === 4;                 // fila de tiles y 64..80, opaca
    const f = computeLight(region, [lamp({ x: 80, y: 70, radius: 40 })], dark, wall, 0);
    expect(at(f, 80, 72)).toBeGreaterThan(0.5);                         // dentro del propio muro, junto a la luz
    expect(at(f, 80, 90)).toBeGreaterThan(0.25);                        // el suelo de abajo
  });

  it('blocked mira solo los tiles de en medio', () => {
    const wall = (tx: number, ty: number) => tx === 3 && ty === 0;
    expect(blocked(8, 8, 120, 8, 16, wall)).toBe(true);
    expect(blocked(8, 8, 40, 8, 16, wall)).toBe(false);                 // llega antes del muro
    expect(blocked(72, 8, 8, 8, 16, wall)).toBe(true);                  // y en sentido contrario
    expect(blocked(56, 8, 8, 8, 16, wall)).toBe(false);                 // salir desde dentro del muro no cuenta: el tile de origen no bloquea
    expect(blocked(8, 8, 8, 8, 16, () => true)).toBe(false);            // mismo tile: nada en medio
    expect(blocked(8, 8, 120, 120, 16, none)).toBe(false);
  });

  it('el parpadeo es determinista y se queda dentro de su amplitud', () => {
    const l = lamp({ intensity: 1, flicker: { amount: 0.3, speed: 8, seed: 5 } });
    const samples = Array.from({ length: 60 }, (_, i) => lightIntensity(l, i * 0.05));
    expect(samples).toEqual(Array.from({ length: 60 }, (_, i) => lightIntensity(l, i * 0.05)));
    for (const s of samples) { expect(s).toBeGreaterThanOrEqual(0.7); expect(s).toBeLessThanOrEqual(1.3); }
    expect(new Set(samples.map((s) => s.toFixed(3))).size).toBeGreaterThan(20);     // de verdad cambia
    expect(lightIntensity(lamp({ intensity: 1.2 }), 3.7)).toBe(1.2);                 // sin parpadeo, constante
    const other = lamp({ flicker: { amount: 0.3, speed: 8, seed: 6 } });
    expect(samples.some((s, i) => s !== lightIntensity(other, i * 0.05))).toBe(true); // otra semilla, otra secuencia
  });

  it('con 8 luces y obstáculos una vista de 384×216 cuesta poco', () => {
    const view: Region = { x: 0, y: 0, width: 384, height: 216 };
    const lights = Array.from({ length: 8 }, (_, i) => lamp({ x: 40 + i * 45, y: 60 + (i % 3) * 50, radius: 90 }));
    const solid = (tx: number, ty: number) => (tx * 7 + ty * 13) % 5 === 0;
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) computeLight(view, lights, dark, solid, i);
    const ms = (performance.now() - t0) / 5;
    console.log(`computeLight 384x216, 8 luces, cell 2: ${ms.toFixed(1)} ms por cuadro`);
    expect(ms).toBeLessThan(120);
  });
});

describe('capas de luz', () => {
  const solid = (c: number) => ({ cell: 2, cols: 4, rows: 4, ambient: [0, 0, 0] as const, total: new Float32Array(4 * 4 * 3).fill(c) });
  const view: Region = { x: 0, y: 0, width: 8, height: 8 };
  const channelValues = (a: Uint8ClampedArray) => new Set(Array.from({ length: a.length / 4 }, (_, i) => a[i * 4]!));

  it('usa como mucho `steps` niveles distintos', () => {
    const f = { cell: 2, cols: 4, rows: 4, ambient: [0, 0, 0] as const, total: Float32Array.from({ length: 48 }, (_, i) => (i % 16) / 15) };
    const layers = buildLayers(f, view, { steps: 4, dither: true });
    expect(channelValues(layers.multiply).size).toBeLessThanOrEqual(4);
  });

  it('un nivel que cae justo entre dos escalones se trama y su media se conserva', () => {
    const layers = buildLayers(solid(0.4), { x: 0, y: 0, width: 8, height: 8 }, { steps: 5, dither: true });
    const values = Array.from({ length: 64 }, (_, i) => layers.multiply[i * 4]!);
    expect(new Set(values).size).toBe(2);                                              // dos niveles vecinos: 0.25 y 0.5
    const mean = values.reduce((a, b) => a + b, 0) / 64 / 255;
    expect(mean).toBeGreaterThan(0.37);
    expect(mean).toBeLessThan(0.43);
  });

  it('donde no llega ninguna luz el ambiente queda exacto y plano, sin tramado', () => {
    const f = computeLight({ x: 0, y: 0, width: 8, height: 8 }, [], { color: [0.3, 0.36, 0.52] }, none, 0);
    const layers = buildLayers(f, { x: 0, y: 0, width: 8, height: 8 }, { steps: 6, dither: true });
    for (let i = 0; i < 64; i++) {
      expect(layers.multiply[i * 4]).toBe(Math.round(0.3 * 255));
      expect(layers.multiply[i * 4 + 1]).toBe(Math.round(0.36 * 255));
      expect(layers.multiply[i * 4 + 2]).toBe(Math.round(0.52 * 255));
      expect(layers.add[i * 4]).toBe(0);
    }
  });

  it('con ambiente, el tramado solo toca lo que aportan las luces', () => {
    const f = { cell: 2, cols: 4, rows: 4, ambient: [0.3, 0.3, 0.3] as const, total: new Float32Array(48).fill(0.58) };   // aporte normalizado 0.4: entre los escalones 1 y 2 (de 4)
    const layers = buildLayers(f, view, { steps: 5, dither: true });
    const values = new Set(Array.from({ length: 64 }, (_, i) => layers.multiply[i * 4]!));
    expect(values.size).toBe(2);                                          // alterna entre dos niveles vecinos
    expect(Math.min(...values)).toBeGreaterThanOrEqual(Math.round(0.3 * 255));
  });

  it('sin tramado cada nivel es plano', () => {
    const layers = buildLayers(solid(0.4), view, { steps: 5, dither: false });
    expect(channelValues(layers.multiply).size).toBe(1);
  });

  it('es determinista', () => {
    const f = solid(0.37);
    expect(buildLayers(f, view)).toEqual(buildLayers(f, view));
  });

  it('el brillo (ADD) solo aparece donde la luz pasa de 1', () => {
    const layers = buildLayers(solid(0.8), view, { glow: 1, steps: 5, dither: false });
    expect(Math.max(...channelValues(layers.add))).toBe(0);
    const bright = buildLayers(solid(1.8), view, { glow: 1, steps: 5, dither: false });
    expect(Math.min(...channelValues(bright.add))).toBeGreaterThan(150);
  });

  it('applyLayers hace escena × multiply + add', () => {
    const layers = { width: 1, height: 1, multiply: Uint8ClampedArray.from([128, 255, 0, 255]), add: Uint8ClampedArray.from([0, 0, 40, 255]) };
    const out = applyLayers(Uint8ClampedArray.from([200, 100, 200, 255]), layers);
    expect(Array.from(out)).toEqual([100, 100, 40, 255]);
  });
});

// La simulación (sim/) es determinista y no sabe de dibujo: lights.ts y lightmap.ts no pueden depender
// de la vista ni usar azar sin semilla o el reloj. El parpadeo es una función del tiempo que se le da.
describe('lighting: la parte pura no depende de la vista', () => {
  const sources = import.meta.glob('../src/engine/lighting/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const file = (name: string) => Object.entries(sources).find(([k]) => k.endsWith(`/${name}`))?.[1] ?? '';
  const importsOf = (src: string) => [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
  for (const name of ['lights.ts', 'lightmap.ts', 'index.ts']) {
    it(`${name} solo importa de la parte pura`, () => {
      expect(file(name)).not.toBe('');
      for (const imp of importsOf(file(name))) expect(['./lights', './lightmap'], `${name} importa ${imp}`).toContain(imp);
    });
  }
  it('ningún archivo usa azar sin semilla ni el reloj', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(4);
    for (const [k, src] of Object.entries(sources)) expect(src, k).not.toMatch(/Math\.random|Date\.now|performance\.now/);
  });
});
