// El juego: el Brotato sobre el mundo de vóxeles (FERN, fase 3). Este fichero solo hace la vista: cámara, compositor,
// entrada y la capa de interfaz. La partida y su reflejo en el mundo son src/game/brotato/play.ts (determinista); las
// pantallas (tienda, selección, fin, HUD), src/game/brotato/ui (funciones puras sobre un Painter); el bucle de ticks
// fijos, src/game/runtime.ts.
// ?seed=N fija la partida y salta la selección (el mundo sale de la semilla); ?nivel=oficina|medieval|cyberpunk fuerza
// el tema; ?camara=clasica|cenital|baja|cerca, la cámara (ui/camera.ts); ?ruta=cpu, la composición en la CPU; ?contorno=exterior|exterior-negro|interior|interior-negro|entidades|no;
// ?ir=tienda|limpia|salida|piso2|fin simula sin entrada hasta ahí: la primera tienda, la oleada limpia, la salida abierta, el
// segundo piso o el final (para verify y las capturas).
// Para medir (fase 4): ?ola=N empieza en la oleada N e ?inmortal hace que MAIA no caiga; body[data-enemigos] los cuenta.
// ?dev activa las herramientas de desarrollo: V pausa y enseña el mundo en modo vóxel (./voxel.ts).
import { Model, render, type ModelFile, type VoxelSource } from '@voxpix/core/index';
import { TILE } from '@voxpix/worldgen';
import { bakeWorld, rebakeChangedJobs, type Baked } from '@voxpix/world/bake';
import { WorldView, prepareViewJob, type Quarter } from '@voxpix/world/view';
import { TurnBackground, inputToWorld, turnQuarter, viewProjector, wallDress, type BgJob } from '../../../src/game/brotato/ui/turn';
import { FrameBudget } from '@voxpix/view/budget';
import { createCompositor } from '@voxpix/view/compositor';
import { walkFrames, WALK_FRAME_MS } from '@voxpix/anim/walk';
import { rigFrames } from '@voxpix/anim/rig';
import { RIG_CLIP, RIG_GRAPA, RIG_TAZA } from '../../../src/anim/rigs-brotato';
import { FixedLoop, type TickInput } from '@voxpix/runtime/runtime';
import { TICK } from '@voxpix/world/state';
import { discoverContent } from '../../../src/game/brotato/registry/discover';
import { validateContent } from '../../../src/game/brotato/registry/validate';
import type { LevelModule, ThemeId } from '../../../src/game/brotato/registry/schemas';
import { pickLevel } from '../../../src/game/brotato/sim/arena';
import { BrotatoGame, type GameInput, type Models } from '../../../src/game/brotato/play';
import { skipTo } from '../../../src/game/brotato/skip';
import { lookOf } from '../../../src/game/brotato/looks';
import { hit, type IconRef, type Painter, type Zone } from '../../../src/game/brotato/ui/paint';
import { applyShop, drawShop, shopKey, type ShopAction, type ShopMessage, type ShopPending } from '../../../src/game/brotato/ui/shop';
import { drawSelect, selectKey, type SelectAction } from '../../../src/game/brotato/ui/select';
import { applyMeta, drawMeta, metaKey, type MetaAction, type MetaMessage } from '../../../src/game/brotato/ui/meta';
import { loadProgress, saveProgress } from '../../../src/game/brotato/meta/store';
import { fichasEarned } from '../../../src/game/brotato/meta/upgrades';
import { drawEnd, END_GRACE_S } from '../../../src/game/brotato/ui/end';
import { ACCENTS } from '../../../src/game/brotato/ui/theme';
import type { Highlight } from '@voxpix/world/frame2d';
import { TouchStick, isTouch } from './touch';
import { GameAudio } from './audio';
import { VoxelInspector } from './voxel';
import { DASH_RECHARGE, DASH_TIME } from '../../../src/game/brotato/sim/World';
import { drawHud, hudText, type HudAction } from '../../../src/game/brotato/ui/hud';
import { PIXEL_RULES, computeLayout, scrollAxis } from '../../../src/game/brotato/ui/layout';
import { cameraById, cycleCamera, type CameraPreset } from '../../../src/game/brotato/ui/camera';
import { Effects, Flashes, FLASH_DASH, FLASH_ENEMY, FLASH_PLAYER, paintPointer, type FxScene } from '../../../src/game/brotato/ui/fx';
import type { EntityId } from '@voxpix/world/state';
import maiaFile from 'voxpix/models/maia/maia.json';

// El commit de la build (app/vite.config.ts): se ve en la portada y en body[data-version]
declare const __COMMIT__: string;
const versionEl = document.getElementById('version')!;
versionEl.textContent = __COMMIT__;
document.body.dataset.version = __COMMIT__;

const TOPZ = 40;
const ICON_INCLINE = 0.5;   // los iconos de la interfaz se ven siempre igual, sea cual sea la cámara
// Lo que se ve, en píxeles del juego: lo decide la regla 216/384 (ui/layout.ts) según la pantalla, en fit()
let VW = 384, VH = 216;
// Lo que mide la interfaz (HUD, tienda, selección): siempre la regla 216/384, sea cual sea el zoom de la cámara
let UW = 384, UH = 216;
const INK = '#0d0c12';
const DEAD_PAUSE_S = 0.7;
const WARM_MS = 150;         // cuadros de calentamiento detrás del letrero al empezar la partida (unos 9)
let warmUntil = 0;   // lo que se ve la caída antes de la pantalla de fin
const q = new URLSearchParams(location.search);
// La cámara (ui/camera.ts): ?camara=id, o la última elegida en la selección (se recuerda en este navegador)
const CAMERA_KEY = 'brotato.camara';
function storedCamera(): string | null {
  try { return localStorage.getItem(CAMERA_KEY); } catch { return null; }
}
let camera: CameraPreset = cameraById(q.get('camara') ?? storedCamera());
// El modo vóxel de desarrollo: solo existe con ?dev
const inspector = q.has('dev') ? new VoxelInspector() : null;

// ---- contenido y modelos
const { registry, errors } = validateContent(discoverContent());
if (errors.length) throw new Error(`El contenido tiene errores:\n${errors.map((e) => `${e.path} ${e.field ?? ''}: ${e.message}`).join('\n')}`);
const FILES = import.meta.glob('../../../models/brotato/**/*.json', { eager: true, import: 'default' }) as Record<string, ModelFile>;
const cache = new Map<string, Model>();
function model(ref: string): Model {
  let m = cache.get(ref);
  if (!m) {
    const file = FILES[`../../../models/brotato/${ref}.json`];
    if (!file) throw new Error(`no existe el modelo models/brotato/${ref}.json`);
    cache.set(ref, (m = Model.fromJSON(file)));
  }
  return m;
}
// El rig de andar de cada papel (NARUTO, src/anim/rigs-brotato.ts): eligen las partes por geometría, así que valen
// para el aspecto de cualquier mundo
const RIGS: Record<string, typeof RIG_GRAPA> = { perseguidor: RIG_GRAPA, embestidor: RIG_CLIP, escupidor: RIG_TAZA };
const walks = new Map<string, { frames: VoxelSource[]; ms: number } | null>();
const models: Models = {
  model,
  walk(ref, role) {
    const key = `${ref}|${role}`;
    if (!walks.has(key)) {
      const rig = RIGS[role];
      walks.set(key, rig ? { frames: rigFrames(model(ref), rig), ms: rig.frameMs } : null);
    }
    return walks.get(key)!;
  },
};
const maiaModel = Model.fromJSON(maiaFile as unknown as ModelFile);
const maiaWalk = walkFrames(maiaModel);
// Lo que miden MAIA y un bicho (los textos de los efectos salen justo encima de la cabeza)
const MAIA_H = (maiaModel.bounds()?.maxZ ?? 30) + 1;
const ENEMY_H = 12;


// ---- lienzos: el del mundo, el de los efectos y, encima, el de la interfaz, a la misma resolución y escala
const canvas = document.getElementById('view') as HTMLCanvasElement;
const fxCanvas = document.getElementById('fx') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const loading = document.getElementById('loading')!;
canvas.width = VW; canvas.height = VH;
ui.width = UW; ui.height = UH;
fxCanvas.width = VW; fxCanvas.height = VH;
const compositor = createCompositor(canvas, { prefer: q.get('ruta') === 'cpu' ? 'cpu' : 'gpu' });
// La regla de píxel del Brotato (216/384): un píxel del juego son s×s píxeles FÍSICOS, s entero, y se ve lo que quepa
// hasta 384 por eje. El mundo y los efectos usan la regla de la cámara (la Cerca acerca); la interfaz, siempre la de
// 216/384, para que la tienda quepa igual con cualquier cámara. Cada lienzo va centrado en su caja y el tamaño CSS (con
// decimales si hace falta) cae en píxeles físicos exactos. El compositor ajusta su lienzo al tamaño de cada cuadro
function fit(): void {
  // innerWidth es entero y el ancho de verdad puede no serlo: en el Flip abierto, 411 x 2,625 = 1078,9 en vez de
  // 1080, y la escala bajaba de 5 a 4. visualViewport da el ancho con decimales
  const dpr = devicePixelRatio || 1;
  const vv = visualViewport;
  const pw = Math.round((vv?.width ?? innerWidth) * dpr), ph = Math.round((vv?.height ?? innerHeight) * dpr);
  const l = computeLayout(pw, ph, camera.rules), lu = computeLayout(pw, ph, PIXEL_RULES);
  VW = l.width; VH = l.height; UW = lu.width; UH = lu.height;
  if (fxCanvas.width !== VW || fxCanvas.height !== VH) { fxCanvas.width = VW; fxCanvas.height = VH; }
  if (ui.width !== UW || ui.height !== UH) { ui.width = UW; ui.height = UH; }
  const place = (c: HTMLCanvasElement, w: number, h: number, k: typeof l) => {
    c.style.position = 'fixed'; c.style.margin = '0';
    c.style.width = `${(w * k.scale) / dpr}px`; c.style.height = `${(h * k.scale) / dpr}px`;
    c.style.left = `${k.left / dpr}px`; c.style.top = `${k.top / dpr}px`;
  };
  place(compositor.canvas, VW, VH, l);
  place(fxCanvas, VW, VH, l);
  place(ui, UW, UH, lu);
  inspector?.place(compositor.canvas, VW, VH);
}
addEventListener('resize', fit);
visualViewport?.addEventListener('resize', fit);
matchMedia?.(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', fit);
fit();
// Letrero de bajo detalle, como en la escena: si se compone en la CPU, que se vea
const lowDetail = document.getElementById('lowdetail')!;
lowDetail.textContent = q.get('ruta') === 'cpu' ? 'Modo de bajo detalle (forzado con ?ruta=cpu)' : 'Sin aceleración gráfica: modo de bajo detalle';
lowDetail.style.display = compositor.kind === 'cpu' ? 'block' : 'none';

// El contorno de las entidades (compositor.frame) y, salvo en 'entidades', el del escenario (bakeWorld). 'entidades'
// es la propuesta de NARUTO: separa enemigos y armas del suelo sin contornear el escenario; lo decide Andrés.
const OUTLINES: Record<string, { id: 'outer' | 'both' | 'none'; color?: string; scenery?: false }> = {
  exterior: { id: 'outer' }, 'exterior-negro': { id: 'outer', color: INK }, interior: { id: 'both' }, 'interior-negro': { id: 'both', color: INK }, no: { id: 'none' },
  entidades: { id: 'outer', color: INK, scenery: false },
};
// Por defecto el contorno interior (decisión de Andrés, el estándar de las demos de VoxPix): el exterior más los saltos de
// profundidad (paredes, columnas), con el tono más oscuro de la rampa vecina y sin color fijo
const DEFAULT_OUTLINE = 'interior';
// Solo las claves propias: ?contorno=__proto__ no puede caer en Object.prototype
const outlineKey = q.get('contorno') ?? DEFAULT_OUTLINE;
const outline = (Object.hasOwn(OUTLINES, outlineKey) ? OUTLINES[outlineKey] : undefined) ?? OUTLINES[DEFAULT_OUTLINE]!;

// ---- iconos de la interfaz: el modelo pintado con la cámara del juego, recortado a lo que ocupa
const g2 = ui.getContext('2d')!;
const icons = new Map<string, HTMLCanvasElement | null>();
let theme: ThemeId = 'oficina';
function iconModel(ref: IconRef): VoxelSource | null {
  switch (ref.kind) {
    case 'weapon': return model(lookOf(registry.weapon(ref.id), theme).model);
    case 'item': { const icon = lookOf(registry.item(ref.id), theme).icon; return icon ? model(icon) : null; }
    case 'character': return ref.id === 'maia' ? maiaModel : null;
    case 'material': return model(`efectos/material-${ref.id}`);
  }
}
function iconImage(ref: IconRef): HTMLCanvasElement | null {
  const key = `${theme}|${ref.kind}|${ref.id}`;
  if (icons.has(key)) return icons.get(key)!;
  const m = iconModel(ref);
  let out: HTMLCanvasElement | null = null;
  if (m) {
    // Las armas de perfil (el modelo apunta a -y); el resto, de frente
    const S = 72;
    // El material es una pieza de 3 o 4 vóxeles tumbada: de frente se lee como un guion, y en oblicua la cara del
    // vóxel de delante tapa el hueco del clip. Cenital y a 2 px por vóxel se ven el clip, la moneda o el chip
    const top = ref.kind === 'material';
    const view = top ? { elevation: 90, ppu: 2 } : { oblique: { y: ICON_INCLINE, z: 1 } };
    const img = render(m, { width: S, height: S, originX: S / 2, originY: S - 8, pivot: [0.5, 0, 0], yaw: ref.kind === 'weapon' ? 90 : 0, ...view, flat: true, outline: 'outer', outlineColor: INK });
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img.rgba[(y * S + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 >= 0) {
      const full = document.createElement('canvas');
      full.width = S; full.height = S;
      full.getContext('2d')!.putImageData(new ImageData(img.rgba, S, S), 0, 0);
      out = document.createElement('canvas');
      out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d')!.drawImage(full, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    }
  }
  icons.set(key, out);
  return out;
}
const painter: Painter = {
  get width() { return UW; },
  get height() { return UH; },
  fill(x, y, w, h, color) { g2.fillStyle = color; g2.fillRect(x, y, w, h); },
  icon(ref, x, y, w, h) {
    const img = iconImage(ref);
    if (!img) return false;
    // El retrato de la portada crece a múltiplos enteros hasta llenar su caja (sin suavizar: es pixel art)
    const k = ref.kind === 'character' ? Math.max(1, Math.floor(Math.min(w / img.width, h / img.height))) : 1;
    if (k > 1) {
      g2.imageSmoothingEnabled = false;
      g2.drawImage(img, x + Math.floor((w - img.width * k) / 2), y + Math.floor((h - img.height * k) / 2), img.width * k, img.height * k);
      return true;
    }
    // Centrado; si no cabe, se recorta por el centro (sin escalar: es pixel art)
    const sw = Math.min(img.width, w), sh = Math.min(img.height, h);
    const sx = Math.floor((img.width - sw) / 2), sy = Math.floor((img.height - sh) / 2);
    g2.drawImage(img, sx, sy, sw, sh, x + Math.floor((w - sw) / 2), y + Math.floor((h - sh) / 2), sw, sh);
    return true;
  },
};

// ---- la partida y las pantallas
type Screen = 'select' | 'meta' | 'game' | 'end';
let screen: Screen = 'select';
let seed = Number(q.get('seed') ?? Math.floor(Math.random() * 1e6));
let level = levelFor(seed);
let game: BrotatoGame | null = null;
let baked: Baked | null = null;
// El giro de la cámara (ui/turn.ts): Q / E en la partida. Cada giro es una vista girada del mundo con su horneado; se
// guardan los 4 (unos 52 MB cada uno con su copia girada). El actual se hornea al empezar y los demás en segundo plano,
// por pasos y con el presupuesto por cuadro (prepareViewJob de VoxPix)
interface TurnView { view: WorldView; baked: Baked }
let quarter: Quarter = 0;
const views = new Map<Quarter, TurnView>();
let cur: TurnView | null = null;
const pending = new Map<Quarter, { prep: ReturnType<typeof prepareViewJob>; bg: BgJob; t0: number }>();
let runStart = 0;
// Los trabajos de esos giros, aparte del FrameBudget del rehorneado: tienen su presupuesto según la fase (ui/turn.ts)
let bgJobs: BgJob[] = [];
// Los giros listos que faltan por subir a la GPU (compositor.upload, NARUTO): se suben de uno en uno y solo fuera de la
// oleada, porque subir uno es el cuadro de 33-50 ms que daba girar en el Flip. Ya subidos, girar solo cambia los enlaces
let toUpload: Baked[] = [];
const turnBg = new TurnBackground();
const bakeLog: Array<{ q: Quarter; ms: number; phase: string; wave: number; how: string }> = [];
(window as unknown as { __giros: typeof bakeLog }).__giros = bakeLog;
const slowLog: Array<{ at: number; frameMs: number; bgMs: number; rebakeMs: number; q: number; phase: string; stage?: string }> = [];
(window as unknown as { __lentos: typeof slowLog }).__lentos = slowLog;
let ticks: FixedLoop | null = null;
let budget = new FrameBudget(3);
let selected = 0;
let shopMessage: ShopMessage | null = null;
const shopPending: ShopPending = { swap: null };
let endAt = 0;                  // performance.now() en que apareció el fin (para la gracia)
let zones: Zone<ShopAction | SelectAction | HudAction | MetaAction>[] = [];
// El progreso entre partidas (roguelite): las fichas y las mejoras, guardadas en este navegador. La partida recibe
// las mejoras al empezar; lo que gana se suma al acabar (earned, para enseñarlo en el fin)
function storage(): Storage | null {
  try { return localStorage; } catch { return null; }
}
const progress = loadProgress(storage());
let earned = 0;
let metaMessage: MetaMessage | null = null;
const audio = new GameAudio();
const touch = isTouch();
const stick = new TouchStick();
let pointerTaken = -1;          // el dedo que pulsó un botón de la interfaz (ese no mueve el joystick)
let heard = '';                // la fase y el estado de la oleada que ya sonaron (limpia, tienda, derrota, victoria)
let shotSeen = 0;               // el uid del último disparo de MAIA que ya sonó (los uid empiezan de nuevo en cada oleada)
let shotWave: object | null = null;
let enterQueued = false;        // F pulsada (o el botón de entrar tocado) desde el último tick: se gasta en el siguiente
let dashQueued = false;         // lo mismo con el dash (espacio, o su botón)
const effects = new Effects();
// El destello de un golpe: el tinte plano de la entidad (NARUTO), solo aspecto, con el reloj de la vista
const flashes = new Flashes<EntityId>((id, c) => game?.state.entities.setTint(id, c), (id) => !!game?.state.entities.get(id));
const gfx = fxCanvas.getContext('2d')!;
const fxPainter: Painter = { get width() { return VW; }, get height() { return VH; }, fill(x, y, w, h, color) { gfx.fillStyle = color; gfx.fillRect(x, y, w, h); }, icon: () => false };
let drawn = '';                 // la firma de lo último pintado en la interfaz: solo se repinta si cambia
const keys = new Set<string>();

function levelFor(s: number): LevelModule {
  const forced = q.get('nivel');
  return forced && registry.has('level', forced) ? registry.level(forced) : pickLevel(registry.levels(), s);
}

function newRun(after?: () => void): void {
  loading.style.display = 'flex';
  setTimeout(() => {
    level = levelFor(seed);
    theme = level.theme;
    // Sin luz en la mano al empezar (decisión de Andrés): la ficha de MAIA guarda su carryLight por si se consigue luego
    game = new BrotatoGame(registry, seed, models, { model: maiaModel, walk: maiaWalk, walkMs: WALK_FRAME_MS }, level,
      { startWave: Number(q.get('ola') ?? 0) || undefined, immortal: q.has('inmortal'), meta: progress.levels, waitFloor: true });
    quarter = 0;
    runStart = performance.now();
    bakeFloor();
    ticks = new FixedLoop(game, input, 10);
    budget = new FrameBudget(3);
    shopMessage = null;
    shopPending.swap = null;
    effects.clear();
    flashes.clear();
    screen = 'game';
    after?.();
    frame(performance.now() / 1000);
    // Calentar: unos cuadros del mundo detrás del letrero, sin que avance la partida (MAIA). Sin esto, el primer cuadro
    // de la oleada cargaba con todo el arranque (en el Flip, 50-67 ms): el reloj traía el tiempo de la carga y el bucle
    // fijo daba de golpe sus 10 ticks de tope. Mientras se calienta, el reloj sigue al día y la oleada empieza con un dt normal
    warmUntil = performance.now() + WARM_MS;
    setTimeout(() => { loading.style.display = 'none'; }, WARM_MS);
  }, 30);
}

// Hornea el piso de la partida (al empezar y en cada piso nuevo): el giro actual de golpe, con el letrero a la vista, y
// los otros 3 en segundo plano. Nunca dentro de una oleada: en un piso nuevo la partida espera quieta (waitFloor)
let shownArena: unknown = null;   // la arena horneada; si la partida cambia de piso, deja de ser la suya
function bakeFloor(): void {
  const g = game!;
  views.clear();
  pending.clear();
  bgJobs = [];
  toUpload = [];
  cur = bakeView(quarter);
  baked = cur.baked;
  shownArena = g.run.arena;
  // Precarga (NARUTO, Compositor.prewarm) con el letrero de carga a la vista: los sprites de todo lo que la partida
  // puede enseñar en sus 8 rumbos, y un cuadro tapado que sube el horneado y compila los shaders. Sin ella, el primer
  // cuadro tardaba 86-88 ms
  compositor.prewarm(baked, viewOptions(0, 0, performance.now() / 1000), g.preloadModels());
  // Los otros 3 giros, en segundo plano: primero los vecinos (los que se piden antes)
  for (const k of [turnQuarter(quarter, 1), turnQuarter(quarter, -1), ((quarter + 2) % 4) as Quarter]) {
    const prep = prepareViewJob(g.state, k, bakeOptions(), { dress: wallDress(g.run.arena.layout) });
    const bg: BgJob = { run: (d) => prep.job.run(d), stage: () => prep.stage() };
    bgJobs.push(bg);
    pending.set(k, { prep, bg, t0: performance.now() });
  }
  effects.clear();
  flashes.clear();
}

// La partida cruzó la salida y está en un piso nuevo: el letrero con el número, el horneado y, al acabar, la oleada
let floorBaking = false;
function changeFloor(): void {
  if (!game || floorBaking) return;
  floorBaking = true;
  const text = loading.textContent;
  loading.textContent = `Piso ${game.run.floor + 1}`;
  loading.style.display = 'flex';
  setTimeout(() => {
    if (!game) { floorBaking = false; return; }
    bakeFloor();
    game.floorReady();
    floorBaking = false;
    // Unos cuadros de calentamiento detrás del letrero, como al empezar
    warmUntil = performance.now() + WARM_MS;
    setTimeout(() => { loading.style.display = 'none'; loading.textContent = text; }, WARM_MS);
  }, 30);
}

function bakeOptions() {
  return { topZ: TOPZ, incline: camera.incline, outline: outline.scenery === false ? 'none' as const : outline.id, outlineColor: outline.color };
}

// Hornea de golpe la vista de un giro (el 0 al empezar, sin vestido: desde el sur las paredes ya están bien)
function bakeView(q: Quarter): TurnView {
  const g = game!;
  const t0 = performance.now();
  const view = new WorldView(g.state, q, q === 0 ? {} : { dress: wallDress(g.run.arena.layout) });
  return keep(q, { view, baked: bakeWorld(view.bakeable(), bakeOptions()) }, t0, 'de golpe');
}

// Guarda un giro listo. Para medir (fase 4 y el giro): cuándo quedó, cuánto tardó y en qué fase de la partida
function keep(q: Quarter, t: TurnView, t0: number, how: string): TurnView {
  views.set(q, t);
  pending.delete(q);
  const g = game!;
  bakeLog.push({ q, ms: Math.round(performance.now() - t0), phase: g.phase, wave: g.run.waveNumber, how });
  document.body.dataset.giros = String(views.size);
  return t;
}

// Recoge los giros de segundo plano que ya acabaron
function collectViews(): void {
  for (const [k, p] of pending) {
    const r = p.prep.result();
    if (r) { keep(k, r, runStart, 'segundo plano (desde el empezar)'); toUpload.push(r.baked); }
  }
}

// Girar: si el giro ya está horneado, al momento; si no, con el letrero «Girando…» mientras se hornea
let turning = false;
function turn(step: 1 | -1): void {
  if (!game || !cur || turning) return;
  const next = turnQuarter(quarter, step);
  const go = (t: TurnView) => { quarter = next; cur = t; baked = t.baked; };
  collectViews();
  const have = views.get(next);
  if (have) { go(have); return; }
  turning = true;
  const text = loading.textContent;
  loading.textContent = 'Girando…';
  loading.style.display = 'flex';
  setTimeout(() => {
    // Si estaba a medias en segundo plano, se termina de golpe; si no, se hornea entero
    const p = pending.get(next);
    if (p) {
      const t0 = performance.now();
      while (!p.prep.job.run(Infinity)) { /* el resto del trabajo, de una vez */ }
      bgJobs = bgJobs.filter((j) => j !== p.bg);
      go(keep(next, p.prep.result()!, t0, 'terminado al girar'));
    } else go(bakeView(next));
    loading.style.display = 'none';
    loading.textContent = text;
    turning = false;
  }, 30);
}

function toSelect(): void {
  seed = (seed * 7919 + 13) % 1000003;
  level = levelFor(seed);
  theme = level.theme;
  game = null; baked = null; ticks = null; cur = null; views.clear(); pending.clear(); bgJobs = []; toUpload = [];
  flashes.clear(); effects.clear(); gfx.clearRect(0, 0, VW, VH);
  selected = 0;
  screen = 'select';
}

function input(): GameInput {
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy++;                 // arriba = norte = +y
  if (keys.has('s') || keys.has('arrowdown')) dy--;
  // La entrada es de la pantalla ("arriba" = lejos de la cámara); la partida la quiere en ejes del mundo
  // El joystick táctil manda si está en uso (una dirección de pantalla, como las flechas)
  const s = stick.dir();
  if (s) { dx = s.dx; dy = s.dy; }
  if (cur) [dx, dy] = inputToWorld(cur.view.camera, dx, dy);
  const interact = enterQueued || keys.has('f');
  enterQueued = false;
  const dash = dashQueued;
  dashQueued = false;
  return { dx, dy, stomp: false, interact, dash };
}

function frame(time: number): void {
  if (!game || !cur) return;
  const s = game.state, b = cur.baked, cam = cur.view.camera;
  // La vista girada al día (con el giro 0 es el mundo tal cual); las luces de lo rebajado ya no vienen (hideLight)
  const rs = cur.view.frame();
  const me = s.entities.get(game.playerId)!;
  const [mx, my] = cam.pointToView(me.x + 0.5, me.y);
  const feet = b.cam.project(mx, my, me.z);
  const vx = scrollAxis(Math.floor(feet[0]), VW, 0, b.width);
  const top = Math.floor(b.cam.project(0, cam.viewDepth - 1 - 2 * TILE, 32)[1]);   // la tapa de la pared del fondo
  const vy = scrollAxis(Math.floor(feet[1]) - 12, VH, top, b.height);
  compositor.frame(rs, b, viewOptions(vx, vy, time));
  document.body.dataset.enemigos = String(game.current.enemies.length);   // para medir (fase 4)
  paintFx(vx, vy);
}

// Los efectos de la oleada, en su lienzo: se repinta cada cuadro (se mueven), y no se ven en la tienda
function paintFx(vx: number, vy: number): void {
  const g = game!, b = baked!;
  gfx.clearRect(0, 0, VW, VH);
  if (g.phase === 'shop') { flashes.clear(); return; }
  const p = g.current.player;
  const scene: FxScene = { player: { x: p.x, y: p.y, z: p.z }, playerHeight: MAIA_H, enemyHeight: ENEMY_H, groundZ: (x, y) => g.run.arena.restZ(x, y, 1), accent: ACCENTS[theme] };
  const fx = g.takeFx();
  for (const f of fx) {
    if (f.type === 'enemy-hit') { const id = g.enemyEntity(f.uid); if (id !== undefined) flashes.flash(id, FLASH_ENEMY.color, FLASH_ENEMY.s); audio.play('golpe'); }
    else if (f.type === 'player-hit') { flashes.flash(g.playerId, FLASH_PLAYER.color, FLASH_PLAYER.s); audio.play('dano'); }
    else if (f.type === 'enemy-die') audio.play('muerte');
    else if (f.type === 'pickup') audio.play('recoger');
    else if (f.type === 'dash') { flashes.flash(g.playerId, FLASH_DASH.color, DASH_TIME); audio.play('dash'); }
  }
  // Los disparos de MAIA no son un efecto de la partida: se oyen al ver un proyectil suyo nuevo
  if (shotWave !== g.current) { shotWave = g.current; shotSeen = 0; }
  for (const pr of g.current.projectiles) if (pr.owner !== 'enemy' && pr.uid > shotSeen) { shotSeen = pr.uid; audio.play('disparo'); }
  if (Math.hypot(p.vx, p.vy) > 1) audio.play('paso');
  effects.add(fx, scene);
  if (g.phase === 'wave' && g.current.dash.t > 0) effects.dashAt(p.x, p.y, p.z);
  const cam = viewProjector(cur!.view.camera, b.cam);
  effects.paint(fxPainter, cam, vx, vy, scene, g.phase === 'wave' ? g.current.telegraphs : []);
  // Con la oleada limpia o la salida abierta, una flecha en el borde si el sitio adonde ir no se ve
  const goal = g.phase !== 'wave' ? null : g.current.status === 'open' ? g.run.arena.shop : g.current.status === 'exit' ? g.run.arena.exit : null;
  if (goal) {
    const [gx, gy] = cam.project(goal.x, goal.y, g.run.arena.floorZ);
    paintPointer(fxPainter, gx! - vx, gy! - vy, ACCENTS[g.theme]);
  }
}

// Lo que suena al cambiar de fase: la oleada limpia, la tienda, la derrota y la victoria; la música, en las oleadas
function listen(): void {
  const g = game;
  if (stick.active && (screen !== 'game' || g?.phase !== 'wave')) stick.end();
  const now = screen === 'game' && g ? `${g.phase}|${g.phase === 'wave' ? g.current.status : ''}|${g.run.waveIndex}` : screen;
  audio.music(screen === 'game' && g?.phase === 'wave' && g.current.status === 'playing' && !inspector?.on);
  if (now === heard) return;
  heard = now;
  if (!g || screen !== 'game') return;
  if (g.phase === 'wave' && g.current.status === 'open') audio.play('limpia');
  else if (g.phase === 'shop') audio.play('tienda');
  else if (g.phase === 'dead') audio.play('derrota');
  else if (g.phase === 'victory') audio.play('victoria');
}

// Lo que queda detrás del escenario (MAIA o un enemigo pegados a la pared sur, que mide 16 como todas desde VoxPix
// 857c33d) se ve como una silueta en damero de este color (VoxPix 2d45335 y 93db4f1, Frame2DOptions.xray)
const XRAY = { color: [150, 220, 255] as const };

// Las opciones de composición del juego (las mismas para el cuadro y para la precarga)
function viewOptions(vx: number, vy: number, time: number) {
  return { vx, vy, vw: VW, vh: VH, time, lights: true, ambient: game!.run.arena.ambient, outline: outline.id, outlineColor: outline.color, highlight: shopHighlight(time), xray: XRAY };
}

// Con la oleada limpia, la entrada a la tienda brilla con el acento del mundo y late (resalte de VoxPix, a612e67):
// entre el acento y su 55 %, un ciclo cada 1,2 s. En la caja del objeto pasada a los ejes del giro actual
function shopHighlight(time: number): Highlight | null {
  const g = game;
  if (!g || !cur || g.phase !== 'wave') return null;
  // Con la oleada limpia, la tienda; tras ella, la salida del piso
  const box = g.current.status === 'open' ? g.run.arena.shopBox : g.current.status === 'exit' ? g.run.arena.exit?.box : null;
  if (!box) return null;
  const hex = ACCENTS[g.theme], k = 0.775 + 0.225 * Math.cos((time * 2 * Math.PI) / 1.2);
  const color = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k)) as [number, number, number];
  return { box: cur.view.viewBox(box), color, width: 2 };
}

// La pantalla que toca ahora y su firma
function current(): { name: string; sign: string } {
  if (screen === 'select') return { name: 'seleccion', sign: `select|${selected}|${theme}|${audio.muted}|${progress.fichas}` };
  if (screen === 'meta') return { name: 'mejoras', sign: `meta|${theme}|${JSON.stringify(progress)}|${metaMessage?.text ?? ''}` };
  if (screen === 'end' || !game) return { name: 'fin', sign: `end|${seed}` };
  const g = game;
  if (g.phase === 'shop') {
    const offers = g.run.shop.offers.map((o) => (o ? `${o.id}${o.locked ? '*' : ''}` : '-')).join(',');
    return { name: 'tienda', sign: `shop|${g.run.materials}|${offers}|${g.run.weapons.length}|${g.run.items.length}|${shopMessage?.text ?? ''}|${shopPending.swap}` };
  }
  // Las cargas de dash se rellenan poco a poco: la firma lleva cuánto (en los 12 px de su barra)
  const d = g.current.dash, refill = d.max > 0 ? Math.floor((d.rechargeT / DASH_RECHARGE) * 12) : 0;
  return { name: 'oleada', sign: `hud|${hudText(g)}|${g.phase}|${refill}` };
}

function drawUi(): void {
  const c = current();
  document.body.dataset.pantalla = c.name;
  // Con el tamaño en la firma: si la ventana cambia, se repinta a la nueva medida
  const sign = `${UW}x${UH}|${camera.id}|${c.sign}`;
  if (sign === drawn) return;
  drawn = sign;
  g2.clearRect(0, 0, UW, UH);
  zones = [];
  if (screen === 'select') zones = drawSelect(painter, registry, selected, theme, 1, camera.name, !audio.muted, progress.fichas);
  else if (screen === 'meta') zones = drawMeta(painter, progress, theme, metaMessage);
  else if (screen === 'end' && game) drawEnd(painter, game.run, game.phase === 'victory' ? 'victory' : 'defeat', earned);
  else if (game?.phase === 'shop') zones = drawShop(painter, game.run, theme, shopMessage, shopPending.swap);
  else if (game) zones = drawHud(painter, game, { touch });
  // El texto de la pantalla, para lectores de pantalla (y verify)
  versionEl.style.display = screen === 'select' ? '' : 'none';
  hud.textContent = screen === 'select' ? `Brotato de la oficina · jugar · mejoras (${progress.fichas} fichas)` : screen === 'meta' ? `Mejoras · ${progress.fichas} fichas` : screen === 'end' ? (game?.phase === 'victory' ? '¡Victoria!' : 'Has caído') : game ? hudText(game) : '';
}

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  // En el modo vóxel la partida no avanza (sin ticks, el reloj fijo no acumula: al volver sigue donde estaba)
  if (screen === 'game' && game && now >= warmUntil && !inspector?.on) {
    ticks?.advance(dt);
    const over = game.phase === 'victory' || (game.phase === 'dead' && game.phaseTick * TICK >= DEAD_PAUSE_S);
    if (over) { screen = 'end'; endAt = now; award(game); }
  }
  // Piso nuevo: lo que hay horneado es del anterior, así que no se pinta nada hasta hornearlo
  const stale = !!game && game.run.arena !== shownArena;
  if (stale && screen === 'game') changeFloor();
  listen();
  effects.update(Math.min(dt, 0.1));
  flashes.update(dt);
  if (inspector?.on && game) {
    let dx = 0, dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx--;
    if (keys.has('d') || keys.has('arrowright')) dx++;
    if (keys.has('w') || keys.has('arrowup')) dy++;
    if (keys.has('s') || keys.has('arrowdown')) dy--;
    inspector.pan(dx, dy, Math.min(dt, 0.1));
    inspector.frame(game.state, now / 1000, { ambient: game.run.arena.ambient, outline: outline.id, outlineColor: outline.color });
  } else if (screen !== 'select' && screen !== 'meta' && !stale) frame(now / 1000);
  if (game && cur && !stale) for (const job of rebakeChangedJobs(cur.baked, cur.view.lights)) budget.push(job);
  const spent = budget.run();
  if (game && bgJobs.length) {
    // Para medir: los cuadros lentos con lo que se llevó el segundo plano y qué giro estaba trabajando
    const head = [...pending].find(([, p]) => p.bg === bgJobs[0]);
    const first = head?.[0], stage = head?.[1].prep.stage() ?? '-';
    const t0 = performance.now();
    bgJobs = turnBg.run(bgJobs, game.phase === 'wave', spent);
    const bgMs = performance.now() - t0;
    if (dt * 1000 > 30 || bgMs > 10) slowLog.push({ at: Math.round(now - runStart), frameMs: Math.round(dt * 1000), bgMs: Math.round(bgMs), rebakeMs: Math.round(spent), q: first ?? -1, phase: game.phase, stage });
  } else if (game && dt * 1000 > 30) slowLog.push({ at: Math.round(now - runStart), frameMs: Math.round(dt * 1000), bgMs: 0, rebakeMs: Math.round(spent), q: -1, phase: game.phase });
  if (pending.size) collectViews();
  // Subir a la GPU un giro listo por cuadro, sin juego (el que se sube pasa a ser el actual del compositor, pero el
  // siguiente cuadro vuelve al del giro actual desde su caché de 4, sin coste)
  if (game && toUpload.length && game.phase !== 'wave') compositor.upload(toUpload.shift()!);
  drawUi();
  next(loop);
}
// En navegadores sin ventana (capturas) requestAnimationFrame no avanza: ?timer=1 usa temporizadores
const next = q.has('timer') ? (f: (t: number) => void) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;

// Las fichas de la partida que acaba de terminar (no con ?ola ni ?inmortal: son para medir, no para jugar)
function award(g: BrotatoGame): void {
  const victory = g.phase === 'victory';
  earned = q.has('ola') || q.has('inmortal') ? 0 : fichasEarned(victory ? g.run.totalWaves : g.run.waveIndex, g.run.kills, victory);
  progress.fichas += earned;
  saveProgress(storage(), progress);
}

function act(action: ShopAction | SelectAction | HudAction | MetaAction): void {
  if (action.type === 'meta') {
    metaMessage = null;
    screen = 'meta';
  } else if (action.type === 'back') {
    screen = 'select';
  } else if (action.type === 'upgrade') {
    metaMessage = applyMeta(progress, action);
    if (metaMessage?.ok) { saveProgress(storage(), progress); audio.play('compra'); }
  } else if (action.type === 'turn') {
    if (game) turn(action.delta);
  } else if (action.type === 'dash') {
    dashQueued = true;
  } else if (action.type === 'sound') {
    audio.toggleMuted();
    drawn = '';
  } else if (action.type === 'enter') {
    enterQueued = true;
  } else if (action.type === 'start') {
    if (registry.characters()[action.index]) newRun();
  } else if (action.type === 'move') {
    const n = registry.characters().length;
    selected = (selected + action.delta + n) % n;
  } else if (action.type === 'camera') {
    // Se elige en la selección: la inclinación se hornea al empezar la partida y el zoom se aplica ya
    camera = cycleCamera(camera, action.delta);
    try { localStorage.setItem(CAMERA_KEY, camera.id); } catch { /* sin almacenamiento: solo esta vez */ }
    fit();
  } else if (game?.phase === 'shop') {
    if (action.type === 'next') { shopMessage = null; shopPending.swap = null; game.leaveShop(); }
    else {
      shopMessage = applyShop(game.run, action, shopPending);
      if ((action.type === 'buy' || action.type === 'replace') && shopMessage?.text === 'comprado') audio.play('compra');
    }
  }
}

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  audio.unlock();
  // El modo vóxel (?dev): V entra en la partida; dentro, solo V/Esc (salir) y R (volver a MAIA), el resto es la vista
  if (inspector && game && screen === 'game' && (inspector.on || k === 'v')) {
    const me = game.state.entities.get(game.playerId)!;
    if (k === 'v' || (k === 'escape' && inspector.on)) inspector.toggle(me);
    else if (k === 'r') inspector.lookAt(me);
    e.preventDefault();
    return;
  }
  if (k === 'm' && screen !== 'select') { audio.toggleMuted(); return; }
  if (screen === 'select') { const a = selectKey(e, registry.characters().length, selected); if (a) act(a); }
  else if (screen === 'meta') { const a = metaKey(e); if (a) { e.preventDefault(); act(a); } }
  else if (screen === 'end') { if (performance.now() - endAt >= END_GRACE_S * 1000) toSelect(); }
  else if (game?.phase === 'shop') { const a = shopKey(e, game.run, shopPending.swap); if (a) { e.preventDefault(); act(a); } }
  else if (game && (k === 'q' || k === 'e')) turn(k === 'e' ? 1 : -1);
  else if (game && k === 'f') enterQueued = true;
  else if (game && k === ' ' && !e.repeat) { dashQueued = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
// El audio nace con el primer gesto en cualquier sitio de la página (en el Flip abierto, el lienzo es solo una franja)
addEventListener('pointerdown', () => audio.unlock(), { capture: true });
ui.addEventListener('pointerdown', (e) => {
  if (screen === 'end') { if (performance.now() - endAt >= END_GRACE_S * 1000) toSelect(); return; }
  const r = ui.getBoundingClientRect();
  const a = hit(zones, ((e.clientX - r.left) * UW) / r.width, ((e.clientY - r.top) * UH) / r.height);
  if (a) { pointerTaken = e.pointerId; act(a); }
});
// El joystick: un dedo (no el ratón) que no cayó en un botón, durante la oleada, en cualquier sitio de la página
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || e.pointerId === pointerTaken || screen !== 'game' || game?.phase !== 'wave' || inspector?.on) return;
  stick.start(e, ACCENTS[theme]);
});
addEventListener('pointermove', (e) => stick.move(e));
addEventListener('pointerup', (e) => { stick.end(e); if (e.pointerId === pointerTaken) pointerTaken = -1; });
addEventListener('pointercancel', (e) => { stick.end(e); if (e.pointerId === pointerTaken) pointerTaken = -1; });

theme = level.theme;
loading.style.display = 'none';
if (q.has('seed')) newRun(() => {
  const target = q.get('ir');
  if (!target) return;
  const r = skipTo(game!, target);
  if (!r.reached) console.warn(`?ir=${target} no llegó: ${r.phase} (semilla ${seed}, ${level.id})`);
});
next(loop);
