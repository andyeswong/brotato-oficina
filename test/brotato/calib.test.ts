// La calibración por mundo (MAIA, 2026-10-27): enemyDamageScale del nivel multiplica el daño que ganan los enemigos con
// cada oleada solo en ese nivel. Por defecto 1: los otros mundos no cambian.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { levelSchema } from '../../src/game/brotato/registry/schemas';

vi.setConfig({ testTimeout: 120_000 });
const { registry } = validateContent(discoverContent());

// Los enemigos de la oleada `n` (1 = la primera) de un nivel, con el factor que se le dé, tras unos segundos
function waveEnemies(level: string, n: number, scale?: number) {
  const lv = { ...registry.level(level), ...(scale !== undefined ? { enemyDamageScale: scale } : {}) };
  const run = new Run(registry, registry.character('maia'), lv, 4);
  run.waveIndex = n - 1;
  const w = run.startWave();
  for (let t = 0; t < 60 * 8; t++) w.step(1 / 60, { x: 0, y: 0 });
  return { run, w };
}

describe('enemyDamageScale', () => {
  it('por defecto vale 1, y medieval y cyberpunk lo dejan así', () => {
    const parsed = levelSchema.parse({ ...registry.level('medieval'), enemyDamageScale: undefined });
    expect(parsed.enemyDamageScale).toBe(1);
    expect(registry.level('medieval').enemyDamageScale).toBe(1);
    expect(registry.level('cyberpunk').enemyDamageScale).toBe(1);
    expect(registry.level('oficina').enemyDamageScale).toBe(0.9);
  });

  it('con 1 la partida es la misma que sin el campo (misma huella)', () => {
    for (const level of ['medieval', 'cyberpunk']) {
      const a = waveEnemies(level, 6), b = waveEnemies(level, 6, 1);
      expect(runDigest(b.run, b.w, true), level).toBe(runDigest(a.run, a.w, true));
    }
  });

  it('escala el daño que ganan los enemigos con la oleada, y solo eso', () => {
    const n = 6, w = n - 1;
    const full = waveEnemies('cyberpunk', n, 1), half = waveEnemies('cyberpunk', n, 0.5);
    expect(full.w.enemies.length).toBeGreaterThan(0);
    for (const e of half.w.enemies) {
      expect(e.contactDamage).toBe(Math.round(e.def.contactDamage + e.def.damagePerWave * w * 0.5));
    }
    const hpFull = full.w.enemies.map((e) => e.maxHp).sort().join(), hpHalf = half.w.enemies.map((e) => e.maxHp).sort().join();
    expect(hpHalf).toBe(hpFull);   // la vida no cambia
    expect(Math.max(...half.w.enemies.map((e) => e.contactDamage))).toBeLessThan(Math.max(...full.w.enemies.map((e) => e.contactDamage)));
  });
});
