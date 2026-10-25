import { describe, expect, it } from 'vitest';
import { Model, material } from '@voxpix/core';
import { bakeWorld } from '@voxpix/world/bake';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { BrotatoGame, type Models } from '../../src/game/brotato/play';
import { CAMERAS, DEFAULT_CAMERA, cameraById, cycleCamera } from '../../src/game/brotato/ui/camera';
import { PIXEL_RULES, computeLayout } from '../../src/game/brotato/ui/layout';
import { groundRing } from '../../src/game/brotato/ui/fx';
import { drawSelect, selectKey } from '../../src/game/brotato/ui/select';
import { FONT_CHARS, normalize } from '../../src/game/brotato/ui/font';
import type { Painter } from '../../src/game/brotato/ui/paint';

// Los presets de cámara (src/game/brotato/ui/camera.ts): unos pocos, fijos, que se eligen en la selección.
const { registry } = validateContent(discoverContent());
const pal = { ramps: [{ name: 'g', colors: ['#202020', '#606060', '#a0a0a0'] }] };
const cube = (h: number) => { const m = new Model(pal, 'c' + h); for (let z = 0; z < h; z++) m.set(0, 0, z, material(0, 1)); return m; };
const models: Models = { model: () => cube(2), walk: () => null };
const player = { model: cube(6), walk: [cube(7)], walkMs: 100 };
const SCREENS = [['escritorio', 1920, 1080], ['portátil', 1152, 648], ['tapa del Flip', 747, 655], ['Flip abierto', 1080, 2640]] as const;

describe('los presets de cámara', () => {
  it('ids únicos, la clásica por defecto, y un id desconocido cae en ella', () => {
    expect(new Set(CAMERAS.map((c) => c.id)).size).toBe(CAMERAS.length);
    expect(DEFAULT_CAMERA.id).toBe('clasica');
    expect(cameraById('no-existe')).toBe(DEFAULT_CAMERA);
    expect(cameraById(null)).toBe(DEFAULT_CAMERA);
  });

  it('cambiar de cámara da la vuelta en los dos sentidos y pasa por todas', () => {
    let c = DEFAULT_CAMERA;
    const seen = new Set<string>();
    for (let i = 0; i < CAMERAS.length; i++) { seen.add(c.id); c = cycleCamera(c, 1); }
    expect(seen.size).toBe(CAMERAS.length);
    expect(c).toBe(DEFAULT_CAMERA);
    expect(cycleCamera(DEFAULT_CAMERA, -1)).toBe(CAMERAS[CAMERAS.length - 1]);
  });

  it.each(SCREENS)('la Cerca acerca de verdad en %s: más escala y menos mundo que la clásica', (_n, w, h) => {
    const near = computeLayout(w, h, cameraById('cerca').rules), base = computeLayout(w, h, PIXEL_RULES);
    expect(near.scale).toBeGreaterThan(base.scale);
    expect(near.width * near.height).toBeLessThan(base.width * base.height);
  });

  it('cada inclinación se hornea con el mundo del juego y lo del suelo sale acortado por ella', { timeout: 60_000 }, () => {
    const g = new BrotatoGame(registry, 3, models, player, registry.level('medieval'));
    const p = g.current.player;
    for (const cam of CAMERAS) {
      const b = bakeWorld(g.run.arena.world, { topZ: 40, incline: cam.incline });
      const ring = groundRing(b.cam, p.x, p.y, p.z, 12);
      const ys = ring.map((q) => q[1]), xs = ring.map((q) => q[0]);
      expect(Math.max(...xs) - Math.min(...xs), cam.id).toBe(24);
      expect(Math.abs(Math.max(...ys) - Math.min(...ys) - 24 * cam.incline), cam.id).toBeLessThanOrEqual(1);
    }
  });
});

describe('la cámara en la selección', () => {
  const recorder = (width: number, height: number) => {
    const texts: string[] = [], outside: string[] = [];
    const p: Painter = {
      width, height, icon: () => true,
      fill(x, y, w, h) { if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`${x},${y} ${w}x${h}`); },
      onText(t) { texts.push(t); },
    };
    return { p, texts, outside };
  };

  it.each([[384, 216], [249, 218], [216, 384]] as const)('se ve, se toca y no se sale a %ix%i', (w, h) => {
    const { p, texts, outside } = recorder(w, h);
    const zones = drawSelect(p, registry, 0, 'oficina', 1, 'Cenital');
    expect(texts).toContain('« cámara: Cenital »');
    const cams = zones.filter((z) => z.action.type === 'camera');
    expect(cams.map((z) => z.action)).toEqual([{ type: 'camera', delta: -1 }, { type: 'camera', delta: 1 }]);
    expect(outside).toEqual([]);
  });

  it('todo lo que pinta la línea de la cámara existe en la fuente, con cada preset', () => {
    for (const cam of CAMERAS) {
      const { p, texts } = recorder(384, 216);
      drawSelect(p, registry, 0, 'oficina', 1, cam.name);
      for (const t of texts) for (const ch of normalize(t)) expect(FONT_CHARS.includes(ch), `${ch} en "${t}"`).toBe(true);
    }
  });

  it('C cambia a la siguiente y mayúscula a la anterior; sin cámara no hay línea', () => {
    expect(selectKey({ code: 'KeyC', key: 'c' }, 1, 0)).toEqual({ type: 'camera', delta: 1 });
    expect(selectKey({ code: 'KeyC', key: 'C' }, 1, 0)).toEqual({ type: 'camera', delta: -1 });
    const { p, texts } = recorder(384, 216);
    drawSelect(p, registry, 0, 'oficina');
    expect(texts.some((t) => t.includes('cámara'))).toBe(false);
  });
});
