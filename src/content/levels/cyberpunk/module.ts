import { defineLevel } from '@engine/api';
import sheetPng from './cyberpunk.png';
import sheetJson from './cyberpunk.json';

// Calle de ciudad de noche: ventanas, tuberías y letreros de neón rosa y cian (arte de NARUTO,
// arte/escenarios/cyberpunk).
// La hoja junta suelo y muros: python3 scripts/merge-sheets.py <tema>_nivel.png <tema>_muros.png cyberpunk.png
export default defineLevel({
  format: 1,
  id: 'cyberpunk',
  name: 'La ciudad de neón',
  // Mundo a escala 216/384: la arena es algo más que una pantalla y media en cada eje (32x32 celdas de 16 px)
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
      material: 'chip-suelto_idle',
      piso: 'piso_idle',
      'piso-gastado': 'piso-gastado_idle',
      'piso-raspon': 'piso-raspon_idle',
      'piso-charco-cian': 'piso-charco-cian_idle',
      'piso-charco-rosa': 'piso-charco-rosa_idle',
      'piso-rejilla': 'piso-rejilla_idle',
      'piso-neon-rosa': 'piso-neon-rosa_idle',
      'piso-neon-cian': 'piso-neon-cian_idle',
      'muro-tapa': 'muro-tapa_idle',
      'muro-tapa-aviso': 'muro-tapa-aviso_idle',
      'muro-liso': 'muro-liso_idle',
      'muro-ventana': 'muro-ventana_idle',
      'muro-ventana-calida': 'muro-ventana-calida_idle',
      'muro-ventana-cian': 'muro-ventana-cian_idle',
      'muro-ventana-rosa': 'muro-ventana-rosa_idle',
      'muro-rejilla': 'muro-rejilla_idle',
      'muro-tuberia': 'muro-tuberia_idle',
      'muro-puerta': 'muro-puerta_idle',
      'muro-neon-rosa': 'muro-neon-rosa_idle',
      'muro-neon-cian': 'muro-neon-cian_idle',
    },
  },
  // Un mapa distinto en cada partida, sacado de su semilla (src/engine/worldgen)
  generator: {
    floors: [{ anim: 'piso', weight: 12 }, { anim: 'piso-gastado', weight: 3 }, { anim: 'piso-raspon', weight: 2 }, { anim: 'piso-rejilla', weight: 1 }, { anim: 'piso-neon-rosa', weight: 0.4 }, { anim: 'piso-neon-cian', weight: 0.4 }],
    caps: ['muro-tapa', 'muro-tapa-aviso'],
    facade: {
      fill: [{ anim: 'muro-liso', weight: 3 }, { anim: 'muro-ventana', weight: 5 }, { anim: 'muro-ventana-calida', weight: 2 }, { anim: 'muro-ventana-cian', weight: 1.2 }, { anim: 'muro-ventana-rosa', weight: 1.2 }, { anim: 'muro-rejilla', weight: 1.4 }, { anim: 'muro-tuberia', weight: 1.1 }, { anim: 'muro-neon-rosa', weight: 1.4 }, { anim: 'muro-neon-cian', weight: 1.4 }],
      neutral: 'muro-liso',
      door: 'muro-puerta',
      emits: { 'muro-neon-rosa': 'neon-pink', 'muro-neon-cian': 'neon-cyan' },
    },
    // Solo charcos: lo que hace el agua al jugar (frenar, bloquear) está por decidir y, hasta entonces, es decorado.
    // Un lago o un océano que se cruzan andando engañan.
    water: { puddles: 6 },
    pillars: 6,
    pillar: { top: '#76809c', topDim: '#606880', lit: '#525c78', mid: '#3a425c', dark: '#222638', joint: '#161826' },
  },
  // Las luces salen de las piezas que emiten (fachada y muebles). softGlow: lo que pasa de 1 se mide en
  // luminancia y sin trama, así las intensidades de noche no dejan bordes de color ni puntos sueltos.
  light: {
    // Más claro que la noche del medieval: con 0,42 MAIA se perdía en el suelo (MAIA, 2026-10-23)
    ambient: [0.55, 0.58, 0.8],
    shade: { steps: 8, softGlow: true },
  },
});
