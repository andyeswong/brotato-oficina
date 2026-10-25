import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { Model, render, decode } from '../src/core';
import { loadPxl, paletteFromPxl, spriteToVoxels, toPxlSource, pxlAssets } from '../src/pxl/bridge';
import { sampleScene } from '../src/samples/basic';

const OPTS = { width: 48, height: 36, originX: 24, originY: 30 };

describe('pxl: exportar', () => {
  it('ida y vuelta: lo que pxl construye desde el .px.js es idéntico al render de VoxPix', () => {
    const m = sampleScene();
    const frames = [0, 45, 90, 200].map((yaw) => ({ name: `muestra_a${yaw}`, ...render(m, { ...OPTS, yaw }) }));
    const src = toPxlSource(m, frames, { sheet: 'muestra' });
    const p = loadPxl(src, 'muestra.px.js');
    expect(pxlAssets(p)).toEqual(expect.arrayContaining(frames.map((f) => f.name)));
    for (const f of frames) {
      const img = p.image(f.name);
      expect([img.w, img.h]).toEqual([f.width, f.height]);
      for (let i = 0; i < img.w * img.h; i++) {
        const c = img.data[i]!;
        const ours = f.rgba[i * 4 + 3] ? ((f.rgba[i * 4]! << 24) | (f.rgba[i * 4 + 1]! << 16) | (f.rgba[i * 4 + 2]! << 8) | 255) >>> 0 : 0;
        if (c !== ours) throw new Error(`${f.name}: píxel ${i % img.w},${Math.floor(i / img.w)} difiere (${c.toString(16)} vs ${ours.toString(16)})`);
      }
    }
  });

  it('las rampas de VoxPix salen como ramps() de pxl, en el mismo orden de oscuro a claro', () => {
    const m = sampleScene();
    const p = loadPxl(toPxlSource(m, []));
    expect(paletteFromPxl(p).ramps.slice(0, m.palette.ramps.length).map((r) => r.colors)).toEqual(m.palette.ramps.map((r) => r.colors));
  });

  it('es determinista', () => {
    const m = sampleScene();
    const f = [{ name: 'a', ...render(m, OPTS) }];
    expect(toPxlSource(m, f)).toBe(toPxlSource(sampleScene(), [{ name: 'a', ...render(sampleScene(), OPTS) }]));
  });
});

describe('pxl: importar', () => {
  const SRC = `
pal({ k: "#0b0812", h: "#1e1e42", H: "#554275", s: "#d69aae", W: "#f7ddd7" })
ramps("khH", "sW")
sprite("cara", \`
  .hhh.
  hHHHh
  hsWsh
  .sss.\`)`;

  it('toma la paleta con sus rampas (y los colores sueltos como rampas de un tono)', () => {
    const pal = paletteFromPxl(loadPxl(SRC));
    expect(pal.ramps.map((r) => r.colors)).toEqual([['#0b0812', '#1e1e42', '#554275'], ['#d69aae', '#f7ddd7']]);
  });

  it('pone un sprite como vóxeles de frente, con la fila de abajo en z = 0 y centrado en x', () => {
    const p = loadPxl(SRC);
    const m = new Model(paletteFromPxl(p));
    const n = spriteToVoxels(p, 'cara', m, { plane: 'front' });
    expect(n).toBe(16);
    // Fila de abajo ".sss." -> z = 0, x = -1..1, color s (rampa 1 tono 0)
    expect(decode(m.get(0, 0, 0))).toEqual({ ramp: 1, tone: 0 });
    expect(m.get(-2, 0, 0)).toBe(0);
    // Fila de arriba ".hhh." -> z = 3
    expect(decode(m.get(0, 0, 3))).toEqual({ ramp: 0, tone: 1 });
  });

  it('lee arte real del equipo (maia24-ropa.px.js)', () => {
    const path = '/mnt/c/Users/andre/Sync/brotato-oficina/arte/maia24-ropa.px.js';
    let src: string;
    try { src = readFileSync(path, 'utf8'); } catch { return; }   // solo en la máquina con Sync
    const p = loadPxl(src, 'maia24-ropa.px.js');
    const names = pxlAssets(p);
    expect(names.length).toBeGreaterThan(0);
    const pal = paletteFromPxl(p, names[0]);
    expect(pal.ramps.length).toBeGreaterThan(2);
    const m = new Model(pal);
    expect(spriteToVoxels(p, names[0]!, m, { plane: 'front' })).toBeGreaterThan(50);
  });
});

describe('pxl: pila de capas', () => {
  it('ida y vuelta: modelo -> capas .px.js -> modelo, idéntico vóxel a vóxel', async () => {
    const { toPxlStack, stackFromPxl, stackPrefixes } = await import('../src/pxl/bridge');
    const m = sampleScene();
    const src = toPxlStack(m, 'muestra');
    const p = loadPxl(src);
    expect(stackPrefixes(p)).toEqual(['muestra']);
    const back = new Model(m.palette);
    expect(stackFromPxl(p, 'muestra', back)).toBe(m.size);
    expect([...back.entries()]).toEqual([...m.entries()]);
  });

  it('las capas son vistas desde arriba con el norte arriba y el pivote en el centro', async () => {
    const { toPxlStack } = await import('../src/pxl/bridge');
    const m = new Model(TEST_PAL);
    m.set(0, 0, 0, 1);         // pivote
    m.set(2, 1, 0, 1);         // al este y al norte
    const src = toPxlStack(m, 't');
    // 5x3: fila de arriba = y 1 (norte), columna central = x 0
    expect(src).toContain('sprite("t_z00", { w: 5, h: 3 }, `\n  ....a\n  ..a..\n  .....`)');
  });

  it('las capas de distinto tamaño son un error claro', async () => {
    const { stackFromPxl } = await import('../src/pxl/bridge');
    const p = loadPxl('pal({ a: "#ff0000" })\nsprite("x_z00", `aa`)\nsprite("x_z01", `aaa`)');
    expect(() => stackFromPxl(p, 'x', new Model(paletteFromPxl(p)))).toThrow(/todas iguales/);
  });
});

const TEST_PAL = { ramps: [{ name: 'r', colors: ['#ff0000'] }] };
