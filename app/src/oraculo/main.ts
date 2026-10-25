// La prueba del ORÁCULO (condición de MAIA para dar por bueno el compositor de la GPU): los mismos estados del mundo
// compuestos por la CPU (frame2D, la referencia) y por la GPU, comparados píxel a píxel. Corre en un navegador de
// verdad (WebGL2); scripts/oracle/oracle.ps1 la abre en Edge sin ventana y recoge window.__oracle.
//
// Qué se compara, por píxel de la vista:
//   - el color antes de la luz (la escena, las entidades, el agua y las gotas): debe ser el mismo byte (±1);
//   - la luz ya pasada a pixel art: el NIVEL de la capa multiply (8 niveles por canal) y el de la capa add (16);
//   - el cuadro final.
// Tolerancia (la justifica scripts/oracle/README.md): como mucho el 0,5 % de los píxeles puede diferir, y ninguno en
// más de un nivel de luz o en más de ±2 de color.
import { generateLayout, TILE } from '../../../src/worldgen';
import { THEMES } from '../../../src/content/themes';
import { Model, type ModelFile } from '@core/index';
import { buildWorldState, type WorldTheme } from '../../../src/world/build';
import { bakeWorld, rebakeChanged, type Baked } from '../../../src/world/bake';
import { frame2DParts, shadeLayers, type Frame2DOptions } from '../../../src/world/frame2d';
import { applyLayers } from '../../../src/lighting/shade';
import type { WorldState } from '../../../src/world/state';
import { NO_INPUT, Runtime } from '../../../src/game/runtime';
import { GpuCompositor } from '../../../src/view/gpu/compositor';
import maiaFile from '../../../models/maia/maia.json';

const VW = 384, VH = 216, TOPZ = 40, INCLINE = 0.5;
const TOL_SHARE = 0.005;
const maiaModel = Model.fromJSON(maiaFile as unknown as ModelFile);

interface Scenario {
  name: string;
  theme: WorldTheme;
  pos?: [number, number];
  ticks: number;
  stompEvery?: number;
  lights?: boolean;
  setup?: (s: WorldState, rt: Runtime) => void;
  // Lo que pasa después del primer cuadro de la GPU (para probar lo que se sube al rehornear)
  after?: (s: WorldState, b: Baked) => void;
}

const SCENARIOS: Scenario[] = [
  { name: 'medieval salida', theme: 'medieval', ticks: 120 },
  { name: 'oficina salida', theme: 'oficina', ticks: 120 },
  { name: 'cyberpunk salida', theme: 'cyberpunk', ticks: 120 },
  { name: 'medieval lago con pisotones', theme: 'medieval', pos: [172, 170], ticks: 300, stompEvery: 42 },
  { name: 'medieval lago sin luces', theme: 'medieval', pos: [172, 170], ticks: 300, stompEvery: 42, lights: false },
  {
    name: 'medieval columna rota', theme: 'medieval', ticks: 120,
    after: (s, b) => {
      const x0 = Math.floor(296 / TILE) * TILE, y0 = Math.floor(135 / TILE) * TILE;
      for (let z = 1; z < 48; z++) for (let y = y0; y < y0 + TILE; y++) for (let x = x0; x < x0 + TILE; x++) if (s.solid.get(x, y, z)) s.solid.set(x, y, z, 0);
      rebakeChanged(b, s.lights);
    },
  },
  {
    // Varias entidades con sombra, girados, y una luz dinámica (las que se añaden en partida)
    name: 'oficina entidades y luz dinámica', theme: 'oficina', ticks: 60,
    setup: (s, rt) => {
      const p = rt.player;
      for (const [dx, dy, f] of [[-14, 6, 2], [16, -4, 5], [4, 18, 7]] as const) s.entities.add({ model: maiaModel, x: Math.round(p.x + dx), y: Math.round(p.y + dy), z: p.z, facing: f * 45, castsShadow: true });
      s.lights.add({ kind: 'lantern', x: p.x + 8, y: p.y - 10, z: 14 });
    },
  },
];

function viewOf(s: WorldState, b: Baked, x: number, y: number, z: number): { vx: number; vy: number } {
  const feet = b.cam.project(x + 0.5, y, z);
  const vx = Math.max(0, Math.min(b.width - VW, Math.floor(feet[0]) - VW / 2));
  const top = Math.floor(b.cam.project(0, s.depth - 1 - 2 * TILE, 32)[1]);
  const vy = Math.max(top, Math.min(b.height - VH, Math.floor(feet[1]) - VH / 2 - 12));
  return { vx, vy };
}

interface Result {
  name: string;
  pixels: number;
  differ: number;          // píxeles con el cuadro final distinto
  colorOff: number;        // color sin luz a más de ±2
  mulOff1: number;         // multiply a un nivel
  mulOff2: number;         // multiply a más de un nivel
  addOff2: number;         // add a más de un nivel
  maxFinal: number;
  share: number;
  pass: boolean;
  worst: Array<{ x: number; y: number; cpu: number[]; gpu: number[]; cpuColor: number[]; gpuColor: number[]; cpuMul: number[]; gpuMul: number[]; cpuAdd: number[]; gpuAdd: number[]; total: number[] }>;
  gpuMs: number;
  cpuMs: number;
}

function compare(name: string, cpu: { color: Uint8ClampedArray; mul: Uint8ClampedArray; add: Uint8ClampedArray; final: Uint8ClampedArray },
  gpu: { color: Uint8Array; mul: Uint8Array; add: Uint8Array; final: Uint8Array }, ambient: readonly number[], lights: boolean, ms: [number, number], total: Float32Array | null): Result {
  const worst: Result['worst'] = [];
  const px = (a: ArrayLike<number>, i: number) => [a[i * 4]!, a[i * 4 + 1]!, a[i * 4 + 2]!];
  const n = VW * VH;
  let differ = 0, colorOff = 0, mulOff1 = 0, mulOff2 = 0, addOff2 = 0, maxFinal = 0;
  const level = (m: number, ch: number) => { const base = Math.min(1, ambient[ch]!), room = 1 - base; return room > 0 ? Math.round(((m / 255 - base) / room) * 7) : 0; };
  for (let i = 0; i < n; i++) {
    let fd = 0, cd = 0, md = 0, ad = 0;
    for (let ch = 0; ch < 3; ch++) {
      const o = i * 4 + ch;
      fd = Math.max(fd, Math.abs(cpu.final[o]! - gpu.final[o]!));
      cd = Math.max(cd, Math.abs(cpu.color[o]! - gpu.color[o]!));
      if (lights) {
        md = Math.max(md, Math.abs(level(cpu.mul[o]!, ch) - level(gpu.mul[o]!, ch)));
        ad = Math.max(ad, Math.abs(Math.round((cpu.add[o]! / 255) * 15) - Math.round((gpu.add[o]! / 255) * 15)));
      }
    }
    if (fd) differ++;
    maxFinal = Math.max(maxFinal, fd);
    if (cd > 2) colorOff++;
    if (md === 1) mulOff1++;
    if (md > 1) mulOff2++;
    if ((md > 1 || ad > 1 || cd > 2) && worst.length < 12) worst.push({ x: i % VW, y: Math.floor(i / VW), cpu: px(cpu.final, i), gpu: px(gpu.final, i), cpuColor: px(cpu.color, i), gpuColor: px(gpu.color, i),
      cpuMul: px(cpu.mul, i), gpuMul: px(gpu.mul, i), cpuAdd: px(cpu.add, i), gpuAdd: px(gpu.add, i), total: total ? [total[i * 3]!, total[i * 3 + 1]!, total[i * 3 + 2]!] : [] });
    if (ad > 1) addOff2++;
  }
  const share = differ / n;
  return { name, pixels: n, differ, colorOff, mulOff1, mulOff2, addOff2, maxFinal, share, pass: share <= TOL_SHARE && !colorOff && !mulOff2 && !addOff2, worst, cpuMs: ms[0], gpuMs: ms[1] };
}

async function run(): Promise<void> {
  const out = document.getElementById('out')!;
  const canvas = document.createElement('canvas');
  const gpu = GpuCompositor.create(canvas);
  if (!gpu) {
    (window as unknown as { __oracle: unknown }).__oracle = { error: 'sin WebGL2 o sin EXT_color_buffer_float' };
    out.textContent = 'Sin WebGL2: no se puede comparar.';
    return;
  }
  const results: Result[] = [];
  const shots: Record<string, { cpu: string; gpu: string; diff: string; colorDiff: string }> = {};
  for (const sc of SCENARIOS) {
    out.textContent += `${sc.name}…\n`;
    await new Promise((r) => setTimeout(r, 0));
    const layout = generateLayout(THEMES[sc.theme].spec, 7);
    const { world, state } = buildWorldState(layout, sc.theme);
    const b = bakeWorld(world, { topZ: TOPZ, incline: INCLINE });
    const spawn = sc.pos ? { x: sc.pos[0], y: sc.pos[1] } : { x: layout.spawn.x, y: world.depth - 1 - layout.spawn.y };
    const rt = new Runtime(state, spawn, { radius: 4, speed: 70, model: maiaModel });
    sc.setup?.(state, rt);
    for (let t = 1; t <= sc.ticks; t++) rt.step(sc.stompEvery && t % sc.stompEvery === 0 ? { ...NO_INPUT, stomp: true } : NO_INPUT);
    const maia = state.entities.get(rt.entityId!)!;
    const { vx, vy } = viewOf(state, b, maia.x, maia.y, maia.z);
    const ambient = THEMES[sc.theme].ambient;
    const o: Frame2DOptions = { vx, vy, vw: VW, vh: VH, time: sc.ticks / 60, lights: sc.lights ?? true, ambient };
    if (sc.after) { gpu.read(state, b, o, 'color'); sc.after(state, b); }
    const c0 = performance.now();
    const parts = frame2DParts(state, b, o);
    const layers = parts.total ? shadeLayers(parts.total, o) : null;
    const cpuFinal = layers ? applyLayers(parts.view, layers) : parts.view;
    const c1 = performance.now();
    const gFinal = gpu.read(state, b, o, 'frame');
    const c2 = performance.now();
    const gColor = gpu.read(state, b, o, 'color');
    const gMul = gpu.read(state, b, o, 'multiply');
    const gAdd = gpu.read(state, b, o, 'add');
    const empty = new Uint8ClampedArray(VW * VH * 4);
    const r = compare(sc.name, { color: parts.view, mul: layers?.multiply ?? empty, add: layers?.add ?? empty, final: cpuFinal },
      { color: gColor, mul: gMul, add: gAdd, final: gFinal }, ambient, o.lights, [c1 - c0, c2 - c1], parts.total);
    results.push(r);
    shots[sc.name] = { cpu: toPng(cpuFinal), gpu: toPng(gFinal), diff: toPng(diffMask(cpuFinal, gFinal)), colorDiff: toPng(diffMask(parts.view, gColor)) };
    out.textContent += `  ${r.pass ? 'BIEN' : 'MAL '} difieren ${(r.share * 100).toFixed(3)} % (${r.differ}), color>2: ${r.colorOff}, luz a 1 nivel: ${r.mulOff1}, a más: ${r.mulOff2}, add a más: ${r.addOff2}, máx ${r.maxFinal}\n`;
  }
  (window as unknown as { __oracle: unknown }).__oracle = { results, pass: results.every((r) => r.pass), shots };
  out.textContent += results.every((r) => r.pass) ? '\nTODO BIEN\n' : '\nHAY FALLOS\n';
}

// Blanco donde difieren, y la imagen de la CPU muy oscura debajo para situarse
function diffMask(a: ArrayLike<number>, b: ArrayLike<number>): Uint8ClampedArray {
  const m = new Uint8ClampedArray(VW * VH * 4);
  for (let i = 0; i < VW * VH; i++) {
    const d = Math.max(Math.abs(a[i * 4]! - b[i * 4]!), Math.abs(a[i * 4 + 1]! - b[i * 4 + 1]!), Math.abs(a[i * 4 + 2]! - b[i * 4 + 2]!));
    for (let ch = 0; ch < 3; ch++) m[i * 4 + ch] = d ? (ch === 1 ? 255 : 255) : a[i * 4 + ch]! * 0.25;
    m[i * 4 + 3] = 255;
  }
  return m;
}

function toPng(px: Uint8Array | Uint8ClampedArray): string {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  const g = c.getContext('2d')!;
  g.putImageData(new ImageData(new Uint8ClampedArray(px), VW, VH), 0, 0);
  return c.toDataURL('image/png');
}

run().catch((e) => {
  (window as unknown as { __oracle: unknown }).__oracle = { error: String(e?.stack ?? e) };
  document.getElementById('out')!.textContent += `\nERROR ${e?.stack ?? e}\n`;
});
