// Charcos en mancha redonda (NARUTO, 2026-11-04; MAIA: "los rectángulos duros son lo más feo", y luego "siguen
// pareciendo barras"). El generador los hace de losetas enteras, rectángulos y a veces barras de una loseta de ancho;
// aquí cada charco se queda en una elipse poco alargada dentro de su caja, con el borde mordido por un ruido suave. Solo se
// QUITA agua, nunca se añade (acordado con FERN: cambia por dónde se frena, y él recalibra la oficina y el cyberpunk;
// el medieval no lo usa). Va en el decorate del nivel, antes de que exista el agua del estado: la celda que se seca
// pierde su cuenca, se rellena de suelo hasta z = 0 y su losa es la que diga `floor`.
import { M, worldNoise, type World } from '@voxpix/world/build';
import { material } from '@voxpix/core';

const BITE = 3.2;        // lo más que se come el borde
const STRETCH = 1.5;     // lo más alargada que queda la mancha: su eje largo, como mucho 1,5 veces el corto (más 4)
const SHRINK = 0.86;     // la elipse, un poco dentro de la caja del charco
const CORE = 0.7;        // lo hondo, otra elipse concéntrica a esta escala (MAIA: "parecen montículos")

// floor(x, y): la losa de suelo seco que va en (x, y, 0). Devuelve cuántas celdas se secaron
export function roundPuddles(world: World, seed: number, floor: (x: number, y: number) => number): number {
  const W = world.width, D = world.depth, wet = world.wet, m = world.model;
  const seen = new Uint8Array(W * D);
  let dried = 0;
  for (let i0 = 0; i0 < wet.length; i0++) {
    if (!wet[i0] || seen[i0]) continue;
    // El charco: sus celdas y su caja
    const cells: number[] = [], stack = [i0];
    seen[i0] = 1;
    let x0 = W, y0 = D, x1 = -1, y1 = -1;
    while (stack.length) {
      const c = stack.pop()!, cx = c % W, cy = (c - cx) / W;
      cells.push(c);
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < wet.length && wet[n] && !seen[n] && Math.abs((n % W) - cx) <= 1) { seen[n] = 1; stack.push(n); }
    }
    // La distancia de cada celda a la orilla (BFS desde las celdas que tocan seco), para morder el borde
    const dist = new Map<number, number>(), queue: number[] = [];
    const inP = new Set(cells);
    for (const c of cells) {
      const cx = c % W;
      if ([c - 1, c + 1, c - W, c + W].some((n, k) => !inP.has(n) || (k < 2 && Math.abs((n % W) - cx) > 1))) { dist.set(c, 0); queue.push(c); }
    }
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h]!, d = dist.get(c)!;
      for (const n of [c - 1, c + 1, c - W, c + W]) if (inP.has(n) && !dist.has(n)) { dist.set(n, d + 1); queue.push(n); }
    }
    // La elipse: centrada en el centroide del charco, con el eje corto el de la caja y el largo recortado a STRETCH
    // veces el corto, y algo más pequeña que la caja (SHRINK): si la tocara, ese lado quedaría recto (MAIA: "base plana")
    let mx = 0, my = 0;
    for (const c of cells) { mx += (c % W) + 0.5; my += Math.floor(c / W) + 0.5; }
    mx /= cells.length; my /= cells.length;
    const hw = Math.min(mx - x0, x1 + 1 - mx), hh = Math.min(my - y0, y1 + 1 - my);
    const short = Math.min(hw, hh), long = Math.min(Math.max(hw, hh), short * STRETCH + 4);
    const ex = (hw >= hh ? long : short) * SHRINK, ey = (hw >= hh ? short : long) * SHRINK;
    // Cuánto de la elipse ocupa la celda: 1 en el borde (con su ondulación), 0 en el centro
    const reach = (c: number) => {
      const cx = c % W, cy = (c - cx) / W;
      const wob = 0.92 + 0.08 * Math.sin(Math.atan2(cy + 0.5 - my, cx + 0.5 - mx) * 3 + seed % 7);
      return Math.sqrt(((cx + 0.5 - mx) / ex) ** 2 + ((cy + 0.5 - my) / ey) ** 2) / wob;
    };
    const keep = (c: number) => {
      const cx = c % W, cy = (c - cx) / W;
      if (reach(c) > 1) return false;
      // El borde, mordido con un ruido suave (de 6 en 6 vóxeles, interpolado)
      const fx = cx / 6, fy = cy / 6, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const n = (a: number, b: number) => worldNoise(a, b, 77, seed);
      const top = n(ix, iy) * (1 - tx) + n(ix + 1, iy) * tx, bot = n(ix, iy + 1) * (1 - tx) + n(ix + 1, iy + 1) * tx;
      return dist.get(c)! >= Math.floor((top * (1 - ty) + bot * ty) * BITE);
    };
    // Si se fuera a quedar en casi nada, se deja como estaba
    const drop = cells.filter((c) => !keep(c));
    if (drop.length > cells.length * 0.9) continue;
    for (const c of drop) {
      const x = c % W, y = (c - x) / W;
      wet[c] = 0;
      world.waterTop[c] = 0;
      for (let z = m.zMin; z < 0; z++) if (!m.get(x, y, z)) m.set(x, y, z, material(M.floor, (z & 1) === 0 ? 0 : 1));
      m.set(x, y, 0, floor(x, y));
      dried++;
    }
    // Lo hondo era la cuenca del generador, que no está centrada en la mancha: llegaba hasta un borde y dejaba orilla
    // somera solo en el otro, y la mancha se leía como un montículo de base plana. Fuera de la elipse de dentro el
    // fondo sube al de la orilla, con su losa en z = -1 (agua de 1 de hondo, que frena igual que la de 2): solo se quita agua
    for (const c of cells) {
      if (!wet[c] || reach(c) <= CORE) continue;
      const x = c % W, y = (c - x) / W;
      if (m.floorAt(x, y) >= 0) continue;
      for (let z = m.zMin; z < -1; z++) if (!m.get(x, y, z)) m.set(x, y, z, material(M.floor, (z & 1) === 0 ? 0 : 1));
      m.set(x, y, -1, floor(x, y));
    }
  }
  return dried;
}
