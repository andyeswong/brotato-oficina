import { defineLevel } from '@engine/api';
import sheetPng from './oficina.png';
import sheetJson from './oficina.json';

export default defineLevel({
  format: 1,
  id: 'oficina',
  name: 'La oficina',
  arena: { width: 640, height: 640 },
  // F1: 10 oleadas
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
});
