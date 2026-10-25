import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';

// En el Brotato el cuerpo salía de la hoja de sprites (body.test.ts probaba que el motor no asumiera celdas de 32).
// Aquí se escribe en el módulo del personaje: lo que se prueba es que llega tal cual a la partida, con los números
// que tenía MAIA en el Brotato, para que el balance no cambie con el dibujo.
const { registry } = validateContent(discoverContent());

describe('el cuerpo de la jugadora', () => {
  it('MAIA tiene el cuerpo que tenía en el Brotato: radio 5, centro a 10, 67 px/s y armas a 14', () => {
    expect(registry.character('maia').body).toEqual({ radius: 5, centerY: 10, speed: 67, orbit: 14 });
  });

  it('la partida usa ese cuerpo', () => {
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 1);
    expect(run.body).toBe(registry.character('maia').body);
  });

  it('las armas flotan en un círculo de radio orbit alrededor de los pies', () => {
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 1, { weapons: ['buzon', 'regla', 'grapadora'] });
    const world = run.startWave();
    world.step(1 / 60, { x: 0, y: 0 });
    for (const w of world.weapons) expect(Math.hypot(w.x - world.player.x, w.y - world.player.y)).toBeCloseTo(14, 6);
  });
});
