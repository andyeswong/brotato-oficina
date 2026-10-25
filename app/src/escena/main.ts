// Demo: el escenario generado del juego, en UN SOLO MUNDO de vóxeles (src/world/state.ts). Este fichero solo hace
// entrada, bucle e interfaz: el mundo guarda lo estático, el agua, las entidades (MAIA), las luces y las gotas; el
// modo 2D (frame2D) y el modo vóxel (frame3D) leen ese mismo estado, y la lógica (colisión, agua) le pregunta a él.
import { generateLayout, WALL, TILE, type Layout } from '../../../../escenario-motor/src/engine/worldgen';
import { THEMES } from '../../../../escenario-motor/demo/src/themes';
import { Model, type ModelFile } from '@core/index';
import { buildWorldState, type WorldTheme, type World } from '../../../src/world/build';
import { bakeWorld, type Baked } from '../../../src/world/bake';
import { frame2D } from '../../../src/world/frame2d';
import { frame3D } from '../../../src/world/frame3d';
import type { WorldState, Entity } from '../../../src/world/state';
import maiaFile from '../../../models/maia/maia.json';

const VW = 384, VH = 216;
const TOPZ = 40;
const THEME_IDS: WorldTheme[] = ['medieval', 'cyberpunk', 'oficina'];
const q = new URLSearchParams(location.search);
// Inclinación del suelo (misma para escenario y personajes): 0.5 por defecto; 1 = losetas sin acortar como el juego
const INCLINE = Number(q.get('inclinacion') ?? 0.5);

const canvas = document.getElementById('view') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const loading = document.getElementById('loading')!;
const modeBtn = document.getElementById('mode') as HTMLButtonElement;
const g = canvas.getContext('2d')!;
canvas.width = VW; canvas.height = VH;
function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  canvas.style.width = `${VW * s}px`; canvas.style.height = `${VH * s}px`;
  canvas.style.marginTop = `${Math.max(0, (innerHeight - VH * s) / 2)}px`;
}
addEventListener('resize', fit); fit();

const maiaModel = Model.fromJSON(maiaFile as unknown as ModelFile);

// ---- estado de la demo (el del juego vive en `state`)
let theme: WorldTheme = (THEME_IDS.includes(q.get('tema') as WorldTheme) ? q.get('tema') : 'medieval') as WorldTheme;
let seed = Number(q.get('seed') ?? 7);
let lightsOn = true;
let layout: Layout = generateLayout(THEMES[theme].spec, seed);
let world: World | null = null;
let state: WorldState | null = null;
let baked: Baked | null = null;
let maia: Entity | null = null;
let mode: '2d' | 'voxel' = q.get('modo') === 'voxel' ? 'voxel' : '2d';
const vox = { yaw: -30, elevation: 35, zoom: 3, dirty: true };
const player = { x: 0, y: 0, dir: 0, moving: false, t: 0, wasInWater: false, stomp: false };
const keys = new Set<string>();
let bakeMs = 0;

function rebuild(): void {
  loading.style.display = 'flex';
  setTimeout(() => {
    const t0 = performance.now();
    layout = generateLayout(THEMES[theme].spec, seed);
    ({ world, state } = buildWorldState(layout, theme));
    baked = bakeWorld(world, { topZ: TOPZ, incline: INCLINE });
    player.x = layout.spawn.x; player.y = layout.spawn.y;
    const pos = q.get('pos')?.split(',').map(Number);
    if (pos && pos.length === 2 && pos.every(Number.isFinite)) { player.x = pos[0]!; player.y = pos[1]!; }
    if (q.get('dir')) player.dir = Number(q.get('dir')) % 8;
    maia = state.addEntity('maia', maiaModel, 0, 0);
    syncPlayer();
    bakeMs = Math.round(performance.now() - t0);
    vox.dirty = true;
    loading.style.display = 'none';
  }, 30);
}

// La entidad MAIA del mundo sigue al jugador (posición del juego -> ejes del mundo; de pie en el fondo del agua)
function syncPlayer(): void {
  if (!state || !maia) return;
  maia.x = Math.round(player.x);
  maia.y = state.toModelY(Math.round(player.y));
  maia.z = state.floorAt(player.x, player.y);
  maia.yaw = player.dir * 45;
}

function blocked(px: number, py: number): boolean {
  if (!state || !world) return true;
  for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 2], [4, 2]] as const) {
    const x = px + dx, y = py + dy;
    const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= layout.cols || cy >= layout.rows) return true;
    const i = cy * layout.cols + cx;
    if (layout.wall[i] !== WALL.none || layout.pillar[i]) return true;
    if (state.waterDepthAt(x, y) > 4.5) return true;                      // agua muy honda (océano)
    if (world.blocked[Math.floor(y) * world.width + Math.floor(x)]) return true;   // el pilón de la fuente
  }
  return false;
}

function step(dt: number): void {
  if (!state) return;
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy--;
  if (keys.has('s') || keys.has('arrowdown')) dy++;
  player.moving = !!(dx || dy);
  const water = state.water;
  const wd = state.waterDepthAt(player.x, player.y);
  if (player.moving) {
    // En el agua se va más despacio, y al moverse se hacen ondas y salpica
    const len = Math.hypot(dx, dy), speed = 70 * dt * (wd < 0.3 ? 1 : wd < 2.5 ? 0.8 : 0.55);
    if (water && wd > 0.3 && Math.floor((player.t + dt) * 12) !== Math.floor(player.t * 12)) {
      water.disturb(player.x, player.y, 0.35);
      state.drops.splash(player.x, player.y, state.waterSurfaceAt(player.x, player.y), 3, 38);
    }
    const nx = player.x + (dx / len) * speed, ny = player.y + (dy / len) * speed;
    if (!blocked(nx, player.y)) player.x = nx;
    if (!blocked(player.x, ny)) player.y = ny;
    player.dir = ((Math.round((Math.atan2(dx, dy) * 180) / Math.PI / 45) % 8) + 8) % 8;   // sur = 0, este = 2...
    player.t += dt;
  }
  if (water) {
    const inWater = state.waterDepthAt(player.x, player.y) > 0.3, zs = state.waterSurfaceAt(player.x, player.y);
    if (inWater && !player.wasInWater) { water.disturb(player.x, player.y, 0.7, 2); state.drops.splash(player.x, player.y, zs, 14, 70); }
    player.wasInWater = inWater;
    if (player.stomp && inWater) { water.disturb(player.x, player.y, 2.8, 3); state.drops.splash(player.x, player.y, zs, 40, 105); }
  }
  player.stomp = false;
  syncPlayer();
}

// El mundo sigue vivo en los dos modos: el agua, el chorro de la fuente y las gotas
function stepWorld(dt: number): void {
  if (!state || !world) return;
  const f = world.fountain;
  if (f) for (let k = 0; k < Math.round(140 * dt) + 1; k++) {
    const ang = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 8;
    state.drops.emit(f.x + Math.cos(ang) * 6.5, f.y + Math.sin(ang) * 6.5, f.bowl.z + 2, Math.cos(ang) * sp, Math.sin(ang) * sp, 8 + Math.random() * 10, 0.012);
  }
  state.step(dt);
}

let lastVoxelDraw = 0;
function frame(time: number): void {
  if (!state || !baked || !maia) return;
  if (mode === 'voxel') {
    // Se redibuja al girar o hacer zoom, y a pocos Hz para el parpadeo y el agua
    if (!vox.dirty && time - lastVoxelDraw < 0.15) return;
    const out = frame3D(state, { width: VW, height: VH, center: [maia.x, maia.y], radius: 72, yaw: vox.yaw, elevation: vox.elevation, zoom: vox.zoom,
      time, lights: lightsOn, ambient: THEMES[theme].ambient });
    g.putImageData(new ImageData(out as Uint8ClampedArray<ArrayBuffer>, VW, VH), 0, 0);
    vox.dirty = false; lastVoxelDraw = time;
    return;
  }
  const b = baked;
  // Cámara: centrada en MAIA, sin pasar de la tapa de la pared norte
  const feet = b.cam.project(maia.x + 0.5, maia.y, maia.z);
  const fx = Math.floor(feet[0]), fy = Math.floor(feet[1]);
  const vx = Math.max(0, Math.min(b.width - VW, fx - VW / 2));
  const top = Math.floor(b.cam.project(0, state.toModelY(2 * TILE), 32)[1]);
  const vy = Math.max(top, Math.min(b.height - VH, fy - VH / 2 - 12));
  const out = frame2D(state, b, {
    vx, vy, vw: VW, vh: VH, time, lights: lightsOn, ambient: THEMES[theme].ambient,
    bob: (e) => (e === maia && player.moving && Math.floor(player.t * 8) % 2 ? 1 : 0),
  });
  g.putImageData(new ImageData(out as Uint8ClampedArray<ArrayBuffer>, VW, VH), 0, 0);
}

let last = performance.now(), avg = 0, acc = 0, n = 0;
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === '2d') step(dt);
  if (q.has('agitar') && Math.floor(now / 700) !== Math.floor((now - dt * 1000) / 700)) player.stomp = true;   // pruebas sin teclado
  stepWorld(dt);
  const t0 = performance.now();
  frame(now / 1000);
  acc += performance.now() - t0; n++;
  if (n === 30) { avg = acc / n; acc = 0; n = 0; }
  hud.textContent = `VoxPix · un solo mundo en vóxeles · ${theme} · semilla ${seed}\n` +
    `horneado ${bakeMs} ms${baked ? ` (render ${baked.ms.render}, luces ${baked.ms.light})` : ''} · cuadro ${avg.toFixed(1)} ms · luces ${lightsOn ? 'sí' : 'no'} · gotas ${state?.drops.count ?? 0}\n` +
    (mode === '2d' ? `WASD/flechas mover · Espacio pisotón · R otra semilla · T otro tema · L luz · V modo vóxel`
      : `MODO VÓXEL · arrastrar = girar · rueda = zoom · V vuelve al modo 2D`);
  next(loop);
}
// En navegadores sin ventana (capturas) requestAnimationFrame no avanza: ?timer=1 usa temporizadores
const next = q.has('timer') ? (f: (t: number) => void) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;

function toggleMode(): void {
  mode = mode === '2d' ? 'voxel' : '2d';
  vox.dirty = true;
  modeBtn.textContent = mode === '2d' ? 'Modo vóxel' : 'Modo 2D';
  modeBtn.classList.toggle('on', mode === 'voxel');
}
modeBtn.addEventListener('click', () => { toggleMode(); modeBtn.blur(); });
if (mode === 'voxel') { mode = '2d'; toggleMode(); }

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'r') { seed = (seed * 7919 + 13) % 100000; rebuild(); }
  if (k === 't') { theme = THEME_IDS[(THEME_IDS.indexOf(theme) + 1) % THEME_IDS.length]!; rebuild(); }
  if (k === 'l') { lightsOn = !lightsOn; vox.dirty = true; }
  if (k === 'v') toggleMode();
  if (k === ' ') { player.stomp = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

// Girar y hacer zoom en modo vóxel
let drag: [number, number] | null = null;
canvas.addEventListener('mousedown', (e) => { if (mode === 'voxel') drag = [e.clientX, e.clientY]; });
addEventListener('mouseup', () => { drag = null; });
addEventListener('mousemove', (e) => {
  if (!drag) return;
  vox.yaw = Math.round(vox.yaw + (e.clientX - drag[0]) * 0.5);
  vox.elevation = Math.max(5, Math.min(89, Math.round(vox.elevation + (e.clientY - drag[1]) * 0.3)));
  drag = [e.clientX, e.clientY];
  vox.dirty = true;
});
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'voxel') return;
  e.preventDefault();
  vox.zoom = Math.max(1, Math.min(8, vox.zoom + (e.deltaY < 0 ? 1 : -1)));
  vox.dirty = true;
}, { passive: false });

rebuild();
next(loop);
