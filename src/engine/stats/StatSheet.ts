import type { Modifier } from '../registry/schemas';

export interface StatDef {
  id: string;
  base: number;
  min: number;
  max: number;
}

export type CounterReader = (counter: string) => number;

// Una sola fórmula para todo lo que cambia una estadística:
//   valor = clamp((base + Σadd) × (1 + Σpct/100) × Πmul, min, max)
// Los modificadores se guardan por fuente ("character:maia", "item:cafe#2"…): quitar una fuente deshace su efecto.
export class StatSheet {
  private readonly sources = new Map<string, readonly Modifier[]>();
  private cache = new Map<string, number>();

  constructor(
    private readonly defs: ReadonlyMap<string, StatDef>,
    private readonly baseOverrides: Readonly<Record<string, number>> = {},
    private readonly counters: CounterReader = () => 0,
  ) {}

  setSource(source: string, mods: readonly Modifier[]): void {
    this.sources.set(source, mods);
    this.invalidate();
  }

  removeSource(source: string): void {
    if (this.sources.delete(source)) this.invalidate();
  }

  // Llamarlo cuando cambie un contador del que puede depender un modificador "per"
  invalidate(): void {
    this.cache.clear();
  }

  get(stat: string): number {
    const cached = this.cache.get(stat);
    if (cached !== undefined) return cached;

    const def = this.defs.get(stat);
    if (!def) throw new Error(`StatSheet: estadística desconocida "${stat}"`);

    let add = 0;
    let pct = 0;
    let mul = 1;
    for (const mods of this.sources.values()) {
      for (const m of mods) {
        if (m.stat !== stat) continue;
        const k = this.factor(m);
        if (m.add !== undefined) add += m.add * k;
        if (m.pct !== undefined) pct += m.pct * k;
        if (m.mul !== undefined) mul *= m.mul ** k;
      }
    }
    const base = this.baseOverrides[stat] ?? def.base;
    const value = Math.min(def.max, Math.max(def.min, (base + add) * (1 + pct / 100) * mul));
    this.cache.set(stat, value);
    return value;
  }

  // Cuántas veces aplica un modificador: 1, o floor(contador / every) si escala con un contador
  private factor(m: Modifier): number {
    if (!m.per) return 1;
    const times = Math.floor(this.counters(m.per.counter) / m.per.every);
    if (m.per.max === undefined) return times;
    const step = Math.abs(m.add ?? m.pct ?? 1) || 1;
    return Math.min(times, Math.floor(m.per.max / step));
  }
}
