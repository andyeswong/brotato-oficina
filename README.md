# Brotato de la oficina

Un arena-shooter de oleadas al estilo de Brotato, con MAIA y los bichos de material de oficina, sobre el motor de
vóxeles [VoxPix](https://github.com/andyeswong/voxpix). El juego se ve en 2.5D: el escenario, los personajes, los
enemigos y las armas son modelos de vóxeles, y la composición va por GPU, o por CPU en modo de bajo detalle.

La primera versión, en Phaser, está en la etiqueta `phaser-final`.

## Arrancar

```sh
npm install
npm test             # simulación, contenido, pantallas, efectos y rigs
npm run typecheck
npm run dev          # http://localhost:5191/juego.html
npm run build        # app/dist
```

Parámetros de `juego.html`:

- `?seed=N` fija la partida y salta la selección. El mundo sale de la semilla.
- `?nivel=oficina|medieval|cyberpunk` fuerza el tema.
- `?ruta=cpu` compone en la CPU.
- `?contorno=exterior|exterior-negro|interior|interior-negro|entidades|no` elige el contorno.
- `?ir=tienda|fin` simula sin entrada hasta la primera tienda o hasta el final.

## El motor

VoxPix es una dependencia (`"voxpix": "github:andyeswong/voxpix#<commit>"` en `package.json`, fijada a un commit) y
se importa como `@voxpix/...`. El alias apunta a su `src`
en TypeScript, sin compilar, y está en `tsconfig.json`, `vitest.config.ts` y `app/vite.config.ts`. Lo que el juego
necesita del motor (prewarm, tinte de entidades, el tick fijo...) se añade a VoxPix como función general, no aquí.

## Dónde está cada cosa

- `src/game/brotato/sim`: la simulación, determinista. Mundo, partida, tienda, rng y huella.
- `src/game/brotato/registry`: el contenido como módulos validados con zod.
- `src/content/brotato`: el contenido (personajes, enemigos, armas, objetos, oleadas, niveles).
- `src/game/brotato/play.ts`: la partida reflejada en el mundo de VoxPix, con una entidad por cosa visible.
- `src/game/brotato/ui`: las pantallas (tienda, selección, fin, HUD) y los efectos, como funciones puras sobre un Painter.
- `app/src/juego`: la vista (cámara, compositor, entrada, lienzos).
- `models/brotato`: los modelos de vóxeles del juego. `src/anim/rigs-brotato.ts`: el andar de los bichos.

Mientras el repo de VoxPix sea privado, `npm install` necesita acceso a GitHub. En una máquina sin él, pero con un clon
de VoxPix en ese commit, se puede redirigir solo para la instalación, sin tocar la configuración de git:

```sh
GIT_CONFIG_COUNT=2 \
  GIT_CONFIG_KEY_0=url./ruta/a/voxpix.insteadOf GIT_CONFIG_VALUE_0=ssh://git@github.com/andyeswong/voxpix.git \
  GIT_CONFIG_KEY_1=url./ruta/a/voxpix.insteadOf GIT_CONFIG_VALUE_1=https://github.com/andyeswong/voxpix.git \
  npm install
```
