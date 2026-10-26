// El árbol de mejoras entre partidas (Andrés, 2026-10-26: "tiene que ser roguelite"). Al acabar cada partida se ganan
// fichas; con ellas se compran mejoras permanentes que valen para las partidas siguientes. Aquí solo hay datos y
// funciones puras: la partida recibe los niveles comprados como una entrada más (Run, opción meta), así que la
// simulación y su huella no saben nada del guardado (meta/store.ts) ni de la pantalla (ui/meta.ts).
import type { Modifier } from '../registry/schemas';

export interface Upgrade {
  readonly id: string;
  readonly name: string;
  readonly description: string;     // lo que da cada nivel
  readonly costs: readonly number[];   // fichas de cada nivel: tantos niveles como costes
  readonly requires?: string;       // la mejora de la que cuelga (con nivel 1 o más)
  readonly modifiers?: readonly Modifier[];   // lo que suma cada nivel (se multiplica por el nivel)
  readonly startMaterials?: number;   // materiales de más al empezar, por nivel
}

// Las ramas: vida en la raíz; de ella, ataque (afilado), movimiento (zapatillas) y defensa (chaleco)
export const UPGRADES: readonly Upgrade[] = [
  { id: 'vida', name: 'Constitución', description: '+2 de vida máxima', costs: [4, 8, 14], modifiers: [{ stat: 'max-hp', add: 2 }] },
  { id: 'afilado', name: 'Afilado', description: '+4 % de daño', costs: [6, 12, 20], requires: 'vida', modifiers: [{ stat: 'damage-pct', add: 4 }] },
  { id: 'zapatillas', name: 'Zapatillas', description: '+3 % de velocidad', costs: [6, 12, 20], requires: 'vida', modifiers: [{ stat: 'speed-pct', add: 3 }] },
  { id: 'chaleco', name: 'Chaleco', description: '+1 de armadura', costs: [8, 16], requires: 'vida', modifiers: [{ stat: 'armor', add: 1 }] },
  { id: 'reflejos', name: 'Reflejos', description: '+4 % de cadencia', costs: [10, 18, 28], requires: 'afilado', modifiers: [{ stat: 'attack-speed-pct', add: 4 }] },
  { id: 'ojo', name: 'Ojo fino', description: '+3 % de crítico', costs: [12, 22], requires: 'afilado', modifiers: [{ stat: 'crit-chance-pct', add: 3 }] },
  { id: 'iman', name: 'Imán', description: '+16 de recolección', costs: [8, 16], requires: 'zapatillas', modifiers: [{ stat: 'pickup-range', add: 16 }] },
  { id: 'esquiva', name: 'Juego de pies', description: '+3 % de esquiva', costs: [12, 22], requires: 'zapatillas', modifiers: [{ stat: 'dodge-pct', add: 3 }] },
  { id: 'cafe', name: 'Café de casa', description: '+1 de regeneración', costs: [12, 22], requires: 'chaleco', modifiers: [{ stat: 'hp-regen', add: 1 }] },
  { id: 'ahorros', name: 'Ahorros', description: '+6 materiales al empezar', costs: [10, 18, 28], requires: 'iman', startMaterials: 6 },
];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

// Lo que se guarda entre partidas: las fichas sin gastar y el nivel de cada mejora
export interface Progress {
  fichas: number;
  levels: Record<string, number>;
}

export function emptyProgress(): Progress {
  return { fichas: 0, levels: {} };
}

export function levelOf(p: Progress, id: string): number {
  return p.levels[id] ?? 0;
}

// Lo que cuesta el siguiente nivel, o null si ya está al máximo
export function nextCost(p: Progress, id: string): number | null {
  return BY_ID.get(id)?.costs[levelOf(p, id)] ?? null;
}

// ¿Se ve (y se puede comprar algún día)? Las raíces siempre; las demás, con su mejora de arriba comprada
export function unlocked(p: Progress, id: string): boolean {
  const u = BY_ID.get(id);
  return !!u && (!u.requires || levelOf(p, u.requires) > 0);
}

export type BuyResult = { ok: true } | { ok: false; reason: string };

export function buyUpgrade(p: Progress, id: string): BuyResult {
  const u = BY_ID.get(id);
  if (!u) return { ok: false, reason: 'No existe esa mejora' };
  if (!unlocked(p, id)) return { ok: false, reason: `Antes, ${BY_ID.get(u.requires!)!.name}` };
  const cost = nextCost(p, id);
  if (cost === null) return { ok: false, reason: 'Ya está al máximo' };
  if (p.fichas < cost) return { ok: false, reason: `Te faltan ${cost - p.fichas} fichas` };
  p.fichas -= cost;
  p.levels[id] = levelOf(p, id) + 1;
  return { ok: true };
}

// Lo que la partida aplica: cada modificador por su nivel, y los materiales de más
export function metaModifiers(levels: Readonly<Record<string, number>>): Modifier[] {
  const out: Modifier[] = [];
  for (const u of UPGRADES) {
    const n = Math.min(levels[u.id] ?? 0, u.costs.length);
    if (n <= 0) continue;
    for (const m of u.modifiers ?? []) out.push({ ...m, ...(m.add !== undefined ? { add: m.add * n } : {}), ...(m.pct !== undefined ? { pct: m.pct * n } : {}) });
  }
  return out;
}

export function metaStartMaterials(levels: Readonly<Record<string, number>>): number {
  return UPGRADES.reduce((sum, u) => sum + (u.startMaterials ?? 0) * Math.min(levels[u.id] ?? 0, u.costs.length), 0);
}

// Las fichas que da una partida acabada: 2 por oleada superada, 1 por cada 20 bajas y 10 más si se gana
export function fichasEarned(wavesCleared: number, kills: number, victory: boolean): number {
  return 2 * wavesCleared + Math.floor(kills / 20) + (victory ? 10 : 0);
}

// Lo leído del almacenamiento, sea lo que sea: lo que no encaja se descarta (niveles fuera de rango, ids que ya no
// existen, números que no son números)
export function parseProgress(raw: unknown): Progress {
  const p = emptyProgress();
  if (!raw || typeof raw !== 'object') return p;
  const r = raw as { fichas?: unknown; levels?: unknown };
  if (typeof r.fichas === 'number' && Number.isFinite(r.fichas) && r.fichas > 0) p.fichas = Math.floor(r.fichas);
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, v] of Object.entries(r.levels as Record<string, unknown>)) {
      const u = BY_ID.get(id);
      if (u && typeof v === 'number' && Number.isInteger(v) && v > 0) p.levels[id] = Math.min(v, u.costs.length);
    }
  }
  return p;
}
