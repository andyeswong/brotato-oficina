// El aspecto de la ciudad de neón (NARUTO, 2026-11-04; segunda vuelta con el juicio de MAIA): sus piezas de suelo y
// de fachada y lo que se pone en el mundo. Antes usaba las piezas de muestra de VoxPix, que no dibujan las losetas ni
// las piezas propias del cyberpunk. Lo que la hace rica, como el medieval: luz rosa y cian que cae sobre el asfalto
// (rótulos, máquinas, farolas), una pieza central (el cruce de calles con un holograma grande sobre la tienda), cosas
// agrupadas y un suelo tranquilo. Como en la oficina (levels/oficina/look.ts), nada de esto cambia la partida:
// - el suelo es una sola capa (z = 0); solo cambia el color de cada losa (también al pintar la calzada);
// - la fachada se pinta EN la cara de la pared o en huecos tallados; los rótulos de neón siguen siendo los de muestra;
// - lo de encima es 'atravesable' y nunca pisa un vóxel que ya estaba; lo alto va contra la pared, lo del centro es
//   bajo (conos, bolsas) y los hologramas flotan por encima de las cabezas.
import { material, type Ramp } from '@voxpix/core';
import { M, worldNoise, type FacadeBuilder, type FloorBuilder, type World } from '@voxpix/world/build';
import { sampleFacade, sampleFloor } from '@voxpix/samples/pieces';
import { NORTH, TILE, type Layout } from '@voxpix/worldgen';
import { roundPuddles } from '../charcos';

// Rampas propias, detrás de las del motor (M va de 0 a 14)
const EXTRA: Array<Ramp & { key: string }> = [
  { key: 'acera', name: 'acera', colors: ['#1c1e2c', '#282c3e', '#363c52', '#4a526c', '#626c8a'] },
  { key: 'pintura', name: 'pintura vial', colors: ['#4a3a10', '#8a6c1a', '#c8a02a', '#f0d050'] },
  { key: 'neonAmarillo', name: 'neón amarillo', colors: ['#5a4010', '#a07a18', '#e0b428', '#ffe070', '#fff6c8'], emissive: true },
  { key: 'neonVerde', name: 'neón verde', colors: ['#0c4020', '#1a7a3a', '#2ec060', '#86f8a8', '#d8ffe4'], emissive: true },
  { key: 'oxido', name: 'óxido', colors: ['#2a140e', '#4a2416', '#6e3a20', '#94542c'] },
  { key: 'blancoVial', name: 'pintura blanca', colors: ['#6a6e80', '#9ca2b4', '#c8ccd8', '#e8eaf0'] },
  // Encima
  { key: 'bolsa', name: 'bolsa de basura', colors: ['#0c0c12', '#16161e', '#22222e', '#34344a'], material: 'atravesable' },
  { key: 'contenedor', name: 'contenedor', colors: ['#0e2218', '#183a28', '#24543a', '#347050'], material: 'atravesable' },
  { key: 'cono', name: 'cono', colors: ['#c04810', '#ff6a1a', '#ff8a30', '#ffb060', '#ffffff'], material: 'atravesable' },
  { key: 'chapa', name: 'chapa', colors: ['#16182a', '#24283e', '#363c58', '#4c5476', '#6a7498'], material: 'atravesable' },
  { key: 'holo', name: 'holograma', colors: ['#0e3a4a', '#1a7088', '#28b4d0', '#7fe3ff', '#d0f8ff'], material: 'atravesable', emissive: true },
  { key: 'holoRosa', name: 'holograma rosa', colors: ['#5a1640', '#a02a78', '#e04cb4', '#ff8ad8', '#ffd0f0'], material: 'atravesable', emissive: true },
  { key: 'expendedora', name: 'pantalla expendedora', colors: ['#3a1030', '#8a2068', '#e04cb4', '#ffa0e0'], material: 'atravesable', emissive: true },
  { key: 'tubo', name: 'tubería', colors: ['#1a1a22', '#2c2e3a', '#444858', '#626878', '#8a92a4'], material: 'atravesable' },
  { key: 'farol', name: 'luz de farola', colors: ['#3a5a6a', '#7aa8c0', '#c8ecff', '#ffffff'], material: 'atravesable', emissive: true },
];
const R = Object.fromEntries(EXTRA.map((r, k) => [r.key, 15 + k])) as Record<string, number>;
export const CYBERPUNK_RAMPS: Ramp[] = EXTRA.map(({ key: _k, ...r }) => r);
const mat = (ramp: number, tone: number) => material(ramp, Math.max(0, tone));
const rampOf = (v: number) => Math.floor((v - 1) / 16);

// ---- suelo: aceras de losas grandes, de 32, con la junta solo un tono más oscura (MAIA: la losa pequeña con la junta
// oscura se veía como una pared de ladrillo), y las rejillas de muestra. El motor pinta su junta de 16; decorateCyberpunk
// repinta las aceras con slab y luego la calzada, porque sabe dónde va el cruce. Sin las franjas de neón del suelo
// (MAIA: parecían un fallo)
export const cyberpunkFloor: FloorBuilder = (site) => (site.kind.includes('rejilla') ? sampleFloor(site) : mat(R.acera!, 2));
const slab = (x: number, y: number, D: number) => mat(R.acera!, (x & 31) === 0 || ((D - 1 - y) & 31) <= 1 ? 1 : 2);

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
      // Un rótulo de neón con letras inventadas (columnas de un glifo de 5); su luz la pone decorateCyberpunk
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

// ---- lo que se pone en el mundo
function rng(seed: number): () => number {
  let s = (seed ^ 0x2f6b9a31) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CyberpunkDecor {
  secos: number; calzada: number; alcantarillas: number; contenedores: number; bolsas: number; expendedoras: number; conos: number;
  hologramas: number; farolas: number; rotulos: number; tuberias: number;
}

// Las alcantarillas del piso (los centros, en ejes del modelo): de ellas puede salir vapor (capa de efectos, FERN)
export const MANHOLES = new WeakMap<World, Array<{ x: number; y: number }>>();

export function decorateCyberpunk(world: World, seed: number, layout: Layout, at: { shop: { x: number; y: number } | null }): CyberpunkDecor {
  const m = world.model, W = world.width, D = world.depth;
  const r = rng(seed);
  const put = (x: number, y: number, z: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < D && !m.get(x, y, z)) m.set(x, y, z, v); };
  // El color de una losa del suelo seco (la acera o la junta del motor); nada más se repinta
  const repaint = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= D || world.wet[y * W + x]) return false;
    const old = m.get(x, y, 0);
    if (!old || (rampOf(old) !== R.acera && rampOf(old) !== M.floor)) return false;
    m.set(x, y, 0, v);
    return true;
  };
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
  const out: CyberpunkDecor = { secos: 0, calzada: 0, alcantarillas: 0, contenedores: 0, bolsas: 0, expendedoras: 0, conos: 0, hologramas: 0, farolas: 0, rotulos: 0, tuberias: 0 };
  const shop = at.shop ?? { x: W / 2, y: D / 2 };
  const sx = Math.round(shop.x), sy = Math.round(shop.y);
  const manholes: Array<{ x: number; y: number }> = [];
  MANHOLES.set(world, manholes);

  // Las aceras, en losas de 32 (slab), encima de la junta de 16 del motor; las rejillas se quedan
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const v = m.get(x, y, 0);
    if (v && (rampOf(v) === M.floor || rampOf(v) === R.acera) && !world.wet[y * W + x]) m.set(x, y, 0, slab(x, y, D));
  }
  // Los charcos tóxicos, en manchas redondas (charcos.ts); lo que se seca, acera (la calzada se pinta encima después)
  out.secos = roundPuddles(world, seed, (x, y) => slab(x, y, D));

  // ---- la calzada: dos calles que se cruzan en la tienda (una de este a oeste y otra de norte a sur), de asfalto
  // liso con grietas y parches, la línea discontinua en medio, pasos de cebra al llegar al cruce y el bordillo claro
  const HALF = 36, CURB = 2;
  const inRoad = (x: number, y: number) => Math.abs(y - sy) <= HALF || Math.abs(x - sx) <= HALF;
  const cross = (x: number, y: number) => Math.abs(y - sy) <= HALF && Math.abs(x - sx) <= HALF;
  // Los parches: rectángulos de asfalto nuevo (un tono más oscuro), sueltos por la calzada
  const patches: Array<[number, number, number, number]> = [];
  for (let k = 0; k < 10; k++) {
    const w = 8 + Math.floor(r() * 14), h = 5 + Math.floor(r() * 8), x = Math.floor(r() * (W - w)), y = Math.floor(r() * (D - h));
    patches.push([x, y, x + w - 1, y + h - 1]);
  }
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    if (!inRoad(x, y)) continue;
    const dEdge = Math.min(Math.abs(y - sy) <= HALF ? HALF - Math.abs(y - sy) : Infinity, Math.abs(x - sx) <= HALF ? HALF - Math.abs(x - sx) : Infinity);
    let v: number;
    const n = worldNoise(x, y, 5, seed);
    if (dEdge < CURB && !cross(x, y)) v = mat(R.acera!, 4);                                       // el bordillo
    else {
      let tone = 2 + (n > 0.97 ? 1 : 0);
      if (patches.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) tone = 1;
      // Grietas finas: donde un ruido suave cruza su mitad
      const g = worldNoise(x >> 3, y >> 3, 6, seed), g2 = worldNoise((x >> 3) + 1, y >> 3, 6, seed);
      if (Math.abs((g + (g2 - g) * ((x & 7) / 8)) - 0.5) < 0.012 && n > 0.3) tone = 0;
      v = mat(M.floor, tone);
      // La línea discontinua de cada calle, fuera del cruce
      const alongX = Math.abs(y - sy) <= HALF && !cross(x, y), alongY = Math.abs(x - sx) <= HALF && !cross(x, y);
      if (alongX && (y === sy || y === sy + 1) && ((x >> 3) & 1) === 0) v = mat(R.pintura!, 3);
      if (alongY && (x === sx || x === sx + 1) && ((y >> 3) & 1) === 0) v = mat(R.pintura!, 3);
      // Los pasos de cebra: franjas blancas de 3 a la entrada del cruce
      const zebraX = Math.abs(x - sx) > HALF - 1 && Math.abs(x - sx) <= HALF + 10 && Math.abs(y - sy) < HALF - 3;
      const zebraY = Math.abs(y - sy) > HALF - 1 && Math.abs(y - sy) <= HALF + 10 && Math.abs(x - sx) < HALF - 3;
      if ((zebraX && ((y - sy + 64) % 6) < 3) || (zebraY && ((x - sx + 64) % 6) < 3)) v = mat(R.blancoVial!, 2 + (n > 0.9 ? 1 : 0));
    }
    if (repaint(x, y, v)) out.calzada++;
  }
  // Alcantarillas por la calzada, fuera del cruce: la tapa redonda de metal
  for (let k = 0, t = 0; k < 3 && t < 200; t++) {
    const x = 12 + Math.floor(r() * (W - 24)), y = 12 + Math.floor(r() * (D - 24));
    if (!inRoad(x, y) || cross(x, y) || Math.abs(x - sx) < 8 || Math.abs(y - sy) < 8 || !clear(x - 5, y - 5, x + 5, y + 5, 3)) continue;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < 4.6) repaint(x + dx, y + dy, mat(M.metal, d > 3.6 ? 1 : (dx + dy) % 2 === 0 ? 2 : 3));
    }
    manholes.push({ x: x + 0.5, y: y + 0.5 });
    claim(x - 5, y - 5, x + 5, y + 5, 0);
    out.alcantarillas++;
    k++;
  }

  // ---- la pieza central: un holograma grande sobre la tienda, por encima de las cabezas (z 22 a 38): dos anillos
  // inclinados y un rombo en medio, cian y rosa, con su luz
  {
    const cx = sx, cy = sy + 4, cz = 30;
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      put(Math.round(cx + Math.cos(t) * 10), Math.round(cy + Math.sin(t) * 3), Math.round(cz + Math.sin(t) * 6), mat(R.holo!, a % 4 === 0 ? 4 : 3));
      put(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 2), Math.round(cz - Math.sin(t) * 5), mat(R.holoRosa!, a % 4 === 0 ? 4 : 2));
    }
    for (let a = -5; a <= 5; a++) for (let b = -5; b <= 5; b++) if (Math.abs(a) + Math.abs(b) === 5 || (Math.abs(a) + Math.abs(b) <= 1)) put(cx + a, cy, cz + b, mat(R.holo!, Math.abs(a) + Math.abs(b) <= 1 ? 4 : 3));
    for (let z = 22; z <= 24; z++) put(cx, cy, z, mat(R.holo!, 2));
    world.lights.push({ id: 'holo-centro', kind: 'neon-cyan', x: cx + 0.5, y: cy + 0.5, z: 24, intensity: 1.1, radius: 120 });
    world.lights.push({ id: 'holo-centro-rosa', kind: 'neon-pink', x: cx + 0.5, y: cy - 6.5, z: 20, intensity: 0.7, radius: 80 });
    out.hologramas++;
  }

  // ---- contra la pared: contenedores con bolsas, máquinas expendedoras con su luz y farolas
  const blob = (cx: number, cy: number, z0: number, rx: number, ry: number, rz: number, ramp: number) => {
    for (let z = z0; z <= z0 + 2 * rz; z++) for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx / rx) ** 2 + (dy / ry) ** 2 + ((z - z0 - rz) / rz) ** 2 > 1) continue;
      put(cx + dx, cy + dy, z, mat(ramp, Math.min(3, 1 + (z - z0 > rz ? 1 : 0) + (dx < 0 && dy < 0 ? 1 : 0))));
    }
  };
  const bags = (x: number, y: number) => {
    blob(x + 2, y + 2, 1, 2.4, 2.2, 2, R.bolsa!);
    blob(x + 5, y + 3, 1, 2, 2, 1.6, R.bolsa!);
    if (r() < 0.5) blob(x + 3, y + 3, 4, 1.8, 1.6, 1.5, R.bolsa!);
    out.bolsas++;
  };
  const nDump = 2 + Math.floor(r() * 2);
  for (let k = 0; k < nDump; k++) {
    const s = spotAgainstWall(16, 8, 12);
    if (!s) break;
    const [x, y] = s;
    for (let z = 1; z <= 8; z++) for (let dy = 0; dy < 7; dy++) for (let dx = 0; dx < 12; dx++) {
      const shell = dx === 0 || dx === 11 || dy === 0 || dy === 6 || z === 1;
      if (shell) put(x + dx, y + dy, z, mat(R.contenedor!, z === 8 ? 3 : dx === 0 || dy === 0 ? 1 : 2));
      else if (z >= 6) put(x + dx, y + dy, z, mat(R.bolsa!, 1 + ((dx + dy) & 1)));
    }
    for (let dx = 0; dx < 12; dx++) for (let dy = 3; dy < 7; dy++) put(x + dx, y + dy, 9 + (dy - 3), mat(R.contenedor!, 3));   // la tapa
    for (const dx of [2, 9]) m.set(x + dx, y, 4, mat(R.cono!, 4));                           // las pegatinas de aviso
    bags(x + 11, y);
    claim(x, y, x + 15, y + 7, 2);
    out.contenedores++;
  }
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
    world.lights.push({ id: `expendedora-${k}`, kind: 'neon-pink', x: fx + 0.5, y: fy + 0.5, z: 9, intensity: 0.9, radius: 70 });
    claim(x, y, x + 7, y + 5, 2);
    out.expendedoras++;
  }
  // Farolas: un mástil contra la pared con el brazo hacia fuera y la luz que cae en un charco sobre la acera
  for (let k = 0; k < 4; k++) {
    const s = spotAgainstWall(3, 3, 26);
    if (!s) break;
    const [x, y, side] = s, px = x + 1, py = y + 1;
    const ox = side === 2 ? 1 : side === 3 ? -1 : 0, oy = side === 0 ? 1 : side === 1 ? -1 : 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(px + dx, py + dy, 1, mat(R.chapa!, 1));
    for (let z = 2; z <= 24; z++) put(px, py, z, mat(R.chapa!, z % 6 === 0 ? 4 : 3));
    for (let d = 1; d <= 4; d++) put(px + ox * d, py + oy * d, 24, mat(R.chapa!, 3));
    const hx = px + ox * 5, hy = py + oy * 5;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { put(hx + dx, hy + dy, 24, mat(R.chapa!, 2)); put(hx + dx, hy + dy, 23, mat(R.farol!, dx === 0 && dy === 0 ? 3 : 2)); }
    world.lights.push({ id: `farola-${k}`, kind: 'lantern', x: hx + 0.5, y: hy + 0.5, z: 22, color: k % 2 ? [0.55, 0.9, 1] : [1, 0.6, 0.9], intensity: 0.9, radius: 96 });
    claim(x, y, x + 2, y + 2, 4);
    out.farolas++;
  }
  // La luz de los rótulos de neón de la pared lisa (cyberpunkFacade): uno por tramo de 16 con letras encendidas
  const faceY = D - NORTH * TILE;
  for (let cx = 1; cx < layout.cols - 1; cx++) {
    if (!(layout.facade[cx] ?? '').includes('liso')) continue;
    let pink = 0, cyan = 0, yellow = 0, zs = 0, n = 0;
    for (let lx = 0; lx < 16; lx++) for (let zz = 4; zz < 16; zz++) {
      const v = m.get(cx * TILE + lx, faceY, zz);
      if (!v) continue;
      const rp = rampOf(v), tone = (v - 1) % 16;
      if (tone < 3) continue;   // los carteles rotos y la pintada llevan neón apagado (tonos bajos): no son un rótulo
      if (rp === M.neonPink) pink++; else if (rp === M.neonCyan) cyan++; else if (rp === R.neonAmarillo) yellow++; else continue;
      zs += zz; n++;
    }
    if (n < 6) continue;
    const color: [number, number, number] = yellow >= pink && yellow >= cyan ? [1, 0.85, 0.35] : cyan > pink ? [0.21, 0.95, 1] : [1, 0.31, 0.85];
    world.lights.push({ id: `rotulo-${cx}`, kind: cyan > pink ? 'neon-cyan' : 'neon-pink', x: cx * TILE + 8.5, y: faceY - 4, z: zs / n, color, intensity: 0.9, radius: 70 });
    out.rotulos++;
  }

  // ---- por la calle: obras con conos alrededor de alguna alcantarilla, y montones de bolsas sueltos en la acera
  const cone = (x: number, y: number) => {
    if (!clear(x - 2, y - 2, x + 2, y + 2, 8)) return false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(x + dx, y + dy, 1, mat(R.cono!, 0));
    for (let z = 2; z <= 7; z++) {
      const rr = z <= 3 ? 1 : 0;
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) put(x + dx, y + dy, z, mat(R.cono!, z === 4 || z === 5 ? 4 : dx < 0 || dy < 0 ? 2 : 1));
    }
    claim(x - 2, y - 2, x + 2, y + 2);
    out.conos++;
    return true;
  };
  for (const h of manholes.slice(0, 2)) for (let a = 0; a < 4; a++) {
    const t = (a / 4) * Math.PI * 2 + 0.6;
    cone(Math.round(h.x + Math.cos(t) * 9), Math.round(h.y + Math.sin(t) * 9));
  }
  for (let k = 0; k < 3; k++) for (let t = 0; t < 80; t++) {
    const x = 12 + Math.floor(r() * (W - 24)), y = 12 + Math.floor(r() * (D - 24));
    if (inRoad(x, y) || !clear(x, y, x + 7, y + 5, 6)) continue;
    bags(x, y); claim(x, y, x + 7, y + 5, 2);
    break;
  }
  // Tuberías tumbadas al pie de la pared: tramos largos de 2 de grueso con abrazaderas
  const nPipes = 3 + Math.floor(r() * 3);
  for (let k = 0; k < nPipes; k++) {
    const len = 24 + Math.floor(r() * 30), alongX = r() < 0.5;
    const s = spotAgainstWall(alongX ? len : 3, alongX ? 3 : len, 4);
    if (!s) continue;
    const [x, y] = s;
    for (let i = 0; i < len; i++) for (const [a, b] of [[0, 1], [1, 1], [0, 2], [1, 2]] as const) {
      const [px, py] = alongX ? [x + i, y + a] : [x + a, y + i];
      put(px, py, b, mat(R.tubo!, i % 10 === 4 ? 0 : b === 2 ? 3 : 2));
    }
    claim(x, y, alongX ? x + len - 1 : x + 2, alongX ? y + 2 : y + len - 1);
    out.tuberias++;
  }
  return out;
}

export const withCyberpunkRamps = (p: { ramps: Ramp[] }) => ({ ...p, ramps: [...p.ramps, ...CYBERPUNK_RAMPS.map((r) => ({ ...r, colors: [...r.colors] }))] });
