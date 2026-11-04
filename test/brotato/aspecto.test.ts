// El aspecto de la oficina y del cyberpunk (levels/*/look.ts, NARUTO 2026-11-04): sus losetas, su fachada y lo que
// ponen por el suelo no cambian la partida: cada vóxel que pone el decorado se atraviesa, no quita ninguno, y lo que para
// un disparo es lo mismo con él que sin él. Y sale entero y siempre igual para la misma semilla.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Arena } from '../../src/game/brotato/sim/arena';
import { materialsOf } from '@voxpix/core';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());
const SHOT_Z = 8;

// Los vóxeles que pone el decorado (los que hay con él y no sin él), por rampa, y los que quitaría (ninguno)
function decorVoxels(a: Arena, b: Arena): { added: Map<string, number>; blocking: string[]; removed: number } {
  const ma = a.world.model, mb = b.world.model, mt = materialsOf(ma.palette)!;
  const added = new Map<string, number>(), blocking: string[] = [];
  let removed = 0;
  for (let y = 0; y < a.world.depth; y++) for (let x = 0; x < a.world.width; x++) for (let z = 0; z < 40; z++) {
    const va = ma.get(x, y, z), vb = mb.get(x, y, z);
    if (va === vb) continue;
    if (!va) { removed++; continue; }
    const ramp = ma.palette.ramps[Math.floor((va - 1) / 16)]!.name;
    added.set(ramp, (added.get(ramp) ?? 0) + 1);
    // El café de las tazas de sim/decor.ts es el agua del tema, que es sólida: no es de este decorado
    if (mt.blocks[va] && ramp !== 'agua') blocking.push(`${x},${y},${z} ${ramp}`);
  }
  return { added, blocking, removed };
}

describe('el aspecto de la oficina y del cyberpunk', () => {
  for (const id of ['oficina', 'cyberpunk']) {
    it(`${id}: con el decorado se anda y se dispara igual que sin él`, () => {
      for (const [seed, floor] of [[3, 0], [7, 4], [11, 9]] as const) {
        const a = new Arena(registry.level(id), seed, { floor }), b = new Arena(registry.level(id), seed, { floor, foliage: false });
        const d = decorVoxels(a, b);
        expect(d.added.size, `semilla ${seed} piso ${floor}`).toBeGreaterThan(5);
        expect(d.blocking.slice(0, 5), `semilla ${seed} piso ${floor}`).toEqual([]);
        expect(d.removed).toBe(0);
        // Y lo que ve la partida, igual: donde se apoya el pie y lo que para un disparo, en cada columna
        for (let y = 0; y < a.world.depth; y += 3) for (let x = 0; x < a.world.width; x += 3) {
          if (b.world.model.get(x, y, 2) && b.world.model.palette.ramps[Math.floor((b.world.model.get(x, y, 2) - 1) / 16)]!.name === 'agua') continue;
          expect(a.state.solidAt(x, y, a.floorZ + SHOT_Z)).toBe(b.state.solidAt(x, y, b.floorZ + SHOT_Z));
        }
      }
    });
  }

  it('oficina: plantas, cajas, papeleras, fuentes de agua, sillas y papeles en cada piso', () => {
    for (const floor of [0, 3, 6, 9]) {
      const d = new Arena(registry.level('oficina'), 5, { floor }).decor;
      expect(d.plantas, `piso ${floor}`).toBeGreaterThanOrEqual(6);
      expect(d.cajas).toBeGreaterThanOrEqual(4);
      expect(d.papeleras).toBeGreaterThanOrEqual(4);
      expect(d.fuentes).toBeGreaterThanOrEqual(1);
      expect(d.sillas).toBeGreaterThanOrEqual(3);
      expect(d.papeles).toBeGreaterThanOrEqual(80);
    }
  });

  it('cyberpunk: contenedores, bolsas, expendedoras con su luz, conos, hologramas y tuberías en cada piso', () => {
    for (const floor of [0, 3, 6, 9]) {
      const a = new Arena(registry.level('cyberpunk'), 5, { floor }), d = a.decor;
      expect(d.contenedores, `piso ${floor}`).toBeGreaterThanOrEqual(1);
      expect(d.bolsas).toBeGreaterThanOrEqual(4);
      expect(d.expendedoras).toBeGreaterThanOrEqual(1);
      expect(a.world.lights.filter((l) => String(l.id).startsWith('expendedora-')).length).toBe(d.expendedoras);
      expect(d.conos).toBeGreaterThanOrEqual(3);
      expect(d.hologramas).toBeGreaterThanOrEqual(2);
      expect(d.tuberias).toBeGreaterThanOrEqual(2);
    }
  });

  it('el decorado sale igual con la misma semilla', () => {
    for (const id of ['oficina', 'cyberpunk']) {
      const a = new Arena(registry.level(id), 9, { floor: 2 }), b = new Arena(registry.level(id), 9, { floor: 2 });
      expect(a.decor).toEqual(b.decor);
      expect(decorVoxels(a, b).added.size).toBe(0);
    }
  });
});
