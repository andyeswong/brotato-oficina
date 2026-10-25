import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { pickLevel, type Arena } from '../../src/game/brotato/sim/arena';
import { Run } from '../../src/game/brotato/sim/Run';
import { footprint } from '../../src/game/body';

const { registry } = validateContent(discoverContent());

// Los niveles son mundos de vóxeles: las paredes, columnas y muebles no se atraviesan. Se recorre cada tema con
// varias semillas, andando en diagonal contra todo, y se mira la huella de los pies en cada paso. (La versión del
// Brotato miraba el círculo contra la rejilla de tiles de Obstacles; aquí, contra los vóxeles.)
const LEVELS = registry.levels().map((l) => l.id);
const SEEDS = [1, 2, 3, 4, 5];

// ¿Pisa algo sólido por encima de los pies, o agua más honda de lo que se puede pisar?
function touchesSolid(a: Arena, x: number, y: number, z: number, r: number): boolean {
  return footprint(x, y, r).some(([cx, cy]) => a.state.solidAt(cx + 0.5, cy + 0.5, z) || (a.state.waterAt(cx + 0.5, cy + 0.5)?.depth ?? 0) > 4.5);
}

describe('nadie atraviesa paredes, columnas ni muebles', () => {
  it.each(LEVELS)('%s: MAIA andando contra todo se queda fuera de lo sólido y dentro de las paredes', (id) => {
    for (const seed of SEEDS) {
      const r = new Run(registry, registry.character('maia'), registry.level(id), seed);
      const world = r.startWave();
      const a = r.arena;
      // A ~60 px/s, 12 s por diagonal bastan para ir de esquina a esquina: así toca las cuatro paredes
      const moves = [{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }].map((m) => ({ x: m.x * Math.SQRT1_2, y: m.y * Math.SQRT1_2 }));
      let touchedWall = 0;
      for (let t = 0; t < 48; t += 1 / 60) {
        world.step(1 / 60, moves[Math.floor(t / 12)]!);
        world.player.hp = world.player.maxHp; // que los enemigos no corten la prueba
        const p = world.player;
        expect(touchesSolid(a, p.x, p.y, p.z, r.body.radius), `${id} semilla ${seed} t=${t.toFixed(2)} en (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).toBe(false);
        expect(p.x).toBeGreaterThan(a.inner.x0);
        expect(p.x).toBeLessThan(a.inner.x1);
        expect(p.y).toBeGreaterThan(a.inner.y0);
        expect(p.y).toBeLessThan(a.inner.y1);
        if (p.x - r.body.radius - a.inner.x0 < 1 || a.inner.x1 - p.x - r.body.radius < 1) touchedWall++;
      }
      // Que la prueba haya llegado de verdad a las paredes: si no, no estaría probando nada
      expect(touchedWall, `${id} semilla ${seed}`).toBeGreaterThan(0);
    }
  }, 60_000);

  it.each(LEVELS)('%s: los enemigos aparecen y se mueven fuera de lo sólido', (id) => {
    for (const seed of SEEDS) {
      const r = new Run(registry, registry.character('maia'), registry.level(id), seed);
      const world = r.startWave();
      let seen = 0;
      for (let t = 0; t < 15; t += 1 / 60) {
        world.step(1 / 60, { x: 1, y: 0 });
        world.player.hp = world.player.maxHp;
        for (const e of world.enemies) {
          seen++;
          expect(touchesSolid(r.arena, e.x, e.y, e.z, e.def.radius), `${id} semilla ${seed} ${e.def.id} en (${e.x.toFixed(1)}, ${e.y.toFixed(1)})`).toBe(false);
        }
      }
      expect(seen).toBeGreaterThan(0);
    }
  }, 60_000);

  it('el mapa sale de la semilla: la misma da el mismo nivel y el mismo mundo, otra da otro', () => {
    const levels = registry.levels();
    const a = new Run(registry, registry.character('maia'), pickLevel(levels, 7), 7).arena;
    const b = new Run(registry, registry.character('maia'), pickLevel(levels, 7), 7).arena;
    expect(pickLevel(levels, 7).id).toBe(pickLevel(levels, 7).id);
    expect(a.state.hash()).toBe(b.state.hash());
    const c = new Run(registry, registry.character('maia'), registry.level(pickLevel(levels, 7).id), 8).arena;
    expect(c.state.hash()).not.toBe(a.state.hash());
    // Y con unas cuantas semillas salen los tres temas
    expect(new Set(Array.from({ length: 30 }, (_, s) => pickLevel(levels, s).id)).size).toBe(levels.length);
  });
});
