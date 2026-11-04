// El aspecto de la oficina y del cyberpunk (levels/*/look.ts, NARUTO 2026-11-04): sus losetas, su fachada y lo que
// ponen por el suelo no cambian la partida: cada vóxel que pone el decorado se atraviesa, no quita ninguno, y lo que para
// un disparo es lo mismo con él que sin él. La única excepción, acordada con FERN: los charcos se redondean quitando
// agua (nunca añadiendo). Y sale entero y siempre igual para la misma semilla.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Arena, levelWorld } from '../../src/game/brotato/sim/arena';
import { mamparaPillar } from '../../src/game/brotato/sim/decor';
import { buildWorldState } from '@voxpix/world/build';
import { materialsOf } from '@voxpix/core';
import { MAX_LIGHTS } from '@voxpix/view/gpu/shaders';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());
const SHOT_Z = 8;

// Lo que cambia el decorado (con él frente a sin él): los vóxeles que pone, por rampa; los que pone y paran el paso
// (ninguno, salvo el suelo de los charcos que se secan); los que quita (ninguno), y los que repinta (las losas del
// suelo) sin cambiar lo que son para la partida
function decorVoxels(a: Arena, b: Arena): { added: Map<string, number>; blocking: string[]; removed: number; repainted: number; changed: string[] } {
  const ma = a.world.model, mb = b.world.model, ta = materialsOf(ma.palette)!, tb = materialsOf(mb.palette)!;
  const added = new Map<string, number>(), blocking: string[] = [], changed: string[] = [];
  let removed = 0, repainted = 0;
  for (let y = 0; y < a.world.depth; y++) for (let x = 0; x < a.world.width; x++) for (let z = 0; z < 40; z++) {
    const va = ma.get(x, y, z), vb = mb.get(x, y, z);
    if (va === vb) continue;
    if (!va) { removed++; continue; }
    const ramp = ma.palette.ramps[Math.floor((va - 1) / 16)]!.name;
    // Donde un charco se secó (charcos.ts, acordado con FERN): el suelo que rellena su cuenca
    if (!a.world.wet[y * a.world.width + x] && b.world.wet[y * b.world.width + x]) { added.set('charco seco', (added.get('charco seco') ?? 0) + 1); continue; }
    if (vb) {
      repainted++;
      if (ta.blocks[va] !== tb.blocks[vb] || ta.bed[va] !== tb.bed[vb] || ta.climb[va] !== tb.climb[vb]) changed.push(`${x},${y},${z} ${ramp}`);
      continue;
    }
    added.set(ramp, (added.get(ramp) ?? 0) + 1);
    // El café de las tazas de sim/decor.ts es el agua del tema, que es sólida: no es de este decorado
    if (ta.blocks[va] && ramp !== 'agua') blocking.push(`${x},${y},${z} ${ramp}`);
  }
  return { added, blocking, removed, repainted, changed };
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
        expect(d.changed.slice(0, 5)).toEqual([]);
        // Los charcos solo pierden agua: lo mojado con el decorado está mojado sin él
        let wetA = 0, wetB = 0;
        for (let i = 0; i < a.world.wet.length; i++) { wetA += a.world.wet[i]!; wetB += b.world.wet[i]!; if (a.world.wet[i]) expect(b.world.wet[i]).toBe(1); }
        expect(wetB - wetA).toBe(a.decor.secos);
        expect(a.decor.secos).toBeGreaterThan(0);
        // Las luces del mundo caben en las que pinta la GPU en un cuadro (MAX_LIGHTS, con la que lleva MAIA)
        expect(a.world.lights.length).toBeLessThanOrEqual(MAX_LIGHTS - 2);
        // Y lo que ve la partida, igual fuera de los charcos secados: donde se apoya el pie y lo que para un disparo
        for (let y = 0; y < a.world.depth; y += 3) for (let x = 0; x < a.world.width; x += 3) {
          if (b.world.wet[y * b.world.width + x]) continue;
          if (b.world.model.get(x, y, 2) && b.world.model.palette.ramps[Math.floor((b.world.model.get(x, y, 2) - 1) / 16)]!.name === 'agua') continue;
          expect(a.state.solidAt(x, y, a.floorZ + SHOT_Z)).toBe(b.state.solidAt(x, y, b.floorZ + SHOT_Z));
        }
      }
    });
  }

  it('oficina: moqueta, montones de papel, grupos contra la pared, tubos colgados y lámparas en cada piso', () => {
    for (const floor of [0, 3, 6, 9]) {
      const a = new Arena(registry.level('oficina'), 5, { floor }), d = a.decor;
      expect(d.alfombras, `piso ${floor}`).toBeGreaterThanOrEqual(3);
      expect(d.montones).toBeGreaterThanOrEqual(3);
      expect(d.plantas).toBeGreaterThanOrEqual(4);
      expect(d.lamparas).toBeGreaterThanOrEqual(1);
      expect(d.tubos).toBeGreaterThanOrEqual(4);
      for (const k of ['lampara-', 'tubo-']) expect(a.world.lights.filter((l) => String(l.id).startsWith(k)).length).toBe(k === 'tubo-' ? d.tubos : d.lamparas);
    }
  });

  it('cyberpunk: el cruce con su holograma, alcantarillas, contenedores, expendedoras, farolas y rótulos con su luz', () => {
    for (const floor of [0, 3, 6, 9]) {
      const a = new Arena(registry.level('cyberpunk'), 5, { floor }), d = a.decor;
      expect(d.calzada, `piso ${floor}`).toBeGreaterThan(20000);
      expect(d.hologramas).toBe(1);
      expect(d.alcantarillas).toBeGreaterThanOrEqual(1);
      expect(d.contenedores).toBeGreaterThanOrEqual(1);
      expect(d.expendedoras).toBeGreaterThanOrEqual(1);
      expect(d.farolas).toBeGreaterThanOrEqual(2);
      for (const k of ['expendedora-', 'farola-', 'rotulo-']) expect(a.world.lights.filter((l) => String(l.id).startsWith(k)).length).toBe(k === 'farola-' ? d.farolas : k === 'rotulo-' ? d.rotulos : d.expendedoras);
    }
  });

  it('oficina: la mampara alta pesa, ocupa y bloquea lo mismo que la de sim/decor.ts', () => {
    const look = levelWorld(registry.level('oficina')).look;
    for (const seed of [3, 7, 11]) {
      const layout = new Arena(registry.level('oficina'), seed, { floor: seed % 4 }).layout;
      const a = buildWorldState(layout, look).state, b = buildWorldState(layout, { ...look, pillar: mamparaPillar }).state;
      const pa = [...a.objects].filter((o) => o.kind === 'pillar'), pb = [...b.objects].filter((o) => o.kind === 'pillar');
      expect(pa.length, `semilla ${seed}`).toBeGreaterThan(0);
      expect(pa.map((o) => o.mass)).toEqual(pb.map((o) => o.mass));
      expect(pa.map((o) => [o.x, o.y])).toEqual(pb.map((o) => [o.x, o.y]));
      // Lo que ve la partida en cada columna: dónde se apoya el pie y lo que para un disparo
      for (let y = 0; y < a.solid.depth; y++) for (let x = 0; x < a.solid.width; x++) {
        if (a.solid.walkAt(x, y) !== b.solid.walkAt(x, y)) expect(`${x},${y} ${a.solid.walkAt(x, y)}`).toBe(`${x},${y} ${b.solid.walkAt(x, y)}`);
        if (a.solidAt(x, y, 1 + SHOT_Z) !== b.solidAt(x, y, 1 + SHOT_Z)) expect(`${x},${y} disparo`).toBe('igual');
      }
      // Y es más alta: llega a z 14
      expect(pa.some((o) => { for (let i = 2; i < o.cells.length; i += 4) if (o.z + o.cells[i]! >= 14) return true; return false; })).toBe(true);
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
