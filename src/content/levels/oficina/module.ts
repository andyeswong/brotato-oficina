import { defineLevel } from '@engine/api';
import sheetPng from './oficina.png';
import sheetJson from './oficina.json';

// Oficina de noche: losetas, escritorios con pantalla y apliques junto a las puertas (arte de NARUTO,
// arte/escenarios/oficina).
// La hoja junta suelo y muros: python3 scripts/merge-sheets.py <tema>_nivel.png <tema>_muros.png oficina.png
export default defineLevel({
  format: 1,
  id: 'oficina',
  name: 'La oficina',
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
      material: 'clip-suelto_idle',
      piso: 'piso_idle',
      'piso-gastado': 'piso-gastado_idle',
      'piso-raspon': 'piso-raspon_idle',
      'piso-mancha': 'piso-mancha_idle',
      'piso-papel': 'piso-papel_idle',
      'escritorio-pc': 'escritorio-pc_idle',
      'escritorio-laptop': 'escritorio-laptop_idle',
      'muro-tapa': 'muro-tapa_idle',
      'muro-tapa-rejilla': 'muro-tapa-rejilla_idle',
      'muro-liso': 'muro-liso_idle',
      'muro-ventana': 'muro-ventana_idle',
      'muro-ventana-noche': 'muro-ventana-noche_idle',
      'muro-ventana-persiana': 'muro-ventana-persiana_idle',
      'muro-cartelera': 'muro-cartelera_idle',
      'muro-grafica': 'muro-grafica_idle',
      'muro-reloj': 'muro-reloj_idle',
      'muro-extintor': 'muro-extintor_idle',
      'muro-puerta': 'muro-puerta_idle',
      'muro-aplique': 'muro-aplique_idle',
    },
  },
  // Un mapa distinto en cada partida, sacado de su semilla (src/engine/worldgen)
  generator: {
    floors: [{ anim: 'piso', weight: 12 }, { anim: 'piso-gastado', weight: 3 }, { anim: 'piso-raspon', weight: 2 }, { anim: 'piso-mancha', weight: 1 }, { anim: 'piso-papel', weight: 1 }],
    caps: ['muro-tapa', 'muro-tapa-rejilla'],
    facade: {
      fill: [{ anim: 'muro-liso', weight: 4 }, { anim: 'muro-ventana', weight: 3 }, { anim: 'muro-ventana-persiana', weight: 2 }, { anim: 'muro-ventana-noche', weight: 1 }, { anim: 'muro-cartelera', weight: 1 }, { anim: 'muro-grafica', weight: 1 }, { anim: 'muro-reloj', weight: 0.5 }, { anim: 'muro-extintor', weight: 0.7 }],
      neutral: 'muro-liso',
      door: 'muro-puerta',
      flank: 'muro-aplique',
      emits: { 'muro-aplique': 'lamp' },
    },
    // Solo charcos: lo que hace el agua al jugar (frenar, bloquear) está por decidir y, hasta entonces, es decorado.
    // Un lago o un océano que se cruzan andando engañan.
    water: { puddles: 4 },
    pillars: 3,
    pillar: { top: '#aab2c2', topDim: '#969eae', lit: '#8a94a6', mid: '#6e7a8d', dark: '#4a5263', joint: '#343a48' },
    // Escritorios de huella 2x1 (el monitor sobresale por arriba), casi todos contra la pared: sueltos no dejan sitio
    // para que salgan enemigos (lo comprueba test/worldgen.test.ts). Su pantalla es una fuente de luz.
    props: [
      { anim: 'escritorio-pc', w: 2, h: 1, count: 3, emits: 'screen', edge: true },
      { anim: 'escritorio-laptop', w: 2, h: 1, count: 2, emits: 'screen', edge: true },
      { anim: 'escritorio-pc', w: 2, h: 1, count: 1, emits: 'screen' },
    ],
  },
  // Las luces salen de las piezas que emiten (fachada y muebles). softGlow: lo que pasa de 1 se mide en
  // luminancia y sin trama, así las intensidades de noche no dejan bordes de color ni puntos sueltos.
  light: {
    ambient: [0.7, 0.72, 0.8],
    shade: { steps: 8, softGlow: true },
  },
});
