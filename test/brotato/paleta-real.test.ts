// Los muebles con la paleta de una partida de verdad: MAIA, las armas y los enemigos de los tres temas suman sus rampas
// a la del mundo y la pasan de 64. Despertar un mueble (empujarlo) o romperlo con caída reventaba con "demasiadas
// rampas: 67" (Andrés, 2026-10-28; arreglo de NARUTO en voxpix 86643af). Las pruebas de objetos.test.ts no lo veían:
// usan la arena sola, sin modelos registrados
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_RAMPS, Model, type ModelFile } from '@voxpix/core';
import { walkFrames, WALK_FRAME_MS } from '@voxpix/anim/walk';
import { rigFrames } from '@voxpix/anim/rig';
import { RIG_CLIP, RIG_GRAPA, RIG_TAZA } from '../../src/anim/rigs-brotato';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { FURNITURE_HP } from '../../src/game/brotato/sim/furniture';

const { registry } = validateContent(discoverContent());
const load = (path: string) => Model.fromJSON(JSON.parse(readFileSync(path, 'utf8')) as ModelFile);

// Los mismos modelos que carga app/src/juego/main.ts
const cache = new Map<string, Model>();
const model = (ref: string) => { let m = cache.get(ref); if (!m) cache.set(ref, (m = load(`models/brotato/${ref}.json`))); return m; };
const RIGS: Record<string, typeof RIG_GRAPA> = { perseguidor: RIG_GRAPA, embestidor: RIG_CLIP, escupidor: RIG_TAZA };
const models: Models = { model, walk: (ref, role) => (RIGS[role] ? { frames: rigFrames(model(ref), RIGS[role]!), ms: RIGS[role]!.frameMs } : null) };
const maia = load('node_modules/voxpix/models/maia/maia.json');

// Una partida con todo lo que puede enseñar ya en el mundo (lo que sube Compositor.prewarm al empezar)
function loaded(level: string, seed: number) {
  const g = new BrotatoGame(registry, seed, models, { model: maia, walk: walkFrames(maia), walkMs: WALK_FRAME_MS }, registry.level(level));
  for (const { model: m } of g.preloadModels()) g.state.models.register(m);
  return g;
}

describe('muebles con la paleta de una partida', () => {
  it('la paleta del mundo pasa de 64 y aun así se empuja un escritorio y se rompe una mampara', () => {
    const g = loaded('oficina', 7), a = g.run.arena;
    expect(g.state.palette.ramps.length).toBeGreaterThan(MAX_RAMPS);   // el caso de Andrés
    const desk = [...g.state.objects].find((o) => o.name?.startsWith('escritorio'))!;
    expect(g.state.objects.wake(desk.id)).toBe(true);
    // La mampara, a balazos de MAIA: se rompe con caída (VoxelFall.lift, la otra mitad del arreglo)
    const mampara = [...g.state.objects].find((o) => o.kind === 'pillar')!, r = a.furniture.rect(mampara.id)!;
    let hx = -1, hy = -1;
    for (let y = r.y0; y <= r.y1 && hx < 0; y++) for (let x = r.x0; x <= r.x1; x++) if (a.shotBlocked(x + 0.5, y + 0.5)) { hx = x + 0.5; hy = y + 0.5; break; }
    let hits = 0;
    while (!a.hitShot(hx, hy, 10, 'player') && hits < 100) hits++;
    expect(hits + 1).toBe(FURNITURE_HP / 10);
    expect(a.furniture.debris.length).toBe(1);
    for (let t = 0; t < 60 * 5 && a.furniture.debris.length; t++) a.stepObjects();
    expect(a.furniture.debris.length).toBe(0);
  });

  it('las rampas propias del mundo caben con holgura en los tres temas', () => {
    for (const [level, seed] of [['oficina', 7], ['medieval', 3], ['cyberpunk', 11]] as const) {
      const g = loaded(level, seed);
      const own = g.state.models.worldPalette().ramps.length, all = g.state.palette.ramps.length;
      console.log(`RAMPAS ${level}: propias ${own}, con modelos ${all}, libres para objetos ${MAX_RAMPS - own}`);
      expect(own).toBeLessThanOrEqual(MAX_RAMPS);
    }
  });
});
