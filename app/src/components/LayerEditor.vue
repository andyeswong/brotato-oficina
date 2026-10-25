<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { decode, rampOf } from '@core/index';
import { model, history, version, editor, paint, currentMaterial, touch, toggleLight } from '../store';
import { SOURCE_PRESETS } from '../../../src/lighting';
import { startPour, stopPour, fluidState } from '../fluidTool';

// Editor de una capa z vista desde arriba (norte arriba). Clic izquierdo pinta según la herramienta,
// clic derecho borra. La capa de abajo se ve en fantasma para orientarse.
const CELL = 14;
const canvas = ref<HTMLCanvasElement>();
const cols = computed(() => editor.grid.maxX - editor.grid.minX + 1);
const rows = computed(() => editor.grid.maxY - editor.grid.minY + 1);
let painting = 0;            // 0 nada, 1 pintar, 2 borrar
let lightDone = false;       // la fuente se pone una vez por clic, no al arrastrar

function colorOf(v: number): string {
  const { ramp, tone } = decode(v);
  return rampOf(model.value.palette, ramp).colors[tone] ?? '#ff00ff';
}

function draw(): void {
  const c = canvas.value;
  if (!c) return;
  c.width = cols.value * CELL;
  c.height = rows.value * CELL;
  const g = c.getContext('2d')!;
  g.fillStyle = '#23252e';
  g.fillRect(0, 0, c.width, c.height);
  const m = model.value;
  for (let r = 0; r < rows.value; r++) for (let q = 0; q < cols.value; q++) {
    const x = editor.grid.minX + q, y = editor.grid.maxY - r;   // norte arriba
    const v = m.get(x, y, editor.z);
    const px = q * CELL, py = r * CELL;
    if (v) {
      g.fillStyle = colorOf(v);
      g.fillRect(px, py, CELL, CELL);
    } else {
      const below = editor.z > 0 ? m.get(x, y, editor.z - 1) : 0;
      if (below) {
        g.globalAlpha = 0.28;
        g.fillStyle = colorOf(below);
        g.fillRect(px, py, CELL, CELL);
        g.globalAlpha = 1;
      }
    }
  }
  // Rejilla, ejes y eje del espejo
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.beginPath();
  for (let q = 0; q <= cols.value; q++) { g.moveTo(q * CELL + 0.5, 0); g.lineTo(q * CELL + 0.5, c.height); }
  for (let r = 0; r <= rows.value; r++) { g.moveTo(0, r * CELL + 0.5); g.lineTo(c.width, r * CELL + 0.5); }
  g.stroke();
  const ox = (0 - editor.grid.minX) * CELL, oy = (editor.grid.maxY - 0) * CELL;
  g.strokeStyle = 'rgba(140,120,216,0.8)';
  g.strokeRect(ox + 0.5, oy + 0.5, CELL - 1, CELL - 1);               // celda del pivote
  // Fuentes de luz de esta capa
  for (const l of editor.light.sources) {
    if (l.z !== editor.z) continue;
    const [r, gg, b] = SOURCE_PRESETS[l.kind].color;
    const cx = (l.x - editor.grid.minX) * CELL + CELL / 2, cy = (editor.grid.maxY - l.y) * CELL + CELL / 2;
    g.fillStyle = `rgba(${r * 255},${gg * 255},${b * 255},0.9)`;
    g.beginPath(); g.arc(cx, cy, CELL * 0.32, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.stroke();
  }
  // Grifos de esta capa
  for (const [fx, fy, fz] of fluidState.faucets) {
    if (fz !== editor.z) continue;
    const cx = (fx - editor.grid.minX) * CELL + CELL / 2, cy = (editor.grid.maxY - fy) * CELL + CELL / 2;
    g.strokeStyle = '#7fe3ff'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
  }
  if (editor.mirrorX) {
    const mx = (editor.mirrorAxis - editor.grid.minX) * CELL + CELL / 2;
    g.strokeStyle = 'rgba(255,200,80,0.7)';
    g.beginPath(); g.moveTo(mx, 0); g.lineTo(mx, c.height); g.stroke();
  }
}

function cellAt(e: MouseEvent): [number, number] | null {
  const c = canvas.value!;
  const r = c.getBoundingClientRect();
  const q = Math.floor(((e.clientX - r.left) / r.width) * cols.value);
  const row = Math.floor(((e.clientY - r.top) / r.height) * rows.value);
  if (q < 0 || row < 0 || q >= cols.value || row >= rows.value) return null;
  return [editor.grid.minX + q, editor.grid.maxY - row];
}

function apply(e: MouseEvent): void {
  const cell = cellAt(e);
  if (!cell) return;
  const [x, y] = cell;
  if (editor.tool === 'fluid') {
    if (painting === 1) startPour(x, y, editor.z);
    return;
  }
  if (editor.tool === 'light') {
    if (painting === 1 && !lightDone) { toggleLight(x, y, editor.z); lightDone = true; }
    return;
  }
  if (editor.tool === 'pick' && painting === 1) {
    const v = model.value.get(x, y, editor.z);
    if (v) { const d = decode(v); editor.ramp = d.ramp; editor.tone = d.tone; }
    return;
  }
  const erase = painting === 2 || editor.tool === 'erase';
  if (editor.tool === 'paint' && !erase && !model.value.get(x, y, editor.z)) return;
  paint(x, y, editor.z, erase ? 0 : currentMaterial());
  touch();
}

function down(e: MouseEvent): void {
  e.preventDefault();
  painting = e.button === 2 ? 2 : 1;
  lightDone = false;
  history.value.begin();
  apply(e);
}
function move(e: MouseEvent): void { if (painting) apply(e); }
function up(): void {
  if (!painting) return;
  painting = 0;
  if (editor.tool === 'fluid') { stopPour(); history.value.commit(); return; }
  history.value.commit();
  touch();
}

function wheel(e: WheelEvent): void {
  e.preventDefault();
  editor.z = Math.max(0, editor.z + (e.deltaY < 0 ? 1 : -1));
}

onMounted(draw);
watch([version, () => JSON.stringify(fluidState.faucets), () => JSON.stringify(editor.light.sources), () => editor.z, () => editor.mirrorX, () => editor.mirrorAxis, () => editor.grid], draw, { deep: true });
</script>

<template>
  <div class="layer">
    <div class="bar">
      <label>Capa z</label>
      <button @click="editor.z = Math.max(0, editor.z - 1)">−</button>
      <strong>{{ editor.z }}</strong>
      <button @click="editor.z++">+</button>
      <span class="hint">rueda = subir/bajar capa · clic der. = borrar · norte arriba · el cuadro morado es el pivote</span>
    </div>
    <div class="scroll">
      <canvas ref="canvas" @mousedown="down" @mousemove="move" @mouseup="up" @mouseleave="up" @contextmenu.prevent @wheel="wheel" />
    </div>
  </div>
</template>

<style scoped>
.layer { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hint { color: var(--muted); font-size: 12px; }
.scroll { overflow: auto; border: 1px solid var(--line); border-radius: 4px; max-height: 70vh; }
canvas { cursor: crosshair; }
</style>
