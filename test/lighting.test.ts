import { describe, expect, it } from 'vitest';
import { blocked, computeLight, shadowedBy, type Region } from '../src/engine/lighting/lightmap';
import { lightIntensity, lightOf, lightsOf, maxSafeIntensity, SOURCE_PRESETS, type Light, type LightSource, type SourceKind } from '../src/engine/lighting/lights';
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

  it('un cuerpo que se mueve (el personaje) también da sombra, pero no a sí mismo ni a la luz que lleva', () => {
    const body = { x: 100, y: 80, rx: 5, ry: 7 };
    const con = computeLight(region, [lamp({ x: 60, y: 80, radius: 90 })], dark, none, 0, { occluders: [body] });
    const sin = computeLight(region, [lamp({ x: 60, y: 80, radius: 90 })], dark, none, 0);
    expect(at(con, 120, 80)).toBeCloseTo(0.2);                          // justo detrás del cuerpo: a oscuras
    expect(at(sin, 120, 80)).toBeGreaterThan(0.25);                     // sin cuerpo, llega
    expect(at(con, 120, 112)).toBeGreaterThan(0.2);                     // a un lado, fuera del cono: alumbrado
    expect(at(con, 80, 80)).toBeCloseTo(at(sin, 80, 80));               // delante del cuerpo, igual
    expect(at(con, 100, 80)).toBeCloseTo(at(sin, 100, 80));             // el propio cuerpo recibe luz
    // el farol que lleva el personaje, dentro de su cuerpo, alumbra a todos lados
    const farol = computeLight(region, [lamp({ x: 101, y: 78, radius: 60 })], dark, none, 0, { occluders: [body] });
    const farolSin = computeLight(region, [lamp({ x: 101, y: 78, radius: 60 })], dark, none, 0);
    expect(at(farol, 120, 78)).toBeCloseTo(at(farolSin, 120, 78));
    expect(at(farol, 80, 78)).toBeCloseTo(at(farolSin, 80, 78));
  });

  it('shadowedBy: solo bloquea si el cuerpo está entre la luz y el punto', () => {
    const o = { x: 50, y: 50, rx: 4, ry: 6 };
    expect(shadowedBy(10, 50, 90, 50, o)).toBe(true);                   // en medio
    expect(shadowedBy(10, 50, 40, 50, o)).toBe(false);                  // el punto llega antes del cuerpo
    expect(shadowedBy(10, 20, 90, 20, o)).toBe(false);                  // pasa por arriba
    expect(shadowedBy(10, 50, 50, 50, o)).toBe(false);                  // destino dentro del cuerpo
    expect(shadowedBy(50, 50, 90, 50, o)).toBe(false);                  // luz dentro del cuerpo
    expect(shadowedBy(10, 56, 90, 56, o)).toBe(false);                  // roza por debajo del eje vertical (ry)
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

describe('una luz nace de una fuente que se ve', () => {
  const torch: LightSource = { id: 'muro-5', kind: 'torch', x: 88, y: 32 };

  it('la luz se coloca en la llama de la fuente y conserva su id', () => {
    const l = lightOf(torch);
    expect(l.x).toBe(88 + SOURCE_PRESETS.torch.flame.dx);
    expect(l.y).toBe(32 + SOURCE_PRESETS.torch.flame.dy);
    expect(l.source).toBe('muro-5');
    expect(l.color).toEqual(SOURCE_PRESETS.torch.color);
  });

  it('cada tipo tiene valores válidos y todos los tipos producen luz', () => {
    for (const [kind, p] of Object.entries(SOURCE_PRESETS)) {
      expect(p.radius, kind).toBeGreaterThan(0);
      expect(p.intensity, kind).toBeGreaterThan(0);
      for (const c of p.color) { expect(c, kind).toBeGreaterThanOrEqual(0); expect(c, kind).toBeLessThanOrEqual(1); }
      expect(lightOf({ id: `x-${kind}`, kind: kind as SourceKind, x: 10, y: 10 }).source).toBe(`x-${kind}`);
    }
  });

  it('el parpadeo sale del id: el mismo id da siempre lo mismo y ids distintos no parpadean a la vez', () => {
    const a = lightOf(torch), b = lightOf({ ...torch }), c = lightOf({ ...torch, id: 'muro-6' });
    expect(a.flicker!.seed).toBe(b.flicker!.seed);
    expect(a.flicker!.seed).not.toBe(c.flicker!.seed);
    expect(lightOf({ id: 'l', kind: 'lantern', x: 0, y: 0 }).flicker).toBeUndefined();   // la linterna no parpadea
  });

  it('lightsOf conserva el orden y una luz por fuente, y todas dicen de dónde vienen', () => {
    const sources: LightSource[] = [torch, { id: 'n1', kind: 'neon-pink', x: 40, y: 20 }, { id: 'l1', kind: 'lantern', x: 5, y: 6 }];
    const lights = lightsOf(sources);
    expect(lights).toHaveLength(3);
    expect(lights.map((l) => l.source)).toEqual(['muro-5', 'n1', 'l1']);
  });
});

describe('fuentes con ajustes propios y la intensidad segura', () => {
  it('cada dibujo pone su llama a su altura, y una fuente puede ajustar intensidad, radio y color', () => {
    const l = lightOf({ id: 'lampara-1', kind: 'lamp', x: 100, y: 200, sprite: 'lampara_idle', flame: { dx: 1, dy: -22 }, intensity: 0.4, radius: 70, color: [1, 0.72, 0.38] });
    expect(l.x).toBe(101);
    expect(l.y).toBe(178);
    expect(l.intensity).toBe(0.4);
    expect(l.radius).toBe(70);
    expect(l.source).toBe('lampara-1');
    const dflt = lightOf({ id: 'l2', kind: 'lamp', x: 100, y: 200 });
    expect(dflt.y).toBe(200 + SOURCE_PRESETS.lamp.flame.dy);
    expect(dflt.intensity).toBe(SOURCE_PRESETS.lamp.intensity);
  });

  it('maxSafeIntensity: ningún canal pasa de 1 contando el pico del parpadeo', () => {
    // el dato medido por FERN: [1, 0.72, 0.38] sobre un ambiente de 0.6 -> 0.4
    expect(maxSafeIntensity([0.6, 0.6, 0.6], [1, 0.72, 0.38])).toBeCloseTo(0.4);
    for (const flicker of [0, 0.06, 0.25]) {
      for (const ambient of [[0.4, 0.46, 0.64], [0.6, 0.6, 0.6], [0.2, 0.2, 0.3]] as const) {
        for (const color of [[1, 0.62, 0.28], [1, 0.72, 0.38], [0.62, 0.85, 1]] as const) {
          const i = maxSafeIntensity(ambient, color, flicker);
          for (let ch = 0; ch < 3; ch++) expect(ambient[ch]! + i * (1 + flicker) * color[ch]!).toBeLessThanOrEqual(1 + 1e-9);
          expect(i).toBeGreaterThan(0);
        }
      }
    }
    expect(maxSafeIntensity([1, 1, 1], [1, 1, 1])).toBe(0);   // un ambiente a tope no deja margen
  });

  it('la lámpara por defecto se lee cálida: el rojo sube mucho más que el azul', () => {
    const [r, , b] = SOURCE_PRESETS.lamp.color;
    expect(r).toBeGreaterThan(b * 2);
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

  it('softGlow: el brillo conserva el tono de la luz y no deja píxeles sueltos (ni bordes de color ni puntos blancos)', () => {
    // una luz cálida muy intensa: cada canal pasa de 1 en un sitio distinto
    const cols = 24, rows = 1;
    const total = new Float32Array(cols * rows * 3);
    for (let c = 0; c < cols; c++) { const k = 1 - c / cols; total[c * 3] = 0.4 + 1.6 * k; total[c * 3 + 1] = 0.4 + 1.2 * k; total[c * 3 + 2] = 0.4 + 0.6 * k; }
    const field = { cell: 2, cols, rows, ambient: [0.4, 0.4, 0.4] as const, total };
    const region: Region = { x: 0, y: 0, width: cols * 2, height: 4 };
    const soft = buildLayers(field, region, { softGlow: true, glow: 0.8, steps: 5 });
    const old = buildLayers(field, region, { softGlow: false, glow: 0.8, steps: 5 });
    const px = (a: Uint8ClampedArray, x: number, y: number, ch: number) => a[(y * region.width + x) * 4 + ch]!;
    let lit = 0;
    for (let x = 0; x < region.width; x++) {
      const [r, g, b] = [px(soft.add, x, 0, 0), px(soft.add, x, 0, 1), px(soft.add, x, 0, 2)];
      expect(r).toBeGreaterThanOrEqual(g);                  // sigue siendo cálido: rojo >= verde >= azul, nunca un borde de otro color
      expect(g).toBeGreaterThanOrEqual(b);
      if (r > 0) { lit++; expect(g, 'rojo sin verde = borde de color').toBeGreaterThan(0); expect(b, 'verde sin azul = borde de color').toBeGreaterThan(0); }
    }
    expect(lit).toBeGreaterThan(8);
    // no es blanco: el azul queda claramente por debajo del rojo (con blanco puro serían iguales y lavaría el color)
    const mid = Math.floor(region.width / 4);
    expect(px(soft.add, mid, 0, 2)).toBeLessThan(px(soft.add, mid, 0, 0) * 0.85);
    // sin trama: a lo largo de una fila el brillo solo baja, y entre filas es idéntico (no hay píxeles aislados)
    for (let x = 1; x < region.width; x++) expect(px(soft.add, x, 0, 0)).toBeLessThanOrEqual(px(soft.add, x - 1, 0, 0));
    for (let y = 1; y < region.height; y++) for (let x = 0; x < region.width; x++) expect(px(soft.add, x, y, 0)).toBe(px(soft.add, x, 0, 0));
    // el modo anterior sí deja bordes de color: hay píxeles con rojo y sin azul
    let fringe = 0;
    for (let x = 0; x < region.width; x++) if (px(old.add, x, 0, 0) > 0 && px(old.add, x, 0, 2) === 0) fringe++;
    expect(fringe).toBeGreaterThan(0);
  });

  it('softGlow por defecto apagado: lo que ya se hornea no cambia', () => {
    const f = { cell: 2, cols: 4, rows: 4, ambient: [0.3, 0.3, 0.3] as const, total: new Float32Array(48).fill(1.6) };
    expect(buildLayers(f, view)).toEqual(buildLayers(f, view, { softGlow: false }));
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
