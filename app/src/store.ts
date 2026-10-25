import { reactive, shallowRef, ref } from 'vue';
import { Model, History, material, type ModelFile } from '@core/index';
import { sampleScene } from '../../src/samples/basic';

// Estado del editor. El modelo es mutable y no reactivo (es un Map grande); cada cambio sube `version` y
// los componentes que dibujan escuchan ese número.

export type Tool = 'pen' | 'erase' | 'paint' | 'pick' | 'light' | 'fluid';
export type LightKind = 'torch' | 'lamp' | 'brazier' | 'neon-pink' | 'neon-cyan' | 'screen';

export const model = shallowRef<Model>(sampleScene());
export const history = shallowRef(new History(model.value));
export const version = ref(0);

export const editor = reactive({
  tool: 'pen' as Tool,
  ramp: 0,
  tone: 2,
  z: 0,
  mirrorX: false,
  mirrorAxis: 0,               // espejo respecto al centro del vóxel x = mirrorAxis
  grid: { minX: -20, maxX: 19, minY: -10, maxY: 9 },
  view: { yaw: 0, elevation: 30, outline: 'outer' as 'none' | 'outer' | 'both', scale: 8, turn: 8 },
  mode: 'layers' as 'layers' | 'voxel3d',                    // cómo se edita: por capas o sobre el modelo en 3D
  view3d: { yaw: -30, elevation: 35, zoom: 12, panX: 0, panY: 0 },   // pan: desplazamiento de la vista en píxeles
  // Fuentes de luz de la escena, en el ESPACIO DEL MODELO (celda x, y, z): el render las interpreta en 2.5D.
  // Solo afectan a la vista previa iluminada; no cambian los vóxeles ni la paleta. Se guardan con el modelo.
  light: {
    enabled: false,
    ambient: 0.45,
    kind: 'torch' as LightKind,
    sources: [] as LightSource3D[],
  },
});

// Lo de la interfaz que no es del modelo: qué paneles flotantes están abiertos y la celda bajo el cursor
export const ui = reactive({
  layersOpen: true,
  previewOpen: true,
  paletteOpen: false,
  menu: '' as '' | 'archivo' | 'exportar',
  cursor: null as [number, number, number] | null,
  renderMs: 0,
});

export interface LightSource3D { id: string; kind: LightKind; x: number; y: number; z: number }

let lightIds = 0;
export function lightAtCell(x: number, y: number, z: number): number {
  return editor.light.sources.findIndex((l) => l.x === x && l.y === y && l.z === z);
}
// Pone una fuente en la celda, o la quita si ya hay una
export function toggleLight(x: number, y: number, z: number): void {
  const i = lightAtCell(x, y, z);
  if (i >= 0) editor.light.sources.splice(i, 1);
  else editor.light.sources.push({ id: `luz-${Date.now().toString(36)}-${++lightIds}`, kind: editor.light.kind, x, y, z });
  editor.light.enabled = true;
}

export const currentMaterial = () => material(editor.ramp, editor.tone);

export function touch(): void {
  version.value++;
}

export function replaceModel(m: Model): void {
  model.value = m;
  history.value = new History(m);
  const b = m.bounds();
  if (b) {
    editor.z = Math.max(0, Math.min(editor.z, b.maxZ));
    editor.grid = {
      minX: Math.min(-20, b.minX - 2), maxX: Math.max(19, b.maxX + 2),
      minY: Math.min(-10, b.minY - 2), maxY: Math.max(9, b.maxY + 2),
    };
  }
  touch();
}

// Pinta un vóxel (y su espejo si está activo) dentro del paso abierto del historial
export function paint(x: number, y: number, z: number, value: number): void {
  const h = history.value;
  h.set(x, y, z, value);
  if (editor.mirrorX) h.set(2 * editor.mirrorAxis - x, y, z, value);
}

export function loadFile(f: ModelFile & { lights?: LightSource3D[] }): void {
  replaceModel(Model.fromJSON(f));
  editor.light.sources.splice(0, editor.light.sources.length, ...(f.lights ?? []));
}

export function newModel(): void {
  replaceModel(new Model(model.value.palette, 'nuevo'));
}

// Estado inicial desde la URL (para enlazar una vista o probar sin clics):
//   ?modo=voxel3d  ·  ?luz=torch:-8,-4,10;neon-cyan:12,2,6 (celdas x,y,z)  ·  ?ambiente=0.4  ·  ?giro=30
{
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  if (q.get('modo') === 'voxel3d') editor.mode = 'voxel3d';
  const luz = q.get('luz');
  if (luz) {
    editor.light.enabled = true;
    for (const part of luz.split(';')) {
      const [kind, xy] = part.split(':');
      const [x, y, z] = (xy ?? '').split(',').map(Number);
      if (kind && [x, y, z].every(Number.isFinite)) { editor.light.kind = kind as LightKind; toggleLight(x!, y!, z!); }
    }
  }
  if (q.get('ambiente')) editor.light.ambient = Number(q.get('ambiente'));
  if (q.get('giro')) editor.view.yaw = Number(q.get('giro'));
  if (q.get('herramienta')) editor.tool = q.get('herramienta') as Tool;
}
