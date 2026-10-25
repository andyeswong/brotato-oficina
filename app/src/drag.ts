// Ventanas flotantes que se mueven (v-draggable="'nombre'"): se arrastran por su cabecera (<header>), sin salirse de
// la ventana; la posición se recuerda (localStorage) y un doble clic en la cabecera las devuelve a su sitio.
import type { Directive } from 'vue';

const KEY = (name: string) => `voxpix.ventana.${name}`;
const MARGIN = 8;
// La ventana que se toca pasa al frente (por encima también de las píldoras de arriba, que van a z 5)
let front = 6;

function place(el: HTMLElement, left: number, top: number): void {
  const r = el.getBoundingClientRect();
  const x = Math.max(MARGIN, Math.min(innerWidth - r.width - MARGIN, left));
  const y = Math.max(MARGIN, Math.min(innerHeight - Math.min(r.height, 60) - MARGIN, top));
  Object.assign(el.style, { left: `${x}px`, top: `${y}px`, right: 'auto', bottom: 'auto', transform: 'none' });
}

function load(name: string): { left: number; top: number } | null {
  try { const v = localStorage.getItem(KEY(name)); return v ? JSON.parse(v) : null; } catch { return null; }
}
function store(name: string, pos: { left: number; top: number } | null): void {
  try { if (pos) localStorage.setItem(KEY(name), JSON.stringify(pos)); else localStorage.removeItem(KEY(name)); } catch { /* sin almacenamiento */ }
}

export const vDraggable: Directive<HTMLElement & { _dragOff?: () => void }, string> = {
  mounted(el, binding) {
    const name = binding.value;
    const saved = load(name);
    if (saved) requestAnimationFrame(() => place(el, saved.left, saved.top));
    let start: { x: number; y: number; left: number; top: number } | null = null;
    const handle = () => el.querySelector('header') as HTMLElement | null;

    const down = (e: MouseEvent) => {
      el.style.zIndex = String(++front);
      const h = handle();
      if (e.button !== 0 || !h || !h.contains(e.target as Node) || (e.target as HTMLElement).closest('button, input, select, label')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
      el.classList.add('dragging');
    };
    const move = (e: MouseEvent) => { if (start) place(el, start.left + e.clientX - start.x, start.top + e.clientY - start.y); };
    const up = () => {
      if (!start) return;
      start = null;
      el.classList.remove('dragging');
      const r = el.getBoundingClientRect();
      store(name, { left: r.left, top: r.top });
    };
    // Doble clic en la cabecera: a su sitio de siempre (el que da el CSS)
    const reset = (e: MouseEvent) => {
      const h = handle();
      if (!h || !h.contains(e.target as Node) || (e.target as HTMLElement).closest('button, input, select, label')) return;
      Object.assign(el.style, { left: '', top: '', right: '', bottom: '', transform: '' });
      store(name, null);
    };
    // Si la ventana del navegador encoge, que no se quede fuera
    const resize = () => { if (load(name)) { const r = el.getBoundingClientRect(); place(el, r.left, r.top); } };

    el.addEventListener('mousedown', down);
    el.addEventListener('dblclick', reset);
    addEventListener('mousemove', move);
    addEventListener('mouseup', up);
    addEventListener('resize', resize);
    el._dragOff = () => {
      el.removeEventListener('mousedown', down);
      el.removeEventListener('dblclick', reset);
      removeEventListener('mousemove', move);
      removeEventListener('mouseup', up);
      removeEventListener('resize', resize);
    };
  },
  unmounted(el) { el._dragOff?.(); },
};
