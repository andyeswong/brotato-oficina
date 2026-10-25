<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import LayerEditor from './components/LayerEditor.vue';
import Voxel3DEditor from './components/Voxel3DEditor.vue';
import Viewport from './components/Viewport.vue';
import PalettePanel from './components/PalettePanel.vue';
import PxIcon from './components/PxIcon.vue';
import { model, history, editor, touch, loadFile, newModel, replaceModel, version, paint } from './store';
import type { LightKind, Tool } from './store';
import { sampleScene } from '../../src/samples/basic';
import { Model, render, assertClosedPalette } from '@core/index';
import { fluidState, settleNow, startPour, stopPour } from './fluidTool';
import { loadPxl, pxlAssets, paletteFromPxl, spriteToVoxels, toPxlSource, stackPrefixes, stackFromPxl, toPxlStack } from '../../src/pxl/bridge';

const LIGHT_KINDS: Array<[LightKind, string]> = [['torch', 'antorcha'], ['lamp', 'lámpara'], ['brazier', 'brasero'], ['neon-pink', 'neón rosa'], ['neon-cyan', 'neón cian'], ['screen', 'pantalla']];
const TOOLS: Array<[Tool, string, string, string]> = [
  ['pen', 'pen', 'Lápiz', 'B'], ['erase', 'erase', 'Borrar', 'E'], ['paint', 'paint', 'Repintar', 'P'],
  ['pick', 'pick', 'Cuentagotas', 'I'], ['light', 'light', 'Fuente de luz', 'L'], ['fluid', 'fluid', 'Fluido', 'F'],
];

function undo(): void { if (history.value.undo()) touch(); }
function redo(): void { if (history.value.redo()) touch(); }

function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function save(): void {
  download(`${model.value.name || 'modelo'}.voxpix.json`, JSON.stringify({ ...model.value.toJSON(), lights: editor.light.sources }), 'application/json');
}

function readFile(e: Event, then: (text: string, name: string) => void): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) file.text().then((t) => then(t, file.name));
  input.value = '';
}

function open(e: Event): void {
  readFile(e, (t) => loadFile(JSON.parse(t)));
}

// ---- pxl
const pxl = ref<{ name: string; source: string; sprites: string[]; stacks: string[]; sprite: string; plane: 'front' | 'top'; error: string } | null>(null);

function importPxl(e: Event): void {
  readFile(e, (source, name) => {
    try {
      const p = loadPxl(source, name);
      const sprites = pxlAssets(p);
      pxl.value = { name, source, sprites, stacks: stackPrefixes(p), sprite: sprites[0] ?? '', plane: 'front', error: '' };
    } catch (err) {
      pxl.value = { name, source, sprites: [], stacks: [], sprite: '', plane: 'front', error: String(err) };
    }
  });
}

// Modelo nuevo con la paleta del arte (y el sprite, si se eligió)
function pxlAsNew(withSprite: boolean): void {
  const d = pxl.value!;
  const p = loadPxl(d.source, d.name);
  const m = new Model(paletteFromPxl(p, withSprite ? d.sprite : undefined), withSprite ? d.sprite : d.name.replace(/\.px\.[jt]s$/, ''));
  if (withSprite) spriteToVoxels(p, d.sprite, m, { plane: d.plane, z: editor.z });
  replaceModel(m);
  pxl.value = null;
}

// El sprite dentro del modelo actual, con los colores más cercanos de su paleta (deshacer lo quita)
function pxlIntoCurrent(): void {
  const d = pxl.value!;
  const p = loadPxl(d.source, d.name);
  const tmp = new Model(model.value.palette);
  spriteToVoxels(p, d.sprite, tmp, { plane: d.plane, z: editor.z });
  history.value.begin();
  for (const [x, y, z, v] of tmp.entries()) paint(x, y, z, v);
  history.value.commit();
  touch();
  pxl.value = null;
}

// Modelo nuevo desde una pila de capas <prefijo>_zNN
function pxlStack(prefix: string): void {
  const d = pxl.value!;
  const p = loadPxl(d.source, d.name);
  const m = new Model(paletteFromPxl(p, `${prefix}_z00`), prefix);
  try { stackFromPxl(p, prefix, m); } catch (err) { d.error = String(err); return; }
  replaceModel(m);
  pxl.value = null;
}

function exportStack(): void {
  const base = (model.value.name || 'modelo').replace(/[^a-zA-Z0-9_-]/g, '_');
  download(`${base}_capas.px.js`, toPxlStack(model.value, base), 'text/javascript');
}

function exportPxl(): void {
  const m = model.value;
  const n = editor.view.turn;
  const base = (m.name || 'modelo').replace(/[^a-zA-Z0-9_-]/g, '_');
  const frames = Array.from({ length: n }, (_, i) => {
    const yaw = Math.round(editor.view.yaw + (360 * i) / n);
    const img = render(m, { width: 64, height: 48, originX: 32, originY: 42, yaw, elevation: editor.view.elevation, outline: editor.view.outline });
    assertClosedPalette(img, m);
    return { name: `${base}_a${String(((yaw % 360) + 360) % 360).padStart(3, '0')}`, ...img };
  });
  download(`${base}.px.js`, toPxlSource(m, frames, { sheet: base, comment: `VoxPix: ${m.name}, ${n} ángulos de 64x48, pivote en 32,42` }), 'text/javascript');
}

function key(e: KeyboardEvent): void {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (e.key === 'b') editor.tool = 'pen';
  else if (e.key === 'e') editor.tool = 'erase';
  else if (e.key === 'i') editor.tool = 'pick';
  else if (e.key === 'p') editor.tool = 'paint';
  else if (e.key === 'l') editor.tool = 'light';
  else if (e.key === 'f') editor.tool = 'fluid';
  else if (e.key === 'Tab') { e.preventDefault(); editor.mode = editor.mode === 'layers' ? 'voxel3d' : 'layers'; }
  else if (e.key === 'm') editor.mirrorX = !editor.mirrorX;
  else if (e.key === 'PageUp' || e.key === 'w') editor.z++;
  else if (e.key === 'PageDown' || e.key === 's') editor.z = Math.max(0, editor.z - 1);
}

onMounted(() => {
  window.addEventListener('keydown', key);
  // ?verter=x,y,z: vierte un segundo de agua en esa celda (para probar la herramienta sin ratón)
  const v = new URLSearchParams(location.search).get('verter')?.split(',').map(Number);
  if (v && v.length === 3 && v.every(Number.isFinite)) {
    const water = model.value.palette.ramps.findIndex((r) => r.name === 'agua');
    if (water >= 0) { editor.ramp = water; editor.tone = 3; }
    editor.tool = 'fluid';
    startPour(v[0]!, v[1]!, v[2]!);
    setTimeout(stopPour, 1200);
  }
});
onUnmounted(() => window.removeEventListener('keydown', key));
void version;
</script>

<template>
  <header>
    <strong class="logo">VoxPix</strong>
    <button title="Nuevo modelo" @click="newModel"><PxIcon name="new" />Nuevo</button>
    <button title="Escena de muestra" @click="replaceModel(sampleScene())"><PxIcon name="sample" />Muestra</button>
    <label class="pxbtn" title="Abrir un modelo de VoxPix (.json)"><input type="file" accept=".json" @change="open" /><PxIcon name="open" />Abrir</label>
    <button title="Guardar el modelo (.voxpix.json)" @click="save"><PxIcon name="save" />Guardar</button>
    <span class="sep" />
    <label class="pxbtn" title="Importar arte de pxl (.px.js): paleta con rampas y sprites"><input type="file" accept=".js,.ts" @change="importPxl" /><PxIcon name="import" />pxl</label>
    <button title="Exportar a pxl (.px.js): un sprite por ángulo + hoja" @click="exportPxl"><PxIcon name="export" />pxl</button>
    <button title="Exportar a pxl como capas (un sprite por altura, vistas desde arriba)" @click="exportStack"><PxIcon name="layers" />capas</button>
    <span class="sep" />
    <button class="icon" :disabled="!history.canUndo" title="Deshacer (Ctrl+Z)" @click="undo"><PxIcon name="undo" /></button>
    <button class="icon" :disabled="!history.canRedo" title="Rehacer (Ctrl+Y)" @click="redo"><PxIcon name="redo" /></button>
    <span class="info">{{ model.name }} · {{ model.size }} vóxeles</span>
  </header>

  <div v-if="pxl" class="pxl-dialog">
    <strong>Importar de pxl: {{ pxl.name }}</strong>
    <span v-if="pxl.error" class="err">{{ pxl.error }}</span>
    <template v-else>
      <label>Sprite
        <select v-model="pxl.sprite"><option v-for="s in pxl.sprites" :key="s" :value="s">{{ s }}</option></select>
      </label>
      <label>Como
        <select v-model="pxl.plane"><option value="front">plano de frente (filas = altura)</option><option value="top">capa vista desde arriba (z = {{ editor.z }})</option></select>
      </label>
      <button :disabled="!pxl.sprite" @click="pxlAsNew(true)">Modelo nuevo con su paleta</button>
      <button :disabled="!pxl.sprite" @click="pxlIntoCurrent">Añadir al modelo actual</button>
      <button @click="pxlAsNew(false)">Solo la paleta</button>
      <button v-for="st in pxl.stacks" :key="st" class="on" @click="pxlStack(st)"><PxIcon name="layers" />Capas {{ st }}_zNN</button>
    </template>
    <button @click="pxl = null">Cancelar</button>
  </div>

  <main>
    <aside>
      <section>
        <h3>Herramientas</h3>
        <div class="tools">
          <button v-for="[t, icon, name, k] in TOOLS" :key="t" class="icon" :class="{ on: editor.tool === t }" :title="`${name} (${k})`" @click="editor.tool = t">
            <PxIcon :name="icon" />
          </button>
          <button class="icon" :class="{ on: editor.mirrorX }" title="Espejo X (M)" @click="editor.mirrorX = !editor.mirrorX"><PxIcon name="mirror" /></button>
        </div>
        <div class="tool-name">{{ TOOLS.find((x) => x[0] === editor.tool)?.[2] }}</div>
        <div v-if="editor.tool === 'light'" class="row">
          <select v-model="editor.light.kind">
            <option v-for="[k, name] in LIGHT_KINDS" :key="k" :value="k">{{ name }}</option>
          </select>
          <span class="hint">clic en una celda pone la fuente; clic sobre una fuente la quita</span>
        </div>
        <div v-if="editor.tool === 'fluid'" class="row">
          <span class="hint">mantén pulsado para verter agua del material elegido (elige la rampa "agua"); cae, se reparte y se nivela, y se fija sola cuando se calma</span>
          <button :class="{ on: fluidState.faucetMode }" title="Con el modo grifo, un clic pone una fuente continua (o la quita)" @click="fluidState.faucetMode = !fluidState.faucetMode">Grifo</button>
          <span v-if="fluidState.faucets.length" class="hint">{{ fluidState.faucets.length }} grifo(s) abiertos</span>
          <button v-if="fluidState.running" @click="settleNow">Cerrar y fijar ({{ fluidState.cells }} vóxeles)</button>
        </div>
        <div v-if="editor.mirrorX" class="row">
          <label>eje del espejo x = <input class="num" type="number" v-model.number="editor.mirrorAxis" /></label>
        </div>
      </section>
      <section>
        <h3>Paleta (rampas)</h3>
        <PalettePanel />
      </section>
    </aside>
    <section class="center">
      <div class="modes">
        <button :class="{ on: editor.mode === 'layers' }" title="Editar por capas (Tab)" @click="editor.mode = 'layers'"><PxIcon name="layers" />Por capas</button>
        <button :class="{ on: editor.mode === 'voxel3d' }" title="Editar sobre el modelo en 3D (Tab)" @click="editor.mode = 'voxel3d'"><PxIcon name="cube" />Vóxel 3D</button>
      </div>
      <LayerEditor v-if="editor.mode === 'layers'" />
      <Voxel3DEditor v-else />
    </section>
    <section class="right"><Viewport /></section>
  </main>
</template>

<style scoped>
header { display: flex; align-items: center; gap: 4px; padding: 6px 10px; border-bottom: 2px solid var(--line); background: var(--panel); flex-wrap: wrap; }
.logo { color: var(--accent); margin-right: 10px; letter-spacing: .5px; }
.sep { width: 10px; }
.info { margin-left: auto; color: var(--muted); }
.pxbtn input { display: none; }
main { display: grid; grid-template-columns: 210px minmax(0, 1fr) minmax(0, 560px); gap: 14px; padding: 12px; align-items: start; }
aside { display: flex; flex-direction: column; gap: 14px; background: var(--panel); border: 2px solid var(--line); padding: 8px; }
h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); }
.tools { display: grid; grid-template-columns: repeat(4, 48px); gap: 2px; }
.tools button { justify-content: center; }
.tool-name { margin: 6px 0; color: var(--text); }
.modes { display: flex; gap: 4px; align-items: center; margin-bottom: 8px; }
.hint { color: var(--muted); font-size: 12px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; align-items: center; }
.num { width: 50px; }
.pxl-dialog { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 12px; background: #2a2440; border-bottom: 2px solid var(--line); }
.err { color: #ec6a7e; white-space: pre-wrap; }
@media (max-width: 1100px) { main { grid-template-columns: 1fr; } }
</style>
