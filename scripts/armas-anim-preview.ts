// Las armas de los tres mundos disparando o golpeando con sus poses de VoxPix (<id>-anim0..3, de armas_capas.px.js),
// vistas de lado con la cámara oblicua del juego, para revisar:
//   armas_anim_x5.gif: una fila por mundo, una columna por arma; quieta, los cuatro cuadros y de vuelta a quieta
//   armas_anim_x5.png: la lámina, por arma una fila con quieta + los cuatro cuadros
//   bunx tsx --tsconfig tsconfig.runtime.json scripts/armas-anim-preview.ts <carpeta>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Model, render, type ModelFile } from '@voxpix/core';
import { encodePNG, onBackground } from '@voxpix/core/png';
import { encodeGIF } from './lib/gif';

const outDir = process.argv[2] ?? 'out';
const BG: [number, number, number] = [74, 78, 92];
const W = 64, H = 44, OX = 40, OY = 30;
const YAW = 90;   // de lado, la punta a la derecha
const WORLDS: [string, string[]][] = [
  ['armas-futuro', ['pistola', 'subfusil', 'abanico', 'perforador', 'hoja', 'barrido']],
  ['medieval', ['tiro', 'rafaga', 'abanico', 'perforador', 'estocada', 'barrido']],
  ['cyberpunk', ['tiro', 'rafaga', 'abanico', 'perforador', 'estocada', 'barrido']],
];

const load = (dir: string, id: string) =>
  Model.fromJSON(JSON.parse(readFileSync(`models/brotato/${dir}/${id}.json`, 'utf8')) as ModelFile);
const cell = (m: Model) =>
  render(m, { width: W, height: H, originX: OX, originY: OY, pivot: [0.5, 0, 0], yaw: YAW, oblique: { y: 0.5, z: 1 }, flat: true,
    outline: 'outer', outlineColor: '#0d0c12' }).rgba;

function blit(dst: Uint8ClampedArray, dw: number, src: Uint8ClampedArray, dx: number, dy: number): void {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y * W + x) * 4;
    if (src[s + 3]) dst.set(src.subarray(s, s + 4), ((dy + y) * dw + dx + x) * 4);
  }
}

const rows = WORLDS.map(([dir, ids]) => ids.map((id) => [load(dir, id), ...[0, 1, 2, 3].map((i) => load(dir, `${id}-anim${i}`))].map(cell)));
mkdirSync(outDir, { recursive: true });

// Lámina: 18 filas (arma) x 5 columnas (quieta + cuadros)
const flat = rows.flat();
const SW = 5 * W, SH = flat.length * H;
const sheet = new Uint8ClampedArray(SW * SH * 4);
flat.forEach((cells, r) => cells.forEach((c, i) => blit(sheet, SW, c, i * W, r * H)));
writeFileSync(`${outDir}/armas_anim_x5.png`, encodePNG(SW, SH, onBackground(sheet, BG), 5));

// GIF: quieta 400 ms, cada cuadro 70 ms, y quieta otra vez
const STEP = 70;
const seq = [0, 0, 0, 0, 0, 0, 1, 2, 3, 4];
const GW = 6 * W, GH = rows.length * H;
const anim = seq.map((f) => {
  const img = new Uint8ClampedArray(GW * GH * 4);
  rows.forEach((cells, r) => cells.forEach((c, col) => blit(img, GW, c[f]!, col * W, r * H)));
  return onBackground(img, BG);
});
writeFileSync(`${outDir}/armas_anim_x5.gif`, encodeGIF(GW, GH, anim, STEP, 5));
console.log(`${outDir}: armas_anim_x5.gif y .png (${flat.length} armas, ${seq.length} pasos de ${STEP} ms)`);
