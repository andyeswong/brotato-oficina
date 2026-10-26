// Lo que cada tema pone en su mundo además de lo que da el generador (Andrés, 2026-10-26: "el medieval con
// diferencia es el mejor, por el follaje y los charcos"; a los otros dos, lo suyo). Con las herramientas genéricas de
// VoxPix 857c33d:
// - columnas propias (WorldLook.pillar): las mamparas de cubículo de la oficina y los pilares de metal con neón del
//   cyberpunk. Son su colisión: lo que no ocupan se cruza, así que cambian la partida (la curva F1 se mide con ellas);
// - en decorate: los cables del cyberpunk y las tazas tiradas junto a los charcos de café de la oficina. Los dos con
//   el material 'atravesable' (opaco, no para nada ni a nadie): son solo aspecto, como la hierba;
// - el líquido de cada tema es la rampa 'agua' de su paleta (en su module.ts): café opaco, verde tóxico que brilla.
import { M, type PillarBuilder, type World } from '@voxpix/world/build';

const COLUMN_H = 34;            // el alto de la columna redonda de VoxPix: las de los temas, igual
const MAMPARA_H = 12;           // el panel de cubículo, más bajo que las paredes (16): se ve por encima (NARUTO: 10-12)

const v = (ramp: number, tone: number) => ramp * 16 + tone + 1;

// Una mampara de cubículo en L dentro de su loseta: dos brazos de 14 de largo y 2 de grueso, con zócalo oscuro, tela
// clara (más que el suelo, para que la L se lea desde arriba) y tapa de metal claro. La esquina (de las 4) sale de la
// posición: el mismo mapa da siempre las mismas
export const mamparaPillar: PillarBuilder = ({ model, x0, y0, x1, y1, noise }) => {
  const corner = Math.floor(noise(x0, y0, 0) * 4);
  const ax = corner & 1 ? x1 - 2 : x0 + 1, ay = corner & 2 ? y1 - 2 : y0 + 1;   // la esquina de la L
  const panel = (xa: number, ya: number, xb: number, yb: number) => {
    for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++) for (let y = Math.min(ya, yb); y <= Math.max(ya, yb); y++) {
      for (let z = 0; z < MAMPARA_H; z++) {
        const end = x === Math.min(xa, xb) || x === Math.max(xa, xb) || y === Math.min(ya, yb) || y === Math.max(ya, yb);
        const top = z === MAMPARA_H - 1, base = z < 2, post = end && (xa === xb ? y === ya || y === yb : x === xa || x === xb);
        const val = top ? v(M.metal, 4) : base ? v(M.metal, 0) : post ? v(M.metal, 3) : v(M.cloth, 2 + (noise(x, y, z) > 0.85 ? 1 : 0) + (z > MAMPARA_H / 2 ? 1 : 0));
        model.set(x, y, z, val);
      }
    }
  };
  // El panel a lo largo de x y el que va a lo largo de y, de 2 de grueso, desde la esquina
  const dx = corner & 1 ? -1 : 1, dy = corner & 2 ? -1 : 1;
  panel(ax, ay, ax + dx * 13, ay + dy);
  panel(ax, ay, ax + dx, ay + dy * 13);
};

// Un pilar cuadrado de metal de 11 × 11 con aristas claras, una franja vertical de neón cian en cada cara y un anillo
// de neón rosa arriba
export const neonPillar: PillarBuilder = ({ model, cx, cy, noise }) => {
  const x0 = Math.floor(cx) - 5, x1 = Math.floor(cx) + 5, y0 = Math.floor(cy) - 5, y1 = Math.floor(cy) + 5;
  const mx = Math.floor(cx), my = Math.floor(cy);
  for (let z = 0; z < COLUMN_H; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const edgeX = x === x0 || x === x1, edgeY = y === y0 || y === y1;
    if (!edgeX && !edgeY && z < COLUMN_H - 1) continue;          // hueco por dentro: solo se ve la piel
    let val = v(M.column, edgeX && edgeY ? 3 : z % 8 === 0 ? 1 : 2 + (noise(x, y, z) > 0.92 ? 1 : 0));
    if (z >= 4 && z < COLUMN_H - 6 && ((edgeY && x === mx) || (edgeX && y === my))) val = v(M.neonCyan, 3);
    if (z === COLUMN_H - 5 || z === COLUMN_H - 4) val = v(M.neonPink, 3);
    if (z < 2 || z === COLUMN_H - 1) val = v(M.metal, z === COLUMN_H - 1 ? 3 : 1);
    model.set(x, y, z, val);
  }
};

// La altura del suelo en (x, y): justo encima del vóxel más alto de los primeros (las losas)
function floorTop(world: World, x: number, y: number): number {
  let top = 0;
  for (let z = 0; z < 6; z++) if (world.model.get(x, y, z)) top = z + 1;
  return top;
}

// Un azar propio, de la semilla: no gasta el de la partida
function rng(seed: number): () => number {
  let s = (seed ^ 0x6d2b79f5) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addRamps(world: World, ramps: Array<{ name: string; colors: string[]; material?: string; emissive?: boolean }>): number {
  const m = world.model, base = m.palette.ramps.length;
  // La paleta tiene que ser un objeto NUEVO (NARUTO): el motor la compara por identidad
  m.palette = { ...m.palette, ramps: [...m.palette.ramps, ...ramps] };
  return base;
}

// ¿Se puede tender algo plano en (x, y)? Suelo seco y libre a su altura (ni pared, ni columna, ni mueble, ni agua)
function flat(world: World, x: number, y: number, z: number): boolean {
  if (x < 0 || y < 0 || x >= world.width || y >= world.depth || world.wet[y * world.width + x]) return false;
  return z > 0 && !!world.model.get(x, y, z - 1) && !world.model.get(x, y, z) && floorTop(world, x, y) === z;
}

// Cables por el suelo del cyberpunk (revisión de NARUTO: pocos y largos, de algo a algo): cada uno sale del pie de una
// pared o de un pilar hacia dentro, sigue recto, gira en L una o dos veces y acaba al topar con otra cosa sólida. Solo
// se tiende si es largo (MIN_CABLE); si no, se prueba otro sitio. Gris oscuro casi todos (más claro que el suelo);
// alguno rosa. Devuelve cuántos vóxeles puso (para las pruebas)
const MIN_CABLE = 40;
export function addCables(world: World, seed: number): number {
  const base = addRamps(world, [
    { name: 'cable', colors: ['#1a1a26', '#2a2a3c', '#3c3c56', '#56567a'], material: 'atravesable' },
    { name: 'cable de color', colors: ['#3a1030', '#7a1e5e', '#c0388e', '#f070c0'], material: 'atravesable' },
  ]);
  const r = rng(seed), want = Math.max(3, Math.round((world.width * world.depth) / 30000));
  const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  let placed = 0, laid = 0;
  for (let tries = 0; tries < want * 40 && laid < want; tries++) {
    // Un sitio al azar; de ahí, hacia un lado, hasta el pie de lo primero sólido: ese es el arranque, y se sale al revés
    let x = Math.floor(16 + r() * (world.width - 32)), y = Math.floor(16 + r() * (world.depth - 48));
    const z = floorTop(world, x, y);
    if (!flat(world, x, y, z)) continue;
    let dir = Math.floor(r() * 4);
    while (flat(world, x + DX[dir]!, y + DY[dir]!, z)) { x += DX[dir]!; y += DY[dir]!; }
    dir = (dir + 2) % 4;
    // El trazado: recto, con 1 o 2 giros en L a lo largo del camino, hasta topar
    const path: Array<[number, number]> = [];
    let turns = 1 + Math.floor(r() * 2), nextTurn = 25 + Math.floor(r() * 60);
    while (flat(world, x, y, z) && path.length < 400) {
      path.push([x, y]);
      if (path.length === nextTurn && turns > 0) {
        const side = (dir + (r() < 0.5 ? 1 : 3)) % 4;
        if (flat(world, x + DX[side]!, y + DY[side]!, z)) { dir = side; turns--; nextTurn += 25 + Math.floor(r() * 60); }
      }
      x += DX[dir]!; y += DY[dir]!;
    }
    if (path.length < MIN_CABLE) continue;
    const ramp = base + (r() < 0.25 ? 1 : 0);
    path.forEach(([px, py], s) => world.model.set(px, py, z, v(ramp, s % 9 === 0 ? 3 : 2)));
    placed += path.length;
    laid++;
  }
  return placed;
}

// Los charcos del mundo (lo mojado al empezar), como listas de celdas, en orden fijo
function puddles(world: World): number[][] {
  const W = world.width, seen = new Uint8Array(world.wet.length), out: number[][] = [];
  for (let i = 0; i < world.wet.length; i++) {
    if (!world.wet[i] || seen[i]) continue;
    const cells: number[] = [], stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      cells.push(c);
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < world.wet.length && world.wet[n] && !seen[n] && Math.abs((n % W) - (c % W)) <= 1) { seen[n] = 1; stack.push(n); }
    }
    out.push(cells.sort((a, b) => a - b));
  }
  return out;
}

// Una taza tumbada (4 de largo, 3 de alto) con asa, en (x, y) a la altura z, a lo largo de x (dir 1 o -1): por la
// boca, el café
function stampCup(world: World, ramp: number, coffee: number, x: number, y: number, z: number, dir: number): void {
  const m = world.model;
  for (let i = 0; i < 4; i++) for (const [dy, dz] of [[-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, 2]] as const) {
    const mouth = i === 3 && dy === 0 && dz === 1;
    m.set(x + dir * i, y + dy, z + dz, mouth ? coffee : v(ramp, dz === 2 ? 3 : dz === 1 ? 2 : 1));
  }
  m.set(x + dir, y + 2, z, v(ramp, 2));
  m.set(x + dir * 2, y + 2, z, v(ramp, 2));
}

// Junto a cada charco de café de la oficina, una o dos tazas tumbadas en el suelo seco del borde. Devuelve cuántas
export function addCups(world: World, seed: number): number {
  const base = addRamps(world, [
    { name: 'taza blanca', colors: ['#6e6e78', '#a4a4ae', '#d0d0d8', '#f2f2f8'], material: 'atravesable' },
    { name: 'taza roja', colors: ['#4a1418', '#7e2228', '#b03a3a', '#d86a5e'], material: 'atravesable' },
  ]);
  const coffee = v(M.water, 1);
  const r = rng(seed ^ 0x2c1b3c6d), W = world.width;
  let cups = 0;
  for (const cells of puddles(world)) {
    // Las celdas secas del borde con sitio para la taza (todo plano a su alrededor)
    const spots: Array<[number, number, number, number]> = [];
    for (const c of cells) {
      const x = c % W, y = Math.floor(c / W);
      for (const dir of [1, -1]) {
        const sx = x + dir * 2, z = floorTop(world, sx, y);
        let ok = true;
        for (let i = 0; i < 4 && ok; i++) for (let dy = -1; dy <= 2 && ok; dy++) if (!flat(world, sx + dir * i, y + dy, z)) ok = false;
        if (ok) spots.push([sx, y, z, dir]);
      }
    }
    if (!spots.length) continue;
    const n = cells.length > 200 && spots.length > 20 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const [x, y, z, dir] = spots[Math.floor(r() * spots.length)]!;
      if (!flat(world, x, y, z)) continue;
      stampCup(world, base + (r() < 0.35 ? 1 : 0), coffee, x, y, z, dir);
      cups++;
    }
  }
  return cups;
}

// Una luz verde sobre cada charco tóxico del cyberpunk que sea grande: el líquido brilla solo, y así alumbra alrededor
export function addToxicGlow(world: World): number {
  const W = world.width;
  let n = 0;
  for (const cells of puddles(world)) {
    if (cells.length < 120) continue;
    let sx = 0, sy = 0;
    for (const c of cells) { sx += c % W; sy += Math.floor(c / W); }
    world.lights.push({ id: `toxico-${n++}`, kind: 'lantern', x: sx / cells.length + 0.5, y: sy / cells.length + 0.5, z: 6, color: [0.35, 1, 0.45], intensity: 0.7, radius: 56 });
  }
  return n;
}
