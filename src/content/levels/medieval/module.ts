import { defineLevel } from '@engine/api';
import sheetPng from './medieval.png';
import sheetJson from './medieval.json';

// Patio de castillo de noche: antorchas junto a las puertas, estandartes y columnas (arte de NARUTO,
// arte/escenarios/medieval).
// La hoja junta suelo y muros: python3 scripts/merge-sheets.py <tema>_nivel.png <tema>_muros.png medieval.png
export default defineLevel({
  format: 1,
  id: 'medieval',
  name: 'El castillo',
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
      material: 'moneda_idle',
      piso: 'piso_idle',
      'piso-gastado': 'piso-gastado_idle',
      'piso-grieta': 'piso-grieta_idle',
      'piso-hierba': 'piso-hierba_idle',
      'piso-charco': 'piso-charco_idle',
      'piso-paja': 'piso-paja_idle',
      'muro-tapa': 'muro-tapa_idle',
      'muro-almena': 'muro-almena_idle',
      'muro-liso': 'muro-liso_idle',
      'muro-tronera': 'muro-tronera_idle',
      'muro-ventana-arco': 'muro-ventana-arco_idle',
      'muro-ventana-oscura': 'muro-ventana-oscura_idle',
      'muro-antorcha': 'muro-antorcha_idle',
      'muro-estandarte': 'muro-estandarte_idle',
      'muro-puerta': 'muro-puerta_idle',
      'muro-escudo': 'muro-escudo_idle',
      'muro-hiedra': 'muro-hiedra_idle',
    },
  },
  // Un mapa distinto en cada partida, sacado de su semilla (src/engine/worldgen)
  generator: {
    floors: [{ anim: 'piso', weight: 12 }, { anim: 'piso-gastado', weight: 3 }, { anim: 'piso-grieta', weight: 2 }, { anim: 'piso-hierba', weight: 2 }, { anim: 'piso-paja', weight: 1.5 }],
    caps: ['muro-almena', 'muro-tapa'],
    facade: {
      fill: [{ anim: 'muro-liso', weight: 4 }, { anim: 'muro-ventana-arco', weight: 3 }, { anim: 'muro-ventana-oscura', weight: 2 }, { anim: 'muro-tronera', weight: 2 }, { anim: 'muro-hiedra', weight: 1.5 }],
      neutral: 'muro-liso',
      door: 'muro-puerta',
      flank: 'muro-antorcha',
      banner: 'muro-estandarte',
      crest: 'muro-escudo',
      emits: { 'muro-antorcha': 'torch' },
    },
    // Solo charcos: lo que hace el agua al jugar (frenar, bloquear) está por decidir y, hasta entonces, es decorado.
    // Un lago o un océano que se cruzan andando engañan.
    water: { puddles: 5 },
    pillars: 8,
    pillar: { top: '#9e927c', topDim: '#8a7e6a', lit: '#7c7160', mid: '#62594b', dark: '#403930', joint: '#302a23' },
  },
  // Las luces salen de las piezas que emiten (fachada y muebles). softGlow: lo que pasa de 1 se mide en
  // luminancia y sin trama, así las intensidades de noche no dejan bordes de color ni puntos sueltos.
  light: {
    ambient: [0.4, 0.46, 0.64],
    shade: { steps: 8, softGlow: true },
  },
});
