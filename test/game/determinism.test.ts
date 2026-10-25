import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildWorldState, type WorldTheme } from '../../src/world/build';
import { generateLayout, TILE } from '../../src/worldgen';
import { THEMES } from '../../src/content/themes';
import { FixedLoop, Runtime, type TickInput } from '../../src/game/runtime';
import { Model, material } from '../../src/core';

// Las partidas largas tardan: en oficina, una de 2400 ticks por partida pasa de los 5 s por defecto
const SLOW = 30_000;

// La partida es función de la semilla y de la entrada de cada tick, nada más: ni del ritmo de cuadros, ni del orden
// en que se construyó el mundo, ni del reloj. Es lo que hizo posibles las curvas de balance de 64 semillas del Brotato.

function game(theme: WorldTheme, seed: number): Runtime {
  const layout = generateLayout(THEMES[theme].spec, seed);
  const { state } = buildWorldState(layout, theme);
  return new Runtime(state, { x: layout.spawn.x, y: layout.rows * TILE - 1 - layout.spawn.y }, { radius: 4, speed: 70 });
}

// Una entrada pseudoaleatoria por tick, fija para una semilla: cambia de rumbo cada 30 ticks y pisa fuerte a veces
function script(seed: number): (tick: number) => TickInput {
  const inputs: TickInput[] = [];
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let dx = 0, dy = 0;
  return (tick) => {
    while (inputs.length <= tick) {
      if (inputs.length % 30 === 0) { const ang = rand() * Math.PI * 2; dx = Math.cos(ang); dy = Math.sin(ang); }
      inputs.push({ dx, dy, stomp: rand() < 0.05 });
    }
    return inputs[tick]!;
  };
}

function run(rt: Runtime, input: (tick: number) => TickInput, until: number): void {
  while (rt.tick < until) rt.step(input(rt.tick));
}

// medieval 7 tiene agua y fuente: las ondas, las gotas y el chorro entran en juego
const CASES: Array<[WorldTheme, number]> = [['medieval', 7], ['cyberpunk', 3], ['oficina', 2]];

describe('determinismo del runtime', () => {
  it.each(CASES)('%s, semilla %i: misma semilla y misma entrada, misma huella en cada control', (theme, seed) => {
    const a = game(theme, seed), b = game(theme, seed);
    const input = script(seed);
    const seen = new Set<string>();
    let wet = false;
    for (const t of [60, 600, 1200, 2400]) {
      while (a.tick < t) { a.step(input(a.tick)); b.step(input(b.tick)); wet ||= a.player.inWater; }
      expect(a.hash(), `tick ${t}`).toBe(b.hash());
      seen.add(a.hash());
    }
    expect(seen.size, 'la partida tiene que cambiar entre controles').toBe(4);
    // En el mapa con agua, el guion tiene que meterse en ella: si no, las ondas y las gotas no se prueban
    if (theme === 'medieval') expect(wet, 'el jugador nunca pisó el agua').toBe(true);
  }, SLOW);

  it('un solo pisotón de diferencia en el agua cambia la huella', () => {
    const a = game('medieval', 7), b = game('medieval', 7);
    const base = script(7);
    // El primer tick que acaba con los pies en el agua (el pisotón se mira después de moverse): lo encuentra una partida de prueba
    const probe = game('medieval', 7);
    let wet = -1;
    for (let t = 0; t < 3000 && wet < 0; t++) { probe.step(base(t)); if (probe.player.inWater) wet = t; }
    expect(wet, "el guion tiene que meter al jugador en el agua").toBeGreaterThanOrEqual(0);
    const changed = (t: number) => (t === wet ? { ...base(t), stomp: !base(t).stomp } : base(t));
    run(a, base, wet + 120); run(b, changed, wet + 120);
    expect(a.hash()).not.toBe(b.hash());
  }, SLOW);

  it('otra semilla, otra partida', () => {
    const a = game('medieval', 7), b = game('medieval', 8);
    run(a, script(1), 120); run(b, script(1), 120);
    expect(a.hash()).not.toBe(b.hash());
  });

  it('instantánea a mitad, seguir, volver a ella y repetir: misma huella', () => {
    const rt = game('medieval', 7);
    const input = script(7);
    run(rt, input, 300);
    const snap = rt.snapshot();
    run(rt, input, 600);
    const first = rt.hash();
    rt.restore(snap);
    expect(rt.tick).toBe(300);
    run(rt, input, 600);
    expect(rt.hash()).toBe(first);
  });

  it('el ritmo de cuadros no cambia la partida: 60 Hz, 30 Hz, 144 Hz y cuadros irregulares dan la misma huella', () => {
    const input = script(7);
    const N = 600;
    const hashes = new Set<string>();
    const frames: Array<(i: number) => number> = [
      () => 1 / 60, () => 1 / 30, () => 1 / 144,
      (i) => [0.011, 0.023, 0.017, 0.041, 0.006][i % 5]!,
    ];
    for (const dt of frames) {
      const rt = game('medieval', 7);
      const loop = new FixedLoop(rt, input);
      let elapsed = 0;
      for (let i = 0; rt.tick < N; i++) { const d = dt(i); elapsed += d; loop.advance(d); }
      expect(rt.tick).toBe(N);
      // Y el tiempo de juego sigue al real: N ticks tras N/60 s (más, como mucho, el último cuadro)
      expect(elapsed).toBeGreaterThanOrEqual(N / 60 - 1e-6);
      expect(elapsed).toBeLessThan(N / 60 + 0.05);
      hashes.add(rt.hash());
    }
    expect(hashes.size).toBe(1);
  }, SLOW);

  it('un cuadro enorme no encadena más de 5 ticks: la partida se frena, no se acumula', () => {
    const rt = game('oficina', 2);
    const loop = new FixedLoop(rt, script(2));
    expect(loop.advance(10)).toBe(5);
    expect(loop.advance(1 / 60)).toBe(1);
  });

  it('con modelo, el runtime crea la entidad del mundo, la lleva con el cuerpo y entra en la huella', () => {
    const layout = generateLayout(THEMES.medieval.spec, 7);
    const model = new Model({ ramps: [{ name: 'tela', colors: ['#202040', '#404080', '#6060c0'] }] }, 'cubo');
    for (let z = 0; z < 6; z++) for (let y = -2; y < 2; y++) for (let x = -2; x < 2; x++) model.set(x, y, z, material(0, 1));
    const make = () => {
      const { state } = buildWorldState(layout, 'medieval');
      return new Runtime(state, { x: layout.spawn.x, y: layout.rows * TILE - 1 - layout.spawn.y }, { radius: 4, speed: 70, model });
    };
    const a = make(), b = make();
    const input = script(7);
    run(a, input, 300); run(b, input, 300);
    const e = a.world.entities.get(a.entityId!)!;
    expect([e.x, e.y, e.z]).toEqual([Math.round(a.player.x), Math.round(a.player.y), a.player.z]);
    expect(e.yaw).toBe(a.player.facing * 45);
    expect(a.hash()).toBe(b.hash());
    // Si la entidad se moviera distinto, la huella lo vería
    b.world.entities.move(b.entityId!, e.x + 1, e.y, e.z, e.yaw);
    expect(a.hash()).not.toBe(b.hash());
  });

  it('src/game no usa reloj ni azar del navegador', () => {
    const dir = join(__dirname, '../../src/game');
    for (const f of readdirSync(dir)) {
      const code = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/Math\.random|performance\.now|Date\.now|new Date\(/);
    }
  });
});
