// El aspecto de la ciudad de neón (NARUTO, 2026-11-04): sus piezas de suelo y de fachada y lo que se pone por el suelo.
// Antes usaba las de muestra de VoxPix, que no dibujan las losetas ni las piezas propias del cyberpunk (raspones,
// rejillas, tuberías): salían lisas. Como en la oficina (levels/oficina/look.ts), nada de esto cambia la partida:
// - el suelo es una sola capa (z = 0); solo cambia el color de cada losa;
// - la fachada se pinta EN la cara de la pared o en huecos tallados; los rótulos de neón siguen siendo los de muestra;
// - lo que se pone por el suelo (decorateCyberpunk) es del material 'atravesable': no para a nadie ni un disparo.
import { material, type Ramp } from '@voxpix/core';
import { M, worldNoise, type FacadeBuilder, type FloorBuilder, type World } from '@voxpix/world/build';
import { sampleFacade, sampleFloor } from '@voxpix/samples/pieces';
import { TILE } from '@voxpix/worldgen';

// Rampas propias, detrás de las del motor (M va de 0 a 14)
const EXTRA: Array<Ramp & { key: string }> = [
  { key: 'acera', name: 'acera', colors: ['#1a1c2a', '#262a3c', '#343a50', '#464e68', '#5c6684'] },
  { key: 'pintura', name: 'pintura vial', colors: ['#4a3a10', '#8a6c1a', '#c8a02a', '#f0d050'] },
  { key: 'neonAmarillo', name: 'neón amarillo', colors: ['#5a4010', '#a07a18', '#e0b428', '#ffe070', '#fff6c8'], emissive: true },
  { key: 'neonVerde', name: 'neón verde', colors: ['#0c4020', '#1a7a3a', '#2ec060', '#86f8a8', '#d8ffe4'], emissive: true },
  { key: 'oxido', name: 'óxido', colors: ['#2a140e', '#4a2416', '#6e3a20', '#94542c'] },
  // Por el suelo
  { key: 'bolsa', name: 'bolsa de basura', colors: ['#0c0c12', '#16161e', '#22222e', '#34344a'], material: 'atravesable' },
  { key: 'contenedor', name: 'contenedor', colors: ['#0e2218', '#183a28', '#24543a', '#347050'], material: 'atravesable' },
  { key: 'cono', name: 'cono', colors: ['#5a1e08', '#a03a0c', '#e0601a', '#ff9a4a', '#f4f0f0'], material: 'atravesable' },
  { key: 'chapa', name: 'chapa', colors: ['#16182a', '#24283e', '#363c58', '#4c5476', '#6a7498'], material: 'atravesable' },
  { key: 'holo', name: 'holograma', colors: ['#0e3a4a', '#1a7088', '#28b4d0', '#7fe3ff', '#d0f8ff'], material: 'atravesable', emissive: true },
  { key: 'holoRosa', name: 'holograma rosa', colors: ['#5a1640', '#a02a78', '#e04cb4', '#ff8ad8', '#ffd0f0'], material: 'atravesable', emissive: true },
  { key: 'expendedora', name: 'pantalla expendedora', colors: ['#3a1030', '#8a2068', '#e04cb4', '#ffa0e0'], material: 'atravesable', emissive: true },
  { key: 'tubo', name: 'tubería', colors: ['#1a1a22', '#2c2e3a', '#444858', '#626878', '#8a92a4'], material: 'atravesable' },
];
const R = Object.fromEntries(EXTRA.map((r, k) => [r.key, 15 + k])) as Record<string, number>;
export const CYBERPUNK_RAMPS: Ramp[] = EXTRA.map(({ key: _k, ...r }) => r);
const mat = (ramp: number, tone: number) => material(ramp, Math.max(0, tone));

// ---- suelo: calzada de asfalto con su pintura y aceras de losas. La zona sale de un ruido suave por loseta
function smooth(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const n = (a: number, b: number) => worldNoise(a, b, 93, seed);
  const top = n(ix, iy) + (n(ix + 1, iy) - n(ix, iy)) * s(tx), bot = n(ix, iy + 1) + (n(ix + 1, iy + 1) - n(ix, iy + 1)) * s(tx);
  return top + (bot - top) * s(ty);
}
const sidewalk = (cx: number, cy: number, seed: number) => smooth(cx, cy, seed, 5) > 0.56;

export const cyberpunkFloor: FloorBuilder = (site) => {
  const { kind, cx, cy, lx, ly, px, noise: n, seed } = site;
  let tone = site.tone;
  if (kind.includes('neon') || kind.includes('rejilla')) return sampleFloor(site);
  const walk = sidewalk(cx, cy, seed);
  if (walk) {
    // Losas de acera de 8, con el bordillo claro donde empieza la calzada
    if ((lx === 1 && !sidewalk(cx - 1, cy, seed)) || (lx === TILE - 1 && !sidewalk(cx + 1, cy, seed))
      || (ly === 2 && !sidewalk(cx, cy - 1, seed)) || (ly === TILE - 1 && !sidewalk(cx, cy + 1, seed))) return mat(R.acera!, 4);
    if (lx === 8 || ly === 9) tone -= 1;
  } else {
    // Asfalto: la línea discontinua cada cinco filas de losetas, y alguna tapa de alcantarilla
    if (cy % 5 === 2 && (ly === 8 || ly === 9) && ((px >> 3) & 1) === 0) return mat(R.pintura!, ly === 8 ? 3 : 2);
    if (worldNoise(cx, cy, 31, seed) > 0.95) {
      const d = Math.hypot(lx - 8, ly - 8.5);
      if (d < 4.6) return mat(M.metal, d > 3.6 ? 1 : (Math.floor(lx) + Math.floor(ly)) % 2 === 0 ? 2 : 3);
    }
  }
  if (kind.includes('gastado') && worldNoise(cx * 4 + (lx >> 2), cy * 4 + (ly >> 2), 7, seed) > 0.6) tone += walk ? 1 : -1;
  if (kind.includes('raspon')) {
    // Frenazos: dos rodadas oscuras y paralelas que cruzan la loseta en diagonal
    const a = lx + ly * (worldNoise(cx, cy, 8, seed) > 0.5 ? 1 : -1) + 32;
    if (a % 16 === 3 || a % 16 === 7) tone -= 1;
  }
  if (!walk && n > 0.96) tone += 1;                                               // la grava del asfalto
  return mat(walk ? R.acera! : M.floor, Math.min(4, tone));
};

// ---- fachada: todo en la cara de la pared o en huecos tallados. Los rótulos de neón y las ventanas, los de muestra
const z16 = (height: number) => (z: number) => Math.max(1, Math.min(height - 2, Math.round((z * height) / 16)));
const GLYPHS = [0b10111, 0b11101, 0b01110, 0b11011, 0b10101, 0b11111, 0b01011, 0b11010];

export const cyberpunkFacade: FacadeBuilder = (site) => {
  const { model, piece, cx, x0, faceY, height, seed, carve } = site;
  const z = z16(height);
  const face = (lx: number, zz: number, v: number) => model.set(x0 + lx, faceY, zz, v);
  const nz = (a: number, b: number) => worldNoise(cx * 16 + a, b, 23, seed);
  // Abajo, una franja de chapa sucia con óxido en todas
  for (let lx = 0; lx < 16; lx++) for (let zz = 0; zz <= 2; zz++) face(lx, zz, nz(lx, zz) > 0.8 ? mat(R.oxido!, 1 + (zz & 1)) : mat(M.wall, zz === 2 ? 3 : 0));
  if (piece.includes('puerta')) {
    // Cierre metálico de rejilla, con las franjas de aviso encima y un neón verde de salida
    carve(3, 12, 1, z(11), (lx, zz) => mat(M.metal, zz % 2 === 0 ? 1 : 2 + (lx === 3 || lx === 12 ? -1 : 0)));
    for (let lx = 3; lx <= 12; lx++) face(lx, z(12), ((lx >> 1) & 1) ? mat(R.pintura!, 3) : mat(M.wall, 0));
    for (let lx = 6; lx <= 9; lx++) face(lx, z(14), mat(R.neonVerde!, lx === 6 || lx === 9 ? 2 : 3));
  } else if (piece.includes('rejilla')) {
    // Rejilla de ventilación grande, con lamas y el marco
    carve(2, 13, z(3), z(10), (lx, zz) => (lx === 2 || lx === 13 || zz === z(3) || zz === z(10) ? mat(M.metal, 3) : zz % 2 === 0 ? mat(M.metal, 2) : mat(M.darkGlass, 0)));
  } else if (piece.includes('tuberia')) {
    // Tuberías: dos bajantes y un tramo horizontal con su llave, en un canal tallado en la pared
    carve(3, 4, 3, z(14), () => mat(M.wall, 0));
    carve(10, 11, 3, z(14), () => mat(M.wall, 0));
    for (let zz = 3; zz <= z(14); zz++) { face(3, zz, mat(M.metal, 3)); face(4, zz, mat(M.metal, 2)); face(10, zz, mat(R.oxido!, 2)); face(11, zz, mat(R.oxido!, 1)); }
    for (let lx = 3; lx <= 11; lx++) { face(lx, z(9), mat(M.metal, 3)); face(lx, z(9) - 1, mat(M.metal, 1)); }
    face(7, z(9) + 1, mat(R.neonAmarillo!, 2)); face(7, z(9) + 2, mat(M.metal, 4));
  } else if (piece.includes('liso')) {
    const r = nz(0, 60);
    if (r > 0.62) {
      // Un cartel de neón con letras inventadas (columnas de un glifo de 5)
      const ramp = r > 0.86 ? R.neonAmarillo! : r > 0.74 ? M.neonCyan : M.neonPink;
      const zl = z(6), vertical = nz(1, 61) > 0.5;
      if (vertical) {
        for (let k = 0; k < 4; k++) { const g = GLYPHS[Math.floor(nz(k, 62) * GLYPHS.length)]!; for (let b = 0; b < 5; b++) if ((g >> b) & 1) face(6 + (b % 3), zl + k * 2 + (b >> 2), mat(ramp, 3)); }
        for (let zz = zl - 1; zz <= zl + 8; zz++) { face(5, zz, mat(M.metal, 1)); face(9, zz, mat(M.metal, 1)); }
      } else {
        for (let k = 0; k < 3; k++) { const g = GLYPHS[Math.floor(nz(k, 62) * GLYPHS.length)]!; for (let b = 0; b < 5; b++) if ((g >> b) & 1) face(3 + k * 4 + (b % 3), zl + 2 + (b >> 2), mat(ramp, b === 2 ? 4 : 3)); }
        for (let lx = 2; lx <= 13; lx++) { face(lx, zl, mat(M.metal, 1)); face(lx, zl + 5, mat(M.metal, 1)); }
      }
    } else if (r > 0.4) {
      // Carteles pegados y rotos, y una pintada
      for (let k = 0; k < 2; k++) {
        const lx0 = 2 + k * 6 + Math.floor(nz(k, 63) * 2), zl = z(4) + Math.floor(nz(k, 64) * 3);
        for (let lx = lx0; lx < lx0 + 4; lx++) for (let zz = zl; zz < zl + 5; zz++) if (nz(lx, zz) > 0.12) face(lx, zz, mat(k ? M.neonCyan : R.pintura!, zz === zl + 4 ? 1 : 0));
      }
      for (let lx = 2; lx <= 13; lx++) { const zz = 3 + Math.round(1.5 + Math.sin(lx * 0.9 + r * 9) * 1.2); face(lx, zz, mat(M.neonPink, 1)); }
    }
  } else sampleFacade(site);
};

// ---- por el suelo: bolsas de basura, contenedores, conos, máquinas expendedoras, hologramas y tuberías. Atravesable
function rng(seed: number): () => number {
  let s = (seed ^ 0x2f6b9a31) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CyberpunkDecor { bolsas: number; contenedores: number; conos: number; expendedoras: number; hologramas: number; tuberias: number }

export function decorateCyberpunk(world: World, seed: number): CyberpunkDecor {
  const m = world.model, W = world.width, D = world.depth;
  const r = rng(seed);
  // Solo en el aire: nada de lo que se pone pisa la pared, una columna, un mueble ni otra cosa ya puesta
  const put = (x: number, y: number, z: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < D && !m.get(x, y, z)) m.set(x, y, z, v); };
  const used = new Uint8Array(W * D);
  const clear = (x0: number, y0: number, x1: number, y1: number, h: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= D - 1) return false;
      const i = y * W + x;
      if (used[i] || world.wet[i] || !m.get(x, y, 0)) return false;
      for (let z = 1; z <= h; z++) if (m.get(x, y, z)) return false;
    }
    return true;
  };
  const claim = (x0: number, y0: number, x1: number, y1: number, pad = 1) => {
    for (let y = y0 - pad; y <= y1 + pad; y++) for (let x = x0 - pad; x <= x1 + pad; x++) if (x >= 0 && y >= 0 && x < W && y < D) used[y * W + x] = 1;
  };
  // ¿Qué lado del rectángulo toca pared? (0 sur, 1 norte, 2 oeste, 3 este; -1 ninguno). A media altura: sin cables
  const wallSide = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) { if (m.get(x, y0 - 1, 8)) return 0; if (m.get(x, y1 + 1, 8)) return 1; }
    for (let y = y0; y <= y1; y++) { if (m.get(x0 - 1, y, 8)) return 2; if (m.get(x1 + 1, y, 8)) return 3; }
    return -1;
  };
  const spotAgainstWall = (w: number, d: number, h: number): [number, number, number] | null => {
    for (let t = 0; t < 400; t++) {
      let x = 2 + Math.floor(r() * (W - w - 4)), y = 2 + Math.floor(r() * (D - d - 4));
      if (!clear(x, y, x + w - 1, y + d - 1, h)) continue;
      const dir = Math.floor(r() * 4), dx = [1, -1, 0, 0][dir]!, dy = [0, 0, 1, -1][dir]!;
      let steps = 0;
      while (steps < 90 && clear(x + dx, y + dy, x + dx + w - 1, y + dy + d - 1, h)) { x += dx; y += dy; steps++; }
      const side = wallSide(x, y, x + w - 1, y + d - 1);
      if (steps < 90 && side >= 0) return [x, y, side];
    }
    return null;
  };
  const out: CyberpunkDecor = { bolsas: 0, contenedores: 0, conos: 0, expendedoras: 0, hologramas: 0, tuberias: 0 };
  const blob = (cx: number, cy: number, z0: number, rx: number, ry: number, rz: number, ramp: number) => {
    for (let z = z0; z <= z0 + 2 * rz; z++) for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 + ((z - z0 - rz) / rz) ** 2 > 1) continue;
      put(cx + dx, cy + dy, z, mat(ramp, Math.min(3, 1 + (z - z0 > rz ? 1 : 0) + (dx < 0 && dy < 0 ? 1 : 0))));
    }
  };

  // Contenedores de basura con la tapa abierta a medias, y bolsas al lado
  const nDump = 2 + Math.floor(r() * 2);
  for (let k = 0; k < nDump; k++) {
    const s = spotAgainstWall(14, 8, 12);
    if (!s) break;
    const [x, y] = s;
    for (let z = 1; z <= 8; z++) for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 12; dx++) {
      const shell = dx === 0 || dx === 11 || dy === 0 || dy === 6 || z === 1;
      if (shell) put(x + dx, y + dy, z, mat(R.contenedor!, z === 8 ? 3 : dx === 0 || dy === 0 ? 1 : 2));
      else if (z >= 6) put(x + dx, y + dy, z, mat(R.bolsa!, 1 + ((dx + dy) & 1)));
    }
    for (let dx = 0; dx < 12; dx++) for (let dy = 3; dy < 7; dy++) put(x + dx, y + dy, 9 + (dy - 3), mat(R.contenedor!, 3));   // la tapa
    for (const dx of [2, 9]) m.set(x + dx, y, 4, mat(R.cono!, 4));                           // las pegatinas de aviso
    blob(x + 13, y + 2, 1, 2.2, 2, 2, R.bolsa!);
    claim(x, y, x + 15, y + 7, 2);
    out.contenedores++;
  }
  // Bolsas sueltas, de dos en dos o de tres en tres, contra la pared
  const nBags = 6 + Math.floor(r() * 4);
  for (let k = 0; k < nBags; k++) {
    const s = spotAgainstWall(8, 6, 8);
    if (!s) break;
    const [x, y] = s;
    blob(x + 2, y + 2, 1, 2.4, 2.2, 2, R.bolsa!);
    blob(x + 5, y + 3, 1, 2, 2, 1.6, R.bolsa!);
    if (r() < 0.5) blob(x + 3, y + 3, 4, 1.8, 1.6, 1.5, R.bolsa!);
    claim(x, y, x + 7, y + 5);
    out.bolsas++;
  }
  // Máquinas expendedoras: el cuerpo de chapa y la pantalla que brilla (con su luz), mirando al sur si están en la
  // pared norte; si no, a un lado
  const nVend = 2 + Math.floor(r() * 2);
  for (let k = 0; k < nVend; k++) {
    const s = spotAgainstWall(8, 6, 16);
    if (!s) break;
    const [x, y, side] = s;
    for (let z = 1; z <= 15; z++) for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 8; dx++) {
      const front = side === 1 ? dy === 0 : side === 0 ? dy === 5 : side === 2 ? dx === 7 : dx === 0;
      const along = side <= 1 ? dx : dy, span = side <= 1 ? 8 : 6;
      const screen = front && z >= 6 && z <= 13 && along >= 1 && along <= span - 3;
      const slot = front && z >= 2 && z <= 3 && along >= 1 && along <= span - 2;
      put(x + dx, y + dy, z, screen ? mat(R.expendedora!, z === 13 ? 3 : (z + along) % 3 === 0 ? 1 : 2) : slot ? mat(R.bolsa!, 0) : mat(R.chapa!, z === 15 ? 4 : front ? 3 : 2));
    }
    const fx = side === 2 ? x + 9 : side === 3 ? x - 2 : x + 4, fy = side === 1 ? y - 2 : side === 0 ? y + 7 : y + 3;
    world.lights.push({ id: `expendedora-${k}`, kind: 'lantern', x: fx + 0.5, y: fy + 0.5, z: 10, color: [1, 0.35, 0.8], intensity: 0.6, radius: 40 });
    claim(x, y, x + 7, y + 5, 2);
    out.expendedoras++;
  }
  // Conos de obra, sueltos por la calle
  const nCones = 5 + Math.floor(r() * 4);
  for (let k = 0; k < nCones; k++) {
    for (let t = 0; t < 80; t++) {
      const x = 8 + Math.floor(r() * (W - 16)), y = 8 + Math.floor(r() * (D - 16));
      if (!clear(x - 2, y - 2, x + 2, y + 2, 8)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(x + dx, y + dy, 1, mat(R.cono!, 1));
      for (let z = 2; z <= 7; z++) {
        const rr = z <= 3 ? 1 : 0;
        for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) put(x + dx, y + dy, z, mat(R.cono!, z === 4 || z === 5 ? 4 : dx < 0 || dy < 0 ? 2 : 3));
      }
      claim(x - 2, y - 2, x + 2, y + 2);
      out.conos++;
      break;
    }
  }
  // Hologramas: un proyector en el suelo y encima, flotando, un rombo o un anillo que brilla
  const nHolo = 3 + Math.floor(r() * 2);
  for (let k = 0; k < nHolo; k++) {
    for (let t = 0; t < 80; t++) {
      const x = 12 + Math.floor(r() * (W - 24)), y = 12 + Math.floor(r() * (D - 24));
      if (!clear(x - 4, y - 4, x + 4, y + 4, 20)) continue;
      const ramp = r() < 0.5 ? R.holo! : R.holoRosa!;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dy, 1, mat(R.chapa!, dx === 0 && dy === 0 ? 4 : 2));
      put(x, y, 2, mat(ramp, 3));
      if (r() < 0.5) {
        // Rombo hueco de 4 de radio, de canto hacia la cámara
        for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) if (Math.abs(a) + Math.abs(b) === 4) put(x + a, y, 12 + b, mat(ramp, b > 0 ? 3 : 2));
        put(x, y, 12, mat(ramp, 4));
      } else {
        for (let k2 = 0; k2 < 24; k2++) { const a = (k2 / 24) * Math.PI * 2; put(Math.round(x + Math.cos(a) * 4), Math.round(y + Math.sin(a) * 4), 10, mat(ramp, 3)); put(Math.round(x + Math.cos(a) * 3), Math.round(y + Math.sin(a) * 3), 13, mat(ramp, 2)); }
      }
      for (let z = 4; z <= 8; z += 2) put(x, y, z, mat(ramp, 1));                               // el haz, punteado
      claim(x - 4, y - 4, x + 4, y + 4, 3);
      out.hologramas++;
      break;
    }
  }
  // Tuberías tumbadas al pie de la pared: tramos largos de 2 de grueso con abrazaderas
  const nPipes = 4 + Math.floor(r() * 3);
  for (let k = 0; k < nPipes; k++) {
    const len = 24 + Math.floor(r() * 30), alongX = r() < 0.5;
    const s = spotAgainstWall(alongX ? len : 3, alongX ? 3 : len, 4);
    if (!s) continue;
    const [x, y] = s;
    for (let i = 0; i < len; i++) for (const [a, b] of [[0, 1], [1, 1], [0, 2], [1, 2]] as const) {
      const clamp = i % 10 === 4;
      const [px, py] = alongX ? [x + i, y + a] : [x + a, y + i];
      put(px, py, b, mat(R.tubo!, clamp ? 0 : b === 2 ? 3 : 2));
    }
    claim(x, y, alongX ? x + len - 1 : x + 2, alongX ? y + 2 : y + len - 1);
    out.tuberias++;
  }
  return out;
}

export const withCyberpunkRamps = (p: { ramps: Ramp[] }) => ({ ...p, ramps: [...p.ramps, ...CYBERPUNK_RAMPS.map((r) => ({ ...r, colors: [...r.colors] }))] });
