import { describe, expect, it } from 'vitest';
import { discoverContent } from '../src/engine/registry/discover';
import { validateContent } from '../src/engine/registry/validate';
import { Run } from '../src/engine/sim/Run';

const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');
const oficina = registry.level('oficina');

// Una partida recién salida de la oleada `done`, con dinero
function afterWave(done: number, materials = 100, seed = 1) {
  const run = new Run(registry, maia, oficina, seed);
  run.waveIndex = done; // = oleadas superadas
  run.materials = materials;
  run.shop.open();
  return run;
}

describe('tienda', () => {
  it('ofrece tantos huecos como dice el nivel, sin repetir', () => {
    const run = afterWave(1);
    const offers = run.shop.offers.filter(Boolean);
    expect(offers).toHaveLength(oficina.shop.slots);
    expect(new Set(offers.map((o) => `${o!.kind}:${o!.id}`)).size).toBe(offers.length);
  });

  it('respeta minWave: tras la oleada 1 no salen auriculares ni post-it (son de la 2)', () => {
    for (let seed = 1; seed < 40; seed++) {
      const ids = afterWave(0, 100, seed).shop.offers.map((o) => o?.id);
      expect(ids).not.toContain('auriculares');
      expect(ids).not.toContain('post-it');
    }
  });

  it('los precios suben con las oleadas superadas', () => {
    const early = afterWave(1, 100, 3);
    const late = afterWave(8, 100, 3);
    const priceOf = (run: Run, id: string) => run.shop.offers.find((o) => o?.id === id)?.price;
    const shared = early.shop.offers.map((o) => o?.id).find((id) => id && priceOf(late, id) !== undefined);
    if (shared) expect(priceOf(late, shared)!).toBeGreaterThan(priceOf(early, shared)!);
    expect(late.shop.rerollPrice()).toBeGreaterThan(early.shop.rerollPrice());
  });

  it('comprar un ítem cobra, aplica sus modificadores y deja el hueco vacío', () => {
    const run = afterWave(1, 1000);
    const before = run.stats.get('attack-speed-pct');
    run.shop.offers = [{ kind: 'item', id: 'cafe', tier: 0, price: 12, locked: false }];
    expect(run.shop.buy(0)).toEqual({ ok: true });
    expect(run.materials).toBe(988);
    expect(run.stats.get('attack-speed-pct')).toBe(before + 10);
    expect(run.shop.offers[0]).toBeNull();
    expect(run.shop.buy(0).ok).toBe(false);
  });

  it('sin dinero no compra y dice cuánto falta', () => {
    const run = afterWave(1, 5);
    run.shop.offers = [{ kind: 'item', id: 'cafe', tier: 0, price: 12, locked: false }];
    expect(run.shop.buy(0)).toEqual({ ok: false, reason: 'Te faltan 7 materiales' });
    expect(run.materials).toBe(5);
  });

  it('comprar un arma la equipa y cuenta para el pasivo de MAIA', () => {
    const run = afterWave(1, 1000);
    run.shop.offers = [{ kind: 'weapon', id: 'grapadora', tier: 0, price: 18, locked: false }];
    expect(run.stats.get('damage-pct')).toBe(5);
    run.shop.buy(0);
    expect(run.weapons.map((w) => w.id)).toEqual(['buzon', 'grapadora']);
    expect(run.stats.get('damage-pct')).toBe(10);
  });

  it('con 6 armas, una igual se fusiona y sube de nivel; una distinta no cabe', () => {
    const run = new Run(registry, maia, oficina, 1, { weapons: ['buzon', 'buzon', 'buzon', 'buzon', 'buzon', 'regla'] });
    expect(run.addWeapon('buzon')).toEqual({ ok: true });
    expect(run.weapons.filter((w) => w.tier === 1)).toHaveLength(1);
    expect(run.addWeapon('grapadora').ok).toBe(false);
  });

  it('el candado guarda la oferta al volver a tirar, y volver a tirar cuesta cada vez más', () => {
    const run = afterWave(2, 1000, 9);
    const kept = run.shop.offers[0]!;
    run.shop.toggleLock(0);
    const p1 = run.shop.rerollPrice();
    expect(run.shop.reroll()).toEqual({ ok: true });
    expect(run.shop.offers[0]).toEqual({ ...kept, locked: true });
    expect(run.shop.rerollPrice()).toBeGreaterThan(p1);
  });

  it('el post-it (solo hooks) suelta un material extra cada 10 bajas', () => {
    const run = new Run(registry, maia, oficina, 4);
    run.addItem('post-it');
    const world = run.startWave();
    const before = world.materials.length;
    run.kills = 10;
    run.emit('onKill', { at: { x: 100, y: 100 } });
    expect(world.materials.length).toBe(before + 1);
  });
});
