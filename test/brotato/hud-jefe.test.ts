// La barra del jefe, abajo al centro (Andrés, 2026-10-29): en las tres pantallas, con los botones táctiles, no pisa
// nada de la HUD ni se sale (MAIA). Se pinta la HUD con jefe y sin él: lo que solo sale con jefe no toca lo demás
import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { drawHud } from '../../src/game/brotato/ui/hud';
import type { Painter } from '../../src/game/brotato/ui/paint';

const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };

type R = { x: number; y: number; w: number; h: number };
function paint(game: BrotatoGame, width: number, height: number): R[] {
  const out: R[] = [];
  const p: Painter = { width, height, icon: (_r, x, y, w, h) => { out.push({ x, y, w, h }); return true; }, fill: (x, y, w, h) => out.push({ x, y, w, h }) };
  drawHud(p, game, { touch: true });
  return out;
}
const key = (r: R) => `${r.x},${r.y},${r.w},${r.h}`;
const overlap = (a: R, b: R) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('la barra del jefe en la HUD', () => {
  for (const [name, W, H] of [['escritorio', 384, 216], ['tapa del Flip', 249, 218], ['Flip abierto', 216, 384]] as const) {
    it(`no pisa nada ni se sale (${name} ${W}×${H})`, { timeout: 60_000 }, () => {
      const g = new BrotatoGame(registry, 7, models, player, registry.level('medieval'), { startWave: 10 });
      const w = g.current;
      // Con el dash comprado, para que salga también su botón táctil
      Object.assign(w.dash, { max: 2, charges: 2 });
      const without = paint(g, W, H);
      w['addEnemy'](registry.enemy('jefe'), w.player.x + 80, w.player.y);
      expect(w.boss).not.toBeNull();
      const all = paint(g, W, H);
      const base = new Set(without.map(key));
      const boss = all.filter((r) => !base.has(key(r)));
      expect(boss.length).toBeGreaterThan(3);
      for (const r of boss) {
        expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H, `fuera: ${key(r)}`).toBe(true);
        const hit = without.find((o) => overlap(r, o));
        expect(hit, `la barra ${key(r)} pisa ${hit ? key(hit) : ''}`).toBeUndefined();
      }
    });
  }
});
