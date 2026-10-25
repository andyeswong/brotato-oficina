import type { Run } from './Run';

export interface Offer {
  readonly kind: 'weapon' | 'item';
  readonly id: string;
  readonly tier: number;     // solo armas: 0 = I
  readonly price: number;
  locked: boolean;           // con candado, sobrevive a "volver a tirar" y a la siguiente tienda
}

export type ShopResult = { ok: true } | { ok: false; reason: string };

// La tienda entre oleadas: función pura de la partida (Run), sin pantalla. Las reglas (huecos,
// precios, coste de volver a tirar) vienen del nivel; lo que se ofrece, de los módulos con bloque shop.
export class Shop {
  // null = hueco ya comprado en esta tienda
  offers: Array<Offer | null> = [];
  rerolls = 0;

  constructor(private readonly run: Run) {}

  // Oleadas ya superadas: los precios suben con ellas
  private get wavesDone(): number {
    return this.run.waveIndex;
  }

  open(): void {
    this.rerolls = 0;
    this.roll();
    this.run.emit('onShopEnter', { wave: this.run.waveNumber });
  }

  rerollPrice(): number {
    const { base, perWave, step } = this.run.level.shop.reroll;
    return Math.floor(base + perWave * Math.max(0, this.wavesDone - 1) + step * this.rerolls);
  }

  reroll(): ShopResult {
    const price = this.rerollPrice();
    if (this.run.materials < price) return { ok: false, reason: `Te faltan ${price - this.run.materials} materiales` };
    this.run.spend(price);
    this.rerolls++;
    this.roll();
    return { ok: true };
  }

  toggleLock(index: number): void {
    const offer = this.offers[index];
    if (offer) offer.locked = !offer.locked;
  }

  buy(index: number): ShopResult {
    const offer = this.offers[index];
    if (!offer) return { ok: false, reason: 'Ya está comprado' };
    if (this.run.materials < offer.price) return { ok: false, reason: `Te faltan ${offer.price - this.run.materials} materiales` };
    const added = offer.kind === 'weapon' ? this.run.addWeapon(offer.id, offer.tier) : this.run.addItem(offer.id);
    if (!added.ok) return added;
    this.run.spend(offer.price);
    this.offers[index] = null;
    this.run.emit('onBuy', { kind: offer.kind, id: offer.id, price: offer.price });
    return { ok: true };
  }

  // Rellena los huecos sin candado con ofertas al azar según su peso, sin repetir dentro de la misma tirada
  private roll(): void {
    const slots = this.run.level.shop.slots;
    const kept = this.offers.filter((o): o is Offer => o !== null && o.locked);
    const taken = new Set(kept.map((o) => `${o.kind}:${o.id}`));
    const next: Array<Offer | null> = [...kept];
    while (next.length < slots) {
      const pool = this.pool().filter((p) => !taken.has(`${p.kind}:${p.id}`));
      if (pool.length === 0) break;
      const total = pool.reduce((sum, p) => sum + p.weight, 0);
      let r = this.run.rng() * total;
      const pick = pool.find((p) => (r -= p.weight) < 0) ?? pool[pool.length - 1]!;
      taken.add(`${pick.kind}:${pick.id}`);
      next.push({ kind: pick.kind, id: pick.id, tier: 0, price: this.price(pick.basePrice), locked: false });
    }
    this.offers = next;
  }

  private price(base: number): number {
    return Math.round(base * (1 + this.run.level.shop.priceScale.perWave * Math.max(0, this.wavesDone - 1)));
  }

  private pool(): Array<{ kind: 'weapon' | 'item'; id: string; weight: number; basePrice: number }> {
    const wave = this.run.waveNumber; // la oleada que viene
    const { registry } = this.run;
    const weapons = registry
      .weapons()
      .filter((w) => w.shop && w.shop.minWave <= wave)
      .map((w) => ({ kind: 'weapon' as const, id: w.id, weight: w.shop!.weight, basePrice: w.shop!.price, order: w.shop!.order ?? Infinity }));
    const items = registry
      .items()
      .filter((i) => i.shop && i.shop.minWave <= wave && this.run.itemCount(i.id) < i.maxStack)
      .map((i) => ({ kind: 'item' as const, id: i.id, weight: i.shop!.weight, basePrice: i.shop!.price, order: i.shop!.order ?? Infinity }));
    // Por shop.order, no por el orden del registro (que es el de las carpetas)
    const byOrder = (a: { id: string; order: number }, b: { id: string; order: number }) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return [...weapons.sort(byOrder), ...items.sort(byOrder)].map(({ order: _o, ...p }) => p);
  }
}
