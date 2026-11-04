import { defineLevel } from '../../../../game/brotato/api';
import { DEFAULT_WORLD_RAMPS, worldPalette } from '@voxpix/world/build';
import { SAMPLE_PIECES } from '@voxpix/samples/pieces';
import { mamparaPillar } from '../../../../game/brotato/sim/decor';
import type { LevelWorld } from '../../../../game/brotato/sim/arena';
import { decorateOficina, oficinaFacade, oficinaFloor, withOficinaRamps } from './look';

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
  // Calibración por mundo (MAIA, 2026-10-27). Con 512 semillas (65-576) la oficina llegaba a 7,29 contra 7,63 del
  // medieval y 7,99 del cyberpunk. El daño de contacto se redondea a entero y los enemigos comunes ganan 0,54 por
  // oleada, así que el factor va a saltos: de 1 a 0,93 la partida es idéntica (7,29) y de 0,92 a 0,85 llega a 7,90.
  // 0,9 queda a mitad de ese escalón. Escala el contacto y el proyectil del escupidor, que dispara con su contactDamage.
  enemyDamageScale: 0.9,
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
// La paleta sale de los temas de muestra de VoxPix (samples/themes), con las rampas propias de look.ts detrás; el suelo,
// la fachada y el decorado son los de look.ts. Va aparte del default porque lleva funciones (las piezas), que el
// esquema del nivel no valida; lo lee sim/arena.ts (levelWorld)
export const world: LevelWorld = {
  look: { palette: withOficinaRamps(worldPalette({
    floor: ['#22262e', '#323844', '#464e5e', '#5e687c', '#76829a'],
    wall: ['#262a2e', '#3a4046', '#545c64', '#788088', '#98a0a8'],
    cap: ['#2c2a2a', '#403e3e', '#5c5a58', '#827e7a', '#a29e98'],
    column: ['#343234', '#525052', '#6e6c6c', '#8a8886', '#aaa8a4'],
    // Los charcos son café derramado (Andrés, 2026-10-26), opaco; y la tela de las mamparas, azul gris de oficina
    water: ['#160a04', '#2a160a', '#43260f', '#6a4424', '#c8a070'],   // arriba, la crema (NARUTO: que no parezca tierra)
    cloth: ['#5c5a5e', '#76747a', '#908e96', '#aaa8b0', '#c6c4cc'],
    // Los muebles se empujan (Andrés, 2026-10-27): el peso sale de estas densidades (kg/m³). Macizos de madera, metal y
    // vidrio, un escritorio pesaba 430 kg y una mampara 826; así, unos 55 y 46 (aglomerado, tubo hueco, pantalla plana)
    wood: { colors: DEFAULT_WORLD_RAMPS.wood, props: { density: 150 } },
    metal: { colors: DEFAULT_WORLD_RAMPS.metal, props: { density: 300 } },
    screen: { colors: DEFAULT_WORLD_RAMPS.screen, props: { density: 600 } },
  })), ...SAMPLE_PIECES, floor: oficinaFloor, facade: oficinaFacade, pillar: mamparaPillar, objects: true },
  // Más baja que antes (0,7): los charcos de luz de los tubos y las lámparas tienen que contrastar (MAIA, 2026-11-04)
  ambient: [0.55, 0.57, 0.64] as const,
  // Su suelo, su fachada y lo que pone por el suelo (look.ts, NARUTO 2026-11-04)
  decorate: (w, seed, layout, at) => ({ ...decorateOficina(w, seed, layout, at) }),
};
