<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { render, camera, lightField3D, type RenderOptions, type PointLight3D } from '@core/index';
import { lightIntensity, lightOf, SOURCE_PRESETS } from '../../../src/lighting';
import { buildLayers, applyLayers } from '../../../src/lighting/shade';
import { model, version, editor, ui } from '../store';
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
  const s = 5;
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
  ui.renderMs = ms.value;
}

// Los 8 ángulos en una rejilla de 4 x 2, a 1,5x (cabe en la tarjeta)
function drawStrip(): void {
  if (!strip.value) return;
  const n = editor.view.turn, s = 1.25, cols = 4;
  strip.value.width = cols * W * s; strip.value.height = Math.ceil(n / cols) * H * s;
  const g = strip.value.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (let i = 0; i < n; i++) {
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    off.getContext('2d')!.putImageData(new ImageData(frame(editor.view.yaw + (360 * i) / n, editor.light.enabled, 0), W, H), 0, 0);
    g.drawImage(off, (i % cols) * W * s, Math.floor(i / cols) * H * s, W * s, H * s);
  }
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
watch([version, () => ({ ...editor.view }), () => ui.previewOpen], schedule, { deep: true });
watch(() => JSON.stringify(editor.light), () => { schedule(); animate(); });
</script>

<template>
  <div class="view">
    <header>
      <h2>Vista previa</h2>
      <span class="ms">{{ ms }} ms</span>
      <button class="ghost round" :title="ui.previewOpen ? 'Plegar' : 'Desplegar'" @click="ui.previewOpen = !ui.previewOpen">{{ ui.previewOpen ? '–' : '+' }}</button>
    </header>
    <template v-if="ui.previewOpen">
      <canvas ref="main" class="main" />
      <div class="props">
        <div class="field"><label>Giro</label><input type="range" min="-180" max="180" step="1" v-model.number="editor.view.yaw" /><span class="value">{{ editor.view.yaw }}°</span></div>
        <div class="field"><label>Elevación</label><input type="range" min="0" max="90" step="1" v-model.number="editor.view.elevation" /><span class="value">{{ editor.view.elevation }}°</span></div>
        <div class="field"><label>Contorno</label><span class="dots" />
          <div class="seg">
            <button :class="{ on: editor.view.outline === 'outer' }" @click="editor.view.outline = 'outer'">Exterior</button>
            <button :class="{ on: editor.view.outline === 'both' }" @click="editor.view.outline = 'both'">Interior</button>
            <button :class="{ on: editor.view.outline === 'none' }" @click="editor.view.outline = 'none'">No</button>
          </div>
        </div>
        <div class="field"><label><PxIcon name="sun" /> Iluminación</label><span class="dots" />
          <button class="switch" :class="{ on: editor.light.enabled }" :title="editor.light.enabled ? 'Apagar' : 'Encender'" @click="editor.light.enabled = !editor.light.enabled" />
        </div>
        <div v-if="editor.light.enabled" class="field"><label>Ambiente</label><input type="range" min="0.1" max="1" step="0.05" v-model.number="editor.light.ambient" /><span class="value">{{ editor.light.ambient.toFixed(2) }}</span></div>
        <p v-if="editor.light.enabled" class="hint">{{ editor.light.sources.length }} fuente(s): se ponen con la herramienta Luz</p>
      </div>
      <canvas ref="strip" class="strip" />
    </template>
  </div>
</template>

<style scoped>
.view { display: flex; flex-direction: column; gap: 12px; }
header { display: flex; align-items: center; gap: 8px; }
header h2 { flex: 1; }
.ms { color: var(--faint); font-size: 12px; font-variant-numeric: tabular-nums; }
.main { width: 320px; height: 240px; border-radius: 12px; align-self: center; }
.props { display: flex; flex-direction: column; gap: 2px; }
.field label { display: inline-flex; align-items: center; gap: 6px; }
.strip { width: 320px; border-radius: 12px; align-self: center; }
.hint { margin: 0; }
</style>
