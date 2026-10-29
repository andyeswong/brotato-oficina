import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { THEME_IDS } from '../../src/game/brotato/registry/schemas';

// El largo del arma (def.length, del agarre a la punta) lo usa la simulación y nace ahí el fogonazo; el modelo de cada
// mundo tiene que llegar hasta ahí. Sin esta prueba el lienzo de 28 de armas_capas.px.js recortó en silencio todo lo
// que pasaba de 13 vóxeles por delante del agarre (MAIA, 2026-10-29): el perforador perdía 9 y las hojas 6, y el
// fogonazo quedaba flotando delante del arma. Lo mismo para sus cuatro poses de disparo (<id>-anim0..3) quietas en
// su sitio: la anim3 es la vuelta al reposo.
const { registry } = validateContent(discoverContent());
const MODELS = join(__dirname, '../../models/brotato');
// Hacia delante es y negativo; el agarre está en el origen
const reach = (model: string) => {
  const { voxels } = JSON.parse(readFileSync(join(MODELS, `${model}.json`), 'utf8')) as { voxels: number[][] };
  return -Math.min(...voxels.map((v) => v[1]!));
};

describe('el modelo de cada arma llega hasta su punta', () => {
  for (const w of registry.weapons()) for (const theme of THEME_IDS) {
    const model = (w.looks as Record<string, { model?: string } | undefined> | undefined)?.[theme]?.model;
    if (!model) continue;
    it(`${w.id} en ${theme} (${model}): largo ${w.length}`, () => {
      expect(Math.abs(reach(model) - w.length)).toBeLessThanOrEqual(1);
      expect(Math.abs(reach(`${model}-anim3`) - w.length)).toBeLessThanOrEqual(1);
    });
  }
});
