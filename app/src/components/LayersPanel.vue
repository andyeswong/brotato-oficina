<script setup lang="ts">
import { computed, nextTick, ref, watch, onMounted } from 'vue';
import { decode, rampOf } from '@core/index';
import { model, version, editor, ui } from '../store';

// Las capas del modelo (alturas z), de arriba abajo: miniatura vista desde arriba y cuántos vóxeles tiene. Un clic
// elige la capa que se edita; la rueda sobre el lienzo también sube y baja.
const thumbs = ref<HTMLCanvasElement[]>([]);

const layers = computed(() => {
  void version.value;
  const counts = new Map<number, number>();
  let top = 0;
  for (const [, , z] of model.value.entries()) { counts.set(z, (counts.get(z) ?? 0) + 1); top = Math.max(top, z); }
  const n = Math.max(top + 1, editor.z) + 1;               // una vacía encima, para empezar la siguiente
  return Array.from({ length: n }, (_, i) => { const z = n - 1 - i; return { z, count: counts.get(z) ?? 0 }; });
});

function drawThumbs(): void {
  const { minX, maxX, minY, maxY } = editor.grid;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const m = model.value;
  layers.value.forEach((l, i) => {
    const c = thumbs.value[i];
    if (!c) return;
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, w, h);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const v = m.get(x, y, l.z);
      if (!v) continue;
      const d = decode(v);
      g.fillStyle = rampOf(m.palette, d.ramp).colors[d.tone] ?? '#f0f';
      g.fillRect(x - minX, maxY - y, 1, 1);
    }
  });
}

onMounted(drawThumbs);
watch([version, () => layers.value.length, () => ui.layersOpen, () => ({ ...editor.grid })], () => nextTick(drawThumbs));
</script>

<template>
  <div class="layers">
    <header>
      <h2>Capas</h2>
      <span class="count">z {{ editor.z }}</span>
      <button class="ghost round" :title="ui.layersOpen ? 'Plegar' : 'Desplegar'" @click="ui.layersOpen = !ui.layersOpen">{{ ui.layersOpen ? '–' : '+' }}</button>
    </header>
    <ol v-if="ui.layersOpen">
      <li v-for="l in layers" :key="l.z" :class="{ on: l.z === editor.z, empty: !l.count }" @click="editor.z = l.z">
        <canvas ref="thumbs" />
        <span class="z">z {{ l.z }}</span>
        <span class="n">{{ l.count || '—' }}</span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.layers { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
header { display: flex; align-items: center; gap: 8px; }
header h2 { flex: 1; }
.count { color: var(--faint); font-size: 12px; }
ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; max-height: calc(100vh - 260px); }
li { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; border: 1px solid transparent; cursor: pointer; }
li:hover { background: var(--panel-2); }
li.on { background: var(--panel-2); border-color: var(--accent); }
li.empty canvas { opacity: .35; }
canvas { width: 64px; height: 32px; border-radius: 6px; background: var(--bg); object-fit: contain; }
.z { font-weight: 500; }
.n { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
</style>
