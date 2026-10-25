import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { bakeWorld } from '@voxpix/world/bake';
import { WorldView, ViewCamera, prepareViewJob, type Quarter } from '@voxpix/world/view';
import { WALL } from '@voxpix/worldgen';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { BG_IDLE_MS, BG_STARVE_FRAMES, BG_WAVE_MS, TurnBackground, NEAR_WALL_H, QUARTERS, SIDE_WALL_H, dressWalls, inputToWorld, turnQuarter, viewProjector, wallDress, wallSides } from '../../src/game/brotato/ui/turn';

// El giro de la cámara en el juego (src/game/brotato/ui/turn.ts), sobre la vista girada de VoxPix.
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const game = (level = 'medieval', seed = 3) => new BrotatoGame(registry, seed, models, player, registry.level(level));

// La altura de la columna más alta de una celda del nivel, mirada en la vista girada
function cellTop(view: WorldView, layout: { cols: number }, i: number, depth: number): number {
  const cx = i % layout.cols, cy = Math.floor(i / layout.cols), s = view.static;
  let top = -1;
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const [vx, vy] = view.camera.cellToView(cx * 16 + tx, depth - 1 - (cy * 16 + ty));
    for (let z = s.zMax; z > top; z--) if (s.get(vx, vy, z)) { top = z; break; }
  }
  return top;
}

describe('girar', () => {
  it('los cuartos dan la vuelta en los dos sentidos', () => {
    expect([0, 1, 2, 3].map((q) => turnQuarter(q as Quarter, 1))).toEqual([1, 2, 3, 0]);
    expect(turnQuarter(0, -1)).toBe(3);
  });

  it('arriba en la pantalla es siempre lejos de la cámara: norte, oeste, sur y este', () => {
    const up = QUARTERS.map((q) => inputToWorld(new ViewCamera(q, 640, 480), 0, 1).map((v) => Math.round(v) + 0));
    expect(up).toEqual([[0, 1], [-1, 0], [0, -1], [1, 0]]);
    for (const q of QUARTERS) expect(inputToWorld(new ViewCamera(q, 640, 480), 0, 0)).toEqual([0, 0]);
  });
});

describe('el segundo plano de los giros', () => {
  // Un reloj falso y trabajos que gastan 1 ms por unidad hasta su plazo o hasta acabar sus `units`
  const setup = () => {
    let t = 0;
    const bg = new TurnBackground(() => t);
    const job = (units: number) => { const j = { done: 0, run(deadline: number) { do { t += 1; j.done++; } while (j.done < units && t < deadline); return j.done >= units; } }; return j; };
    return { bg, job };
  };

  it('sin juego da 8 ms por cuadro y en la oleada 3, menos lo que ya gastó el rehorneado', () => {
    const { bg, job } = setup();
    const a = job(100);
    bg.run([a], false, 0);
    expect(a.done).toBe(BG_IDLE_MS);
    const b = job(100);
    bg.run([b], true, 1);
    expect(b.done).toBe(BG_WAVE_MS - 1);
  });

  it('en la oleada sin presupuesto espera, y cada 4 cuadros da un paso mínimo para no quedarse atascado', () => {
    const { bg, job } = setup();
    const a = job(100);
    for (let f = 1; f < BG_STARVE_FRAMES; f++) bg.run([a], true, BG_WAVE_MS);
    expect(a.done).toBe(0);
    bg.run([a], true, BG_WAVE_MS);
    expect(a.done).toBe(1);
  });

  it('en orden: el siguiente empieza solo si el anterior acabó, y los acabados salen de la lista', () => {
    const { bg, job } = setup();
    const a = job(2), b = job(100), c = job(100);
    const left = bg.run([a, b, c], false, 0);
    expect(a.done).toBe(2);
    expect(b.done).toBe(BG_IDLE_MS - 2);
    expect(c.done).toBe(0);
    expect(left).toEqual([b, c]);
  });
});

describe('la vista girada del juego', () => {
  it('los efectos caen donde se pinta la entidad, en los 4 giros', { timeout: 60_000 }, () => {
    const g = game();
    for (const q of QUARTERS) {
      const view = new WorldView(g.state, q);
      const b = bakeWorld(view.bakeable(), { topZ: 40, incline: 0.5 });
      const rs = view.frame();
      const me = g.state.entities.get(g.playerId)!;
      const drawn = [...rs.entities].find((e) => e.id === g.playerId)!;
      const viaFx = viewProjector(view.camera, b.cam).project(me.x, me.y, me.z);
      const viaEnt = b.cam.project(drawn.x, drawn.y, drawn.z);
      // La entidad va en su celda (enteros) y el efecto en el punto: como mucho una celda de diferencia
      expect(Math.abs(viaFx[0]! - viaEnt[0]!), `giro ${q}`).toBeLessThanOrEqual(1);
      expect(Math.abs(viaFx[1]! - viaEnt[1]!), `giro ${q}`).toBeLessThanOrEqual(1);
    }
  });

  it.each(['medieval', 'oficina', 'cyberpunk'])('%s: delante y a los lados las paredes quedan bajas en la vista; el mundo no se toca', { timeout: 60_000 }, (level) => {
    const g = game(level);
    const layout = g.run.arena.layout, depth = g.state.solid.depth;
    const before = g.state.hash();
    expect(dressWalls(new WorldView(g.state, 0), layout).size).toBe(0);   // giro 0: nada
    for (const q of [1, 2, 3] as Quarter[]) {
      const view = new WorldView(g.state, q);
      dressWalls(view, layout);
      const sides = wallSides(layout, view.camera, depth);
      expect([...sides.values()].filter((s) => s === 'near').length, `giro ${q}`).toBeGreaterThan(0);
      for (const [i, side] of sides) {
        const top = cellTop(view, layout, i, depth);
        if (side === 'near') expect(top, `giro ${q} celda ${i}`).toBeLessThan(NEAR_WALL_H);
        if (side === 'side') expect(top, `giro ${q} celda ${i}`).toBeLessThan(SIDE_WALL_H);
      }
    }
    expect(g.state.hash()).toBe(before);
  });

  it('mirando desde el norte, la fachada queda delante: se rebaja y sus luces no se hornean', { timeout: 60_000 }, () => {
    const g = game('medieval');
    const layout = g.run.arena.layout;
    const facade = [...layout.wall.keys()].filter((i) => layout.wall[i] === WALL.facadeTop || layout.wall[i] === WALL.facadeBottom);
    expect(facade.length).toBeGreaterThan(0);
    const view = new WorldView(g.state, 2);
    const sides = wallSides(layout, view.camera, g.state.solid.depth);
    expect(facade.every((i) => sides.get(i) === 'near')).toBe(true);
    const dropped = dressWalls(view, layout);
    expect(dropped.size).toBeGreaterThan(0);
    // Y desde el sur (lo de siempre) la fachada es el fondo
    const south = wallSides(layout, new ViewCamera(0, g.state.solid.width, g.state.solid.depth), g.state.solid.depth);
    expect(facade.every((i) => south.get(i) === 'far')).toBe(true);
  });

  it('en segundo plano (prepareViewJob con el vestido): paredes bajas, luces de la fachada escondidas y lo mismo que de golpe', { timeout: 60_000 }, () => {
    const g = game('medieval');
    const layout = g.run.arena.layout, depth = g.state.solid.depth, opts = { topZ: 40, incline: 0.5 };
    const prep = prepareViewJob(g.state, 2, opts, { dress: wallDress(layout) });
    expect(prep.result()).toBeNull();
    let steps = 0;
    while (!prep.job.run(performance.now() + 2)) steps++;
    expect(steps).toBeGreaterThan(1);   // de verdad por pasos
    const { view, baked } = prep.result()!;
    const sides = wallSides(layout, view.camera, depth);
    for (const [i, side] of sides) if (side === 'near') expect(cellTop(view, layout, i, depth)).toBeLessThan(NEAR_WALL_H);
    const facadeLights = g.state.lights.filter((l) => String(l.id).startsWith('facade-'));
    expect(facadeLights.length).toBeGreaterThan(0);
    expect(facadeLights.every((l) => view.hideLight?.(l))).toBe(true);
    expect(view.frame().lights.some((l) => String(l.id).startsWith('facade-'))).toBe(false);
    const sync = new WorldView(g.state, 2, { dress: wallDress(layout) });
    expect(Buffer.from(bakeWorld(sync.bakeable(), opts).rgba).equals(Buffer.from(baked.rgba))).toBe(true);
    expect(g.state.solid).not.toBe(view.static);
  });

  it('hornear vistas giradas no cambia la partida', { timeout: 60_000 }, () => {
    const a = game('oficina', 9), b = game('oficina', 9);
    const walk = (t: number) => ({ dx: Math.cos(t / 40), dy: Math.sin(t / 40), stomp: false });
    for (let t = 0; t < 400; t++) {
      a.step(walk(t)); b.step(walk(t));
      if (t % 100 === 0) { const v = new WorldView(b.state, ((t / 100) % 4) as Quarter, { dress: wallDress(b.run.arena.layout) }); bakeWorld(v.bakeable(), { topZ: 40, incline: 0.5 }); v.frame(); }
    }
    expect(b.state.hash()).toBe(a.state.hash());
    expect(runDigest(b.run, b.current, false)).toBe(runDigest(a.run, a.current, false));
  });
});
