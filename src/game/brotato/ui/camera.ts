// Las cámaras del juego: unos pocos ajustes fijos (presets), no una cámara libre. Cada uno es una inclinación del suelo
// (la proyección oblicua de VoxPix: 1 = losetas sin acortar, como el Brotato; 0,5 = losetas de 16x8) y una regla de
// píxel (cuánto mundo se ve, ver layout.ts). La simulación es plana: cambiar de cámara solo cambia cómo se ve.
// La inclinación se hornea con el mundo, así que se elige antes de la partida; el zoom se aplica al momento.
import { PIXEL_RULES } from './layout';

export interface CameraPreset {
  id: string;
  name: string;
  incline: number;
  rules: { minShortSide: number; maxVisible: number };
}

export const CAMERAS: readonly CameraPreset[] = [
  { id: 'clasica', name: 'Clásica', incline: 0.5, rules: PIXEL_RULES },
  { id: 'cenital', name: 'Cenital', incline: 1, rules: PIXEL_RULES },
  { id: 'baja', name: 'Baja', incline: 0.35, rules: PIXEL_RULES },
  // Escala un punto más que la clásica: x4 en 1152x648 (288x162), x6 en el Flip abierto (180x288)
  { id: 'cerca', name: 'Cerca', incline: 0.5, rules: { minShortSide: 160, maxVisible: 288 } },
];

export const DEFAULT_CAMERA = CAMERAS[0]!;

export function cameraById(id: string | null | undefined): CameraPreset {
  return CAMERAS.find((c) => c.id === id) ?? DEFAULT_CAMERA;
}

// La siguiente (o la anterior) en la lista, dando la vuelta
export function cycleCamera(current: CameraPreset, delta: number): CameraPreset {
  const i = Math.max(0, CAMERAS.findIndex((c) => c.id === current.id));
  return CAMERAS[(((i + delta) % CAMERAS.length) + CAMERAS.length) % CAMERAS.length]!;
}
