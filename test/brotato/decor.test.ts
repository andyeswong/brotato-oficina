// Lo de cada tema (sim/decor.ts, Andrés 2026-10-26): mamparas y pilares de neón como columnas (bloquean), cables y
// tazas que se cruzan (no bloquean nada), y el líquido de cada tema en la rampa 'agua' de su paleta.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Arena } from '../../src/game/brotato/sim/arena';
import { TILE, WALL } from '@voxpix/worldgen';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());

// Los vóxeles del mundo cuya rampa se llama así
function voxelsOf(arena: Arena, ramp: string): Array<[number, number, number]> {
  const m = arena.world.model, idx = m.palette.ramps.findIndex((r) => r.name === ramp), out: Array<[number, number, number]> = [];
  for (let y = 0; y < arena.world.depth; y++) for (let x = 0; x < arena.world.width; x++) for (let z = 0; z < 6; z++) {
    const v = m.get(x, y, z);
    if (v && Math.floor((v - 1) / 16) === idx) out.push([x, y, z]);
  }
  return out;
}

describe('los adornos de cada tema', () => {
  it('cyberpunk: cables por el suelo que no paran ni a nadie ni un disparo', () => {
    const arena = new Arena(registry.level('cyberpunk'), 3);
    const cables = [...voxelsOf(arena, 'cable'), ...voxelsOf(arena, 'cable de color')];
    expect(cables.length).toBe(arena.decor.cables);
    expect(cables.length).toBeGreaterThan(200);
    for (const [x, y, z] of cables) expect(arena.state.solidAt(x, y, z), `${x},${y},${z}`).toBe(false);
    // Ni suben el suelo: donde hay un cable se apoya igual que al lado
    const [x, y] = cables[0]!;
    expect(arena.restZ(x + 0.5, y + 0.5, 1)).toBe(arena.floorZ);
  });

  it('oficina: tazas tumbadas junto al café, que tampoco paran nada', () => {
    let cups = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const arena = new Arena(registry.level('oficina'), seed);
      cups += arena.decor.cups ?? 0;
      for (const [x, y, z] of [...voxelsOf(arena, 'taza blanca'), ...voxelsOf(arena, 'taza roja')]) expect(arena.state.solidAt(x, y, z)).toBe(false);
    }
    expect(cups).toBeGreaterThanOrEqual(6);
  });

  it('el líquido: café opaco en la oficina, tóxico que brilla en el cyberpunk, agua de siempre en el medieval', () => {
    const water = (id: string) => new Arena(registry.level(id), 1).world.model.palette.ramps.find((r) => r.name === 'agua')!;
    expect(water('oficina').emissive).toBeFalsy();
    expect(water('oficina').colors[2]).toBe('#43260f');
    expect(water('cyberpunk').emissive).toBe(true);
    expect(water('medieval').colors).toEqual(['#0e1a2e', '#16304a', '#1f4a66', '#2f6a86', '#5a9ab4']);
  });

  it('mamparas y pilares son columnas de verdad: en cada loseta de columna hay algo sólido a la altura de los disparos', () => {
    for (const id of ['oficina', 'cyberpunk']) {
      const arena = new Arena(registry.level(id), 5);
      const { layout } = arena, D = layout.rows * TILE;
      let tiles = 0;
      for (let cy = 0; cy < layout.rows; cy++) for (let cx = 0; cx < layout.cols; cx++) {
        const i = cy * layout.cols + cx;
        if (!layout.pillar[i] || layout.wall[i] !== WALL.none || layout.props.some((p) => cx >= p.x && cx < p.x + p.w && cy >= p.y && cy < p.y + p.h)) continue;
        tiles++;
        let solid = 0;
        for (let y = D - (cy + 1) * TILE; y < D - cy * TILE; y++) for (let x = cx * TILE; x < (cx + 1) * TILE; x++) if (arena.shotBlocked(x, y)) solid++;
        expect(solid, `${id} columna ${cx},${cy}`).toBeGreaterThan(20);
      }
      expect(tiles, id).toBeGreaterThan(0);
    }
  });

  it('la misma semilla da el mismo mundo, adornos incluidos', () => {
    for (const id of ['oficina', 'cyberpunk']) {
      const a = new Arena(registry.level(id), 9), b = new Arena(registry.level(id), 9);
      expect(a.decor).toEqual(b.decor);
      expect(a.state.hash()).toBe(b.state.hash());
    }
  });
});
