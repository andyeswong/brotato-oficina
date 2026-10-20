// Scroll de la cámara: centrada en el jugador pero sin enseñar nada fuera de la arena.
// Si la arena es más pequeña que lo visible en un eje, se centra en ese eje. Todo en enteros:
// se parte de la posición YA redondeada del jugador, así no vuelve el temblor de 1 px.
export function cameraScroll(
  target: { x: number; y: number },   // punto a centrar, ya redondeado
  view: { width: number; height: number },
  arena: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: axis(target.x, view.width, arena.width),
    y: axis(target.y, view.height, arena.height),
  };
}

function axis(target: number, view: number, arena: number): number {
  if (arena <= view) return Math.floor((arena - view) / 2);
  const scroll = target - Math.floor(view / 2);
  return Math.min(Math.max(scroll, 0), arena - view);
}
