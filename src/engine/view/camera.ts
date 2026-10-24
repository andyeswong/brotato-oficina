// Scroll de la cámara: centrada en el jugador pero sin enseñar nada fuera de la arena.
// Si la arena es más pequeña que lo visible en un eje, se centra en ese eje. Todo en enteros:
// se parte de la posición YA redondeada del jugador, así no vuelve el temblor de 1 px.
// topPad: lo que mide el HUD de arriba. La cámara puede subir eso por encima de la arena, así arriba del todo el
// HUD queda sobre el fondo oscuro y no tapa la pared del norte (con sus antorchas y lámparas).
export function cameraScroll(
  target: { x: number; y: number },   // punto a centrar, ya redondeado
  view: { width: number; height: number },
  arena: { width: number; height: number },
  topPad = 0,
): { x: number; y: number } {
  return {
    x: axis(target.x, view.width, arena.width, 0),
    y: axis(target.y, view.height, arena.height, topPad),
  };
}

function axis(target: number, view: number, arena: number, pad: number): number {
  if (arena + pad <= view) return Math.floor((arena - pad - view) / 2);
  const scroll = target - Math.floor(view / 2);
  return Math.min(Math.max(scroll, 0 - pad), arena - view); // 0 - pad y no -pad: con pad 0 daría -0
}
