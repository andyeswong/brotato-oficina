<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { render, camera, lightField3D, type RenderOptions, type PointLight3D } from '@core/index';
import { lightIntensity, lightOf, SOURCE_PRESETS } from '../../../src/lighting';
import { buildLayers, applyLayers } from '../../../src/lighting/shade';
import { model, version, editor } from '../store';
import PxIcon from './PxIcon.vue';

// Vista renderizada con el MISMO render que exporta la CLI: lo que ves es lo que sale.
// Con "Iluminación" se ve como en el juego: las fuentes de luz que pusiste en el modelo (herramienta "Fuente de
// luz") alumbran en 2.5D cada cara de vóxel y el suelo, con sombras de los propios vóxeles, y el resultado pasa
// por las mismas capas MULTIPLY/ADD del motor de luz del juego. Solo para mirar: no cambia el modelo.
const W = 64, H = 48;
const FLOOR = ['#3a3e4a', '#363a45'];
const main = ref<HTMLCanvasElement>();
const strip = ref<HTMLCanvasElement>();
const ms = ref(0);

function hex(c: string): [number, number, number] {
  return [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) as [number, number, number];
}

// Sprite sobre fondo opaco: gris plano, o suelo de losetas si hay luz
function compose(rgba: Uint8ClampedArray, lit: boolean): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(W * H * 4);
  const flat = hex('#8a92a6');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4;
    let bg = flat;
    if (lit) bg = hex(FLOOR[((x >> 4) + (y >> 4)) & 1]!);
    if (lit && (x % 16 === 0 || y % 16 === 0)) bg = bg.map((v) => v * 0.85) as [number, number, number];
    const a = rgba[p + 3]! > 0;
    out[p] = a ? rgba[p]! : bg[0]; out[p + 1] = a ? rgba[p + 1]! : bg[1]; out[p + 2] = a ? rgba[p + 2]! : bg[2]; out[p + 3] = 255;
  }
  return out;
}

// Fuentes de la escena con su parpadeo en el instante `time` (mismos presets y ruido que el juego)
function lightsAt(time: number): PointLight3D[] {
  return editor.light.sources.map((s) => {
    const p = SOURCE_PRESETS[s.kind];
    return { x: s.x + 0.5, y: s.y + 0.5, z: s.z + 0.5, radius: p.radius, color: p.color, intensity: lightIntensity(lightOf({ id: s.id, kind: s.kind, x: 0, y: 0 }), time) };
  });
}

function optionsFor(yaw: number, pick: boolean): RenderOptions {
  return { width: W, height: H, originX: W / 2, originY: H - 6, yaw, elevation: editor.view.elevation, outline: editor.view.outline, pick };
}

function frame(yaw: number, lit: boolean, time: number): Uint8ClampedArray<ArrayBuffer> {
  const o = optionsFor(yaw, lit);
  const img = render(model.value, o);
  const scene = compose(img.rgba, lit);
  if (!lit) return scene;
  const a = editor.light.ambient;
  const ambient: [number, number, number] = [a * 0.86, a * 0.9, a];
  const total = lightField3D(model.value, img, camera(o), lightsAt(time), ambient);
  // Los píxeles de contorno no tienen vóxel: toman la luz de su vecino con vóxel para no quedarse a oscuras
  for (let i = 0; i < W * H; i++) {
    if (!Number.isNaN(img.pickKey![i]!) || img.rgba[i * 4 + 3] === 0) continue;
    const x = i % W;
    for (const n of [i - 1, i + 1, i - W, i + W]) {
      if (n < 0 || n >= W * H || Math.abs((n % W) - x) > 1 || Number.isNaN(img.pickKey![n]!)) continue;
      total[i * 3] = total[n * 3]!; total[i * 3 + 1] = total[n * 3 + 1]!; total[i * 3 + 2] = total[n * 3 + 2]!;
      break;
    }
  }
  const layers = buildLayers({ cell: 1, cols: W, rows: H, ambient, total }, { x: 0, y: 0, width: W, height: H }, { steps: 8, softGlow: true });
  return applyLayers(scene, layers) as Uint8ClampedArray<ArrayBuffer>;
}

function blit(c: HTMLCanvasElement, rgba: Uint8ClampedArray<ArrayBuffer>, scale: number, x0 = 0): void {
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d')!.putImageData(new ImageData(rgba, W, H), 0, 0);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(off, x0, 0, W * scale, H * scale);
}

function drawMain(time: number): void {
  const c = main.value;
  if (!c) return;
  const t0 = performance.now();
  const s = editor.view.scale;
  c.width = W * s; c.height = H * s;
  const lit = editor.light.enabled;
  blit(c, frame(editor.view.yaw, lit, time), s);
  // Dónde están las fuentes (giran con el modelo)
  const cam = camera(optionsFor(editor.view.yaw, false));
  const g = c.getContext('2d')!;
  for (const l of editor.light.sources) {
    const [px, py] = cam.project(l.x + 0.5, l.y + 0.5, l.z + 0.5);
    const [r, gg, b] = SOURCE_PRESETS[l.kind].color;
    g.strokeStyle = `rgba(${r * 255},${gg * 255},${b * 255},0.9)`;
    g.beginPath(); g.arc(px * s, py * s, s * 0.8, 0, Math.PI * 2); g.stroke();
  }
  ms.value = Math.round(performance.now() - t0);
}

function drawStrip(): void {
  if (!strip.value) return;
  const n = editor.view.turn, s = 2;
  strip.value.width = n * W * s; strip.value.height = H * s;
  for (let i = 0; i < n; i++) blit(strip.value, frame(editor.view.yaw + (360 * i) / n, editor.light.enabled, 0), s, i * W * s);
}

let pending = 0;
function schedule(): void {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => { drawMain(performance.now() / 1000); drawStrip(); });
}

// Con luces encendidas, el parpadeo se anima a 12 Hz (como el juego, que recalcula a pocos Hz)
let timer = 0;
function animate(): void {
  clearInterval(timer);
  if (editor.light.enabled && editor.light.sources.length) timer = window.setInterval(() => drawMain(performance.now() / 1000), 1000 / 12);
}

onMounted(() => { schedule(); animate(); });
onUnmounted(() => clearInterval(timer));
watch([version, () => ({ ...editor.view })], schedule, { deep: true });
watch(() => JSON.stringify(editor.light), () => { schedule(); animate(); });
</script>

<template>
  <div class="view">
    <div class="bar">
      <label>Giro</label>
      <input type="range" min="-180" max="180" step="1" v-model.number="editor.view.yaw" />
      <span>{{ editor.view.yaw }}°</span>
      <label>Elevación</label>
      <input type="range" min="0" max="90" step="1" v-model.number="editor.view.elevation" />
      <span>{{ editor.view.elevation }}°</span>
      <label>Contorno</label>
      <select v-model="editor.view.outline">
        <option value="outer">exterior</option>
        <option value="both">exterior + interior</option>
        <option value="none">sin contorno</option>
      </select>
      <span class="ms">{{ ms }} ms</span>
    </div>
    <div class="bar">
      <button :class="{ on: editor.light.enabled }" @click="editor.light.enabled = !editor.light.enabled"><PxIcon name="sun" />Iluminación</button>
      <template v-if="editor.light.enabled">
        <label>Ambiente</label>
        <input type="range" min="0.1" max="1" step="0.05" v-model.number="editor.light.ambient" />
        <span class="hint">{{ editor.light.sources.length }} fuente(s) · se ponen con la herramienta "Fuente de luz"</span>
      </template>
    </div>
    <canvas ref="main" class="main" />
    <canvas ref="strip" class="strip" />
  </div>
</template>

<style scoped>
.view { display: flex; flex-direction: column; gap: 8px; }
.bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ms { color: var(--muted); margin-left: auto; }
.hint { color: var(--muted); font-size: 12px; }
.main { border: 1px solid var(--line); border-radius: 4px; max-width: 100%; }
.strip { max-width: 100%; border: 1px solid var(--line); border-radius: 4px; }
</style>
