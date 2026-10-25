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

import { playRun } from './pilot';

// Se salta en los tests normales; solo corre con CURVA=1. Una prueba por semilla (una sola de minutos bloqueaba al
// trabajador de vitest) y el resumen al final.
describe.skipIf(!process.env.CURVA)('curva de balance', () => {
  const rows: string[] = [];
  const reached: number[] = [];
  it.each(SEEDS)('semilla %i', { timeout: 600_000 }, (seed) => {
    const r = playRun(new Run(registry, registry.character('maia'), registry.level(LEVEL), seed));
    rows.push(...r.rows);
    reached.push(r.reached);
  });
  afterAll(() => {
    const mean = reached.reduce((a, b) => a + b, 0) / reached.length;
    const sd = Math.sqrt(reached.reduce((a, b) => a + (b - mean) ** 2, 0) / (reached.length - 1 || 1));
    console.log(['', ...(process.env.FILAS ? rows : []), '', `${LEVEL}: oleada alcanzada por semilla: ${reached.join(', ')} (11 = victoria)`,
      `${LEVEL}: media ${mean.toFixed(2)} ± ${(sd / Math.sqrt(reached.length)).toFixed(2)} (error de la media, ${reached.length} semillas)`].join('\n'));
  });
});
