// Dónde vive el progreso entre partidas: en el almacenamiento de este navegador (como el sonido y la cámara). Solo la
// vista lo usa; si no hay almacenamiento (ventana privada, capturas) se juega igual, sin guardar.
import { emptyProgress, parseProgress, type Progress } from './upgrades';

export const PROGRESS_KEY = 'brotato-progreso';

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>;

export function loadProgress(store: KeyValue | null): Progress {
  try {
    const raw = store?.getItem(PROGRESS_KEY);
    return raw ? parseProgress(JSON.parse(raw)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(store: KeyValue | null, p: Progress): void {
  try { store?.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch { /* sin almacenamiento: solo esta vez */ }
}
