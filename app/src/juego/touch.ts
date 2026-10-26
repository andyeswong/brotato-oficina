// El joystick táctil (Andrés, 2026-10-25: "no hay controles touch"). Flotante: nace donde se apoya el dedo (fuera de
// los botones de la interfaz) y la dirección es la del arrastre desde ahí. Se dibuja con dos elementos de la página, no
// en un lienzo: en el Flip abierto el juego es una franja y el pulgar cae a menudo en el negro de debajo.
// Solo da una dirección de pantalla (derecha +x, arriba +y); quien llama la pasa a ejes del mundo como el teclado.

const RADIUS = 44;      // px de CSS: hasta dónde se aleja el pomo del centro
const DEAD = 8;         // px de CSS: menos que esto es no moverse (un toque no debe andar)

export class TouchStick {
  private id: number | null = null;
  private x0 = 0;
  private y0 = 0;
  private x = 0;
  private y = 0;
  private readonly ring: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(parent: HTMLElement = document.body) {
    const base = 'position:fixed;pointer-events:none;display:none;box-sizing:border-box;z-index:5;';
    this.ring = document.createElement('div');
    this.knob = document.createElement('div');
    this.ring.style.cssText = `${base}width:${RADIUS * 2}px;height:${RADIUS * 2}px;border:2px solid;border-radius:50%;background:#0b0a1455;`;
    this.knob.style.cssText = `${base}width:28px;height:28px;border-radius:50%;`;
    parent.append(this.ring, this.knob);
  }

  get active(): boolean {
    return this.id !== null;
  }

  start(e: PointerEvent, accent: string): void {
    if (this.id !== null) return;
    this.id = e.pointerId;
    this.x0 = this.x = e.clientX;
    this.y0 = this.y = e.clientY;
    this.ring.style.borderColor = accent;
    this.knob.style.background = accent;
    this.ring.style.display = this.knob.style.display = 'block';
    this.place();
  }

  move(e: PointerEvent): void {
    if (e.pointerId !== this.id) return;
    this.x = e.clientX;
    this.y = e.clientY;
    this.place();
  }

  end(e?: PointerEvent): void {
    if (e && e.pointerId !== this.id) return;
    this.id = null;
    this.ring.style.display = this.knob.style.display = 'none';
  }

  // La dirección (unitaria) en ejes de pantalla, o null si el dedo no se ha alejado lo bastante
  dir(): { dx: number; dy: number } | null {
    if (this.id === null) return null;
    const dx = this.x - this.x0, dy = this.y0 - this.y, len = Math.hypot(dx, dy);
    return len < DEAD ? null : { dx: dx / len, dy: dy / len };
  }

  private place(): void {
    const dx = this.x - this.x0, dy = this.y - this.y0, len = Math.hypot(dx, dy), k = len > RADIUS ? RADIUS / len : 1;
    this.ring.style.left = `${this.x0 - RADIUS}px`;
    this.ring.style.top = `${this.y0 - RADIUS}px`;
    this.knob.style.left = `${this.x0 + dx * k - 14}px`;
    this.knob.style.top = `${this.y0 + dy * k - 14}px`;
  }
}

// ¿Pantalla táctil? (para enseñar los botones de girar la cámara)
export function isTouch(): boolean {
  return matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}
