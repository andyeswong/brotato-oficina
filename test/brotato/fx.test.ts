import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { Effects, Flashes, FLASH_ENEMY, FLASH_PLAYER, FLOAT_ENEMY_S, FLOAT_PLAYER_S, groundRing, groundX, type FxScene, type Projector } from '../../src/game/brotato/ui/fx';
import { COLORS, type Painter } from '../../src/game/brotato/ui/paint';
import { bakeWorld } from '@voxpix/world/bake';
import type { WorldFx } from '../../src/game/brotato/sim/World';
import { buyAll, kite, steer } from './pilot';

// Los efectos de la oleada (src/game/brotato/ui/fx.ts). Lo que vive en el suelo se dibuja proyectado con la cámara
// del mundo: a inclinación 0,5 sale acortado a la mitad en vertical (regla de MAIA), y se prueba con la cámara de un
// horneado de verdad, no con una copia de sus opciones.
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'gris', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, `c${h}`); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const one = cube(2);
const models: Models = { model: () => one, walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };

function box(points: Array<[number, number]>) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// El horneado del juego (incline 0,5, como app/src/juego) y uno sin acortar, del mismo mundo
const game = new BrotatoGame(registry, 3, models, player, registry.level('oficina'));
const baked = (incline: number) => bakeWorld(game.run.arena.world, { topZ: 40, incline });
const half = baked(0.5).cam, full = baked(1).cam;
const mid = { x: game.current.player.x, y: game.current.player.y, z: game.current.player.z };

interface Dot { x: number; y: number; w: number; h: number; color: string }
function recorder(width = 384, height = 216) {
  const dots: Dot[] = [];
  const outside: Dot[] = [];
  const p: Painter = {
    width, height, icon: () => false,
    fill(x, y, w, h, color) { const d = { x, y, w, h, color }; dots.push(d); if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(d); },
  };
  return { p, dots, outside };
}

const scene = (cam: Projector): FxScene => ({ player: mid, playerHeight: 30, enemyHeight: 12, groundZ: () => mid.z });
// La vista centrada en MAIA, como la pone la vista del juego
function origin(cam: Projector): [number, number] {
  const f = cam.project(mid.x, mid.y, mid.z);
  return [Math.floor(f[0]!) - 192, Math.floor(f[1]!) - 108];
}

describe('lo que vive en el suelo se proyecta a inclinación 0,5', () => {
  it('el anillo de una muerte: a 0,5 mide la mitad de alto que de ancho; sin acortar, lo mismo', () => {
    for (const r of [6, 10, 14]) {
      const a = box(groundRing(half, mid.x, mid.y, mid.z, r));
      const b = box(groundRing(full, mid.x, mid.y, mid.z, r));
      expect(a.w).toBe(2 * r);
      expect(Math.abs(a.h - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.h - b.w)).toBeLessThanOrEqual(1);
    }
  });

  it('la X del aviso: sus brazos son diagonales del suelo, así que también sale a la mitad de alto', () => {
    const a = box(groundX(half, mid.x, mid.y, mid.z, 3));
    const b = box(groundX(full, mid.x, mid.y, mid.z, 3));
    expect(a.w).toBe(6);
    expect(a.h).toBe(3);
    expect(b.h).toBe(6);
  });

  it('el suelo más alto sube en pantalla 1:1 (la altura no se acorta)', () => {
    const lo = groundRing(half, mid.x, mid.y, mid.z, 6), hi = groundRing(half, mid.x, mid.y, mid.z + 8, 6);
    const top = (ps: Array<[number, number]>) => Math.min(...ps.map((p) => p[1]));
    expect(top(lo) - top(hi)).toBe(8);
  });
});

describe('los efectos de la oleada', () => {
  const hitAt = (amount: number, crit = false): WorldFx => ({ type: 'enemy-hit', uid: 1, x: mid.x + 20, y: mid.y, z: mid.z, amount, crit });

  it('cada aviso de la simulación da su efecto, y cada uno se va a su tiempo', () => {
    const fx = new Effects();
    fx.add([hitAt(7), { type: 'player-hit', amount: 3 }, { type: 'dodge' }, { type: 'heal', amount: 1 }, { type: 'spawn', uid: 2 }, { type: 'pickup', value: 1 }], scene(half));
    expect(fx.count).toBe(4);   // spawn y pickup no se dibujan
    fx.update(FLOAT_ENEMY_S + 0.01);
    expect(fx.count).toBe(3);   // el número del enemigo dura menos que lo de MAIA
    fx.update(FLOAT_PLAYER_S);
    expect(fx.count).toBe(0);
  });

  it('pinta el número del golpe con su color (dorado si es crítico) y sin salirse de la vista', () => {
    const fx = new Effects();
    fx.add([hitAt(7), hitAt(21, true)], scene(half));
    const { p, dots, outside } = recorder();
    const [vx, vy] = origin(half);
    fx.paint(p, half, vx, vy, scene(half), []);
    expect(dots.some((d) => d.color === COLORS.text)).toBe(true);
    expect(dots.some((d) => d.color === COLORS.gold)).toBe(true);
    expect(outside).toEqual([]);
  });

  it('cerca del borde de la vista se recorta, no se sale', () => {
    const fx = new Effects();
    fx.add([hitAt(12345), { type: 'enemy-die', x: mid.x + 20, y: mid.y, z: mid.z }], scene(half));
    const f = half.project(mid.x + 20, mid.y, mid.z);
    const { p, dots, outside } = recorder();
    // La vista empieza justo encima del enemigo: el número y medio anillo caen fuera
    fx.paint(p, half, Math.floor(f[0]!) - 2, Math.floor(f[1]!) - 1, scene(half), []);
    expect(dots.length).toBeGreaterThan(0);
    expect(outside).toEqual([]);
  });

  it('una muerte deja un anillo y trocitos que caen al suelo; ninguno es rojo (se confundiría con la chincheta)', () => {
    const fx = new Effects();
    fx.add([{ type: 'enemy-die', x: mid.x, y: mid.y, z: mid.z }], scene(half));
    const colors = new Set<string>();
    const [vx, vy] = origin(half);
    for (let k = 0; k < 40; k++) {
      const { p, dots } = recorder();
      fx.paint(p, half, vx, vy, scene(half), []);
      for (const d of dots) colors.add(d.color.slice(0, 7).toLowerCase());
      fx.update(1 / 60);
    }
    expect(colors.size).toBeGreaterThan(1);
    for (const c of colors) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
      expect(r - Math.max(g, b), c).toBeLessThan(40);
    }
    expect(fx.count).toBe(0);
  });

  it('el aviso parpadea como en el Brotato, y más deprisa al final', () => {
    const fx = new Effects();
    const [vx, vy] = origin(half);
    const lit = (t: number) => { const { p, dots } = recorder(); fx.paint(p, half, vx, vy, scene(half), [{ x: mid.x, y: mid.y, t }]); return dots.length > 0; };
    expect([0.95, 0.85, 0.7, 0.6].map(lit)).toEqual([false, true, false, true]);   // a 8 Hz
    expect([0.39, 0.33, 0.3, 0.24].map(lit)).toEqual([true, false, true, false]);  // a 16 Hz
    const { p, dots } = recorder();
    fx.paint(p, half, vx, vy, scene(half), [{ x: mid.x, y: mid.y, t: 0.85 }]);
    expect(dots.every((d) => d.color === COLORS.bad)).toBe(true);
  });
});

describe('la partida junta los efectos para la vista', () => {
  it('takeFx entrega lo que anunció la simulación y lo vacía en los dos sitios', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 11, models, player, registry.level('medieval'));
    let got: WorldFx[] = [];
    for (let t = 0; t < 600 && g.phase === 'wave'; t++) {
      g.step({ dx: 0, dy: 0, stomp: false });
      expect(g.current.fx.length).toBe(0);
      got = got.concat(g.takeFx());
    }
    expect(got.some((f) => f.type === 'enemy-hit')).toBe(true);
    expect(g.takeFx()).toEqual([]);
    for (const f of got) if (f.type === 'enemy-hit' || f.type === 'enemy-die') expect(Number.isFinite(f.z)).toBe(true);
  });

  it('si nadie los recoge (pruebas, ?ir=) se quedan los 256 más nuevos, no crecen sin fin', { timeout: 60_000 }, () => {
    // Dos partidas iguales: una recoge cada tick (lo que pasó entero), la otra nunca (lo que queda guardado). La
    // segunda deja de dar pasos cuando la primera ya pasó de 256, pero los anunciados siguen siendo los mismos
    // El piloto de la curva (pilot.ts), para que MAIA aguante varias oleadas
    const drive = (g: BrotatoGame) => { const d = steer(g.run, g.current.player, kite(g.current, g.run)); return { dx: d.x, dy: d.y, stomp: false }; };
    const a = new BrotatoGame(registry, 11, models, player, registry.level('medieval'));
    const b = new BrotatoGame(registry, 11, models, player, registry.level('medieval'));
    let all: WorldFx[] = [];
    // Varias oleadas (una sola da unas 60), comprando en cada tienda como el piloto
    for (let t = 0; t < 30_000 && all.length <= 300 && a.phase !== 'dead' && a.phase !== 'victory'; t++) {
      if (a.phase === 'shop') { buyAll(a.run); buyAll(b.run); a.leaveShop(); b.leaveShop(); }
      const d = drive(a);
      a.step(d); b.step(d);
      all = all.concat(a.takeFx());
    }
    expect(all.length).toBeGreaterThan(256);   // si no, la prueba no prueba nada
    expect(b.takeFx()).toEqual(all.slice(-256));
  });
});

describe('el destello de un golpe (el tinte de la entidad)', () => {
  it('tiñe al golpe y lo quita a su tiempo: el enemigo blanco 60 ms, MAIA roja 90 ms', () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('oficina'));
    const ents = g.state.entities;
    const flashes = new Flashes<number | string>((id, c) => ents.setTint(id, c), (id) => !!ents.get(id));
    flashes.flash(g.playerId, FLASH_PLAYER.color, FLASH_PLAYER.s);
    expect(ents.get(g.playerId)!.tint).toEqual([1, 51 / 255, 51 / 255]);
    flashes.update(0.08);
    expect(ents.get(g.playerId)!.tint).not.toBeNull();
    flashes.update(0.02);
    expect(ents.get(g.playerId)!.tint).toBeNull();
    expect(flashes.count).toBe(0);
    expect(FLASH_ENEMY).toEqual({ color: [1, 1, 1], s: 0.06 });
  });

  it('un golpe sobre un destello vivo lo alarga, y una entidad que ya no está se olvida sin error', () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('oficina'));
    const ents = g.state.entities;
    const flashes = new Flashes<number | string>((id, c) => ents.setTint(id, c), (id) => !!ents.get(id));
    const id = ents.add({ model: one, x: 40, y: 40, z: 0, facing: 0, castsShadow: false });
    flashes.flash(id, FLASH_ENEMY.color, FLASH_ENEMY.s);
    flashes.update(0.05);
    flashes.flash(id, FLASH_ENEMY.color, FLASH_ENEMY.s);
    flashes.update(0.05);
    expect(ents.get(id)!.tint).toEqual([1, 1, 1]);
    ents.remove(id);
    expect(() => flashes.update(1)).not.toThrow();
    expect(flashes.count).toBe(0);
    expect(() => flashes.flash(id, FLASH_ENEMY.color, FLASH_ENEMY.s)).not.toThrow();
  });

  it('la partida dice qué entidad dibuja a cada enemigo golpeado', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 11, models, player, registry.level('medieval'));
    let found = 0;
    // Varias oleadas con el piloto: en la primera todo muere de un golpe (y el golpe que mata no deja entidad)
    for (let t = 0; t < 30_000 && found < 5 && g.phase !== 'dead' && g.phase !== 'victory'; t++) {
      if (g.phase === 'shop') { buyAll(g.run); g.leaveShop(); }
      const d = steer(g.run, g.current.player, kite(g.current, g.run));
      g.step({ dx: d.x, dy: d.y, stomp: false });
      for (const f of g.takeFx()) {
        if (f.type !== 'enemy-hit') continue;
        const e = g.current.enemies.find((x) => x.uid === f.uid);
        const id = g.enemyEntity(f.uid);
        if (!e) { expect(id).toBeUndefined(); continue; }   // murió del golpe: su entidad ya se quitó
        expect(id).toBeDefined();
        const ent = g.state.entities.get(id!)!;
        expect([ent.x, ent.y]).toEqual([Math.round(e.x), Math.round(e.y)]);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});
