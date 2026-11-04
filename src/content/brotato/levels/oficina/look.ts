// El aspecto de la oficina (NARUTO, 2026-11-04): sus piezas de suelo y de fachada y lo que se pone por el suelo. Antes
// usaba las de muestra de VoxPix, que no dibujan las losetas ni las piezas propias de la oficina (manchas, papeles,
// raspones, persianas, reloj, extintor): salían lisas, y la planta se veía vacía. Lo de aquí no cambia la partida:
// - el suelo es una sola capa (z = 0), como antes; solo cambia el color de cada losa;
// - la fachada se pinta EN la cara de la pared o en huecos tallados: nada sale delante de ella;
// - lo que se pone por el suelo (decorateOficina) es del material 'atravesable': no para a nadie ni un disparo.
import { material, type Ramp } from '@voxpix/core';
import { M, worldNoise, type FacadeBuilder, type FloorBuilder, type World } from '@voxpix/world/build';
import { sampleFacade } from '@voxpix/samples/pieces';
import { TILE, type Layout } from '@voxpix/worldgen';

// Rampas propias, detrás de las del motor (M va de 0 a 14). Las del suelo y la fachada son sólidas, como el suelo y
// la pared que pintan; las de lo que se pone por el suelo, atravesables
const EXTRA: Array<Ramp & { key: string }> = [
  { key: 'moqueta', name: 'moqueta', colors: ['#1c2232', '#262e44', '#303a54', '#3c4866', '#4c5a7c'] },
  { key: 'mancha', name: 'mancha de café', colors: ['#1a120c', '#281c12', '#36261a', '#4a3424'] },
  { key: 'rojo', name: 'rojo extintor', colors: ['#3a0c0e', '#6e1418', '#a82024', '#d8402e', '#f88060'] },
  { key: 'corcho', name: 'corcho', colors: ['#3a2414', '#5a3a20', '#7a5430', '#9a7044'] },
  { key: 'blanco', name: 'blanco', colors: ['#7c8090', '#a6aab6', '#cfd2da', '#eef0f4'] },
  { key: 'salida', name: 'luz de salida', colors: ['#0a3a1c', '#14783a', '#2ec062', '#9cf8b8'], emissive: true },
  { key: 'nota', name: 'nota adhesiva', colors: ['#6a5810', '#a8901c', '#e0c430', '#fff07a'] },
  { key: 'notaRosa', name: 'nota rosa', colors: ['#6a2440', '#a83a68', '#e06498', '#ffa8cc'] },
  // Por el suelo
  { key: 'papel', name: 'papel', colors: ['#7c8090', '#aeb2bc', '#d6d8de', '#f4f5f8'], material: 'atravesable' },
  { key: 'carton', name: 'cartón', colors: ['#4a3018', '#6e4a26', '#946836', '#b88a50', '#dcb27a'], material: 'atravesable' },
  { key: 'planta', name: 'planta', colors: ['#10281a', '#1a4026', '#265e32', '#3a8040', '#62a852'], material: 'atravesable' },
  { key: 'maceta', name: 'maceta', colors: ['#2a1a16', '#4e2e24', '#74442e', '#9a603c', '#bc8458'], material: 'atravesable' },
  { key: 'plastico', name: 'plástico', colors: ['#0c2440', '#163e6c', '#2460a0', '#4a8ccc', '#9cccf0'], material: 'atravesable' },
  { key: 'gris', name: 'plástico gris', colors: ['#1a1c22', '#2a2d36', '#3e424e', '#5a606e', '#80889a'], material: 'atravesable' },
  { key: 'silla', name: 'tapizado', colors: ['#16161e', '#22222e', '#30304a', '#42426a'], material: 'atravesable' },
];
const R = Object.fromEntries(EXTRA.map((r, k) => [r.key, 15 + k])) as Record<string, number>;
export const OFICINA_RAMPS: Ramp[] = EXTRA.map(({ key: _k, ...r }) => r);
const mat = (ramp: number, tone: number) => material(ramp, Math.max(0, tone));

// ---- suelo: moqueta en las zonas de trabajo y losetas de vinilo en los pasillos. La zona sale de un ruido suave por
// loseta (zonas grandes, con forma), y la moqueta lleva un perfil de metal donde acaba
function smooth(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale, fy = y / scale, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const s = (t: number) => t * t * (3 - 2 * t);
  const n = (a: number, b: number) => worldNoise(a, b, 91, seed);
  const top = n(ix, iy) + (n(ix + 1, iy) - n(ix, iy)) * s(tx), bot = n(ix, iy + 1) + (n(ix + 1, iy + 1) - n(ix, iy + 1)) * s(tx);
  return top + (bot - top) * s(ty);
}
const carpet = (cx: number, cy: number, seed: number) => smooth(cx, cy, seed, 4.5) > 0.52;

export const oficinaFloor: FloorBuilder = ({ kind, cx, cy, lx, ly, px, py, tone, noise: n, seed }) => {
  const rug = carpet(cx, cy, seed);
  if (rug) {
    // El perfil donde acaba la moqueta (ly 0 y 1 son la junta del motor)
    if ((lx === 1 && !carpet(cx - 1, cy, seed)) || (lx === TILE - 1 && !carpet(cx + 1, cy, seed))
      || (ly === 2 && !carpet(cx, cy - 1, seed)) || (ly === TILE - 1 && !carpet(cx, cy + 1, seed))) return mat(M.metal, 2);
  } else if (lx === 8 || ly === 9) tone -= 1;                                   // la junta de las losetas de 8
  else if (worldNoise(px >> 3, py >> 3, 5, seed) > 0.8) tone += 1;              // alguna loseta más clara
  if (kind.includes('gastado') && worldNoise(cx * 4 + (lx >> 2), cy * 4 + (ly >> 2), 7, seed) > 0.6) tone += rug ? -1 : 1;
  if (kind.includes('raspon')) {
    // Las ruedas de una silla: un arco alrededor del centro de la loseta
    const d = Math.hypot(lx - 8, ly - 8.5), from = worldNoise(cx, cy, 8, seed) * Math.PI * 2;
    const a = (Math.atan2(ly - 8.5, lx - 8) - from + Math.PI * 4) % (Math.PI * 2);
    if (Math.abs(d - 4.5) < 0.6 && a < 2.4) tone += rug ? -1 : 1;
  }
  if (kind.includes('mancha')) {
    // Café derramado: una mancha con su cerco más oscuro
    const sx = 5 + Math.floor(worldNoise(cx, cy, 9, seed) * 6), sy = 6 + Math.floor(worldNoise(cx, cy, 10, seed) * 5);
    const d = Math.hypot(lx - sx, (ly - sy) * 1.2) + (n - 0.5) * 1.2;
    if (d < 3.6) return mat(R.mancha!, d > 2.6 ? 0 : 1 + (n > 0.8 ? 1 : 0));
    if (Math.hypot(lx - sx - 4, ly - sy + 2) < 1.2) return mat(R.mancha!, 1);   // una gota
  }
  const ramp = rug ? R.moqueta! : M.floor;
  if (rug) tone += n > 0.93 ? 1 : n < 0.05 ? -1 : 0;                           // el pelo de la moqueta
  return mat(ramp, Math.min(4, tone));
};

// ---- fachada. Todo se pinta en la cara de la pared (y = faceY) o dentro de un hueco tallado: nada sale delante
const z16 = (height: number) => (z: number) => Math.max(1, Math.min(height - 2, Math.round((z * height) / 16)));

export const oficinaFacade: FacadeBuilder = (site) => {
  const { model, piece, cx, x0, faceY, height, seed, carve } = site;
  const z = z16(height);
  const face = (lx: number, zz: number, v: number) => model.set(x0 + lx, faceY, zz, v);
  const nz = (a: number, b: number) => worldNoise(cx * 16 + a, b, 21, seed);
  // El zócalo de todas: una franja oscura abajo con el canto claro
  for (let lx = 0; lx < 16; lx++) { face(lx, 0, mat(M.wall, 0)); face(lx, 1, mat(M.wall, 0)); face(lx, 2, mat(M.wall, 3)); }
  if (piece.includes('puerta')) {
    // Puerta de oficina: hoja de madera con su ventanuco y el tirador, y la luz verde de salida encima
    carve(3, 12, 1, z(11), (lx, zz) => (lx >= 6 && lx <= 9 && zz >= z(7) && zz <= z(9) ? mat(M.darkGlass, 2)
      : lx === 10 && zz === z(5) ? mat(M.metal, 4) : mat(M.wood, lx === 3 || lx === 12 ? 1 : 2)));
    for (let lx = 6; lx <= 9; lx++) for (const zz of [z(13), z(14)]) face(lx, zz, mat(R.salida!, lx === 6 || lx === 9 ? 1 : zz === z(14) ? 3 : 2));
  } else if (piece.includes('ventana')) {
    const z0 = z(5), z1 = z(12), mid = Math.round((z0 + z1) / 2);
    for (let lx = 2; lx <= 13; lx++) face(lx, z0 - 1, mat(M.metal, 3));                            // el alféizar
    const night = piece.includes('noche'), blinds = piece.includes('persiana');
    // Los edificios de enfrente, para la ventana de noche: un perfil por columna
    const sky = (lx: number) => z0 + 2 + Math.floor(worldNoise(cx * 16 + (lx >> 1), 0, 22, seed) * (z1 - z0 - 2));
    carve(3, 12, z0, z1, (lx, zz) => {
      if (lx === 7 || lx === 8 || zz === mid) return mat(M.metal, 2);                              // el parteluz
      if (blinds) return zz % 2 === 0 ? mat(M.metal, 3) : mat(M.warmGlass, zz > mid ? 2 : 1);     // la persiana
      if (night) return zz >= sky(lx) ? mat(M.darkGlass, 2) : lx % 2 === 1 && zz % 2 === 0 && nz(lx, zz) > 0.45 ? mat(M.warmGlass, 3) : mat(M.darkGlass, 0);
      return mat(M.darkGlass, (lx + zz) % 6 === 0 ? 3 : 2);                                         // el reflejo
    });
  } else if (piece.includes('reloj')) {
    const cz = z(11);
    for (let lx = 4; lx <= 12; lx++) for (let zz = cz - 4; zz <= cz + 4; zz++) {
      const d = Math.hypot(lx - 8, zz - cz);
      if (d <= 2.4) face(lx, zz, mat(R.blanco!, 3));
      else if (d <= 3.4) face(lx, zz, mat(M.metal, 1));
    }
    face(8, cz, mat(M.metal, 0)); face(8, cz + 1, mat(M.metal, 0)); face(8, cz + 2, mat(M.metal, 0));   // las agujas
    face(9, cz, mat(R.rojo!, 2)); face(10, cz - 1, mat(R.rojo!, 2));
  } else if (piece.includes('extintor')) {
    // El extintor en su hornacina, y el cartel rojo encima
    carve(5, 10, 3, z(9), () => mat(M.wall, 1));
    for (let zz = 3; zz <= z(7); zz++) for (const lx of [6, 7, 8]) face(lx, zz, mat(R.rojo!, lx === 6 ? 3 : lx === 7 ? 2 : 1));
    face(7, z(7) + 1, mat(M.metal, 3)); face(8, z(7) + 1, mat(M.metal, 2));
    for (let zz = 4; zz <= z(6); zz++) face(9, zz, mat(M.metal, 0));                                // la manguera
    for (let lx = 5; lx <= 10; lx++) for (const zz of [z(11), z(12)]) face(lx, zz, mat(R.rojo!, lx === 5 || lx === 10 ? 1 : 3));
    face(7, z(11), mat(R.blanco!, 3)); face(8, z(12), mat(R.blanco!, 3));
  } else if (piece.includes('cartelera')) {
    // Tablón de corcho con notas y papeles clavados
    const zl = z(5), zh = z(13);
    for (let lx = 2; lx <= 13; lx++) for (let zz = zl; zz <= zh; zz++) {
      const edge = lx === 2 || lx === 13 || zz === zl || zz === zh;
      face(lx, zz, edge ? mat(M.wood, 1) : mat(R.corcho!, nz(lx, zz) > 0.7 ? 1 : 2));
    }
    for (let k = 0; k < 5; k++) {
      const lx = 3 + Math.floor(nz(k, 40) * 8), zz = zl + 1 + Math.floor(nz(k, 41) * (zh - zl - 3));
      const r = nz(k, 42), ramp = r < 0.4 ? R.nota! : r < 0.6 ? R.notaRosa! : R.blanco!, w = r > 0.6 ? 3 : 2;
      for (let a = 0; a < w; a++) for (let b = 0; b < 2; b++) face(lx + a, zz + b, mat(ramp, ramp === R.blanco ? 3 - b : 2 + b));
      face(lx, zz + 1, mat(R.rojo!, 3));                                                            // la chincheta
    }
  } else if (piece.includes('grafica')) {
    // Pizarra blanca con una gráfica de barras, la línea de tendencia y la bandeja de rotuladores
    const zl = z(5), zh = z(13);
    for (let lx = 1; lx <= 14; lx++) for (let zz = zl; zz <= zh; zz++)
      face(lx, zz, lx === 1 || lx === 14 || zz === zl || zz === zh ? mat(M.metal, 3) : mat(R.blanco!, 3));
    const bars = [2, 3, 3, 5].map((b, k) => Math.min(zh - zl - 2, b + Math.floor(nz(k, 50) * 2)));
    bars.forEach((b, k) => { for (let zz = zl + 1; zz <= zl + b; zz++) { face(3 + k * 3, zz, mat(M.screen, 2)); face(4 + k * 3, zz, mat(M.screen, 3)); } });
    for (let lx = 3; lx <= 12; lx++) face(lx, Math.min(zh - 1, zl + 2 + Math.round((lx - 3) * 0.5)), mat(R.rojo!, 3));
    for (let lx = 4; lx <= 11; lx++) face(lx, zl - 1, mat(M.metal, 2));
    face(5, zl - 1, mat(R.rojo!, 3)); face(6, zl - 1, mat(M.screen, 3));
  } else if (piece.includes('liso')) {
    // La pared lisa, con algún enchufe o un cuadro
    const r = nz(0, 60);
    if (r > 0.55) { face(7, 3, mat(R.blanco!, 2)); face(8, 3, mat(R.blanco!, 2)); }
    if (r > 0.8) {
      const zl = z(7), zh = z(12);
      for (let lx = 5; lx <= 10; lx++) for (let zz = zl; zz <= zh; zz++)
        face(lx, zz, lx === 5 || lx === 10 || zz === zl || zz === zh ? mat(M.wood, 1) : mat(nz(1, 61) > 0.5 ? M.screen : M.grass, zz > (zl + zh) / 2 ? 3 : 2));
    }
  } else sampleFacade(site);
};

// ---- por el suelo: plantas, cajas, papeleras, fuentes de agua, sillas y papeles. Todo atravesable
function rng(seed: number): () => number {
  let s = (seed ^ 0x51ed270b) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OficinaDecor { plantas: number; cajas: number; papeleras: number; fuentes: number; sillas: number; papeles: number }

export function decorateOficina(world: World, seed: number, layout: Layout): OficinaDecor {
  const m = world.model, W = world.width, D = world.depth;
  const r = rng(seed);
  // Solo en el aire: nada de lo que se pone pisa la pared, una columna, un mueble ni otra cosa ya puesta
  const put = (x: number, y: number, z: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < D && !m.get(x, y, z)) m.set(x, y, z, v); };
  const used = new Uint8Array(W * D);
  // Suelo seco y libre hasta h de alto en el rectángulo, y sin nada puesto aquí
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
  // ¿Hay pared (o columna, o mueble) pegada a este rectángulo por algún lado? A media altura, para no contar cables
  const againstWall = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) if (m.get(x, y0 - 1, 8) || m.get(x, y1 + 1, 8)) return true;
    for (let y = y0; y <= y1; y++) if (m.get(x0 - 1, y, 8) || m.get(x1 + 1, y, 8)) return true;
    return false;
  };
  // Un sitio pegado a la pared para algo de w x d y h de alto: se prueba al azar y luego se arrima hasta tocarla
  const spotAgainstWall = (w: number, d: number, h: number): [number, number] | null => {
    for (let t = 0; t < 400; t++) {
      let x = 2 + Math.floor(r() * (W - w - 4)), y = 2 + Math.floor(r() * (D - d - 4));
      if (!clear(x, y, x + w - 1, y + d - 1, h)) continue;
      const dir = Math.floor(r() * 4), dx = [1, -1, 0, 0][dir]!, dy = [0, 0, 1, -1][dir]!;
      let steps = 0;
      while (steps < 90 && clear(x + dx, y + dy, x + dx + w - 1, y + dy + d - 1, h)) { x += dx; y += dy; steps++; }
      if (steps < 90 && againstWall(x, y, x + w - 1, y + d - 1)) return [x, y];
    }
    return null;
  };
  const out: OficinaDecor = { plantas: 0, cajas: 0, papeleras: 0, fuentes: 0, sillas: 0, papeles: 0 };

  // Plantas en maceta: un ficus (una copa de hojas) o una sansevieria (hojas largas de pie)
  const nPlants = 9 + Math.floor(r() * 4);
  for (let k = 0; k < nPlants; k++) {
    const s = spotAgainstWall(5, 5, 14);
    if (!s) break;
    const [x, y] = s, cx = x + 2, cy = y + 2, tall = r() < 0.45;
    for (let z = 1; z <= 5; z++) for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const corner = (dx === 0 || dx === 4) && (dy === 0 || dy === 4);
      if (corner && z < 5) continue;
      const inside = dx > 0 && dx < 4 && dy > 0 && dy < 4;
      if (z === 5 && inside) put(x + dx, y + dy, z, mat(R.maceta!, 0));                           // la tierra
      else put(x + dx, y + dy, z, mat(R.maceta!, z === 5 ? 4 : dx === 0 || dy === 0 ? 2 : 3));
    }
    if (tall) {
      // Sansevieria: siete hojas de pie, de 6 a 10 de alto, con rayas
      for (let b = 0; b < 7; b++) {
        const a = (b / 7) * Math.PI * 2 + r(), lean = 0.1 + r() * 0.08, hgt = 6 + Math.floor(r() * 5);
        for (let z = 0; z < hgt; z++) {
          const bx = Math.round(cx + Math.cos(a) * (0.6 + z * lean)), by = Math.round(cy + Math.sin(a) * (0.6 + z * lean));
          put(bx, by, 6 + z, mat(R.planta!, z === hgt - 1 ? 4 : (z + b) % 3 === 0 ? 2 : 3));
        }
      }
    } else {
      // Ficus: una copa redonda, con huecos, más clara arriba
      const cz = 10, rr = 2.8;
      for (let z = 6; z <= 14; z++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy, (z - cz) * 1.15);
        const n = worldNoise(cx + dx, cy + dy, z, seed);
        if (d > rr + n * 0.8 || n < 0.22) continue;
        put(cx + dx, cy + dy, z, mat(R.planta!, Math.min(4, 1 + Math.floor((z - 6) / 3) + (n > 0.8 ? 1 : 0))));
      }
      for (let z = 6; z <= 8; z++) put(cx, cy, z, mat(R.maceta!, 1));                              // el tronco
    }
    claim(x, y, x + 4, y + 4, 3);
    out.plantas++;
  }

  // Cajas de cartón, sueltas o apiladas, con su cinta
  const box = (x: number, y: number, z0: number, w: number, d: number, h: number) => {
    for (let z = z0; z < z0 + h; z++) for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) {
      const top = z === z0 + h - 1, tape = top && (dx === Math.floor(w / 2));
      const side = dx === 0 || dy === 0 ? 2 : 3;
      put(x + dx, y + dy, z, mat(R.carton!, tape ? 4 : top ? 3 : z === z0 ? 1 : side));
    }
  };
  const nBoxes = 6 + Math.floor(r() * 4);
  for (let k = 0; k < nBoxes; k++) {
    const w = 6 + Math.floor(r() * 3), d = 5 + Math.floor(r() * 3), h = 5 + Math.floor(r() * 2);
    const s = spotAgainstWall(w, d, 14);
    if (!s) break;
    const [x, y] = s;
    box(x, y, 1, w, d, h);
    if (r() < 0.55) box(x + 1, y + 1, 1 + h, w - 2, d - 2, 4 + Math.floor(r() * 2));
    claim(x, y, x + w - 1, y + d - 1);
    out.cajas++;
  }

  // Fuentes de agua: el cuerpo blanco con su grifo y la garrafa azul encima
  const nCoolers = 1 + Math.floor(r() * 2);
  for (let k = 0; k < nCoolers; k++) {
    const s = spotAgainstWall(4, 4, 16);
    if (!s) break;
    const [x, y] = s;
    for (let z = 1; z <= 8; z++) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++)
      put(x + dx, y + dy, z, mat(R.papel!, z === 8 ? 3 : dx === 0 || dy === 0 ? 1 : 2));
    put(x + 1, y, 6, mat(R.plastico!, 4)); put(x + 2, y, 6, mat(R.gris!, 0));                  // los grifos
    for (let z = 9; z <= 14; z++) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      if ((dx === 0 || dx === 3) && (dy === 0 || dy === 3)) continue;
      put(x + dx, y + dy, z, mat(R.plastico!, z === 14 ? 4 : dx === 0 || dy === 0 ? 2 : 3));
    }
    claim(x, y, x + 3, y + 3, 2);
    out.fuentes++;
  }

  // Papeleras: un cubo de rejilla gris con papeles arrugados asomando
  const nBins = 7 + Math.floor(r() * 3);
  for (let k = 0; k < nBins; k++) {
    const s = spotAgainstWall(4, 4, 8);
    if (!s) break;
    const [x, y] = s;
    for (let z = 1; z <= 5; z++) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      const wall = dx === 0 || dx === 3 || dy === 0 || dy === 3;
      if ((dx === 0 || dx === 3) && (dy === 0 || dy === 3)) continue;
      if (wall) put(x + dx, y + dy, z, mat(R.gris!, z === 5 ? 4 : (dx + dy + z) % 2 === 0 ? 2 : 3));
      else if (z === 5) put(x + dx, y + dy, z + (r() < 0.5 ? 1 : 0), mat(R.papel!, 2 + Math.floor(r() * 2)));
    }
    claim(x, y, x + 3, y + 3);
    out.papeleras++;
  }

  // Sillas de oficina: delante de cada escritorio (al sur, de espaldas a la cámara) y alguna suelta
  const chair = (x: number, y: number, backNorth: boolean) => {
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [0, 0]] as const) put(x + dx, y + dy, 1, mat(R.gris!, 1));   // las ruedas
    for (let z = 2; z <= 5; z++) put(x, y, z, mat(R.gris!, 2));                                    // el pie
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(x + dx, y + dy, 6, mat(R.silla!, Math.abs(dx) === 2 || Math.abs(dy) === 2 ? 1 : 2));
    const by = backNorth ? y + 2 : y - 2;
    for (let z = 7; z <= 12; z++) for (let dx = -2; dx <= 2; dx++) put(x + dx, by, z, mat(R.silla!, z === 12 ? 3 : Math.abs(dx) === 2 ? 1 : 2));
  };
  for (const p of layout.props) {
    const x0 = p.x * TILE, x1 = (p.x + p.w) * TILE - 1, yS = D - 1 - ((p.y + p.h) * TILE - 1);
    const cx = Math.round((x0 + x1) / 2) + Math.round((r() - 0.5) * 8), cy = yS - 4;
    if (!clear(cx - 2, cy - 2, cx + 2, cy + 2, 13)) continue;
    chair(cx, cy, false);
    claim(cx - 2, cy - 2, cx + 2, cy + 2);
    out.sillas++;
  }
  for (let k = 0; k < 3; k++) {
    for (let t = 0; t < 60; t++) {
      const x = 8 + Math.floor(r() * (W - 16)), y = 8 + Math.floor(r() * (D - 16));
      if (!clear(x - 2, y - 2, x + 2, y + 2, 13)) continue;
      chair(x, y, r() < 0.5);
      claim(x - 2, y - 2, x + 2, y + 2);
      out.sillas++;
      break;
    }
  }

  // Papeles por el suelo: hojas sueltas (más en las losetas de papeles y junto a los escritorios) y alguna bola
  const tileKind = (x: number, y: number) => layout.floor[Math.floor((D - 1 - y) / TILE) * layout.cols + Math.floor(x / TILE)] ?? '';
  const near = layout.props.map((p) => ({ x: (p.x + p.w / 2) * TILE, y: D - (p.y + p.h) * TILE }));
  const sheet = (x: number, y: number) => {
    const w = r() < 0.5 ? 3 : 2, d = 5 - w;
    if (!clear(x, y, x + w - 1, y + d - 1, 2)) return false;
    for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) put(x + dx, y + dy, 1, mat(R.papel!, (dx + dy) % 3 === 1 && r() < 0.5 ? 1 : 3));
    used[y * W + x] = 1;
    return true;
  };
  for (let t = 0; t < 4000 && out.papeles < 140; t++) {
    let x: number, y: number;
    const pick = r();
    if (pick < 0.3 && near.length) {
      const n = near[Math.floor(r() * near.length)]!;
      x = Math.round(n.x + (r() - 0.5) * 40); y = Math.round(n.y - r() * 22);
    } else { x = 4 + Math.floor(r() * (W - 8)); y = 4 + Math.floor(r() * (D - 8)); }
    if (pick >= 0.3 && !tileKind(x, y).includes('papel') && r() < 0.85) continue;
    if (sheet(x, y)) out.papeles++;
    if (r() < 0.12 && clear(x + 4, y, x + 5, y + 1, 3)) {
      for (const [dx, dy, dz] of [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1], [0, 0, 2], [1, 1, 2]] as const) put(x + 4 + dx, y + dy, dz, mat(R.papel!, dz === 2 ? 3 : 2));
    }
  }
  return out;
}

// La paleta completa de la oficina: la del motor y estas detrás
export const withOficinaRamps = (p: { ramps: Ramp[] }) => ({ ...p, ramps: [...p.ramps, ...OFICINA_RAMPS.map((r) => ({ ...r, colors: [...r.colors] }))] });
