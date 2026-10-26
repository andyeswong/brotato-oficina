import { defineLevel } from '../../../../game/brotato/api';
import { worldPalette, type WorldLook } from '@voxpix/world/build';
import { SAMPLE_PIECES } from '@voxpix/samples/pieces';
import { mamparaPillar } from '../../../../game/brotato/sim/decor';

// Oficina de noche: losetas, escritorios con pantalla y apliques junto a las puertas (arte de NARUTO,
// arte/escenarios/oficina).
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
  theme: 'oficina',
  waves: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10'],
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
    // Escritorios de huella 2x1 (el monitor sobresale por arriba), todos contra la pared. Son el único tema con
    // muebles y cuestan oleadas: paran los disparos y quitan sitio para huir. Medido con 64 semillas (curva F1,
    // 2026-10-23): con 6 (uno suelto) la oficina llegaba a 6,61 y el medieval a 7,61; sin escritorios, 7,66;
    // con 4 o 5 contra la pared, ~6,8; con estos 3, 7,44. MAIA: el tema no debe pesar más de media oleada.
    props: [
      { anim: 'escritorio-pc', w: 2, h: 1, count: 2, emits: 'screen', edge: true },
      { anim: 'escritorio-laptop', w: 2, h: 1, count: 1, emits: 'screen', edge: true },
    ],
  },
});

// El mundo de vóxeles del nivel (VoxPix 857c33d): cómo se ve (WorldLook: paleta, fuente, piezas) y su luz ambiente.
// Copia de los temas de muestra de VoxPix (samples/themes) tal como estaban: el aspecto no cambia. Va aparte del
// default porque lleva funciones (las piezas), que el esquema del nivel no valida; lo lee sim/arena.ts (levelWorld)
export const world: { look: WorldLook; ambient: readonly [number, number, number] } = {
  look: { palette: worldPalette({
    floor: ['#22262e', '#323844', '#464e5e', '#5e687c', '#76829a'],
    wall: ['#262a2e', '#3a4046', '#545c64', '#788088', '#98a0a8'],
    cap: ['#2c2a2a', '#403e3e', '#5c5a58', '#827e7a', '#a29e98'],
    column: ['#343234', '#525052', '#6e6c6c', '#8a8886', '#aaa8a4'],
    // Los charcos son café derramado (Andrés, 2026-10-26), opaco; y la tela de las mamparas, azul gris de oficina
    water: ['#160a04', '#2a160a', '#43260f', '#603a1a', '#8a5a30'],
    cloth: ['#1c2636', '#2a384e', '#3a4e68', '#506884', '#6a84a2'],
  }), ...SAMPLE_PIECES, pillar: mamparaPillar },
  ambient: [0.7, 0.72, 0.8] as const,
};
