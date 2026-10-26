import { defineLevel } from '../../../../game/brotato/api';
import { worldPalette, type WorldLook } from '@voxpix/world/build';
import { SAMPLE_PIECES } from '@voxpix/samples/pieces';

// Patio de castillo de noche: antorchas junto a las puertas, estandartes y columnas (arte de NARUTO,
// arte/escenarios/medieval).
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
  theme: 'medieval',
  waves: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10'],
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
  },
});

// El mundo de vóxeles del nivel (VoxPix 857c33d): cómo se ve (WorldLook: paleta, fuente, piezas) y su luz ambiente.
// Copia de los temas de muestra de VoxPix (samples/themes) tal como estaban: el aspecto no cambia. Va aparte del
// default porque lleva funciones (las piezas), que el esquema del nivel no valida; lo lee sim/arena.ts (levelWorld)
export const world: { look: WorldLook; ambient: readonly [number, number, number] } = {
  // Los colores por defecto de VoxPix son los del medieval: piedra, agua azul; con la fuente y las columnas redondas
  look: { palette: worldPalette(), fountain: true, ...SAMPLE_PIECES },
  ambient: [0.4, 0.46, 0.64] as const,
};
