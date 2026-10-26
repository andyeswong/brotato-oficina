import { describe, expect, it } from 'vitest';
import { discoverContent } from '../../src/game/brotato/registry/discover';
import { validateContent } from '../../src/game/brotato/registry/validate';
import { Run } from '../../src/game/brotato/sim/Run';
import { lookOf } from '../../src/game/brotato/looks';
import { FONT_CHARS, normalize } from '../../src/game/brotato/ui/font';
import { hit, type IconRef, type Painter } from '../../src/game/brotato/ui/paint';
import { applyShop, drawShop, shopKey } from '../../src/game/brotato/ui/shop';
import { drawSelect } from '../../src/game/brotato/ui/select';
import { drawEnd } from '../../src/game/brotato/ui/end';

// Las pantallas del Brotato (src/game/brotato/ui): pintan sobre un Painter y devuelven sus zonas. Aquí, un Painter
// que solo apunta: qué textos, qué iconos y si algo se sale.
const { registry } = validateContent(discoverContent());

interface Note { text: string; x: number; y: number; w: number; h: number }
function recorder(width: number, height: number) {
  const texts: Note[] = [];
  const icons: IconRef[] = [];
  const outside: string[] = [];
  const p: Painter = {
    width, height,
    fill(x, y, w, h) { if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`fill ${x},${y} ${w}x${h}`); },
    icon(ref) { icons.push(ref); return ref.kind === 'weapon'; },
    onText(text, x, y, w, h) { texts.push({ text, x, y, w, h }); if (x < 0 || y < 0 || x + w > width || y + h > height) outside.push(`"${text}" ${x},${y}`); },
  };
  return { p, texts, icons, outside };
}

// Una tienda de verdad: la de tras la primera oleada, con materiales para comprar
function shopRun(level = 'medieval', seed = 9): Run {
  const run = new Run(registry, registry.character('maia'), registry.level(level), seed);
  run.startWave();
  run.finishWave();
  run.materials = 200;
  run.shop.open();
  return run;
}

const SIZES = [['escritorio', 384, 216], ['tapa del Flip', 249, 218], ['Flip abierto', 216, 384]] as const;

describe('la tienda en pantalla', () => {
  it('cada oferta enseña su precio y el nombre de su aspecto en el mundo de la partida', () => {
    const run = shopRun('medieval');
    const { p, texts } = recorder(384, 216);
    drawShop(p, run, 'medieval', null);
    const shown = texts.map((t) => t.text);
    for (const o of run.shop.offers) {
      if (!o) continue;
      const look = o.kind === 'weapon' ? lookOf(registry.weapon(o.id), 'medieval') : lookOf(registry.item(o.id), 'medieval');
      expect(shown.some((t) => look.name.startsWith(t.replace(/\.\.\.$/, ''))), `${o.id}: ${look.name}`).toBe(true);
      expect(shown, o.id).toContain(String(o.price));
      // y la primera línea de su descripción (la del aspecto, o la del módulo si el aspecto no la cambia)
      const mod = o.kind === 'weapon' ? registry.weapon(o.id) : registry.item(o.id);
      const desc = look.description ?? mod.description ?? '';
      expect(desc.length, o.id).toBeGreaterThan(0);
      expect(shown.some((t) => t.length > 3 && desc.startsWith(t.replace(/\.\.\.$/, ''))), `${o.id}: ${desc}`).toBe(true);
    }
  });

  it('tocar una fila la compra; tocar su candado la fija', () => {
    const run = shopRun();
    const { p } = recorder(384, 216);
    const zones = drawShop(p, run, 'oficina', null);
    const buyZone = zones.find((z) => z.action.type === 'buy' && z.action.index === 1)!;
    const lockZone = zones.find((z) => z.action.type === 'lock' && z.action.index === 1)!;
    expect(hit(zones, buyZone.x + 2, buyZone.y + 2)).toEqual({ type: 'buy', index: 1 });
    expect(hit(zones, lockZone.x + lockZone.w - 2, lockZone.y + lockZone.h - 2)).toEqual({ type: 'lock', index: 1 });

    const before = run.materials, offer = run.shop.offers[1]!;
    expect(applyShop(run, hit(zones, buyZone.x + 2, buyZone.y + 2)!)?.text).toBe('comprado');
    expect(run.materials).toBe(before - offer.price);
    expect(run.shop.offers[1]).toBeNull();

    applyShop(run, hit(zones, lockZone.x + lockZone.w - 2, lockZone.y + lockZone.h - 2)!);   // ya vendida: no pasa nada
    applyShop(run, { type: 'lock', index: 0 });
    expect(run.shop.offers[0]!.locked).toBe(true);
  });

  it('las teclas: número compra, Mayús+número fija, R vuelve a tirar, Intro sigue', () => {
    const run = shopRun();
    expect(shopKey({ code: 'Digit2', key: '2', shiftKey: false }, run)).toEqual({ type: 'buy', index: 1 });
    expect(shopKey({ code: 'Digit2', key: '"', shiftKey: true }, run)).toEqual({ type: 'lock', index: 1 });
    expect(shopKey({ code: 'Digit9', key: '9', shiftKey: false }, run)).toBeNull();
    expect(shopKey({ code: 'KeyR', key: 'r', shiftKey: false }, run)).toEqual({ type: 'reroll' });
    expect(shopKey({ code: 'Enter', key: 'Enter', shiftKey: false }, run)).toEqual({ type: 'next' });
  });

  it('sin materiales, comprar dice cuánto falta y no compra', () => {
    const run = shopRun();
    run.materials = 0;
    const msg = applyShop(run, { type: 'buy', index: 0 });
    expect(msg?.text).toMatch(/^Te faltan \d+ materiales$/);
    expect(run.shop.offers[0]).not.toBeNull();
  });

  for (const [name, w, h] of SIZES) {
    it(`nada se sale de la pantalla ni usa letras que la fuente no tiene (${name} ${w}×${h})`, () => {
      for (const theme of ['oficina', 'medieval', 'cyberpunk'] as const) {
        const run = shopRun(theme, 4);
        const screens: Array<(p: Painter) => unknown> = [
          (p) => drawShop(p, run, theme, { text: 'Te faltan 12 materiales', color: '#f00' }),
          (p) => drawSelect(p, registry, 0, theme),
          (p) => drawSelect(p, registry, 0, theme, 1, 'Clásica', true),
          (p) => drawSelect(p, registry, 0, theme, 1, 'Clásica', false),
          (p) => drawEnd(p, run, 'defeat'),
        ];
        for (const draw of screens) {
          const { p, texts, outside } = recorder(w, h);
          draw(p);
          expect(outside, `${theme} ${name}`).toEqual([]);
          for (const t of texts) for (const ch of normalize(t.text)) expect(FONT_CHARS, `"${t.text}"`).toContain(ch);
        }
      }
    });
  }
});

describe('selección y fin', () => {
  it('la ficha de MAIA dice su mundo y nombra su arma con el aspecto de ese mundo', () => {
    const { p, texts, icons } = recorder(384, 216);
    const zones = drawSelect(p, registry, 0, 'cyberpunk');
    const shown = texts.map((t) => t.text).join(' | ');
    expect(shown).toContain('mundo: Cyberpunk');
    const first = registry.character('maia').startingWeapons![0]!;
    expect(shown).toContain(lookOf(registry.weapon(first), 'cyberpunk').name);
    expect(icons).toContainEqual({ kind: 'character', id: 'maia' });
    expect(hit(zones, 192, 80)).toEqual({ type: 'start', index: 0 });
  });

  it('el fin dice cómo acabó', () => {
    const run = shopRun();
    for (const [result, title] of [['victory', '¡Victoria!'], ['defeat', 'Has caído']] as const) {
      const { p, texts } = recorder(384, 216);
      drawEnd(p, run, result);
      expect(texts[0]!.text).toBe(title);
    }
  });
});
