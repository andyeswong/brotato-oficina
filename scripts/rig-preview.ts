// Los bichos del Brotato andando con su rig (src/anim/rigs-brotato.ts), con la cámara del juego, para revisar:
//   bichos_anim_x6.png: por bicho, 4 vistas (frente, derecha, espalda, izquierda) x sus cuadros
//   bichos_anim_x6.gif: los 3 bichos en las 4 vistas, animados (cada uno a su ritmo, en un ciclo común)
//   npx tsx --tsconfig tsconfig.runtime.json scripts/rig-preview.ts <carpeta> [--contorno]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Model, render, type ModelFile } from '../src/core';
import { encodePNG, onBackground } from '../src/core/png';
import { rigFrames } from '../src/anim/rig';
import { BROTATO_RIGS } from '../src/anim/rigs-brotato';
import { encodeGIF } from './lib/gif';

const outDir = process.argv[2] ?? 'out';
const outline = process.argv.includes('--contorno');
const BG: [number, number, number] = [74, 78, 92];
const W = 28, H = 26, OX = 14, OY = 20;
const VIEWS = [0, 90, 180, 270];

const cell = (m: Model, yaw: number) =>
  render(m, { width: W, height: H, originX: OX, originY: OY, pivot: [0.5, 0, 0], yaw, oblique: { y: 0.5, z: 1 }, flat: true,
    outline: outline ? 'outer' : 'none', ...(outline ? { outlineColor: '#0d0c12' } : {}) }).rgba;

const bugs = Object.entries(BROTATO_RIGS).map(([name, rig]) => {
  const base = Model.fromJSON(JSON.parse(readFileSync(`models/brotato/${name}/${name}.json`, 'utf8')) as ModelFile);
  return { name, rig, base, frames: rigFrames(base, rig) };
});

function blit(dst: Uint8ClampedArray, dw: number, src: Uint8ClampedArray, dx: number, dy: number): void {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const s = (y * W + x) * 4;
    if (src[s + 3]) dst.set(src.subarray(s, s + 4), ((dy + y) * dw + dx + x) * 4);
  }
}

mkdirSync(outDir, { recursive: true });
// Lámina: por bicho, 4 filas (vistas); columnas: quieto + cuadros
const cols = 1 + Math.max(...bugs.map((b) => b.frames.length));
const SW = cols * W, SH = bugs.length * VIEWS.length * H;
const sheet = new Uint8ClampedArray(SW * SH * 4);
bugs.forEach((b, bi) => VIEWS.forEach((yaw, vi) => {
  const row = (bi * VIEWS.length + vi) * H;
  blit(sheet, SW, cell(b.base, yaw), 0, row);
  b.frames.forEach((f, i) => blit(sheet, SW, cell(f, yaw), (i + 1) * W, row));
}));
const suffix = outline ? '_contorno' : '';
writeFileSync(`${outDir}/bichos_anim${suffix}_x6.png`, encodePNG(SW, SH, onBackground(sheet, BG), 6));

// GIF: una fila por bicho, 4 vistas; 20 ms por paso y cada bicho cambia de cuadro a su ritmo
const STEP = 20, TOTAL = 960;
const GW = VIEWS.length * W, GH = bugs.length * H;
const anim: Uint8ClampedArray[] = [];
for (let t = 0; t < TOTAL; t += STEP) {
  const img = new Uint8ClampedArray(GW * GH * 4);
  bugs.forEach((b, bi) => {
    const f = b.frames[Math.floor(t / b.rig.frameMs) % b.frames.length]!;
    VIEWS.forEach((yaw, vi) => blit(img, GW, cell(f, yaw), vi * W, bi * H));
  });
  anim.push(onBackground(img, BG));
}
writeFileSync(`${outDir}/bichos_anim${suffix}_x6.gif`, encodeGIF(GW, GH, anim, STEP, 6));
console.log(`${outDir}: bichos_anim${suffix}_x6.png y .gif (${bugs.map((b) => `${b.name} ${b.frames.length} cuadros`).join(', ')})`);
