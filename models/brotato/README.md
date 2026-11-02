# Modelos del juego

Cada `.json` de esta carpeta es un modelo de vóxeles de VoxPix que sale de su fuente por capas: el
`<grupo>_capas.px.js` de su carpeta, importado con `import-pxl --stack` de VoxPix. Ninguno se hace a mano.

- `<id>.json` sale de la pila `<id>`. Los bichos llevan el prefijo en el archivo: `bicho-clip.json` sale de la pila `clip`.
- Si una carpeta tiene dos fuentes (armas y enemigos de un tema), la pila está en una sola de ellas.
- La cabecera de cada `_capas.px.js` dice qué es cada pila y cómo se importa.

Para regenerarlos o comprobarlos:

```sh
bun run models                 # regenera todos los .json desde sus capas
bun run models:check           # los importa aparte y comprueba que salen idénticos a los de aquí
node scripts/import-models.mjs items efectos   # solo esas carpetas
```

Usa la CLI de VoxPix instalada (`node_modules/voxpix`, el commit fijado en `package.json`). Para probar con otro VoxPix,
por ejemplo uno local con cambios sin publicar: `VOXPIX=/ruta/a/voxpix bun run models:check`.

Se importa con `--strict`: si un sprite dibuja fuera de su lienzo, pxl descarta esos píxeles sin avisar y el modelo
pierde vóxeles, así que el script se para y dice qué sprite y dónde.

Las fuentes pueden modelar con el global `vox` que pone VoxPix al importar (mapas `"x,y,z"` -> tecla con `set`, `shift`,
`rotate`, `toneUp`, `layers`...; ver `src/pxl/voxmap.ts` de VoxPix). `armas-futuro/armas_capas.px.js` es el ejemplo.
