// Demo: el escenario generado del juego, en UN SOLO MUNDO de vóxeles (src/world/state.ts). Este fichero solo hace
// entrada, bucle e interfaz: el mundo guarda lo estático, el agua, las entidades (MAIA), las luces y las gotas; el
// modo 2D (frame2D) y el modo vóxel (frame3D) leen ese mismo estado, y la lógica (colisión, agua) le pregunta a él.
import { generateLayout, TILE, type Layout } from '../../../src/worldgen';
import { THEMES } from '../../../src/content/themes';
import { Model, type ModelFile } from '@core/index';
import { buildWorldState, type WorldTheme, type World } from '../../../src/world/build';
import { bakeWorld, type Baked } from '../../../src/world/bake';
import { frame2D } from '../../../src/world/frame2d';
import { frame3D } from '../../../src/world/frame3d';
import { TICK, type WorldState, type Entity } from '../../../src/world/state';
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
    // La salida viene del worldgen (filas hacia abajo): se pasa a ejes del modelo una vez, aquí
    player.x = layout.spawn.x; player.y = world.depth - 1 - layout.spawn.y;
    const pos = q.get('pos')?.split(',').map(Number);              // ?pos=x,y en ejes del modelo (y hacia el norte)
    if (pos && pos.length === 2 && pos.every(Number.isFinite)) { player.x = pos[0]!; player.y = pos[1]!; }
    if (q.get('dir')) player.dir = Number(q.get('dir')) % 8;
    maia = state.addEntity('maia', maiaModel, 0, 0);
    syncPlayer();
    bakeMs = Math.round(performance.now() - t0);
    vox.dirty = true;
    loading.style.display = 'none';
  }, 30);
}

// La entidad MAIA del mundo sigue al jugador, de pie en el suelo (o en el fondo del agua)
function syncPlayer(): void {
  if (!state || !maia) return;
  maia.x = Math.round(player.x);
  maia.y = Math.round(player.y);
  maia.z = state.groundAt(player.x, player.y);
  maia.yaw = player.dir * 45;
}

// Colisión: las cuatro esquinas del pie tienen que ser pisables (subir 2 como mucho; sin agua de más de 4,5)
function blocked(x: number, y: number): boolean {
  if (!state || !maia) return true;
  for (const [dx, dy] of [[-4, -2], [4, -2], [-4, 2], [4, 2]] as const) if (!state.standable(x + dx, y + dy, maia.z, 2)) return true;
  return false;
}

function step(dt: number): void {
  if (!state) return;
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy++;                 // arriba = norte = +y
  if (keys.has('s') || keys.has('arrowdown')) dy--;
  player.moving = !!(dx || dy);
  const water = state.water;
  const wd = state.waterAt(player.x, player.y)?.depth ?? 0;
  if (player.moving) {
    // En el agua se va más despacio, y al moverse se hacen ondas y salpica
    const len = Math.hypot(dx, dy), speed = 70 * dt * (wd < 0.3 ? 1 : wd < 2.5 ? 0.8 : 0.55);
    if (water && wd > 0.3 && Math.floor((player.t + dt) * 12) !== Math.floor(player.t * 12)) {
      state.events.disturb(player.x, player.y, 0.35);
      state.events.splash(player.x, player.y, state.waterAt(player.x, player.y)?.surface ?? 0, 3, 38);
    }
    const nx = player.x + (dx / len) * speed, ny = player.y + (dy / len) * speed;
    if (!blocked(nx, player.y)) player.x = nx;
    if (!blocked(player.x, ny)) player.y = ny;
    player.dir = ((Math.round((Math.atan2(dx, -dy) * 180) / Math.PI / 45) % 8) + 8) % 8;   // sur = 0, este = 2, norte = 4
    player.t += dt;
  }
  if (water) {
    const wa = state.waterAt(player.x, player.y), inWater = (wa?.depth ?? 0) > 0.3, zs = wa?.surface ?? 0;
    if (inWater && !player.wasInWater) { state.events.disturb(player.x, player.y, 0.7, 2); state.events.splash(player.x, player.y, zs, 14, 70); }
    player.wasInWater = inWater;
    if (player.stomp && inWater) { state.events.disturb(player.x, player.y, 2.8, 3); state.events.splash(player.x, player.y, zs, 40, 105); }
  }
  player.stomp = false;
  syncPlayer();
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
  const top = Math.floor(b.cam.project(0, state.depth - 1 - 2 * TILE, 32)[1]);   // la tapa de la pared norte
  const vy = Math.max(top, Math.min(b.height - VH, fy - VH / 2 - 12));
  const out = frame2D(state, b, {
    vx, vy, vw: VW, vh: VH, time, lights: lightsOn, ambient: THEMES[theme].ambient,
    bob: (e) => (e === maia && player.moving && Math.floor(player.t * 8) % 2 ? 1 : 0),
  });
  g.putImageData(new ImageData(out as Uint8ClampedArray<ArrayBuffer>, VW, VH), 0, 0);
}

let last = performance.now(), avg = 0, acc = 0, n = 0, tickAcc = 0;
function loop(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Ticks fijos de 1/60 (como el runtime de FERN): entrada y entidades -> eventos -> world.step()
  if (q.has('agitar') && Math.floor(now / 700) !== Math.floor((now - dt * 1000) / 700)) player.stomp = true;   // pruebas sin teclado
  tickAcc += dt;
  while (state && tickAcc >= TICK) {
    if (mode === '2d') step(TICK);
    state.step();
    tickAcc -= TICK;
  }
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
