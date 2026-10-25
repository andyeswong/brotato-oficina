// VISTA (NARUTO): quién compone el cuadro del modo 2D. La GPU (WebGL2) si la hay; si no, la CPU (frame2D, el mismo
// cálculo y su oráculo), y lo dice en la consola: nunca pantalla negra.
//
// Si la GPU pierde el contexto (en el móvil pasa al ir a segundo plano), mientras tanto pinta la CPU en un lienzo 2D
// que ocupa el sitio del de WebGL; cuando el contexto vuelve, la GPU se rehace, lo sube todo de nuevo desde el Baked
// y su lienzo vuelve a su sitio. Si no vuelve, se queda la CPU.
import { frame2D, type Frame2DOptions } from '../world/frame2d';
import type { Baked } from '../world/bake';
import type { WorldState } from '../world/state';
import { GpuCompositor } from './gpu/compositor';

export interface CompositorStats {
  frameMs: number;             // lo que tardó frame() en el hilo principal (en la GPU: preparar y subir, no dibujar)
  uploadMs: number;            // de eso, las subidas a la GPU (texturas del horneado, agua, entidades, luces)
}

export interface Compositor {
  readonly kind: 'gpu' | 'cpu';
  // El lienzo donde pinta ahora (cambia si la GPU pierde el contexto o no arranca después de pedirlo)
  readonly canvas: HTMLCanvasElement;
  readonly stats: CompositorStats;
  frame(state: WorldState, b: Baked, o: Frame2DOptions): void;
}

export function createCompositor(canvas: HTMLCanvasElement, opts: { prefer?: 'gpu' | 'cpu' } = {}): Compositor {
  const prefer = opts.prefer ?? 'gpu';
  const gpu = prefer === 'gpu' ? GpuCompositor.create(canvas) : null;
  if (gpu) console.info('[voxpix] cuadro compuesto en la GPU (WebGL2)');
  else if (prefer === 'gpu') console.warn('[voxpix] sin WebGL2 (o sin EXT_color_buffer_float): el cuadro se compone en la CPU');
  else console.info('[voxpix] cuadro compuesto en la CPU (pedido)');
  return gpu ? new GpuPath(canvas, gpu) : new CpuPath(canvas);
}

// La CPU pinta en un lienzo 2D. Si el que le dan ya tiene un contexto WebGL, pinta en uno nuevo que ocupa su sitio.
class CpuPath implements Compositor {
  readonly kind = 'cpu' as const;
  readonly canvas: HTMLCanvasElement;
  readonly stats: CompositorStats = { frameMs: 0, uploadMs: 0 };
  private readonly g: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    let g = canvas.getContext('2d');
    if (!g) {
      const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      canvas = fresh;
      g = canvas.getContext('2d')!;
    }
    this.canvas = canvas;
    this.g = g;
  }

  frame(s: WorldState, b: Baked, o: Frame2DOptions): void {
    const t0 = performance.now();
    const c = this.canvas;
    if (c.width !== o.vw || c.height !== o.vh) { c.width = o.vw; c.height = o.vh; }
    this.g.putImageData(new ImageData(frame2D(s, b, o) as Uint8ClampedArray<ArrayBuffer>, o.vw, o.vh), 0, 0);
    this.stats.frameMs = performance.now() - t0;
  }
}

class GpuPath implements Compositor {
  private gpu: GpuCompositor | null;
  private cpu: CpuPath | null = null;          // mientras no hay contexto
  private readonly glCanvas: HTMLCanvasElement;
  readonly stats: CompositorStats = { frameMs: 0, uploadMs: 0 };

  constructor(canvas: HTMLCanvasElement, gpu: GpuCompositor) {
    this.glCanvas = canvas;
    this.gpu = gpu;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();                       // sin esto el navegador no lo devuelve nunca
      console.warn('[voxpix] la GPU perdió el contexto: pinta la CPU mientras tanto');
      this.gpu = null;
      // La CPU necesita un lienzo 2D: uno nuevo en el sitio del de WebGL (que se guarda para cuando vuelva)
      const holder = document.createElement('canvas');
      holder.className = canvas.className;
      holder.style.cssText = canvas.style.cssText;
      holder.id = canvas.id;
      canvas.replaceWith(holder);
      this.cpu = new CpuPath(holder);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      const again = GpuCompositor.create(canvas);
      if (!again) { console.warn('[voxpix] el contexto volvió pero la GPU no arranca: sigue la CPU'); return; }
      console.info('[voxpix] la GPU recuperó el contexto: lo sube todo de nuevo');
      this.gpu = again;
      if (this.cpu) {
        canvas.style.cssText = this.cpu.canvas.style.cssText;
        this.cpu.canvas.replaceWith(canvas);
        this.cpu = null;
      }
    });
  }

  get kind(): 'gpu' | 'cpu' { return this.gpu ? 'gpu' : 'cpu'; }
  get canvas(): HTMLCanvasElement { return this.cpu?.canvas ?? this.glCanvas; }

  frame(s: WorldState, b: Baked, o: Frame2DOptions): void {
    if (this.gpu) {
      const t0 = performance.now();
      this.gpu.frame(s, b, o);
      this.stats.frameMs = performance.now() - t0;
      this.stats.uploadMs = this.gpu.uploadMs;
    } else if (this.cpu) {
      this.cpu.frame(s, b, o);
      this.stats.frameMs = this.cpu.stats.frameMs;
      this.stats.uploadMs = 0;
    }
  }
}
