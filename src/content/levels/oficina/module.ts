import { defineLevel } from '@engine/api';
import sheetPng from './oficina.png';
import sheetJson from './oficina.json';

export default defineLevel({
  format: 1,
  id: 'oficina',
  name: 'La oficina',
  // Mundo a escala 216/384: la arena es algo más que una pantalla y media en cada eje
  arena: { width: 512, height: 512 },
  spawn: { minDistance: 52, edgeMargin: 10, ringRadius: 96, clusterSpread: 32 },
  // F1: 10 oleadas
  // Los precios suben un 20 % por oleada superada: con 10 % sobraban ~200 materiales en la 7 (CURVA-F1.md)
  shop: { priceScale: { perWave: 0.2 } },
  waves: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10'],
  sprites: {
    image: sheetPng,
    atlas: sheetJson,
    anims: {
      material: 'clip-suelto_idle',
      floor: 'piso_idle',
      'floor-worn': 'piso-gastado_idle',
      'floor-scratch': 'piso-raspon_idle',
    },
  },
  // Cada loseta del suelo sale al azar con este peso (siempre igual para el mismo nivel)
  floor: [
    { anim: 'floor', weight: 14 },
    { anim: 'floor-worn', weight: 2 },
    { anim: 'floor-scratch', weight: 1 },
  ],
  // Charcos de goteras: una fila por cada 16 px, '~' agua. Solo charcos (de 1 a 4 losetas), que se pisan:
  // los lagos esperan a que el agua frene o bloquee en la simulación.
  terrain: {
    water: [
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '........................~~......',
      '................................',
      '......~~........................',
      '......~.........................',
      '................................',
      '................................',
      '................................',
      '...................~~...........',
      '....................~...........',
      '................................',
      '................................',
      '................................',
      '....~...........................',
      '....~...........................',
      '................................',
      '................................',
      '................................',
      '..........................~.....',
      '................................',
      '..........~~....................',
      '..........~~....................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  // Luz de oficina: ambiente algo frío y lámparas del techo cálidas; la de arriba a la derecha falla.
  // Ambiente + intensidad no pasa de 1: si pasa, la capa que suma lava al personaje y deja borde de color.
  light: {
    ambient: [0.72, 0.74, 0.84],
    lights: [
      { x: 256, y: 256, radius: 110, color: [1, 0.92, 0.75], intensity: 0.32 },
      { x: 112, y: 112, radius: 100, color: [1, 0.92, 0.75], intensity: 0.32 },
      { x: 400, y: 112, radius: 100, color: [1, 0.92, 0.75], intensity: 0.32, flicker: { amount: 0.35, speed: 6, seed: 7 } },
      { x: 112, y: 400, radius: 100, color: [1, 0.92, 0.75], intensity: 0.32 },
      { x: 400, y: 400, radius: 100, color: [1, 0.92, 0.75], intensity: 0.32 },
    ],
  },
});
