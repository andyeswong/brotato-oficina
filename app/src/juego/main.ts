// El juego: el Brotato sobre el mundo de vóxeles (FERN, fase 3). Este fichero solo hace la vista: cámara, compositor,
// entrada y HUD. La partida y su reflejo en el mundo son src/game/brotato/play.ts (determinista); el bucle de ticks
// fijos, src/game/runtime.ts. ?seed=N fija la partida (el mundo sale de la semilla); ?nivel=oficina|medieval|cyberpunk
// fuerza el tema; ?ruta=cpu, la composición en la CPU; ?contorno=exterior|exterior-negro|interior|interior-negro|no.
import { Model, type ModelFile, type VoxelSource } from '@core/index';
import { TILE } from '../../../src/worldgen';
import { THEMES } from '../../../src/content/themes';
import { bakeWorld, rebakeChangedJobs, type Baked } from '../../../src/world/bake';
import { FrameBudget } from '../../../src/view/budget';
import { createCompositor } from '../../../src/view/compositor';
import { walkFrames, WALK_FRAME_MS } from '../../../src/anim/walk';
import { rigFrames } from '../../../src/anim/rig';
import { RIG_CLIP, RIG_GRAPA, RIG_TAZA } from '../../../src/anim/rigs-brotato';
import { FixedLoop, type TickInput, type CarryConfig } from '../../../src/game/runtime';
import { discoverContent } from '../../../src/game/brotato/registry/discover';
import { validateContent } from '../../../src/game/brotato/registry/validate';
import type { LevelModule } from '../../../src/game/brotato/registry/schemas';
import { pickLevel } from '../../../src/game/brotato/sim/arena';
import { BrotatoGame, type Models } from '../../../src/game/brotato/play';
import maiaFile from '../../../models/maia/maia.json';

const VW = 384, VH = 216, TOPZ = 40, INCLINE = 0.5;
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

function carryFor(theme: LevelModule['theme']): CarryConfig | undefined {
  const c = registry.character('maia').carryLight;
  const l = c?.[theme] ?? c?.oficina;
  return l ? { model: model(l.model), kind: l.kind, cone: l.cone, intensity: l.intensity, radius: l.radius, color: l.color, hand: l.hand, emit: l.emit } : undefined;
}

// ---- lienzo
const canvas = document.getElementById('view') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const banner = document.getElementById('banner')!;
const loading = document.getElementById('loading')!;
canvas.width = VW; canvas.height = VH;
const compositor = createCompositor(canvas, { prefer: q.get('ruta') === 'cpu' ? 'cpu' : 'gpu' });
function fit(): void {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  const c = compositor.canvas;
  c.style.width = `${VW * s}px`; c.style.height = `${VH * s}px`;
  c.style.marginTop = `${Math.max(0, (innerHeight - VH * s) / 2)}px`;
}
addEventListener('resize', fit); fit();
// Letrero de bajo detalle, como en la escena: si se compone en la CPU, que se vea
const lowDetail = document.getElementById('lowdetail')!;

const INK = '#0d0c12';
const OUTLINES: Record<string, { id: 'outer' | 'both' | 'none'; color?: string }> = {
  exterior: { id: 'outer' }, 'exterior-negro': { id: 'outer', color: INK }, interior: { id: 'both' }, 'interior-negro': { id: 'both', color: INK }, no: { id: 'none' },
};
const outline = OUTLINES[q.get('contorno') ?? 'exterior-negro'] ?? OUTLINES['exterior-negro']!;

// ---- la partida
let seed = Number(q.get('seed') ?? Math.floor(Math.random() * 1e6));
let game: BrotatoGame | null = null;
let baked: Baked | null = null;
let ticks: FixedLoop | null = null;
let budget = new FrameBudget(3);
const keys = new Set<string>();

function newRun(): void {
  loading.style.display = 'flex';
  setTimeout(() => {
    // El nivel (y con él el tema y la luz de MAIA) sale de la semilla, como en la simulación, salvo que se fuerce
    const forced = q.get('nivel');
    const level = forced && registry.has('level', forced) ? registry.level(forced) : pickLevel(registry.levels(), seed);
    game = new BrotatoGame(registry, seed, models, { model: maiaModel, walk: maiaWalk, walkMs: WALK_FRAME_MS, carry: carryFor(level.theme) }, level);
    baked = bakeWorld(game.run.arena.world, { topZ: TOPZ, incline: INCLINE, outline: outline.id, outlineColor: outline.color });
    ticks = new FixedLoop(game, input, 10);
    budget = new FrameBudget(3);
    loading.style.display = 'none';
  }, 30);
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
  compositor.frame(s, b, { vx, vy, vw: VW, vh: VH, time, lights: true, ambient: THEMES[game.theme].ambient, outline: outline.id, outlineColor: outline.color });
}

function showHud(): void {
  if (!game) return;
  const w = game.current, run = game.run;
  hud.textContent = `Oleada ${run.waveNumber}/${run.totalWaves} · ${Math.ceil(w.timeLeft)} s · vida ${w.player.hp}/${w.player.maxHp} · materiales ${run.materials} · bajas ${run.kills}`;
  const msg = game.phase === 'cleared' ? `Oleada ${run.waveNumber} superada · Enter para seguir`
    : game.phase === 'dead' ? `Has caído en la oleada ${run.waveNumber} · R para otra partida`
    : game.phase === 'victory' ? '¡Hecho y verificado! · R para otra partida' : '';
  if (banner.textContent !== msg) banner.textContent = msg;
  banner.style.display = msg ? 'block' : 'none';
  const cpu = compositor.kind === 'cpu';
  lowDetail.textContent = q.get('ruta') === 'cpu' ? 'Modo de bajo detalle (forzado con ?ruta=cpu)' : 'Sin aceleración gráfica: modo de bajo detalle';
  lowDetail.style.display = cpu ? 'block' : 'none';
}

let last = performance.now();
function loop(now: number): void {
  const dt = (now - last) / 1000;
  last = now;
  ticks?.advance(dt);
  frame(now / 1000);
  if (game && baked) for (const job of rebakeChangedJobs(baked, game.state.lights)) budget.push(job);
  budget.run();
  showHud();
  next(loop);
}
// En navegadores sin ventana (capturas) requestAnimationFrame no avanza: ?timer=1 usa temporizadores
const next = q.has('timer') ? (f: (t: number) => void) => setTimeout(() => f(performance.now()), 16) : requestAnimationFrame;

addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (k === 'enter') game?.nextWave();
  if (k === 'r' && game && (game.phase === 'dead' || game.phase === 'victory')) { seed = (seed * 7919 + 13) % 1000003; newRun(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

newRun();
next(loop);
