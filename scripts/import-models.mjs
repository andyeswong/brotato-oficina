#!/usr/bin/env node
// El origen reproducible de cada modelo del juego (regla de MAIA, 2026-10-25): todo .json de models/brotato sale de su
// fuente por capas (<carpeta>/*_capas.px.js) con el importador de VoxPix, import-pxl --stack. Nada se hace a mano.
//
//   node scripts/import-models.mjs            regenera todos los .json desde sus capas
//   node scripts/import-models.mjs --check    los importa aparte y comprueba que salen idénticos a los del repo
//   node scripts/import-models.mjs items      solo una carpeta (o varias)
//
// Cada .json es una pila de capas: <id>.json sale de la pila <id>, salvo los bichos, cuyo archivo lleva el prefijo
// (bicho-clip.json sale de la pila clip). Lo dice también la cabecera de cada _capas.px.js. Si una carpeta tiene
// varias fuentes (armas y enemigos de un tema), la pila sale de la única que la contiene; si está en dos, es un error.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const MODELS = join(ROOT, 'models/brotato');
// VOXPIX: un clon de VoxPix en el commit fijado. Hace falta mientras su CLI no corra instalada como dependencia (tsx no
// aplica el alias pxl-core de su tsconfig a archivos dentro de node_modules)
const VOXPIX = process.env.VOXPIX ? resolve(process.env.VOXPIX) : join(ROOT, 'node_modules/voxpix');
const args = process.argv.slice(2);
const check = args.includes('--check');
const only = args.filter((a) => !a.startsWith('--'));
const stackOf = (dir, id) => (dir.startsWith('bicho-') ? id.replace(/^bicho-/, '') : id);

const tmp = check ? mkdtempSync(join(tmpdir(), 'import-models-')) : null;
let n = 0;
const differ = [];
try {
  for (const dir of readdirSync(MODELS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    if (only.length && !only.includes(dir)) continue;
    const here = join(MODELS, dir);
    const sources = readdirSync(here).filter((f) => f.endsWith('_capas.px.js')).sort();
    if (!sources.length) throw new Error(`${dir}: no hay ningún _capas.px.js`);
    for (const file of readdirSync(here).filter((f) => f.endsWith('.json')).sort()) {
      const id = basename(file, '.json');
      const out = check ? join(tmp, `${dir}-${file}`) : join(here, file);
      const ok = sources.filter((src) => {
        try {
          execFileSync('npx', ['tsx', '--tsconfig', join(VOXPIX, 'tsconfig.runtime.json'), join(VOXPIX, 'src/cli/main.ts'),
            'import-pxl', src, '--stack', stackOf(dir, id), out], { cwd: here, stdio: ['ignore', 'ignore', sources.length > 1 ? 'ignore' : 'inherit'] });
          return true;
        } catch { return false; }
      });
      if (ok.length !== 1) throw new Error(`${dir}/${file}: la pila ${stackOf(dir, id)} sale de ${ok.length} fuentes (${ok.join(', ') || 'ninguna'})`);
      n++;
      if (check && !readFileSync(out).equals(readFileSync(join(here, file)))) differ.push(`${dir}/${file}`);
    }
  }
} finally {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
if (check) {
  console.log(`${n} modelos importados desde sus capas; ${differ.length ? `distintos del repo: ${differ.join(', ')}` : 'todos idénticos a los del repo'}`);
  process.exit(differ.length ? 1 : 0);
}
console.log(`${n} modelos regenerados desde sus capas`);
