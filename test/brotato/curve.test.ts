// Informe de balance, no un test: CURVA=1 npx vitest run test/brotato/curve.test.ts (SEEDS=1,2 LEVEL=medieval; sin LEVEL,
// la oficina; FILAS=1 enseña cada oleada). Portado del Brotato (scripts/curve.test.ts): juega partidas completas con
// el mismo piloto automático y la misma política de compra (test/brotato/pilot.ts) e imprime la oleada alcanzada.
import { afterAll, describe, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';

const { registry } = validateContent(discoverContent());
const SEEDS = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const LEVEL = process.env.LEVEL ?? 'oficina';

import { playRunAsync } from './pilot';

// Se salta en los tests normales; solo corre con CURVA=1. Una prueba por semilla (una sola de minutos bloqueaba al
// trabajador de vitest) y el resumen al final.
// FORZAR=<id>: la partida empieza con esa arma o ese objeto (la tanda forzada de MAIA para lo que el piloto apenas
// compra: comprobar que no rompe la curva aunque no lo elija)
const FORZAR = process.env.FORZAR;

// Se salta en los tests normales; solo corre con CURVA=1. Una prueba por semilla (una sola de minutos bloqueaba al
// trabajador de vitest) y el resumen al final, con el % de partidas en que el piloto acabó con cada arma u objeto.
describe.skipIf(!process.env.CURVA)('curva de balance', () => {
  const rows: string[] = [];
  const reached: number[] = [];
  const owned = new Map<string, number>();
  it.each(SEEDS)('semilla %i', { timeout: 600_000 }, async (seed) => {
    const run = new Run(registry, registry.character('maia'), registry.level(LEVEL), seed);
    if (FORZAR) {
      const ok = registry.has('weapon', FORZAR) ? run.addWeapon(FORZAR) : run.addItem(FORZAR);
      if (!ok.ok) throw new Error(`no se pudo forzar ${FORZAR}: ${ok.reason}`);
    }
    const r = await playRunAsync(run);
    rows.push(...r.rows);
    reached.push(r.reached);
    for (const id of new Set([...run.weapons.map((w) => w.id), ...run.items])) owned.set(id, (owned.get(id) ?? 0) + 1);
  });
  afterAll(() => {
    const mean = reached.reduce((a, b) => a + b, 0) / reached.length;
    const sd = Math.sqrt(reached.reduce((a, b) => a + (b - mean) ** 2, 0) / (reached.length - 1 || 1));
    const ids = [...registry.weapons(), ...registry.items()].map((m) => m.id);
    const pct = ids.map((id) => `${id} ${Math.round((100 * (owned.get(id) ?? 0)) / reached.length)} %`).join(', ');
    console.log(['', ...(process.env.FILAS ? rows : []), '', `${LEVEL}${FORZAR ? ` (forzando ${FORZAR})` : ''}: oleada alcanzada por semilla: ${reached.join(', ')} (11 = victoria)`,
      `${LEVEL}: media ${mean.toFixed(2)} ± ${(sd / Math.sqrt(reached.length)).toFixed(2)} (error de la media, ${reached.length} semillas)`,
      `${LEVEL}: partidas que acaban con cada pieza: ${pct}`].join('\n'));
  });
});
