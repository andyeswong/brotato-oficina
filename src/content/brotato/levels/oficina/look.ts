// El aspecto de la oficina (NARUTO, 2026-11-04; segunda vuelta con el juicio de MAIA): sus piezas de suelo y de
// fachada y lo que se pone en el mundo. Antes usaba las piezas de muestra de VoxPix, que no dibujan las losetas ni las
// piezas propias de la oficina, y la planta se veía vacía. Lo que la hace rica, como el medieval: charcos de luz con
// contraste (tubos fríos colgados, lámparas cálidas), una pieza central (la isla de la copiadora, donde está la
// tienda), cosas agrupadas con huecos y un suelo tranquilo. Nada de esto cambia la partida:
// - el suelo es una sola capa (z = 0), como antes: solo cambia el color de cada losa (también al pintar moqueta);
// - la fachada se pinta EN la cara de la pared o en huecos tallados: nada sale delante de ella;
// - lo que se pone encima es 'atravesable' y nunca pisa un vóxel que ya estaba. Regla de Andrés: lo que se cruza no
//   debe engañar, así que lo alto (plantas, cajas, fuentes de agua, lámparas) va contra la pared, lo del centro es
//   bajo (montones de papel) y los tubos cuelgan por encima de las cabezas.
import { material, type Ramp } from '@voxpix/core';
import { M, worldNoise, type FacadeBuilder, type FloorBuilder, type PillarBuilder, type World } from '@voxpix/world/build';
import { sampleFacade } from '@voxpix/samples/pieces';
import { NORTH, TILE, type Layout } from '@voxpix/worldgen';
import { roundPuddles } from '../charcos';

// Rampas propias, detrás de las del motor (M va de 0 a 14). Las que pintan el suelo y la fachada son sólidas, como el
// suelo y la pared; las de encima, atravesables
const EXTRA: Array<Ramp & { key: string }> = [
  // Las moquetas, de tono medio y con color: nunca más oscuras que el vinilo de alrededor (MAIA: si no, parecen agujeros)
  { key: 'moqueta', name: 'moqueta verde azulada', colors: ['#2c4244', '#36504f', '#41605e', '#4e706d', '#5e827e'] },
  { key: 'moquetaB', name: 'moqueta burdeos', colors: ['#3e2a30', '#4e343c', '#604048', '#704c56', '#825a64'] },
  { key: 'mancha', name: 'mancha de café', colors: ['#1a120c', '#281c12', '#36261a', '#4a3424'] },
  { key: 'rojo', name: 'rojo extintor', colors: ['#3a0c0e', '#6e1418', '#a82024', '#d8402e', '#f88060'] },
  { key: 'corcho', name: 'corcho', colors: ['#3a2414', '#5a3a20', '#7a5430', '#9a7044'] },
  { key: 'blanco', name: 'blanco', colors: ['#7c8090', '#a6aab6', '#cfd2da', '#eef0f4'] },
  { key: 'salida', name: 'luz de salida', colors: ['#0a3a1c', '#14783a', '#2ec062', '#9cf8b8'], emissive: true },
  { key: 'nota', name: 'nota adhesiva', colors: ['#6a5810', '#a8901c', '#e0c430', '#fff07a'] },
  { key: 'notaRosa', name: 'nota rosa', colors: ['#6a2440', '#a83a68', '#e06498', '#ffa8cc'] },
  // La orilla de los charcos (charcos.ts, rim): la cara del escalón sobre el agua se hornea un tono por debajo de la de
  // arriba y con la mitad de luz, y se veía como un contorno negro. Aquí ese tono de abajo es uno más claro que la losa:
  // la cara queda como el vinilo de al lado, y la de arriba, igual que siempre (la losa, en el 2; la junta, en el 1)
  { key: 'orilla', name: 'orilla de charco', colors: ['#5e687c', '#5e687c', '#464e5e', '#5e687c', '#76829a'] },
  { key: 'orillaJunta', name: 'orilla de charco, junta', colors: ['#464e5e', '#323844', '#464e5e', '#5e687c', '#76829a'] },
  { key: 'alfombra', name: 'alfombra', colors: ['#4a3e34', '#5a4c40', '#6a5a4c', '#7c6a5a', '#8e7c6a'] },
  // Encima
  { key: 'papel', name: 'papel', colors: ['#7c8090', '#aeb2bc', '#d6d8de', '#f4f5f8'], material: 'atravesable' },
  { key: 'carton', name: 'cartón', colors: ['#4a3018', '#6e4a26', '#946836', '#b88a50', '#dcb27a'], material: 'atravesable' },
  { key: 'planta', name: 'planta', colors: ['#10281a', '#1a4026', '#265e32', '#3a8040', '#62a852'], material: 'atravesable' },
  { key: 'maceta', name: 'maceta', colors: ['#2a1a16', '#4e2e24', '#74442e', '#9a603c', '#bc8458'], material: 'atravesable' },
  { key: 'plastico', name: 'plástico', colors: ['#0c2440', '#163e6c', '#2460a0', '#4a8ccc', '#9cccf0'], material: 'atravesable' },
  { key: 'gris', name: 'plástico gris', colors: ['#1a1c22', '#2a2d36', '#3e424e', '#5a606e', '#80889a'], material: 'atravesable' },
  { key: 'blancoP', name: 'plástico blanco', colors: ['#7c8090', '#a6aab6', '#cfd2da', '#eef0f4'], material: 'atravesable' },
  { key: 'tubo', name: 'tubo fluorescente', colors: ['#5a7080', '#9ab8c8', '#d8f0ff', '#ffffff'], material: 'atravesable', emissive: true },
  { key: 'pantalla', name: 'pantalla de lámpara', colors: ['#7a4a18', '#c07a28', '#f0b04a', '#ffe08a'], material: 'atravesable', emissive: true },
  { key: 'hoja', name: 'hoja caída', colors: ['#1a3a1c', '#2a5428', '#3c7034', '#5a9048'], material: 'atravesable' },
  // Lo alto de la mampara (oficinaPillar): atravesable y sin peso, para que la masa y la colisión no cambien
  { key: 'telaAlta', name: 'tela alta de mampara', colors: ['#2e4e56', '#3e6670', '#507e88', '#6698a0', '#82b2b8'], material: 'atravesable', props: { density: 0 } },
  { key: 'marcoAlto', name: 'marco alto de mampara', colors: ['#4a505c', '#6e7684', '#a0a8b4', '#c8d0da', '#e8ecf2'], material: 'atravesable', props: { density: 0 } },
];
const R = Object.fromEntries(EXTRA.map((r, k) => [r.key, 15 + k])) as Record<string, number>;
export const OFICINA_RAMPS: Ramp[] = EXTRA.map(({ key: _k, ...r }) => r);
const mat = (ramp: number, tone: number) => material(ramp, Math.max(0, tone));
const rampOf = (v: number) => Math.floor((v - 1) / 16);

// ---- suelo: vinilo en losetas grandes, de 32, con la junta solo un tono más oscura (MAIA: con la cámara 2:1, la
// loseta pequeña y la junta oscura se ven como una pared de ladrillo). Es el fondo: tranquilo, sin losetas claras
// sueltas. El motor pinta su junta de 16; decorateOficina repinta todo el suelo con slab, y luego la moqueta y las
// manchas, porque sabe dónde está cada cosa
export const oficinaFloor: FloorBuilder = () => mat(M.floor, 2);
const slab = (x: number, y: number, D: number) => mat(M.floor, (x & 31) === 0 || ((D - 1 - y) & 31) <= 1 ? 1 : 2);

// ---- la mampara (MAIA: "parecen sillas grises bajas"): la de sim/decor.ts (mamparaPillar), más alta y clara, con
// tela de color. Misma huella y mismo bloqueo: los 12 vóxeles de abajo ocupan las mismas celdas que allí, y metal y tela
// pesan lo mismo en la oficina (300 kg/m³), así que la masa es la misma; lo de encima (z 12 a 14) es atravesable y sin
// peso. aspecto.test.ts lo comprueba contra mamparaPillar
const MAMPARA_LOW = 12, MAMPARA_H = 15;
export const oficinaPillar: PillarBuilder = ({ model, x0, y0, x1, y1, noise }) => {
  const corner = Math.floor(noise(x0, y0, 0) * 4);
  const ax = corner & 1 ? x1 - 2 : x0 + 1, ay = corner & 2 ? y1 - 2 : y0 + 1;   // la esquina de la L
  const panel = (xa: number, ya: number, xb: number, yb: number) => {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) {
      for (let z = 0; z < MAMPARA_H; z++) {
        const end = x === Math.min(xa, xb) || x === Math.max(xa, xb) || y === Math.min(ya, yb) || y === Math.max(ya, yb);
        const post = end && (xa === xb ? y === ya || y === yb : x === xa || x === xb);
        const high = z >= MAMPARA_LOW, tone = 2 + (noise(x, y, z) > 0.85 ? 1 : 0) + (z > 8 ? 1 : 0);
        let val: number;
        if (z === MAMPARA_H - 1) val = mat(R.marcoAlto!, 3);                        // el canto de arriba, claro
        else if (z < 2) val = mat(M.metal, 1);                                       // el zócalo
        else if (post) val = high ? mat(R.marcoAlto!, 2) : mat(M.metal, 4);         // los postes
        else val = high ? mat(R.telaAlta!, tone) : mat(M.cloth, tone);               // la tela
        model.set(x, y, z, val);
      }
    }
  };
  const dx = corner & 1 ? -1 : 1, dy = corner & 2 ? -1 : 1;
  panel(ax, ay, ax + dx * 13, ay + dy);
  panel(ax, ay, ax + dx, ay + dy * 13);
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
    // La pared lisa: un aplique de tubo fluorescente (su luz la pone decorateOficina), un cuadro o un enchufe
    const r = nz(0, 60);
    if (r > 0.55) { face(7, 3, mat(R.blanco!, 2)); face(8, 3, mat(R.blanco!, 2)); }
    if (r < 0.4) {
      for (let lx = 3; lx <= 12; lx++) { face(lx, z(13), mat(M.metal, 3)); face(lx, z(12), lx === 3 || lx === 12 ? mat(M.metal, 1) : mat(R.tubo!, 3)); }
    } else if (r > 0.8) {
      const zl = z(7), zh = z(12);
      for (let lx = 5; lx <= 10; lx++) for (let zz = zl; zz <= zh; zz++)
        face(lx, zz, lx === 5 || lx === 10 || zz === zl || zz === zh ? mat(M.wood, 1) : mat(nz(1, 61) > 0.5 ? M.screen : M.grass, zz > (zl + zh) / 2 ? 3 : 2));
    }
  } else sampleFacade(site);
};

// ---- lo que se pone en el mundo
function rng(seed: number): () => number {
  let s = (seed ^ 0x51ed270b) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OficinaDecor {
  secos: number; alfombras: number; manchas: number; montones: number; matas: number; plantas: number; cajas: number;
  fuentes: number; lamparas: number; tubos: number; apliques: number;
}

// shop: dónde está el adorno de la tienda (la copiadora), en ejes del modelo: la pieza central del piso
export function decorateOficina(world: World, seed: number, layout: Layout, at: { shop: { x: number; y: number } | null }): OficinaDecor {
  const m = world.model, W = world.width, D = world.depth;
  const r = rng(seed);
  // Solo en el aire: nada de lo que se pone pisa la pared, una columna, un mueble ni otra cosa ya puesta
  const put = (x: number, y: number, z: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < D && !m.get(x, y, z)) m.set(x, y, z, v); };
  // El color de una losa del suelo seco (z = 0, del vinilo o de la junta del motor); nada más se repinta
  const repaint = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= W || y >= D || world.wet[y * W + x]) return false;
    const old = m.get(x, y, 0);
    if (!old || rampOf(old) !== M.floor) return false;
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
  // El lado del rectángulo que toca pared (0 sur, 1 norte, 2 oeste, 3 este; -1 ninguno). A media altura: sin cables
  const wallSide = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x <= x1; x++) { if (m.get(x, y0 - 1, 8)) return 0; if (m.get(x, y1 + 1, 8)) return 1; }
    for (let y = y0; y <= y1; y++) { if (m.get(x0 - 1, y, 8)) return 2; if (m.get(x1 + 1, y, 8)) return 3; }
    return -1;
  };
  // Un sitio pegado a la pared para algo de w x d y h de alto: se prueba al azar y se arrima hasta tocarla
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
  const out: OficinaDecor = { secos: 0, alfombras: 0, manchas: 0, montones: 0, matas: 0, plantas: 0, cajas: 0, fuentes: 0, lamparas: 0, tubos: 0, apliques: 0 };
  const shop = at.shop;
  const desks = layout.props.map((p) => ({ x0: p.x * TILE, x1: (p.x + p.w) * TILE - 1, yS: D - (p.y + p.h) * TILE, yN: D - 1 - p.y * TILE }));

  // El suelo entero, en losetas de 32 (slab): encima de la junta de 16 del motor
  for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) repaint(x, y, slab(x, y, D));
  // Los charcos de café, en manchas redondas (charcos.ts); lo que se seca, vinilo
  out.secos = roundPuddles(world, seed, (x, y) => slab(x, y, D), {
    flat: true, rim: (_x, _y, v) => (v === mat(M.floor, 2) ? mat(R.orilla!, 2) : v === mat(M.floor, 1) ? mat(R.orillaJunta!, 1) : v),
  });

  // Moqueta: rectángulos limpios (salas y un pasillo) en losetas enteras, con el perfil de metal en el borde, y la
  // alfombra de la isla de la copiadora. Solo cambia el color del suelo
  const carpet = (x0: number, y0: number, x1: number, y1: number, ramp: number) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === y0 || y === y1;
      const nn = worldNoise(x, y, 0, seed);
      if (repaint(x, y, edge ? mat(M.metal, 2) : mat(ramp, 2 + (nn > 0.94 ? 1 : nn < 0.04 ? -1 : 0)))) n++;
    }
    return n;
  };
  const rooms: Array<[number, number, number, number]> = [];
  const carpets = [R.moqueta!, R.moquetaB!];
  for (let t = 0; t < 60 && rooms.length < 4; t++) {
    const corridor = rooms.length === 3, vertical = r() < 0.5;
    let w = corridor ? 2 : 4 + Math.floor(r() * 4), h = corridor ? 12 + Math.floor(r() * 8) : 3 + Math.floor(r() * 3);
    if (corridor && !vertical) [w, h] = [h, w];
    const cx0 = 1 + Math.floor(r() * (layout.cols - w - 2)), cy0 = NORTH + 1 + Math.floor(r() * (layout.rows - NORTH - h - 2));
    const rect: [number, number, number, number] = [cx0 * TILE, D - (cy0 + h) * TILE, (cx0 + w) * TILE - 1, D - 1 - cy0 * TILE];
    if (rooms.some(([a, b, c, d]) => rect[0] <= c + TILE && a <= rect[2] + TILE && rect[1] <= d + TILE && b <= rect[3] + TILE)) continue;
    if (shop && shop.x > rect[0] - 40 && shop.x < rect[2] + 40 && shop.y > rect[1] - 40 && shop.y < rect[3] + 40) continue;
    rooms.push(rect);
    if (carpet(...rect, carpets[rooms.length % 2]!) > 200) out.alfombras++;
  }
  if (shop) { const s = 26; if (carpet(Math.round(shop.x) - s, Math.round(shop.y) - s, Math.round(shop.x) + s, Math.round(shop.y) + s, R.alfombra!) > 200) out.alfombras++; }

  // Manchas de café: pocas, junto a los escritorios (donde iría la silla) y alguna junto a la copiadora
  const stain = (sx: number, sy: number) => {
    const rr = 2.2 + r() * 1.3;
    for (let y = Math.floor(sy - rr - 1); y <= sy + rr + 1; y++) for (let x = Math.floor(sx - rr - 1); x <= sx + rr + 1; x++) {
      const d = Math.hypot(x - sx, (y - sy) * 1.2) + (worldNoise(x, y, 3, seed) - 0.5) * 1.1;
      if (d < rr) repaint(x, y, mat(R.mancha!, d > rr - 0.9 ? 0 : 1));
    }
    out.manchas++;
  };
  for (const d of desks) if (r() < 0.7) stain(d.x0 + 6 + r() * (d.x1 - d.x0 - 12), d.yS - 4 - r() * 6);
  if (shop) stain(shop.x + 14, shop.y - 16);

  // Montones de papeles: hojas superpuestas, algunas encima de otras, junto a los escritorios y a la copiadora
  const pile = (px: number, py: number, n: number) => {
    let laid = 0;
    for (let k = 0; k < n * 3 && laid < n; k++) {
      const x = Math.round(px + (r() - 0.5) * 8), y = Math.round(py + (r() - 0.5) * 6), w = r() < 0.5 ? 3 : 2, d = 5 - w;
      let ok = true;
      for (let yy = y; yy < y + d && ok; yy++) for (let xx = x; xx < x + w && ok; xx++) {
        const v = m.get(xx, yy, 0);
        if (!v || world.wet[yy * W + xx] || (m.get(xx, yy, 1) && rampOf(m.get(xx, yy, 1)) !== R.papel) || m.get(xx, yy, 3)) ok = false;
      }
      if (!ok) continue;
      for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + w; xx++) {
        const z = m.get(xx, yy, 1) ? 2 : 1;
        put(xx, yy, z, mat(R.papel!, (xx + yy) % 3 === 1 && r() < 0.4 ? 1 : 3 - (z === 1 ? 1 : 0)));
      }
      laid++;
    }
    if (laid) { claim(Math.round(px) - 5, Math.round(py) - 4, Math.round(px) + 5, Math.round(py) + 4, 0); out.montones++; }
  };
  for (const d of desks) pile(d.x0 + 4 + r() * (d.x1 - d.x0 - 8), d.yS - 3 - r() * 5, 4 + Math.floor(r() * 4));
  if (shop) { pile(shop.x - 15, shop.y - 14, 6); pile(shop.x + 16, shop.y + 4, 5); }

  // En el centro, como las matas del medieval: grupos bajos (2 de alto como mucho) con huecos entre ellos, de hojas
  // caídas y algún papel. Lejos de las paredes, de los escritorios y de la copiadora. Sin cables: un trazo gris de un
  // vóxel sobre el suelo gris se leía como una línea suelta (MAIA)
  const nearWall = (x: number, y: number, d: number) => {
    for (let k = -d; k <= d; k += 4) if (m.get(x + k, y, 8) || m.get(x, y + k, 8)) return true;
    return false;
  };
  const floorAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < D && !!m.get(x, y, 0) && !world.wet[y * W + x];
  const tuft = (cx: number, cy: number) => {
    const leaves = 6 + Math.floor(r() * 5);
    for (let k = 0; k < leaves; k++) {
      const a = r() * Math.PI * 2, d = r() * 5, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.8);
      if (!floorAt(x, y)) continue;
      put(x, y, 1, mat(R.hoja!, Math.floor(r() * 4)));
      if (r() < 0.4 && floorAt(x + 1, y)) put(x + 1, y, 1, mat(R.hoja!, 1 + Math.floor(r() * 3)));
      if (r() < 0.2) put(x, y, 2, mat(R.hoja!, 3));
    }
    if (r() < 0.7) {
      const x = Math.round(cx + (r() - 0.5) * 6), y = Math.round(cy + (r() - 0.5) * 6);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) if (floorAt(x + dx, y + dy)) put(x + dx, y + dy, 1, mat(R.papel!, 3));
    }
    claim(Math.round(cx) - 7, Math.round(cy) - 7, Math.round(cx) + 7, Math.round(cy) + 7, 0);
    out.matas++;
  };
  for (let g = 0, t = 0; g < 4 && t < 300; t++) {
    const gx = 40 + r() * (W - 80), gy = 40 + r() * (D - NORTH * TILE - 80);
    if (nearWall(Math.round(gx), Math.round(gy), 28) || (shop && Math.hypot(gx - shop.x, gy - shop.y) < 50)) continue;
    if (desks.some((d) => gx > d.x0 - 20 && gx < d.x1 + 20 && gy > d.yS - 24 && gy < d.yN + 8)) continue;
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + r(), d = 10 + r() * 14; tuft(gx + Math.cos(a) * d, gy + Math.sin(a) * d); }
    g++;
  }

  // Plantas en maceta: un ficus (copa de hojas) o una sansevieria (hojas largas de pie); ocupan 7 x 7
  const plant = (x: number, y: number) => {
    const cx = x + 3, cy = y + 3, tall = r() < 0.45;
    for (let z = 1; z <= 5; z++) for (let dy = 1; dy <= 5; dy++) for (let dx = 1; dx <= 5; dx++) {
      const corner = (dx === 1 || dx === 5) && (dy === 1 || dy === 5);
      if (corner && z < 5) continue;
      const inside = dx > 1 && dx < 5 && dy > 1 && dy < 5;
      put(x + dx, y + dy, z, z === 5 && inside ? mat(R.maceta!, 0) : mat(R.maceta!, z === 5 ? 4 : dx === 1 || dy === 1 ? 2 : 3));
    }
    if (tall) {
      for (let b = 0; b < 7; b++) {
        const a = (b / 7) * Math.PI * 2 + r(), lean = 0.1 + r() * 0.08, hgt = 6 + Math.floor(r() * 5);
        for (let z = 0; z < hgt; z++) put(Math.round(cx + Math.cos(a) * (0.6 + z * lean)), Math.round(cy + Math.sin(a) * (0.6 + z * lean)), 6 + z, mat(R.planta!, z === hgt - 1 ? 4 : (z + b) % 3 === 0 ? 2 : 3));
      }
    } else {
      for (let z = 6; z <= 8; z++) put(cx, cy, z, mat(R.maceta!, 1));                               // el tronco
      for (let z = 6; z <= 14; z++) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx, dy, (z - 10) * 1.15), n = worldNoise(cx + dx, cy + dy, z, seed);
        if (d > 2.8 + n * 0.8 || n < 0.22) continue;
        put(cx + dx, cy + dy, z, mat(R.planta!, Math.min(4, 1 + Math.floor((z - 6) / 3) + (n > 0.8 ? 1 : 0))));
      }
    }
    out.plantas++;
  };
  // Cajas de cartón, sueltas o apiladas, con su cinta
  const box = (x: number, y: number, z0: number, w: number, d: number, h: number) => {
    for (let z = z0; z < z0 + h; z++) for (let dy = 0; dy < d; dy++) for (let dx = 0; dx < w; dx++) {
      const top = z === z0 + h - 1, tape = top && dx === Math.floor(w / 2);
      put(x + dx, y + dy, z, mat(R.carton!, tape ? 4 : top ? 3 : z === z0 ? 1 : dx === 0 || dy === 0 ? 2 : 3));
    }
  };
  const boxes = (x: number, y: number) => {
    const w = 6 + Math.floor(r() * 2), d = 5, h = 5 + Math.floor(r() * 2);
    box(x, y + 1, 1, w, d, h);
    if (r() < 0.6) box(x + 1, y + 2, 1 + h, w - 2, d - 2, 4);
    out.cajas++;
  };
  // Fuente de agua: el cuerpo blanco con su grifo y la garrafa azul encima
  const cooler = (x: number, y: number) => {
    for (let z = 1; z <= 8; z++) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++)
      put(x + 1 + dx, y + 1 + dy, z, mat(R.blancoP!, z === 8 ? 3 : dx === 0 || dy === 0 ? 1 : 2));
    put(x + 2, y + 1, 6, mat(R.plastico!, 4)); put(x + 3, y + 1, 6, mat(R.gris!, 0));
    for (let z = 9; z <= 14; z++) for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      if ((dx === 0 || dx === 3) && (dy === 0 || dy === 3)) continue;
      put(x + 1 + dx, y + 1 + dy, z, mat(R.plastico!, z === 14 ? 4 : dx === 0 || dy === 0 ? 2 : 3));
    }
    out.fuentes++;
  };
  // Lámpara de pie: pie, mástil y la pantalla cálida que brilla, con su luz
  const lamp = (x: number, y: number) => {
    const cx = x + 3, cy = y + 3;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(cx + dx, cy + dy, 1, mat(R.gris!, 1));
    for (let z = 2; z <= 16; z++) put(cx, cy, z, mat(R.gris!, 3));
    for (let z = 17; z <= 20; z++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > (z === 20 ? 2 : 3)) continue;
      put(cx + dx, cy + dy, z, mat(R.pantalla!, z === 20 ? 3 : Math.abs(dx) === 2 || Math.abs(dy) === 2 ? 1 : 2));
    }
    world.lights.push({ id: `lampara-${out.lamparas}`, kind: 'lamp', x: cx + 0.5, y: cy + 0.5, z: 18.5, intensity: 1.15, radius: 100 });
    out.lamparas++;
  };
  // Grupos contra la pared, con huecos entre ellos: dos o tres cosas juntas (siempre alguna planta) a lo largo de la
  // pared que tocan
  const SLOT = 8;
  for (let g = 0, lamps = 0; g < 7; g++) {
    const n = 2 + Math.floor(r() * 2), along = r() < 0.5, L = n * SLOT;
    const s = spotAgainstWall(along ? L : SLOT, along ? SLOT : L, 16);
    if (!s) continue;
    const [x, y] = s, horizontal = along;
    // Siempre una planta; hasta cuatro lámparas en todo el piso, una por grupo como mucho: su luz cálida contrasta con
    // la fría de los tubos, como la de las antorchas del medieval con su luna
    const kinds = Array.from({ length: n }, (_, k) => (k === 0 ? 'planta' : ['planta', 'cajas', 'cajas', 'fuente'][Math.floor(r() * 4)]!));
    if (lamps < 4 && g >= 1) { kinds[n - 1] = 'lampara'; lamps++; }
    kinds.forEach((kind, k) => {
      const ox = horizontal ? x + k * SLOT : x, oy = horizontal ? y : y + k * SLOT;
      if (kind === 'planta') plant(ox, oy); else if (kind === 'cajas') boxes(ox, oy); else if (kind === 'fuente') cooler(ox, oy); else lamp(ox, oy);
    });
    claim(x, y, horizontal ? x + L - 1 : x + SLOT - 1, horizontal ? y + SLOT - 1 : y + L - 1, 6);
  }

  // La luz fría de los tubos del techo, en charcos sobre el suelo libre: uno sobre la copiadora y los demás
  // repartidos. Solo la luz: el techo no se ve, y los tubos colgados se leían como rayas sueltas (MAIA)
  const pendant = (px: number, py: number) => {
    const x = Math.round(px), y = Math.round(py);
    for (let dx = -6; dx <= 6; dx++) if (m.get(x + dx, y, 8) || !m.get(x + dx, y, 0)) return false;
    world.lights.push({ id: `tubo-${out.tubos}`, kind: 'lantern', x: x + 0.5, y: y + 0.5, z: 32, color: [0.74, 0.88, 1], intensity: 0.65, radius: 84 });
    out.tubos++;
    return true;
  };
  if (shop) pendant(shop.x, shop.y + 6);
  const STEP = 128;
  for (let gy = STEP / 2 + 16; gy < D - TILE * NORTH; gy += STEP) for (let gx = STEP / 2; gx < W; gx += STEP) {
    if (out.tubos >= 7) break;
    const jx = gx + (r() - 0.5) * 40, jy = gy + (r() - 0.5) * 40;
    if (shop && Math.hypot(jx - shop.x, jy - shop.y) < 70) continue;
    pendant(jx, jy);
  }

  // La luz de los apliques de tubo de la fachada (oficinaFacade): uno por cada tramo de tubo en la cara de la pared
  const faceY = D - NORTH * TILE;
  for (let x = 0; x < W; x++) {
    const tube = (xx: number, zz: number) => { const v = m.get(xx, faceY, zz); return !!v && rampOf(v) === R.tubo; };
    let z = -1;
    for (let zz = 4; zz < 16 && z < 0; zz++) if (tube(x, zz) && !tube(x - 1, zz)) z = zz;
    if (z < 0) continue;
    world.lights.push({ id: `aplique-tubo-${out.apliques}`, kind: 'lantern', x: x + 4.5, y: faceY - 4, z, color: [0.78, 0.9, 1], intensity: 0.6, radius: 64 });
    out.apliques++;
  }
  return out;
}

// La paleta completa de la oficina: la del motor y estas detrás
export const withOficinaRamps = (p: { ramps: Ramp[] }) => ({ ...p, ramps: [...p.ramps, ...OFICINA_RAMPS.map((r) => ({ ...r, colors: [...r.colors] }))] });
