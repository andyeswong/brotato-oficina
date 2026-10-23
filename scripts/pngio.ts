import { deflateSync, inflateSync } from 'node:zlib';

// Lector y escritor mínimos de PNG de 8 bits (RGB o RGBA, sin entrelazado) para las vistas previas
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;  // RGBA
}

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

export function encodePng(img: Raster, scale = 1): Buffer {
  const w = img.width * scale;
  const h = img.height * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (Math.floor(y / scale) * img.width + Math.floor(x / scale)) * 4;
      const d = y * (w * 4 + 1) + 1 + x * 4;
      raw[d] = img.data[s]!; raw[d + 1] = img.data[s + 1]!; raw[d + 2] = img.data[s + 2]!; raw[d + 3] = img.data[s + 3]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function decodePng(file: Buffer): Raster {
  let pos = 8;
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat: Buffer[] = [];
  while (pos < file.length) {
    const len = file.readUInt32BE(pos);
    const name = file.toString('ascii', pos + 4, pos + 8);
    const body = file.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]!; type = body[9]!; interlace = body[12]!; }
    if (name === 'IDAT') idat.push(body);
    pos += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (type !== 6 && type !== 2)) throw new Error(`PNG no soportado: profundidad ${depth}, tipo ${type}, entrelazado ${interlace}`);
  const bpp = type === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = new Uint8ClampedArray(width * height * 4);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = new Uint8Array(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp]! : 0;
      const b = prev[i]!;
      const c = i >= bpp ? prev[i - bpp]! : 0;
      let add = 0;
      if (filter === 1) add = a;
      else if (filter === 2) add = b;
      else if (filter === 3) add = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = (line[i]! + add) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * bpp]!; out[o + 1] = line[x * bpp + 1]!; out[o + 2] = line[x * bpp + 2]!;
      out[o + 3] = type === 6 ? line[x * bpp + 3]! : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

// Recorte de una imagen
export function crop(img: Raster, x: number, y: number, w: number, h: number): Raster {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) data.set(img.data.subarray(((y + j) * img.width + x) * 4, ((y + j) * img.width + x + w) * 4), j * w * 4);
  return { width: w, height: h, data };
}
