// La caída del piso nuevo (etapa 2 de los pisos): lo que hay sobre el suelo cae desde el cielo al llegar. Medido en el
// Flip 6 (2026-10-27): con commit 'end' las piezas que llegan siguen siendo sprites, y pasadas de MAX_SPRITE_LAYERS
// (1024) cada cuadro tarda 350 ms. Tope de 512 piezas (MAIA), y la vista no hornea ni gira mientras cae: el horneado
// final va de golpe detrás del letrero.
import { describe, expect, it, vi } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Arena } from '../../src/game/brotato/sim/arena';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { FallGate, bakeFinal } from '../../src/game/brotato/fallgate';
import { bakeWorld, rebakeChangedJobs } from '@voxpix/world/bake';
import { WorldView } from '@voxpix/world/view';
import { FALL_MAX_PIECES, countPieces, fallPiece } from '../../src/game/brotato/sim/dropin';
import { skipTo } from '../../src/game/brotato/skip';

vi.setConfig({ testTimeout: 240_000 });
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const still = { dx: 0, dy: 0, stomp: false };

// Huella de los vóxeles del mundo (sin entidades)
function voxels(a: Arena): string {
  const s = a.state.solid;
  let h = 2166136261;
  for (let z = s.zMin; z <= s.zMax; z++) for (let y = 0; y < s.depth; y++) for (let x = 0; x < s.width; x++) h = Math.imul(h ^ (s.get(x, y, z) + 1), 16777619);
  return (h >>> 0).toString(16);
}

// Hasta la salida abierta del primer piso y cruzándola: el piso 2 recién llegado, con la partida esperando a la vista
function toFloor2(g: BrotatoGame): void {
  expect(skipTo(g, 'salida').reached).toBe(true);
  const exit = g.run.arena.exit!;
  for (let t = 0; t < 600 && g.run.floor < 1; t++) { Object.assign(g.current.player, { x: exit.x, y: exit.y }); g.step(still); }
  expect(g.run.floor).toBe(1);
}

describe('la caída del piso', () => {
  it('la talla de pieza: la menor de 16/20/24 que deja <= 512 piezas; si ninguna, sin animación', () => {
    // Recuentos de mentira por talla
    const counts = (c16: number, c20: number, c24: number) => (n: number) => (n === 16 ? c16 : n === 20 ? c20 : c24);
    expect(fallPiece(counts(154, 120, 90))).toBe(16);
    expect(fallPiece(counts(512, 400, 300))).toBe(16);
    expect(fallPiece(counts(900, 480, 330))).toBe(20);     // un piso grande: sube a 20
    expect(fallPiece(counts(1400, 760, 500))).toBe(24);    // más grande: 24
    expect(fallPiece(counts(2400, 1300, 800))).toBeNull(); // ni con 24: el piso se monta de golpe
    expect(FALL_MAX_PIECES).toBe(512);
  });

  it('countPieces cuenta las piezas como VoxelFall las corta', () => {
    const solid = { get: (x: number, y: number, z: number) => (x < 40 && y < 20 && z < 10 ? 1 : 0) };
    const box = { x0: 0, y0: 0, z0: 0, x1: 63, y1: 63, z1: 31 };
    expect(countPieces(solid, box, 16)).toBe(3 * 2 * 1);
    expect(countPieces(solid, box, 8)).toBe(5 * 3 * 2);
    expect(countPieces(solid, box, 8, 4)).toBe(5);   // para en cuanto pasa del tope
  });

  it('en los tres temas el piso 2 cae con pieza 16 y sin pasar del tope; el mundo final es el mismo que sin caída', () => {
    for (const [level, seed] of [['oficina', 7], ['medieval', 3], ['cyberpunk', 11]] as const) {
      const lv = registry.level(level);
      const before = new Arena(lv, seed, { floor: 1 });
      const a = new Arena(lv, seed, { floor: 1 });
      const s = a.state.solid, box = { x0: 0, y0: 0, z0: a.floorZ, x1: s.width - 1, y1: s.depth - 1, z1: s.zMax };
      expect(countPieces(s, box, 16), level).toBeLessThanOrEqual(FALL_MAX_PIECES);
      const n = a.dropIn();
      expect(n, level).toBe(countPieces(before.state.solid, box, 16));
      expect(a.falling).toBe(true);
      expect(voxels(a)).not.toBe(voxels(before));   // levantado: el piso está vacío mientras cae
      a.settleFall();
      expect(a.fall).toBeNull();
      expect(voxels(a), level).toBe(voxels(before));
    }
  });

  it('a ticks (con vista) y de golpe (sin ella) el piso queda igual', () => {
    const viewed = new BrotatoGame(registry, 7, models, player, registry.level('oficina'), { waitFloor: true });
    toFloor2(viewed);
    expect(viewed.awaitingFloor).toBe(true);
    expect(viewed.run.arena.falling).toBe(true);
    let ticks = 0;
    while (viewed.run.arena.falling && ticks < 60 * 20) { viewed.step(still); ticks++; }
    expect(viewed.run.arena.falling).toBe(false);
    expect(ticks).toBeGreaterThan(60);           // cae de verdad, no de golpe (unos 2,3 s en el Flip)
    expect(viewed.current.time).toBe(0);         // y la oleada no ha empezado
    viewed.floorReady();
    expect(viewed.run.arena.fall).toBeNull();

    const headless = new BrotatoGame(registry, 7, models, player, registry.level('oficina'));
    toFloor2(headless);
    expect(headless.run.arena.fall).toBeNull();
    expect(voxels(viewed.run.arena)).toBe(voxels(headless.run.arena));
  });

  it('la vista no hornea los otros giros ni gira mientras cae, y hornea el final detrás del letrero antes de la oleada', () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('medieval'), { waitFloor: true });
    const starts: Array<{ fall: boolean; awaiting: boolean }> = [];
    const finishes: Array<{ falling: boolean; awaiting: boolean; held: boolean }> = [];
    let finishDone: ((pending: number) => void) | null = null;
    const gate = new FallGate(() => starts.push({ fall: !!g.run.arena.fall, awaiting: g.awaitingFloor }), (done) => {
      finishes.push({ falling: g.run.arena.falling, awaiting: g.awaitingFloor, held: !!g.run.arena.fall });
      finishDone = done;
    });
    expect(gate.baked(g)).toBe(true);            // el primer piso no cae: los giros, ya
    toFloor2(g);
    // Lo que hace la vista al ver el piso nuevo (changeFloor → bakeFloor)
    expect(gate.baked(g)).toBe(false);
    expect(starts).toHaveLength(1);
    let turnsBlocked = 0, frames = 0;
    for (; frames < 60 * 20 && !finishDone; frames++) {
      g.step(still);
      if (!gate.canTurn(g)) turnsBlocked++;
      gate.frame(g, 0);
    }
    // El horneado final, una vez, con todo caído y las piezas aún dibujadas, y la oleada esperando
    expect(finishes).toEqual([{ falling: false, awaiting: true, held: true }]);
    expect(turnsBlocked).toBeGreaterThan(60);
    // Mientras el letrero hornea, nada más: ni otra vez el final, ni la oleada, ni los otros giros
    for (let k = 0; k < 10; k++) { g.step(still); gate.frame(g, 0); }
    expect(finishes).toHaveLength(1);
    expect(g.awaitingFloor).toBe(true);
    expect(starts).toHaveLength(1);
    finishDone!(0);
    expect(g.awaitingFloor).toBe(false);
    expect(g.run.arena.fall).toBeNull();
    expect(gate.canTurn(g)).toBe(true);
    // Los otros giros solo después de la caída, ya con la partida en marcha
    expect(starts).toEqual([{ fall: false, awaiting: false }, { fall: false, awaiting: false }]);
  });

  it('al soltar, el budget del giro actual está vacío: el horneado final lo deja al día', () => {
    const g = new BrotatoGame(registry, 7, models, player, registry.level('oficina'), { waitFloor: true });
    toFloor2(g);
    // El horneado de la vista al llegar al piso: con lo de encima levantado
    const v0 = new WorldView(g.state, 0);
    const shown = bakeWorld(v0.bakeable(), {});
    while (g.run.arena.falling) g.step(still);
    // Sin el horneado final, el budget tendría todo el piso por rehornear
    expect(rebakeChangedJobs(shown, v0.lights).length).toBeGreaterThan(0);
    let left = -1;
    const gate = new FallGate(() => {}, (done) => { const f = bakeFinal(g.state, 0, {}); left = f.left.length; done(left); });
    gate.frame(g, 0);
    expect(left).toBe(0);
    expect(g.awaitingFloor).toBe(false);
    // Y si al acabar quedara trabajo en el budget, la oleada espera a que se vacíe
    const h = new BrotatoGame(registry, 7, models, player, registry.level('oficina'), { waitFloor: true });
    toFloor2(h);
    while (h.run.arena.falling) h.step(still);
    const gate2 = new FallGate(() => {}, (done) => done(3));
    gate2.frame(h, 3);
    expect(h.awaitingFloor).toBe(true);
    gate2.frame(h, 1);
    expect(h.awaitingFloor).toBe(true);
    gate2.frame(h, 0);
    expect(h.awaitingFloor).toBe(false);
  });
});
