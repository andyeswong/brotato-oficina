<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { render, camera, key, unkey, decode, DIR_VECTORS, type RenderOptions, type Rendered } from '@core/index';
import { model, history, version, editor, paint, currentMaterial, touch, toggleLight } from '../store';
import { SOURCE_PRESETS } from '../../../src/lighting';
import { startPour, stopPour, fluidState } from '../fluidTool';

// Edición sobre el modelo en 3D con el mismo render que la vista previa, a más píxeles por vóxel.
// Clic izquierdo: lápiz pone un vóxel sobre la cara que tocas (o en el suelo), borrar lo quita, repintar le
// cambia el material, cuentagotas lo copia. Arrastre derecho: orbitar. Rueda: zoom.
// El lienzo tiene el tamaño del escenario
let W = 640, H = 520;
const canvas = ref<HTMLCanvasElement>();
const box = ref<HTMLDivElement>();
let last: Rendered | null = null;
let opts: RenderOptions | null = null;
let hover: [number, number, number] | null = null;
let action: 0 | 1 | 2 = 0;           // 1 herramienta, 2 orbitar
let lastXY: [number, number] = [0, 0];
const done = new Set<number>();      // vóxeles ya tocados en este trazo (borrar/repintar al arrastrar)

function options(): RenderOptions {
  return {
    width: W, height: H, originX: W / 2, originY: Math.round(H * 0.78),
    yaw: editor.view3d.yaw, elevation: editor.view3d.elevation, ppu: editor.view3d.zoom,
    pick: true, outline: 'none', ao: true,
  };
}

function draw(): void {
  const c = canvas.value;
  if (!c) return;
  opts = options();
  last = render(model.value, opts);
  const cam = camera(opts);
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#15141c';
  g.fillRect(0, 0, W, H);

  // Suelo z = 0 con la rejilla de celdas y el pivote
  const { minX, maxX, minY, maxY } = editor.grid;
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.beginPath();
  for (let x = minX; x <= maxX + 1; x++) { const a = cam.project(x, minY, 0), b = cam.project(x, maxY + 1, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  for (let y = minY; y <= maxY + 1; y++) { const a = cam.project(minX, y, 0), b = cam.project(maxX + 1, y, 0); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
  g.stroke();
  quad(g, cam, 0, 0, 'rgba(140,120,216,0.35)');
  if (editor.mirrorX) {
    const a = cam.project(editor.mirrorAxis + 0.5, minY, 0), b = cam.project(editor.mirrorAxis + 0.5, maxY + 1, 0);
    g.strokeStyle = 'rgba(255,200,80,0.7)';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }

  // Modelo, con las aristas entre vóxeles marcadas para saber en qué celda estás
  const rgba = last.rgba.slice();
  const pk = last.pickKey!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (Number.isNaN(pk[i]!)) continue;
    const r = x + 1 < W ? pk[i + 1]! : NaN, d = y + 1 < H ? pk[i + W]! : NaN;
    const edge = (!Number.isNaN(r) && r !== pk[i]) || (!Number.isNaN(d) && d !== pk[i]) || Number.isNaN(r) || Number.isNaN(d);
    if (edge) for (let ch = 0; ch < 3; ch++) rgba[i * 4 + ch] = rgba[i * 4 + ch]! * 0.72;
  }
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d')!.putImageData(new ImageData(rgba, W, H), 0, 0);
  g.drawImage(off, 0, 0);

  // Fuentes de luz: un punto de su color en su celda, con un hilo hasta el suelo para leer la altura
  for (const l of editor.light.sources) {
    const [px, py] = cam.project(l.x + 0.5, l.y + 0.5, l.z + 0.5);
    const [fx, fy] = cam.project(l.x + 0.5, l.y + 0.5, 0);
    const [r, gg, b] = SOURCE_PRESETS[l.kind].color;
    const col = `rgba(${r * 255},${gg * 255},${b * 255},1)`;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, py); g.lineTo(fx, fy); g.stroke(); g.setLineDash([]);
    const grad = g.createRadialGradient(px, py, 0, px, py, editor.view3d.zoom * 1.6);
    grad.addColorStop(0, `rgba(${r * 255},${gg * 255},${b * 255},0.55)`); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.beginPath(); g.arc(px, py, editor.view3d.zoom * 1.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.strokeStyle = '#fff';
    g.beginPath(); g.arc(px, py, Math.max(4, editor.view3d.zoom * 0.35), 0, Math.PI * 2); g.fill(); g.stroke();
  }

  // Grifos abiertos: un anillo cian en su celda
  for (const [fx, fy, fz] of fluidState.faucets) {
    const [px, py] = cam.project(fx + 0.5, fy + 0.5, fz + 0.5);
    g.strokeStyle = '#7fe3ff'; g.lineWidth = 2;
    g.beginPath(); g.arc(px, py, Math.max(5, editor.view3d.zoom * 0.45), 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
  }

  if (hover) outlineVoxel(g, cam, hover);
}

// Fuente bajo el ratón (a pocos píxeles de su punto), para quitarla con la herramienta de luz
function lightUnder(e: MouseEvent): [number, number, number] | null {
  if (!opts) return null;
  const [px, py] = pixelOf(e);
  const cam = camera(opts);
  for (const l of editor.light.sources) {
    const [lx, ly] = cam.project(l.x + 0.5, l.y + 0.5, l.z + 0.5);
    if (Math.hypot(lx - px, ly - py) <= Math.max(8, editor.view3d.zoom * 0.5)) return [l.x, l.y, l.z];
  }
  return null;
}

function quad(g: CanvasRenderingContext2D, cam: ReturnType<typeof camera>, x: number, y: number, fill: string): void {
  const p = [cam.project(x, y, 0), cam.project(x + 1, y, 0), cam.project(x + 1, y + 1, 0), cam.project(x, y + 1, 0)];
  g.fillStyle = fill;
  g.beginPath(); p.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.fill();
}

// Contorno del cubo objetivo: envolvente convexa de sus 8 esquinas proyectadas
function outlineVoxel(g: CanvasRenderingContext2D, cam: ReturnType<typeof camera>, [x, y, z]: [number, number, number]): void {
  const pts: Array<[number, number]> = [];
  for (const dx of [0, 1]) for (const dy of [0, 1]) for (const dz of [0, 1]) { const p = cam.project(x + dx, y + dy, z + dz); pts.push([p[0], p[1]]); }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: Array<[number, number]> = [], upper: Array<[number, number]> = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop(); lower.push(p); }
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop(); upper.push(p); }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  g.strokeStyle = editor.tool === 'erase' ? '#ff6b6b' : editor.tool === 'light' ? '#7fe3ff' : '#ffd166';
  g.lineWidth = 2;
  g.beginPath(); hull.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); g.stroke();
  g.lineWidth = 1;
}

function pixelOf(e: MouseEvent): [number, number] {
  const r = canvas.value!.getBoundingClientRect();
  return [Math.floor(((e.clientX - r.left) / r.width) * W), Math.floor(((e.clientY - r.top) / r.height) * H)];
}

// Qué vóxel señala el ratón: el visible (borrar/repintar/cuentagotas) o el hueco junto a la cara (lápiz)
function target(e: MouseEvent): { hit: [number, number, number] | null; place: [number, number, number] | null } {
  if (!last || !opts) return { hit: null, place: null };
  const [px, py] = pixelOf(e);
  if (px < 0 || py < 0 || px >= W || py >= H) return { hit: null, place: null };
  const i = py * W + px;
  const k = last.pickKey![i]!;
  if (!Number.isNaN(k)) {
    const hit = unkey(k);
    const d = DIR_VECTORS[last.pickFace![i]!]!;
    return { hit, place: [hit[0] + d[0], hit[1] + d[1], hit[2] + d[2]] };
  }
  const ground = camera(opts).groundAt(px + 0.5, py + 0.5);
  return { hit: null, place: ground ? [ground[0], ground[1], 0] : null };
}

function apply(e: MouseEvent, first: boolean): void {
  const { hit, place } = target(e);
  if (editor.tool === 'fluid') {
    if (place && place[2] >= 0) startPour(place[0], place[1], place[2]);
    return;
  }
  if (editor.tool === 'light') {
    if (!first) return;
    const existing = lightUnder(e);
    const cell = existing ?? place;
    if (cell && cell[2] >= 0) toggleLight(cell[0], cell[1], cell[2]);
    return;
  }
  if (editor.tool === 'pen') {
    if (first && place && place[2] >= 0) paint(place[0], place[1], place[2], currentMaterial());
  } else if (hit) {
    const k = key(...hit);
    if (done.has(k)) return;
    done.add(k);
    if (editor.tool === 'erase') paint(hit[0], hit[1], hit[2], 0);
    else if (editor.tool === 'paint') paint(hit[0], hit[1], hit[2], currentMaterial());
    else if (editor.tool === 'pick') { const d = decode(model.value.get(...hit)); editor.ramp = d.ramp; editor.tone = d.tone; }
  }
  touch();
}

function down(e: MouseEvent): void {
  e.preventDefault();
  lastXY = [e.clientX, e.clientY];
  if (e.button === 2) { action = 2; return; }
  action = 1;
  done.clear();
  history.value.begin();
  apply(e, true);
}

function move(e: MouseEvent): void {
  if (action === 2) {
    editor.view3d.yaw = Math.round(editor.view3d.yaw + (e.clientX - lastXY[0]) * 0.5);
    editor.view3d.elevation = Math.max(5, Math.min(89, Math.round(editor.view3d.elevation + (e.clientY - lastXY[1]) * 0.4)));
    lastXY = [e.clientX, e.clientY];
    return;
  }
  if (action === 1 && editor.tool !== 'pen') apply(e, false);
  const t = target(e);
  hover = editor.tool === 'pen' || editor.tool === 'light' || editor.tool === 'fluid' ? (lightUnder(e) ?? t.place) : t.hit;
  draw();
}

function up(): void {
  if (action === 1 && editor.tool === 'fluid') { stopPour(); history.value.commit(); }
  else if (action === 1) { history.value.commit(); touch(); }
  action = 0;
}

function wheel(e: WheelEvent): void {
  e.preventDefault();
  editor.view3d.zoom = Math.max(4, Math.min(32, editor.view3d.zoom + (e.deltaY < 0 ? 1 : -1)));
}

let ro: ResizeObserver | null = null;
function fit(): void {
  const b = box.value;
  if (!b) return;
  W = Math.max(200, b.clientWidth); H = Math.max(200, b.clientHeight);
  draw();
}
onMounted(() => { ro = new ResizeObserver(fit); if (box.value) ro.observe(box.value); fit(); });
onUnmounted(() => ro?.disconnect());
watch([version, () => JSON.stringify(fluidState.faucets), () => JSON.stringify(editor.light.sources), () => ({ ...editor.view3d }), () => editor.mirrorX, () => editor.mirrorAxis, () => editor.grid], draw, { deep: true });
</script>

<template>
  <div ref="box" class="v3d">
    <canvas ref="canvas" @mousedown="down" @mousemove="move" @mouseup="up" @mouseleave="up" @contextmenu.prevent @wheel="wheel" />
  </div>
</template>

<style scoped>
.v3d { position: absolute; inset: 0; }
canvas { width: 100%; height: 100%; cursor: crosshair; image-rendering: auto; }
</style>
