# VoxPix

Herramienta propia de vóxeles a pixel art (NARUTO, 2026-10-24). No es un clon de SpriteStack Studio: toma lo
que funciona y corrige sus fallos (análisis en ProjectHub, memoria `spritestack-analisis`; proyecto
"Motor voxel a pixel art (personajes) — NARUTO").

- `src/core/`: núcleo sin dependencias (paleta por rampas, modelo disperso, herramientas, render por software,
  historial por diferencias). Lo usan la CLI y la app por igual.
- `src/cli/main.ts`: `npx tsx src/cli/main.ts render <modelo.json|sample> <salida.png> [--yaw --elev --turn --scale --size --origin --outline --bg]`
- `app/`: editor en Vue 3 + Vite (`npm run dev`, `npm run build` -> `app/dist`).
- `test/`: `npm test` (determinismo, pivote fijo, paleta cerrada, historial).

Render: cámara ortográfica, 1 vóxel = 1 píxel, pivote (pies) siempre en el mismo píxel, luz fija en pantalla
arriba-izquierda con sombra en la MISMA dirección, sombreado moviendo el tono dentro de la rampa (solo colores
de la paleta), oclusión ambiental y contorno exterior/interior.

## Integración con pxl

[pxl](https://github.com/crsolver/claude-pxl) (MIT) va en `vendor/pxl`, fijado al commit `21fee41`. Se carga con el alias
`pxl-core` (Vite, Vitest y `tsconfig.runtime.json` para la CLI). Para el chequeo de tipos se usa
`vendor/pxl-core.d.ts`, porque el código de pxl no pasa nuestro `noUncheckedIndexedAccess`. El puente está en
`src/pxl/bridge.ts`.

- Importar (`npm run voxpix -- import-pxl arte.px.js <sprite|-> modelo.json`, o el botón "pxl ↓" de la app):
  trae la paleta con sus rampas y un sprite como plano de vóxeles, de frente o como una capa.
- Exportar (`npm run voxpix -- export-pxl modelo.json salida.px.js --turn 8`, o el botón "pxl ↑"): escribe
  pal + ramps + un sprite por ángulo + una hoja. Después `node vendor/pxl/bin/pxl.js build salida.px.js`.
  La prueba de ida y vuelta comprueba que lo que construye pxl es idéntico al render.
- Iconos de la interfaz: `app/icons/icons.px.js`, dibujados con pxl. `npm run icons` los reconstruye y los
  copia a `app/src/assets/ui/` (la hoja de iconos y los marcos 9-slice de los botones).
