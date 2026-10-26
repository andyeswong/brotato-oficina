// El roguelite (Andrés, 2026-10-26): fichas al acabar cada partida y un árbol de mejoras que vale para las siguientes.
// La partida recibe los niveles como entrada; el guardado y la pantalla viven fuera de la simulación.
import { describe, expect, it, vi } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { runDigest } from '../../src/game/brotato/sim/digest';
import { UPGRADES, buyUpgrade, emptyProgress, fichasEarned, metaStartMaterials, nextCost, parseProgress, unlocked } from '../../src/game/brotato/meta/upgrades';
import { PROGRESS_KEY, loadProgress, saveProgress } from '../../src/game/brotato/meta/store';
import { applyMeta, drawMeta, metaKey, treeOrder } from '../../src/game/brotato/ui/meta';
import { drawSelect } from '../../src/game/brotato/ui/select';
import { drawEnd } from '../../src/game/brotato/ui/end';
import { FONT_CHARS, normalize } from '../../src/game/brotato/ui/font';
import { hit, type Painter } from '../../src/game/brotato/ui/paint';
import { kite } from './pilot';

vi.setConfig({ testTimeout: 60_000 });
const { registry } = validateContent(discoverContent());
const maia = registry.character('maia');

function recorder(width: number, height: number) {
  const texts: string[] = [], outside: string[] = [];
  const p: Painter = {
    width, height, icon: () => true,
    fill(x, y, w, h) { if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`${x},${y} ${w}x${h}`); },
    onText(t, x, y, w, h) { texts.push(t); if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`"${t}" ${x},${y}`); },
  };
  return { p, texts, outside };
}

describe('el árbol de mejoras', () => {
  it('la raíz se compra; lo que cuelga, solo con su mejora de arriba; cada nivel cuesta lo suyo y hay un máximo', () => {
    const p = { ...emptyProgress(), fichas: 100 };
    expect(unlocked(p, 'afilado')).toBe(false);
    expect(buyUpgrade(p, 'afilado')).toEqual({ ok: false, reason: 'Antes, Constitución' });
    expect(buyUpgrade(p, 'vida')).toEqual({ ok: true });
    expect(p.fichas).toBe(96);
    expect(unlocked(p, 'afilado')).toBe(true);
    buyUpgrade(p, 'vida'); buyUpgrade(p, 'vida');
    expect(p.fichas).toBe(100 - 4 - 8 - 14);
    expect(nextCost(p, 'vida')).toBeNull();
    expect(buyUpgrade(p, 'vida')).toEqual({ ok: false, reason: 'Ya está al máximo' });
    p.fichas = 3;
    expect(buyUpgrade(p, 'afilado')).toEqual({ ok: false, reason: 'Te faltan 3 fichas' });
    expect(p.levels.afilado).toBeUndefined();
  });

  it('cada mejora cuelga de una que existe, y el árbol las recorre todas una vez', () => {
    const ids = new Set(UPGRADES.map((u) => u.id));
    for (const u of UPGRADES) if (u.requires) expect(ids.has(u.requires), u.id).toBe(true);
    expect(treeOrder().map((r) => r.u.id).sort()).toEqual([...ids].sort());
  });

  it('las fichas: 2 por oleada superada, 1 cada 20 bajas, 10 más si se gana', () => {
    expect(fichasEarned(0, 7, false)).toBe(0);
    expect(fichasEarned(4, 85, false)).toBe(12);
    expect(fichasEarned(10, 400, true)).toBe(50);
  });

  it('lo guardado se lee aunque venga roto: se queda lo que encaja', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('hola')).toEqual(emptyProgress());
    expect(parseProgress({ fichas: -5, levels: { vida: 99, nada: 2, afilado: 1.5, zapatillas: '2', chaleco: 1 } }))
      .toEqual({ fichas: 0, levels: { vida: 3, chaleco: 1 } });
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    store.setItem(PROGRESS_KEY, '{no es json');
    expect(loadProgress(store)).toEqual(emptyProgress());
    saveProgress(store, { fichas: 7, levels: { vida: 2 } });
    expect(loadProgress(store)).toEqual({ fichas: 7, levels: { vida: 2 } });
    const broken = { getItem: () => { throw new Error('sin permiso'); }, setItem: () => { throw new Error('sin permiso'); } };
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(() => saveProgress(broken, emptyProgress())).not.toThrow();
    expect(loadProgress(null)).toEqual(emptyProgress());
  });
});

describe('las mejoras en la partida', () => {
  it('dan lo que dicen: vida, daño y materiales al empezar', () => {
    const base = new Run(registry, maia, registry.level('oficina'), 5);
    const meta = { vida: 3, afilado: 2, zapatillas: 1, iman: 1, ahorros: 2 };
    const run = new Run(registry, maia, registry.level('oficina'), 5, { meta });
    expect(run.stats.get('max-hp')).toBe(base.stats.get('max-hp') + 6);
    expect(run.stats.get('damage-pct')).toBe(base.stats.get('damage-pct') + 8);
    expect(run.stats.get('pickup-range')).toBe(base.stats.get('pickup-range') + 16);
    expect(run.materials).toBe(metaStartMaterials(meta));
    expect(run.materials).toBe(12);
    expect(run.startWave().player.maxHp).toBe(base.startWave().player.maxHp + 6);
  });

  it('sin mejoras la partida es la de siempre (misma huella), y con las mismas mejoras se repite igual', () => {
    const play = (opts: { meta?: Record<string, number> }) => {
      const run = new Run(registry, maia, registry.level('oficina'), 7, opts);
      const world = run.startWave();
      for (let t = 0; t < 60 * 15 && world.status === 'playing'; t++) world.step(1 / 60, kite(world, run));
      return runDigest(run, world, false);
    };
    expect(play({ meta: {} })).toBe(play({}));
    const meta = { vida: 2, afilado: 1, reflejos: 1 };
    expect(play({ meta })).toBe(play({ meta }));
    expect(play({ meta })).not.toBe(play({}));
  });
});

const SIZES = [[384, 216], [249, 218], [216, 384]] as const;

describe('la pantalla de mejoras y la portada', () => {
  it.each(SIZES)('nada se sale a %ix%i ni usa letras que la fuente no tiene', (w, h) => {
    const states = [emptyProgress(), { fichas: 1234, levels: { vida: 3, afilado: 3, zapatillas: 2, chaleco: 1, iman: 2, ahorros: 1 } }];
    for (const theme of ['oficina', 'medieval', 'cyberpunk'] as const) {
      for (const state of states) {
        for (const draw of [
          (p: Painter) => drawMeta(p, state, theme, { text: 'Te faltan 22 fichas', color: '#f00', ok: false }),
          (p: Painter) => drawSelect(p, registry, 0, theme, 1, 'Clásica', true, state.fichas),
          (p: Painter) => drawEnd(p, new Run(registry, maia, registry.level(theme), 1), 'defeat', 37),
        ]) {
          const { p, texts, outside } = recorder(w, h);
          draw(p);
          expect(outside, `${theme} ${w}x${h}`).toEqual([]);
          for (const t of texts) for (const ch of normalize(t)) expect(FONT_CHARS, `"${t}"`).toContain(ch);
        }
      }
    }
  });

  it.each(SIZES)('a %ix%i: tocar una fila la compra; lo bloqueado no se toca; volver vuelve', (w, h) => {
    const progress = { fichas: 10, levels: {} };
    const zones = drawMeta(recorder(w, h).p, progress, 'oficina', null);
    expect(zones.some((z) => z.action.type === 'upgrade' && z.action.id === 'afilado')).toBe(false);
    const root = zones.find((z) => z.action.type === 'upgrade' && z.action.id === 'vida')!;
    const a = hit(zones, root.x + 2, root.y + 2)!;
    expect(applyMeta(progress, a)).toMatchObject({ ok: true, text: 'Constitución 1' });
    expect(progress).toEqual({ fichas: 6, levels: { vida: 1 } });
    const back = zones.find((z) => z.action.type === 'back')!;
    expect(hit(zones, back.x + 2, back.y + 2)).toEqual({ type: 'back' });
  });

  it('teclas: los números compran por orden del árbol, Esc vuelve', () => {
    expect(metaKey({ code: 'Digit1', key: '1' })).toEqual({ type: 'upgrade', id: treeOrder()[0]!.u.id });
    expect(metaKey({ code: 'Digit0', key: '0' })).toEqual({ type: 'upgrade', id: treeOrder()[9]!.u.id });
    expect(metaKey({ code: 'Escape', key: 'Escape' })).toEqual({ type: 'back' });
  });

  it.each(SIZES)('la portada a %ix%i: jugar empieza, mejoras lleva al árbol con las fichas a la vista', (w, h) => {
    const { p, texts } = recorder(w, h);
    const zones = drawSelect(p, registry, 0, 'medieval', 1, 'Clásica', true, 42);
    expect(texts).toContain('mejoras · 42');
    expect(texts).toContain('jugar');
    for (const action of [{ type: 'start', index: 0 }, { type: 'meta' }, { type: 'sound' }]) {
      const z = zones.find((q) => JSON.stringify(q.action) === JSON.stringify(action))!;
      expect(z, JSON.stringify(action)).toBeDefined();
      expect(hit(zones, z.x + 2, z.y + 2)).toEqual(action);
    }
  });
});
