// El juego: el Brotato sobre el mundo de vóxeles (FERN, fase 3). Este fichero solo hace la vista: cámara, compositor,
// entrada y la capa de interfaz. La partida y su reflejo en el mundo son src/game/brotato/play.ts (determinista); las
// pantallas (tienda, selección, fin, HUD), src/game/brotato/ui (funciones puras sobre un Painter); el bucle de ticks
// fijos, src/game/runtime.ts.
// ?seed=N fija la partida y salta la selección (el mundo sale de la semilla); ?nivel=oficina|medieval|cyberpunk fuerza
// el tema; ?ruta=cpu, la composición en la CPU; ?contorno=exterior|exterior-negro|interior|interior-negro|entidades|no;
// ?ir=tienda|fin simula sin entrada hasta la primera tienda o hasta el final (para verify y las capturas).
import { Model, render, type ModelFile, type VoxelSource } from '@core/index';
import { TILE } from '../../../src/worldgen';
import { THEMES } from '../../../src/content/themes';
import { bakeWorld, rebakeChangedJobs, type Baked } from '../../../src/world/bake';
import { FrameBudget } from '../../../src/view/budget';
import { createCompositor } from '../../../src/view/compositor';
import { walkFrames, WALK_FRAME_MS } from '../../../src/anim/walk';
import { rigFrames } from '../../../src/anim/rig';
import { RIG_CLIP, RIG_GRAPA, RIG_TAZA } from '../../../src/anim/rigs-brotato';
import { FixedLoop, type TickInput, type CarryConfig } from '../../../src/game/runtime';
import { TICK } from '../../../src/world/state';
import { discoverContent } from '../../../src/game/brotato/registry/discover';
import { validateContent } from '../../../src/game/brotato/registry/validate';
import type { LevelModule, ThemeId } from '../../../src/game/brotato/registry/schemas';
import { pickLevel } from '../../../src/game/brotato/sim/arena';
import { BrotatoGame, type Models } from '../../../src/game/brotato/play';
import { lookOf } from '../../../src/game/brotato/looks';
import { hit, type IconRef, type Painter, type Zone } from '../../../src/game/brotato/ui/paint';
import { applyShop, drawShop, shopKey, type ShopAction, type ShopMessage } from '../../../src/game/brotato/ui/shop';
import { drawSelect, selectKey, type SelectAction } from '../../../src/game/brotato/ui/select';
import { drawEnd, END_GRACE_S } from '../../../src/game/brotato/ui/end';
import { drawHud, hudText } from '../../../src/game/brotato/ui/hud';
import { Effects, Flashes, FLASH_ENEMY, FLASH_PLAYER, type FxScene } from '../../../src/game/brotato/ui/fx';
import type { EntityId } from '../../../src/world/state';
import maiaFile from '../../../models/maia/maia.json';

const VW = 384, VH = 216, TOPZ = 40, INCLINE = 0.5;
const INK = '#0d0c12';
const DEAD_PAUSE_S = 0.7;   // lo que se ve la caída antes de la pantalla de fin
const q = new URLSearchParams(location.search);

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

function carryFor(theme: LevelModule['theme']): CarryConfig | undefined {
  const c = registry.character('maia').carryLight;
  const l = c?.[theme] ?? c?.oficina;
  return l ? { model: model(l.model), kind: l.kind, cone: l.cone, intensity: l.intensity, radius: l.radius, color: l.color, hand: l.hand, emit: l.emit } : undefined;
}

// ---- lienzos: el del mundo, el de los efectos y, encima, el de la interfaz, a la misma resolución y escala
const canvas = document.getElementById('view') as HTMLCanvasElement;
const fxCanvas = document.getElementById('fx') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const loading = document.getElementById('loading')!;
canvas.width = VW; canvas.height = VH;
ui.width = VW; ui.height = VH;
fxCanvas.width = VW; fxCanvas.height = VH;
const compositor = createCompositor(canvas, { prefer: q.get('ruta') === 'cpu' ? 'cpu' : 'gpu' });
function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  const top = Math.max(0, (innerHeight - VH * s) / 2);
  const c = compositor.canvas;
  c.style.width = `${VW * s}px`; c.style.height = `${VH * s}px`;
  c.style.marginTop = `${top}px`;
  ui.style.width = c.style.width; ui.style.height = c.style.height;
  ui.style.left = `${Math.floor((innerWidth - VW * s) / 2)}px`; ui.style.top = `${top}px`;
  fxCanvas.style.width = ui.style.width; fxCanvas.style.height = ui.style.height;
  fxCanvas.style.left = ui.style.left; fxCanvas.style.top = ui.style.top;
}
addEventListener('resize', fit); fit();
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
const outline = OUTLINES[q.get('contorno') ?? 'exterior-negro'] ?? OUTLINES['exterior-negro']!;

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
    const view = top ? { elevation: 90, ppu: 2 } : { oblique: { y: INCLINE, z: 1 } };
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
  width: VW,
  height: VH,
  fill(x, y, w, h, color) { g2.fillStyle = color; g2.fillRect(x, y, w, h); },
  icon(ref, x, y, w, h) {
    const img = iconImage(ref);
    if (!img) return false;
    // Centrado; si no cabe, se recorta por el centro (sin escalar: es pixel art)
    const sw = Math.min(img.width, w), sh = Math.min(img.height, h);
    const sx = Math.floor((img.width - sw) / 2), sy = Math.floor((img.height - sh) / 2);
    g2.drawImage(img, sx, sy, sw, sh, x + Math.floor((w - sw) / 2), y + Math.floor((h - sh) / 2), sw, sh);
    return true;
  },
};

// ---- la partida y las pantallas
type Screen = 'select' | 'game' | 'end';
let screen: Screen = 'select';
let seed = Number(q.get('seed') ?? Math.floor(Math.random() * 1e6));
let level = levelFor(seed);
let game: BrotatoGame | null = null;
let baked: Baked | null = null;
let ticks: FixedLoop | null = null;
let budget = new FrameBudget(3);
let selected = 0;
let shopMessage: ShopMessage | null = null;
let endAt = 0;                  // performance.now() en que apareció el fin (para la gracia)
let zones: Zone<ShopAction | SelectAction>[] = [];
const effects = new Effects();
// El destello de un golpe: el tinte plano de la entidad (NARUTO), solo aspecto, con el reloj de la vista
const flashes = new Flashes<EntityId>((id, c) => game?.state.entities.setTint(id, c), (id) => !!game?.state.entities.get(id));
const gfx = fxCanvas.getContext('2d')!;
const fxPainter: Painter = { width: VW, height: VH, fill(x, y, w, h, color) { gfx.fillStyle = color; gfx.fillRect(x, y, w, h); }, icon: () => false };
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
    game = new BrotatoGame(registry, seed, models, { model: maiaModel, walk: maiaWalk, walkMs: WALK_FRAME_MS, carry: carryFor(level.theme) }, level);
    baked = bakeWorld(game.run.arena.world, { topZ: TOPZ, incline: INCLINE, outline: outline.scenery === false ? 'none' : outline.id, outlineColor: outline.color });
    // Precarga (NARUTO, Compositor.prewarm) con el letrero de carga a la vista: los sprites de todo lo que la partida
    // puede enseñar en sus 8 rumbos, y un cuadro tapado que sube el horneado y compila los shaders. Sin ella, el primer
    // cuadro tardaba 86-88 ms
    compositor.prewarm(baked, viewOptions(0, 0, performance.now() / 1000), game.preloadModels());
    ticks = new FixedLoop(game, input, 10);
    budget = new FrameBudget(3);
    shopMessage = null;
    effects.clear();
    flashes.clear();
    screen = 'game';
    after?.();
    frame(performance.now() / 1000);
    loading.style.display = 'none';
  }, 30);
}

// Para verify y las capturas: sin entrada, hasta la primera tienda o hasta el final (saliendo de cada tienda sin comprar)
function skipTo(target: string): void {
  const g = game!;
  for (let t = 0; t < 60 * 60 * 30; t++) {
    if (target === 'tienda' && g.phase === 'shop') return;
    if (g.phase === 'dead' || g.phase === 'victory') return;
    if (g.phase === 'shop') g.leaveShop();
    g.step({ dx: 0, dy: 0, stomp: false });
  }
}

function toSelect(): void {
  seed = (seed * 7919 + 13) % 1000003;
  level = levelFor(seed);
  theme = level.theme;
  game = null; baked = null; ticks = null;
  flashes.clear(); effects.clear(); gfx.clearRect(0, 0, VW, VH);
  selected = 0;
  screen = 'select';
}

function input(): TickInput {
  let dx = 0, dy = 0;
  if (keys.has('a') || keys.has('arrowleft')) dx--;
  if (keys.has('d') || keys.has('arrowright')) dx++;
  if (keys.has('w') || keys.has('arrowup')) dy++;                 // arriba = norte = +y
  if (keys.has('s') || keys.has('arrowdown')) dy--;
  return { dx, dy, stomp: false };
}

function frame(time: number): void {
  if (!game || !baked) return;
  const s = game.state, b = baked;
  const me = s.entities.get(game.playerId)!;
  const feet = b.cam.project(me.x + 0.5, me.y, me.z);
  const vx = Math.max(0, Math.min(b.width - VW, Math.floor(feet[0]) - VW / 2));
  const top = Math.floor(b.cam.project(0, s.depth - 1 - 2 * TILE, 32)[1]);   // la tapa de la pared norte
  const vy = Math.max(top, Math.min(b.height - VH, Math.floor(feet[1]) - VH / 2 - 12));
  compositor.frame(s, b, viewOptions(vx, vy, time));
  paintFx(vx, vy);
}

// Los efectos de la oleada, en su lienzo: se repinta cada cuadro (se mueven), y no se ven en la tienda
function paintFx(vx: number, vy: number): void {
  const g = game!, b = baked!;
  gfx.clearRect(0, 0, VW, VH);
  if (g.phase === 'shop') { flashes.clear(); return; }
  const p = g.current.player;
  const scene: FxScene = { player: { x: p.x, y: p.y, z: p.z }, playerHeight: MAIA_H, enemyHeight: ENEMY_H, groundZ: (x, y) => g.run.arena.restZ(x, y, 1) };
  const fx = g.takeFx();
  for (const f of fx) {
    if (f.type === 'enemy-hit') { const id = g.enemyEntity(f.uid); if (id !== undefined) flashes.flash(id, FLASH_ENEMY.color, FLASH_ENEMY.s); }
    else if (f.type === 'player-hit') flashes.flash(g.playerId, FLASH_PLAYER.color, FLASH_PLAYER.s);
  }
  effects.add(fx, scene);
  effects.paint(fxPainter, b.cam, vx, vy, scene, g.phase === 'wave' ? g.current.telegraphs : []);
}

// Las opciones de composición del juego (las mismas para el cuadro y para la precarga)
function viewOptions(vx: number, vy: number, time: number) {
  return { vx, vy, vw: VW, vh: VH, time, lights: true, ambient: THEMES[game!.theme].ambient, outline: outline.id, outlineColor: outline.color };
}

// La pantalla que toca ahora y su firma
function current(): { name: string; sign: string } {
  if (screen === 'select') return { name: 'seleccion', sign: `select|${selected}|${theme}` };
  if (screen === 'end' || !game) return { name: 'fin', sign: `end|${seed}` };
  const g = game;
  if (g.phase === 'shop') {
    const offers = g.run.shop.offers.map((o) => (o ? `${o.id}${o.locked ? '*' : ''}` : '-')).join(',');
    return { name: 'tienda', sign: `shop|${g.run.materials}|${offers}|${g.run.weapons.length}|${g.run.items.length}|${shopMessage?.text ?? ''}` };
  }
  return { name: 'oleada', sign: `hud|${hudText(g)}|${g.phase}` };
}

function drawUi(): void {
  const c = current();
  document.body.dataset.pantalla = c.name;
  if (c.sign === drawn) return;
  drawn = c.sign;
  g2.clearRect(0, 0, VW, VH);
  zones = [];
  if (screen === 'select') zones = drawSelect(painter, registry, selected, theme);
  else if (screen === 'end' && game) drawEnd(painter, game.run, game.phase === 'victory' ? 'victory' : 'defeat');
  else if (game?.phase === 'shop') zones = drawShop(painter, game.run, theme, shopMessage);
  else if (game) drawHud(painter, game);
  // El texto de la pantalla, para lectores de pantalla (y verify)
  hud.textContent = screen === 'select' ? 'Elige agente' : screen === 'end' ? (game?.phase === 'victory' ? '¡Victoria!' : 'Has caído') : game ? hudText(game) : '';
}

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  if (screen === 'game' && game) {
    ticks?.advance(dt);
    const over = game.phase === 'victory' || (game.phase === 'dead' && game.phaseTick * TICK >= DEAD_PAUSE_S);
    if (over) { screen = 'end'; endAt = now; }
  }
  effects.update(Math.min(dt, 0.1));
  flashes.update(dt);
  if (screen !== 'select') frame(now / 1000);
  if (game && baked) for (const job of rebakeChangedJobs(baked, game.state.lights)) budget.push(job);
  budget.run();
  drawUi();
  next(loop);
}
// En navegadores sin ventana (capturas) requestAnimationFrame no avanza: ?timer=1 usa temporizadores
const next = q.has('timer') ? (f: (t: number) => void) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;

function act(action: ShopAction | SelectAction): void {
  if (action.type === 'start') {
    if (registry.characters()[action.index]) newRun();
  } else if (action.type === 'move') {
    const n = registry.characters().length;
    selected = (selected + action.delta + n) % n;
  } else if (game?.phase === 'shop') {
    if (action.type === 'next') { shopMessage = null; game.leaveShop(); }
    else shopMessage = applyShop(game.run, action);
  }
}

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (screen === 'select') { const a = selectKey(e, registry.characters().length, selected); if (a) act(a); }
  else if (screen === 'end') { if (performance.now() - endAt >= END_GRACE_S * 1000) toSelect(); }
  else if (game?.phase === 'shop') { const a = shopKey(e, game.run); if (a) { e.preventDefault(); act(a); } }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
ui.addEventListener('pointerdown', (e) => {
  if (screen === 'end') { if (performance.now() - endAt >= END_GRACE_S * 1000) toSelect(); return; }
  const r = ui.getBoundingClientRect();
  const a = hit(zones, ((e.clientX - r.left) * VW) / r.width, ((e.clientY - r.top) * VH) / r.height);
  if (a) act(a);
});

theme = level.theme;
loading.style.display = 'none';
if (q.has('seed')) newRun(() => { const target = q.get('ir'); if (target) skipTo(target); });
next(loop);
