// El favicon del juego: la cabeza de MAIA con la cámara de los iconos de la interfaz (app/src/juego/main.ts, iconImage),
// recortada en cuadrado y ampliada a múltiplos enteros (pixel art) hasta 64x64, sobre transparente.
//   bunx tsx --tsconfig tsconfig.json scripts/favicon.ts   ->  app/public/favicon.png
import { readFileSync, writeFileSync } from 'node:fs';
import { Model, render, type ModelFile } from '@voxpix/core';
import { encodePNG } from '@voxpix/core/png';

const OUT = 64, S = 72, INK = '#0d0c12';
const maia = Model.fromJSON(JSON.parse(readFileSync('node_modules/voxpix/models/maia/maia.json', 'utf8')) as ModelFile);
const img = render(maia, { width: S, height: S, originX: S / 2, originY: S - 8, pivot: [0.5, 0, 0], yaw: 0, oblique: { y: 0.5, z: 1 }, flat: true, outline: 'outer', outlineColor: INK });

// Lo que ocupa la figura
let x0 = S, y0 = S, x1 = -1, y1 = -1;
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img.rgba[(y * S + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
if (x1 < 0) throw new Error('MAIA no se ha pintado');

// Un cuadrado desde arriba algo más alto que ancho la figura, centrado: la cabeza entera con la cara (el pelo solo
// llena el cuadrado del ancho y a 16 px quedaba una mancha morada)
const w = x1 - x0 + 1;
const side = Math.min(Math.ceil(w * 1.45), y1 - y0 + 1);
x0 -= Math.floor((side - w) / 2);
const k = Math.max(1, Math.floor(OUT / side));
const ox = Math.floor((OUT - side * k) / 2), oy = Math.floor((OUT - side * k) / 2);
const out = new Uint8ClampedArray(OUT * OUT * 4);
for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
  const sx = x0 + x;
  if (sx < 0 || sx >= S) continue;
  const si = ((y0 + y) * S + sx) * 4;
  if (!img.rgba[si + 3]) continue;
  for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) {
    const di = ((oy + y * k + dy) * OUT + (ox + x * k + dx)) * 4;
    for (let c = 0; c < 4; c++) out[di + c] = img.rgba[si + c]!;
  }
}
writeFileSync('app/public/favicon.png', encodePNG(OUT, OUT, out));
console.log(`favicon.png: ${OUT}x${OUT}, cabeza de ${side}px x${k}`);
