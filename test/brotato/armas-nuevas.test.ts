// Las cuatro armas de comportamiento nuevo (MAIA, 2026-11-04): retorno, chorro, explosivo y golpe de suelo.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { lobHeight } from '../../src/game/brotato/play';
import type { WorldFx } from '../../src/game/brotato/sim/World';

vi.setConfig({ testTimeout: 60_000 });
const { registry } = validateContent(discoverContent());
const TICK = 1 / 60;

function play(weapon: string, seed = 5, secs = 20, each?: (w: ReturnType<Run['startWave']>) => void) {
  const run = new Run(registry, registry.character('maia'), registry.level('oficina'), seed, { weapons: [weapon] });
  const w = run.startWave();
  for (let t = 0; t < 60 * secs; t++) {
    w.player.hp = w.player.maxHp;
    w.step(TICK, { x: 0, y: 0 });
    each?.(w);
  }
  return { run, w };
}
const fxOf = <T extends WorldFx['type']>(list: readonly WorldFx[], type: T) => list.filter((f): f is Extract<WorldFx, { type: T }> => f.type === type);

describe('armas nuevas', () => {
  it('retorno: da la vuelta, vuelve al cuerpo y desaparece', () => {
    const backs = new Set<number>(), seen = new Set<number>();
    let maxLive = 0;
    const { w } = play('retorno', 5, 20, (x) => {
      maxLive = Math.max(maxLive, x.projectiles.length);
      for (const p of x.projectiles) { seen.add(p.uid); if (p.back) backs.add(p.uid); }
    });
    expect(seen.size).toBeGreaterThan(3);
    expect(backs.size).toBeGreaterThan(0);
    expect(maxLive).toBeLessThan(8);   // vuelven: no se acumulan
    expect(fxOf(w.fx, 'enemy-hit').length).toBeGreaterThan(0);
  });

  it('chorro: cada disparo avisa a la vista y daña sin proyectiles', () => {
    let shots = 0;
    const { w } = play('chorro', 5, 25, (x) => { shots += x.projectiles.filter((p) => p.owner === 'player').length; });
    expect(shots).toBe(0);
    expect(fxOf(w.fx, 'spray').length).toBeGreaterThan(3);
    expect(fxOf(w.fx, 'enemy-hit').length).toBeGreaterThan(0);
  });

  it('explosivo: vuela sin chocar y explota donde cae', () => {
    let lobs = 0;
    const seen = new Set<number>();
    const { w } = play('explosivo', 5, 20, (x) => {
      for (const p of x.projectiles) if (p.lob && !seen.has(p.uid)) { seen.add(p.uid); lobs++; expect(p.hit.size).toBe(0); }
    });
    expect(lobs).toBeGreaterThan(2);
    const blasts = fxOf(w.fx, 'blast');
    expect(blasts.length).toBeGreaterThan(1);
    expect(blasts[0]!.radius).toBe(30);
    expect(fxOf(w.fx, 'enemy-hit').length).toBeGreaterThan(0);
  });

  it('el arco sube y vuelve al suelo', () => {
    expect(lobHeight(100, 100)).toBe(0);
    expect(lobHeight(100, 0)).toBe(0);
    expect(lobHeight(100, 50)).toBeGreaterThan(lobHeight(100, 90));
  });

  it('golpe de suelo: el golpe y su onda', () => {
    const { w } = play('golpe-suelo', 5, 25);
    expect(fxOf(w.fx, 'blast').length).toBeGreaterThan(0);
    expect(fxOf(w.fx, 'enemy-hit').length).toBeGreaterThan(0);
  });

  it('la misma semilla da la misma partida con cada una', () => {
    for (const id of ['retorno', 'chorro', 'explosivo', 'golpe-suelo']) {
      const a = play(id, 9, 15), b = play(id, 9, 15);
      expect(runDigest(b.run, b.w, true), id).toBe(runDigest(a.run, a.w, true));
    }
  });
});
