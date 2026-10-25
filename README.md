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
- `?camara=clasica|cenital|baja|cerca` elige la cámara (también en la selección, con C o tocando la línea). Son presets fijos:
  la inclinación del suelo (0,5, 1 o 0,35) y el zoom (Cerca, una escala más). La interfaz no cambia de tamaño.
- `?contorno=exterior|exterior-negro|interior|interior-negro|entidades|no` elige el contorno.
- `?ir=tienda|fin` simula sin entrada hasta la primera tienda o hasta el final.
- Para medir (fase 4): `?ola=N` empieza en la oleada N, e `?inmortal` hace que MAIA no caiga. El número de enemigos
  vivos sale en `data-enemigos` del `body`.

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
