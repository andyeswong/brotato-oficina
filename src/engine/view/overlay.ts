// Capas HTML encima del canvas. Solo para lo que NO es juego: errores de contenido, pausa y la
// etiqueta de depuración. Lo que se juega se dibuja en el canvas lógico.

function layer(id: string, css: string): HTMLElement {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText = css;
    document.body.appendChild(el);
  }
  return el;
}

export function showContentErrors(text: string): void {
  const el = layer('content-errors', 'position:fixed;inset:0;overflow:auto;background:#1a0d12;color:#ffd7de;'
    + 'font:14px/1.5 ui-monospace,monospace;padding:24px;white-space:pre-wrap;z-index:20');
  el.textContent = text;
}

export function setPaused(paused: boolean): void {
  const el = layer('pause', 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;'
    + 'background:rgba(0,0,0,.55);color:#fff;font:600 20px system-ui,sans-serif;z-index:10;pointer-events:none');
  el.textContent = 'Pausa — vuelve a la ventana para seguir';
  el.style.display = paused ? 'flex' : 'none';
}

export function setDebug(text: string | null): void {
  const el = layer('debug', 'position:fixed;left:4px;bottom:4px;color:#9f9;background:rgba(0,0,0,.6);'
    + 'font:12px ui-monospace,monospace;padding:2px 6px;z-index:5;pointer-events:none');
  el.style.display = text === null ? 'none' : 'block';
  if (text !== null) el.textContent = text;
}
