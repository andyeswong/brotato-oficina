import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent, type DiscoveredModule } from '../../src/game/brotato/registry/validate';
import { THEME_IDS } from '../../src/game/brotato/registry/schemas';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { lookOf } from '../../src/game/brotato/looks';
import { playRunAsync } from './pilot';

// Armas y enemigos tienen un aspecto por mundo (looks: nombre, descripción y modelo). MAIA (2026-10-25): las
// versiones por mundo son solo de aspecto; el papel en el juego es el mismo. Aquí se comprueba que la simulación no
// lo mira y que todo aspecto apunta a un modelo que existe.
const found = discoverContent();
const { registry } = validateContent(found);
const MODELS = join(__dirname, '../../models/brotato');

// El mismo contenido con otros aspectos (armas, enemigos y objetos): nombres, descripciones y modelos cambiados
function withOtherLooks(mods: readonly DiscoveredModule[]): DiscoveredModule[] {
  return mods.map(({ path, value }) => {
    const v = value as { kind?: string; looks?: unknown };
    if (v.kind === 'item') return { path, value: { ...v, looks: { oficina: { name: 'Otro objeto' }, medieval: { name: 'Reliquia' } } } };
    if (v.kind !== 'weapon' && v.kind !== 'enemy') return { path, value };
    const other = { name: 'Otra cosa', description: 'Otro aspecto, el mismo papel', model: 'bicho-taza/bicho-taza' };
    return { path, value: { ...v, looks: { oficina: other, medieval: { ...other, name: 'Autómata' }, cyberpunk: { ...other, name: 'Dron' } } } };
  });
}

async function trace(reg: typeof registry, level: string, seed: number): Promise<string[]> {
  const run = new Run(reg, reg.character('maia'), reg.level(level), seed);
  const digests: string[] = [];
  let tick = 0;
  await playRunAsync(run, {
    onTick: (world) => { if (++tick % 30 === 0) digests.push(runDigest(run, world, false)); },
    onWave: (world) => digests.push(runDigest(run, world)),
  });
  return digests;
}

describe('aspecto por mundo', () => {
  it('toda arma y todo enemigo tiene el aspecto de la oficina, y cada aspecto apunta a un modelo que existe', () => {
    const mods = [...registry.weapons(), ...registry.enemies()];
    expect(mods.length).toBeGreaterThanOrEqual(6);
    for (const mod of mods) {
      expect(mod.looks.oficina, mod.id).toBeDefined();
      for (const theme of THEME_IDS) {
        const look = mod.looks[theme];
        if (!look) continue;
        for (const ref of [look.model, ...('projectile' in look && look.projectile ? [look.projectile] : [])]) {
          expect(existsSync(join(MODELS, `${ref}.json`)), `${mod.id} (${theme}): models/brotato/${ref}.json`).toBe(true);
        }
      }
    }
  });

  // Desde la revisión de la tienda (NARUTO): todo ítem lleva icono en vóxeles en cada mundo, no su inicial
  it('todo objeto tiene el aspecto de la oficina e icono en cada mundo, y el modelo del icono existe', () => {
    const items = registry.items();
    expect(items.length).toBeGreaterThanOrEqual(8);
    for (const item of items) {
      expect(item.looks.oficina, item.id).toBeDefined();
      for (const theme of THEME_IDS) {
        const icon = item.looks[theme]?.icon;
        expect(icon, `${item.id} (${theme}): sin icono`).toBeDefined();
        expect(existsSync(join(MODELS, `${icon}.json`)), `${item.id} (${theme}): models/brotato/${icon}.json`).toBe(true);
      }
    }
  });

  it('la luz que lleva MAIA en cada mundo apunta a un modelo que existe', () => {
    const light = registry.character('maia').carryLight!;
    expect(light.oficina).toBeDefined();
    for (const theme of THEME_IDS) {
      const l = light[theme];
      if (l) expect(existsSync(join(MODELS, `${l.model}.json`)), `${theme}: models/brotato/${l.model}.json`).toBe(true);
    }
  });

  it('un mundo sin aspecto propio usa el de la oficina', () => {
    const tiro = registry.weapon('tiro');
    expect(lookOf(tiro, 'oficina').name).toBe('Pistola de plasma');
    expect(lookOf(tiro, 'medieval')).toBe(tiro.looks.medieval ?? tiro.looks.oficina);
  });

  it('la simulación no mira el aspecto: con otros aspectos, la misma partida da la misma huella en cada paso', { timeout: 240_000 }, async () => {
    const other = validateContent(withOtherLooks(found));
    expect(other.errors).toEqual([]);
    expect(other.registry.weapon('tiro').looks.oficina.name).toBe('Otra cosa');
    for (const [level, seed] of [['oficina', 5], ['medieval', 21]] as const) {
      const a = await trace(registry, level, seed);
      const b = await trace(other.registry, level, seed);
      expect(a.length).toBeGreaterThan(100);
      const first = a.findIndex((d, i) => d !== b[i]);
      expect(first, `${level} ${seed}: se separan en la huella ${first}`).toBe(-1);
    }
  });
});
