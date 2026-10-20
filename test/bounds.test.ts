import { describe, expect, it } from 'vitest';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { Run } from '../src/engine/sim/Run';
import { cameraScroll } from '../src/engine/view/camera';

const { registry } = validateContent(discoverContent());
const run = () => new Run(registry, registry.character('maia'), registry.level('oficina'), 3);

describe('MAIA no se sale de la arena', () => {
  it.each([
    ['abajo-derecha (D+S)', { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
    ['arriba-izquierda (A+W)', { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }],
  ])('caminando %s contra el borde, el sprite entero sigue dentro', (_name, move) => {
    const r = run();
    const world = r.startWave();
    const { width, height } = r.level.arena;
    const half = r.body.cellW / 2;
    for (let t = 0; t < 10; t += 1 / 60) {
      world.step(1 / 60, move);
      world.player.hp = world.player.maxHp; // que los enemigos no corten la prueba
      expect(world.player.x).toBeGreaterThanOrEqual(half);
      expect(world.player.x).toBeLessThanOrEqual(width - half);
      expect(world.player.y).toBeGreaterThanOrEqual(r.body.cellH);
      expect(world.player.y).toBeLessThanOrEqual(height);
    }
    // Y llegó de verdad a la esquina, pegada al borde
    expect(world.player.x).toBe(move.x > 0 ? width - half : half);
  });

  it('los enemigos tampoco se salen', () => {
    const r = run();
    const world = r.startWave();
    for (let t = 0; t < 15; t += 1 / 60) {
      world.step(1 / 60, { x: 1, y: 0 });
      world.player.hp = world.player.maxHp;
      for (const e of world.enemies) {
        expect(e.x).toBeGreaterThanOrEqual(e.cell.w / 2);
        expect(e.x).toBeLessThanOrEqual(r.level.arena.width - e.cell.w / 2);
        expect(e.y).toBeGreaterThanOrEqual(e.cell.h);
        expect(e.y).toBeLessThanOrEqual(r.level.arena.height);
      }
    }
  });
});

describe('la cámara no enseña el vacío', () => {
  const view = { width: 480, height: 270 };
  const arena = { width: 640, height: 640 };

  it('en el centro, centra al jugador', () => {
    expect(cameraScroll({ x: 320, y: 320 }, view, arena)).toEqual({ x: 80, y: 185 });
  });

  it('en una esquina, se queda en el borde de la arena', () => {
    expect(cameraScroll({ x: 640, y: 640 }, view, arena)).toEqual({ x: 160, y: 370 });
    expect(cameraScroll({ x: 0, y: 0 }, view, arena)).toEqual({ x: 0, y: 0 });
  });

  it('el scroll siempre deja la vista dentro de la arena y es entero', () => {
    for (let x = 0; x <= 640; x += 7) {
      for (let y = 0; y <= 640; y += 11) {
        const s = cameraScroll({ x, y }, view, arena);
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + view.width).toBeLessThanOrEqual(arena.width);
        expect(s.y + view.height).toBeLessThanOrEqual(arena.height);
      }
    }
  });

  it('si la arena es más pequeña que la vista en un eje, se centra en ese eje', () => {
    expect(cameraScroll({ x: 100, y: 300 }, { width: 270, height: 480 }, { width: 200, height: 640 }))
      .toEqual({ x: -35, y: 60 });
  });
});
