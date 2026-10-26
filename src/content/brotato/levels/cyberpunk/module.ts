import { defineLevel } from '../../../../game/brotato/api';
import { worldPalette, type WorldLook } from '@voxpix/world/build';
import { SAMPLE_PIECES } from '@voxpix/samples/pieces';
import { neonPillar } from '../../../../game/brotato/sim/decor';

// Calle de ciudad de noche: ventanas, tuberías y letreros de neón rosa y cian (arte de NARUTO,
// arte/escenarios/cyberpunk).
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
  theme: 'cyberpunk',
  waves: ['o01', 'o02', 'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10'],
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
  },
});

// El mundo de vóxeles del nivel (VoxPix 857c33d): cómo se ve (WorldLook: paleta, fuente, piezas) y su luz ambiente.
// Copia de los temas de muestra de VoxPix (samples/themes) tal como estaban: el aspecto no cambia. Va aparte del
// default porque lleva funciones (las piezas), que el esquema del nivel no valida; lo lee sim/arena.ts (levelWorld)
export const world: { look: WorldLook; ambient: readonly [number, number, number] } = {
  look: { palette: worldPalette({
    floor: ['#14162a', '#1e2238', '#2a304a', '#3a4262', '#4e5878'],
    wall: ['#181a2a', '#24283e', '#343a56', '#485072', '#606a8e'],
    cap: ['#20223a', '#2e3250', '#40466a', '#565e86', '#7078a0'],
    column: ['#22263a', '#3a4260', '#525c80', '#6e789c', '#8a94b8'],
    // Los charcos, de líquido tóxico verde que brilla solo (Andrés, 2026-10-26: "verde o morado")
    water: { colors: ['#031406', '#08300f', '#125a1e', '#21903a', '#62d878'], emissive: true },
    // Los neones brillan solos: las franjas de los pilares y los letreros de la fachada
    neonPink: { colors: ['#5a1640', '#a02a78', '#e04cb4', '#ff8ad8', '#ffd0f0'], emissive: true },
    neonCyan: { colors: ['#0e3a4a', '#1a7088', '#28b4d0', '#7fe3ff', '#d0f8ff'], emissive: true },
  }), ...SAMPLE_PIECES, pillar: neonPillar },
  ambient: [0.42, 0.46, 0.66] as const,
};
