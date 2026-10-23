import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { analyzeMasses, KIND_BY_ID } from '../src/engine/terrain/regions';
import { TILE, WATER_PALETTES, colorize, depthStep, waterTone } from '../src/engine/terrain/waterTiles';

// Vista previa: PREVIEW=1 npx vitest run scripts/terrain-preview.test.ts  (escribe out/terrain-preview.png)
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(width: number, height: number, rgba: Uint8ClampedArray, scale: number): Buffer {
  const w = width * scale;
  const h = height * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / scale) * width + Math.floor(x / scale)) * 4;
      const d = y * (w * 4 + 1) + 1 + x * 4;
      raw[d] = rgba[s]!; raw[d + 1] = rgba[s + 1]!; raw[d + 2] = rgba[s + 2]!; raw[d + 3] = rgba[s + 3]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

describe.runIf(process.env.PREVIEW)('vista previa del agua', () => {
  it('dibuja un mapa con océano, lago con isla, charcos y río', () => {
    const W = 44;
    const H = 26;
    const water = new Uint8Array(W * H);
    const ellipse = (cx: number, cy: number, rx: number, ry: number) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) water[y * W + x] = 1;
    };
    ellipse(-2, 13, 11, 17);                       // océano que sale por el borde izquierdo
    ellipse(26, 8, 7, 4.5);                        // lago
    for (let y = 7; y <= 9; y++) for (let x = 25; x <= 27; x++) water[y * W + x] = 0;   // isla del lago
    for (const [x, y] of [[20, 20], [21, 20], [22, 20], [21, 21]]) water[y! * W + x!] = 1;   // charco de 4
    water[22 * W + 30] = 1;                        // charquito de 1
    water[23 * W + 35] = 1; water[24 * W + 36] = 1;   // dos celdas solo en diagonal
    for (let i = 0; i < 14; i++) water[(14 + Math.floor(i / 3)) * W + 14 + i] = 1;      // río estrecho en escalera
    for (let x = 14; x < 28; x++) water[(15 + Math.floor((x - 14) / 3)) * W + x] = 1;
    const r = analyzeMasses(W, H, (x, y) => water[y * W + x] === 1, { edgeIsMember: true });

    // Suelo plano (el de verdad es el adoquín del juego); solo hace falta para ver la orilla
    const out = new Uint8ClampedArray(W * TILE * H * TILE * 4);
    for (let i = 0; i < W * TILE * H * TILE; i++) {
      const n = (i * 2654435761) >>> 0;
      const g = 0x46 + ((n >>> 13) % 7);
      out[i * 4] = g; out[i * 4 + 1] = g - 8; out[i * 4 + 2] = g - 20; out[i * 4 + 3] = 255;
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = y * W + x;
        if (r.region[c]! < 0) continue;
        const kind = KIND_BY_ID[r.kind[c]!]!;
        if (kind === 'none') continue;
        const rgba = colorize(waterTone(r.variant[c]!), WATER_PALETTES[kind], depthStep(r.depth[c]!));
        for (let ty = 0; ty < TILE; ty++) for (let tx = 0; tx < TILE; tx++) {
          const s = (ty * TILE + tx) * 4;
          if (rgba[s + 3] === 0) continue;
          const d = ((y * TILE + ty) * W * TILE + x * TILE + tx) * 4;
          out[d] = rgba[s]!; out[d + 1] = rgba[s + 1]!; out[d + 2] = rgba[s + 2]!; out[d + 3] = 255;
        }
      }
    }
    mkdirSync('out', { recursive: true });
    writeFileSync('out/terrain-preview.png', png(W * TILE, H * TILE, out, 2));
    const sizes = r.regionSizes.map((n, i) => `${n}:${KIND_BY_ID[r.kind[r.region.indexOf(i)]!]}`);
    console.log('masas (celdas:clase):', sizes.join(' '));
  });
});
