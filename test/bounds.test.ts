import { describe, expect, it } from 'vitest';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { pickLevel, type Obstacles } from '../src/engine/sim/map';
import { Run } from '../src/engine/sim/Run';
import { cameraScroll } from '../src/engine/view/camera';

const { registry } = validateContent(discoverContent());

// Los niveles son de mapa generado: las paredes, columnas y muebles no se atraviesan. Se recorre cada tema con
// varias semillas, andando en diagonal contra todo, y se mira el círculo de los pies (el que choca) en cada paso.
const LEVELS = registry.levels().map((l) => l.id);
const SEEDS = [1, 2, 3, 4, 5];

function touchesSolid(o: Obstacles, x: number, y: number, r: number): boolean {
  const cy = y - r;
  // Ocho puntos del borde del círculo, a un 90 % del radio (lo justo para no contar el roce)
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    if (o.solidAt(x + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9)) return true;
  }
  return o.solidAt(x, cy);
}

describe('nadie atraviesa paredes, columnas ni muebles', () => {
  it.each(LEVELS)('%s: MAIA andando contra todo se queda fuera de lo sólido y dentro de las paredes', (id) => {
    for (const seed of SEEDS) {
      const r = new Run(registry, registry.character('maia'), registry.level(id), seed);
      const world = r.startWave();
      const o = r.obstacles!;
      // A ~60 px/s, 12 s por diagonal bastan para ir de esquina a esquina: así toca las cuatro paredes
      const moves = [{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }].map((m) => ({ x: m.x * Math.SQRT1_2, y: m.y * Math.SQRT1_2 }));
      let touchedWall = 0;
      for (let t = 0; t < 48; t += 1 / 60) {
        world.step(1 / 60, moves[Math.floor(t / 12)]!);
        world.player.hp = world.player.maxHp; // que los enemigos no corten la prueba
        const p = world.player;
        expect(touchesSolid(o, p.x, p.y, r.body.radius), `${id} semilla ${seed} t=${t.toFixed(2)} en (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).toBe(false);
        expect(p.x).toBeGreaterThan(o.inner.x0);
        expect(p.x).toBeLessThan(o.inner.x1);
        expect(p.y).toBeLessThanOrEqual(o.inner.y1);
        if (p.x - r.body.radius - o.inner.x0 < 1 || o.inner.x1 - p.x - r.body.radius < 1) touchedWall++;
      }
      // Que la prueba haya llegado de verdad a las paredes: si no, no estaría probando nada
      expect(touchedWall, `${id} semilla ${seed}`).toBeGreaterThan(0);
    }
  });

  it.each(LEVELS)('%s: los enemigos aparecen y se mueven fuera de lo sólido', (id) => {
    for (const seed of SEEDS) {
      const r = new Run(registry, registry.character('maia'), registry.level(id), seed);
      const world = r.startWave();
      const o = r.obstacles!;
      let seen = 0;
      for (let t = 0; t < 15; t += 1 / 60) {
        world.step(1 / 60, { x: 1, y: 0 });
        world.player.hp = world.player.maxHp;
        for (const e of world.enemies) {
          seen++;
          expect(touchesSolid(o, e.x, e.y, e.def.radius), `${id} semilla ${seed} ${e.def.id} en (${e.x.toFixed(1)}, ${e.y.toFixed(1)})`).toBe(false);
        }
      }
      expect(seen).toBeGreaterThan(0);
    }
  });

  it('el mapa sale de la semilla: la misma da el mismo nivel y el mismo mapa, otra da otro', () => {
    const levels = registry.levels();
    const a = new Run(registry, registry.character('maia'), pickLevel(levels, 7), 7).layout!;
    const b = new Run(registry, registry.character('maia'), pickLevel(levels, 7), 7).layout!;
    expect(pickLevel(levels, 7).id).toBe(pickLevel(levels, 7).id);
    expect(a.floor).toEqual(b.floor);
    expect(Array.from(a.pillar)).toEqual(Array.from(b.pillar));
    const c = new Run(registry, registry.character('maia'), registry.level(pickLevel(levels, 7).id), 8).layout!;
    expect(c.floor).not.toEqual(a.floor);
    // Y con unas cuantas semillas salen los tres temas
    expect(new Set(Array.from({ length: 30 }, (_, s) => pickLevel(levels, s).id)).size).toBe(levels.length);
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
