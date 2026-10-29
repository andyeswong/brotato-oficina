// Las armas al disparar (Andrés, 2026-10-29): retroceden y vuelven, la estocada sale hacia delante, y cada proyectil
// de MAIA deja un fogonazo en la boca del arma. La simulación ya llevaba fireT y lunge; la vista no los pintaba
import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { bakeWorld } from '@voxpix/world/bake';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { Run } from '../../src/game/brotato/sim/Run';
import { FIRE_ANIM_TIME, type WorldFx } from '../../src/game/brotato/sim/World';
import { Effects, MUZZLE_S } from '../../src/game/brotato/ui/fx';
import type { Painter } from '../../src/game/brotato/ui/paint';

const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const still = { dx: 0, dy: 0, stomp: false };
const TICK = 1 / 60;

describe('las armas al disparar', () => {
  it('cada proyectil de MAIA deja un fogonazo en la boca del arma, y nada más lo deja', () => {
    const run = new Run(registry, registry.character('maia'), registry.level('oficina'), 5);
    const w = run.startWave();
    const seen = new Set<number>();
    let shots = 0;
    for (let t = 0; t < 60 * 15; t++) {
      w.player.hp = w.player.maxHp;
      w.step(TICK, { x: 0, y: 0 });
      for (const p of w.projectiles) if (p.owner === 'player' && !seen.has(p.uid)) { seen.add(p.uid); shots++; }
    }
    const muzzles = w.fx.filter((f): f is Extract<WorldFx, { type: 'muzzle' }> => f.type === 'muzzle');
    expect(shots).toBeGreaterThan(5);
    // Un proyectil que nace y choca en el mismo paso no llega a verse en projectiles: como mucho, algún fogonazo de más
    expect(muzzles.length).toBeGreaterThanOrEqual(shots);
    expect(muzzles.length).toBeLessThanOrEqual(shots + 3);
    for (const m of muzzles) expect(Math.hypot(m.x - w.player.x, m.y - w.player.y)).toBeLessThan(60);
  });

  it('el arma retrocede al disparar y vuelve a su sitio en FIRE_ANIM_TIME', () => {
    const g = new BrotatoGame(registry, 5, models, player, registry.level('oficina'), { immortal: true });
    const w = g.current.weapons[0]!, id = g['weaponIds'][0]!;
    let fired = false, back = -1;
    for (let t = 0; t < 60 * 15 && back < 0; t++) {
      g.step(still);
      const e = g.state.entities.get(id)!;
      // Justo tras disparar (fireT casi lleno): la entidad está detrás de su sitio en la órbita, en contra de donde apunta
      if (!fired && w.fireT > FIRE_ANIM_TIME * 0.8 && w.lunge === 0) {
        fired = true;
        const along = (e.x - w.x) * Math.cos(w.angle) + (e.y - w.y) * Math.sin(w.angle);
        expect(along).toBeLessThanOrEqual(-1);
      }
      if (fired && w.fireT <= 0 && w.lunge === 0) back = Math.hypot(e.x - Math.round(w.x), e.y - Math.round(w.y));
    }
    expect(fired).toBe(true);
    expect(back).toBe(0);
  });

  it('el fogonazo se pinta en la boca del arma y se va en MUZZLE_S', () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('oficina'));
    const cam = bakeWorld(g.run.arena.world, { topZ: 40, incline: 0.5 }).cam;
    const p0 = g.current.player;
    const scene = { player: p0, playerHeight: 30, enemyHeight: 12, groundZ: () => p0.z };
    const fx = new Effects();
    fx.add([{ type: 'muzzle', x: p0.x + 10, y: p0.y, z: p0.z, angle: 0 }], scene);
    const paint = () => {
      const dots: string[] = [];
      const p: Painter = { width: 4000, height: 4000, icon: () => false, fill: (x, y, _w, _h, c) => dots.push(`${x},${y},${c}`) };
      fx.paint(p, cam, 0, 0, scene, []);
      return dots;
    };
    const first = paint();
    expect(first.length).toBeGreaterThan(3);
    expect(first.some((d) => d.endsWith('#fff6c8'))).toBe(true);
    fx.update(MUZZLE_S + 0.01);
    expect(paint().length).toBe(0);
  });
});
