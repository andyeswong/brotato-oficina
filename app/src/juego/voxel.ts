// El modo vóxel del juego: herramienta de desarrollo (Andrés, 2026-10-26). Solo con ?dev en la URL; V pausa la partida
// y enseña el MISMO estado del mundo con frame3D de VoxPix (el modo vóxel de su laboratorio): arrastrar gira,
// la rueda acerca, WASD/flechas mueven la vista (no a MAIA), R vuelve a MAIA y V o Esc vuelven a la partida.
// No sale en la ayuda ni tiene botón táctil. Pinta con la CPU (8-10 fps): es para mirar, no para jugar.
import { frame3D } from '@voxpix/world/frame3d';
import type { WorldState } from '@voxpix/world/state';

const PAN_SPEED = 90;          // vóxeles por segundo al mover la vista
const REDRAW_S = 0.15;         // sin cambios, se repinta a pocos Hz (el agua y las luces se mueven)

export interface VoxelLook {
  ambient: readonly [number, number, number];
  outline: 'none' | 'outer' | 'both';
  outlineColor?: string;
}

export class VoxelInspector {
  on = false;
  yaw = -30;
  elevation = 35;
  zoom = 3;
  center: [number, number] = [0, 0];
  readonly canvas = document.createElement('canvas');
  private readonly g = this.canvas.getContext('2d')!;
  private dirty = true;
  private lastDraw = -Infinity;
  private drag: [number, number] | null = null;

  constructor() {
    const c = this.canvas;
    c.style.display = 'none';
    c.style.zIndex = '10';
    c.style.imageRendering = 'pixelated';
    c.style.touchAction = 'none';
    document.body.appendChild(c);
    c.addEventListener('mousedown', (e) => { this.drag = [e.clientX, e.clientY]; });
    addEventListener('mouseup', () => { this.drag = null; });
    addEventListener('mousemove', (e) => {
      if (!this.drag || !this.on) return;
      this.yaw = Math.round(this.yaw + (e.clientX - this.drag[0]) * 0.5);
      this.elevation = Math.max(5, Math.min(89, Math.round(this.elevation + (e.clientY - this.drag[1]) * 0.3)));
      this.drag = [e.clientX, e.clientY];
      this.dirty = true;
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(1, Math.min(8, this.zoom + (e.deltaY < 0 ? 1 : -1)));
      this.dirty = true;
    }, { passive: false });
  }

  // Entra mirando a MAIA (o sale)
  toggle(at: { x: number; y: number }): void {
    this.on = !this.on;
    this.canvas.style.display = this.on ? '' : 'none';
    if (this.on) this.lookAt(at);
  }

  lookAt(at: { x: number; y: number }): void {
    this.center = [at.x, at.y];
    this.dirty = true;
  }

  // Mismo sitio y tamaño que el lienzo del mundo
  place(like: HTMLCanvasElement, w: number, h: number): void {
    const c = this.canvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; this.dirty = true; }
    for (const k of ['position', 'margin', 'left', 'top', 'width', 'height'] as const) c.style[k] = like.style[k];
  }

  // La vista se mueve según la pantalla (arriba = alejarse de la cámara), girada con el giro de la vista
  pan(dx: number, dy: number, dt: number): void {
    if (!dx && !dy) return;
    const r = (this.yaw * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    const step = PAN_SPEED * dt;
    this.center = [this.center[0] + (dx * c + dy * s) * step, this.center[1] + (-dx * s + dy * c) * step];
    this.dirty = true;
  }

  frame(state: WorldState, time: number, look: VoxelLook): void {
    if (!this.on || (!this.dirty && time - this.lastDraw < REDRAW_S)) return;
    const { width, height } = this.canvas;
    // El recorte alrededor del centro crece al alejar la cámara, para que la vista no se quede corta
    const radius = Math.max(48, Math.min(200, Math.ceil(width / this.zoom)));
    const center: [number, number] = [Math.round(this.center[0]), Math.round(this.center[1])];
    const out = frame3D(state, { width, height, center, radius, yaw: this.yaw, elevation: this.elevation, zoom: this.zoom, time, lights: true, ...look });
    this.g.putImageData(new ImageData(out as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
    this.g.font = '8px monospace';
    this.g.fillStyle = '#ffd08a';
    this.g.fillText(`vóxel · pausa · ${this.yaw}° ${this.elevation}° x${this.zoom}`, 3, 9);
    this.dirty = false;
    this.lastDraw = time;
  }
}
