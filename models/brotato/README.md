# Modelos del juego

Cada `.json` de esta carpeta es un modelo de vóxeles de VoxPix que sale de su fuente por capas: el
`<grupo>_capas.px.js` de su carpeta, importado con `import-pxl --stack` de VoxPix. Ninguno se hace a mano.

- `<id>.json` sale de la pila `<id>`. Los bichos llevan el prefijo en el archivo: `bicho-clip.json` sale de la pila `clip`.
- Si una carpeta tiene dos fuentes (armas y enemigos de un tema), la pila está en una sola de ellas.
- La cabecera de cada `_capas.px.js` dice qué es cada pila y cómo se importa.

Para regenerarlos o comprobarlos:

```sh
npm run models                 # regenera todos los .json desde sus capas
npm run models:check           # los importa aparte y comprueba que salen idénticos a los de aquí
node scripts/import-models.mjs items efectos   # solo esas carpetas
```

Usa la CLI de VoxPix instalada (`node_modules/voxpix`, el commit fijado en `package.json`). Para probar con otro VoxPix,
por ejemplo uno local con cambios sin publicar: `VOXPIX=/ruta/a/voxpix npm run models:check`.
