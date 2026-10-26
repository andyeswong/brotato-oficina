import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { kite, steer } from './pilot';

// La vegetación (src/game/brotato/sim/foliage.ts): solo en medieval, y solo aspecto: la partida es la misma con y sin ella
const { registry } = validateContent(discoverContent());

describe('la vegetación', () => {
  it('solo medieval la lleva: hierba, flores, juncos y nenúfares en todas las semillas probadas', { timeout: 60_000 }, () => {
    for (const seed of [1, 2, 3]) {
      const m = new Run(registry, registry.character('maia'), registry.level('medieval'), seed).arena.plants;
      expect(m.grass, `semilla ${seed}`).toBeGreaterThan(0);
      expect(m.flowers, `semilla ${seed}`).toBeGreaterThan(0);
      expect(m.reeds, `semilla ${seed}`).toBeGreaterThan(0);
      expect(m.lilies, `semilla ${seed}`).toBeGreaterThan(0);
      for (const lv of ['oficina', 'cyberpunk']) expect(new Run(registry, registry.character('maia'), registry.level(lv), seed).arena.plants).toEqual({});
    }
  });

  it('los nenúfares flotan: son flotantes del agua con ids propios, y oficina y cyberpunk no tienen', { timeout: 60_000 }, () => {
    for (const seed of [1, 3]) {
      const st = new Run(registry, registry.character('maia'), registry.level('medieval'), seed).arena.state;
      expect(st.floaters.list.length, `semilla ${seed}`).toBeGreaterThan(0);
      expect(st.floaters.list.every((f) => String(f.id).startsWith('flota-') && st.entities.get(f.id))).toBe(true);
    }
    expect(new Run(registry, registry.character('maia'), registry.level('oficina'), 1).arena.state.floaters.list.length).toBe(0);
  });

  it('la hierba, las flores, los juncos y los nenúfares se atraviesan: con y sin ellos, la misma partida jugada por el piloto da la misma huella', { timeout: 120_000 }, () => {
    for (const seed of [2, 5]) {
      // Sin arbustos: esos sí bloquean (van aparte, más abajo)
      const runs = [true, false].map((foliage) => new Run(registry, registry.character('maia'), registry.level('medieval'), seed, { foliage, bushes: false }));
      expect(runs[0]!.arena.plants.grass).toBeGreaterThan(0);
      const waves = runs.map((r) => r.startWave());
      for (let t = 0; t < 1200; t++) {
        for (let k = 0; k < 2; k++) {
          const w = waves[k]!, r = runs[k]!;
          if (w.status !== 'playing') continue;
          const d = steer(r, w.player, kite(w, r));
          w.step(1 / 60, d);
        }
      }
      expect(runDigest(runs[0]!, waves[0]!, false), `semilla ${seed}`).toBe(runDigest(runs[1]!, waves[1]!, false));
    }
  });

  // Los arbustos bloquean (decisión de Andrés): no tapan la salida, los enemigos no aparecen dentro de uno y la arena
  // sigue siendo alcanzable desde la salida
  it('arbustos: bloquean, la salida queda libre, ningún punto de aparición cae en uno y todo sigue alcanzable', { timeout: 120_000 }, () => {
    for (const seed of [1, 2, 3]) {
      const withB = new Run(registry, registry.character('maia'), registry.level('medieval'), seed).arena;
      const without = new Run(registry, registry.character('maia'), registry.level('medieval'), seed, { bushes: false }).arena;
      expect(withB.plants.bushes, `semilla ${seed}`).toBeGreaterThan(0);
      // Bloquean: hay sitios donde sin arbustos cabía MAIA y con ellos no
      const r = 5, z = withB.floorZ;
      let blocked = 0;
      for (let y = withB.inner.y0; y < withB.inner.y1; y += 4) for (let x = withB.inner.x0; x < withB.inner.x1; x += 4)
        if (without.fits(x, y, z, r) && !withB.fits(x, y, z, r)) blocked++;
      expect(blocked, `semilla ${seed}`).toBeGreaterThan(0);
      expect(withB.fits(withB.start.x, withB.start.y, z, r)).toBe(true);
      // Puntos de aparición: todos dejan sitio al enemigo más grande, y se pierden pocos
      expect(withB.spawnPoints.every((p) => withB.fits(p.x, p.y, z, 6))).toBe(true);
      expect(withB.spawnPoints.length / without.spawnPoints.length, `semilla ${seed}`).toBeGreaterThan(0.85);
      // Alcanzable: desde la salida, en una rejilla de 4 vóxeles, por donde cabe MAIA
      const reach = (a: typeof withB) => {
        const S = 4, key = (x: number, y: number) => `${x},${y}`;
        const sx = Math.round(a.start.x / S) * S, sy = Math.round(a.start.y / S) * S;
        const seen = new Set([key(sx, sy)]), queue = [[sx, sy]];
        while (queue.length) {
          const [x, y] = queue.pop()!;
          for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) {
            const nx = x! + dx!, ny = y! + dy!, k = key(nx, ny);
            if (!seen.has(k) && a.fits(nx, ny, z, r)) { seen.add(k); queue.push([nx, ny]); }
          }
        }
        return { seen, near: (px: number, py: number) => [0, S].some((ox) => [0, S].some((oy) => seen.has(key(Math.floor(px / S) * S + ox, Math.floor(py / S) * S + oy)))) };
      };
      const a = reach(withB), b = reach(without);
      expect(a.seen.size / b.seen.size, `semilla ${seed}`).toBeGreaterThan(0.9);
      expect(withB.spawnPoints.filter((p) => !a.near(p.x, p.y)).length, `semilla ${seed}: puntos de aparición sin camino`).toBe(0);
    }
  });
});
