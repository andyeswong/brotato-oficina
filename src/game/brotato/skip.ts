// El salto de ?ir= (verify, capturas y medidas): simula sin entrada hasta un punto de la partida, saliendo de cada tienda
// sin comprar. MAIA no cae mientras dura el salto (quieta, en algunas semillas caía en la oleada 1 antes de la tienda:
// verify de la tienda y la medida de la caída en el Flip) y vuelve a poder caer al llegar
import { BrotatoGame, placeAtShop } from './play';

export type SkipTarget = 'tienda' | 'limpia' | 'salida' | 'piso2' | 'fin';
export interface SkipResult { reached: boolean; phase: BrotatoGame['phase'] }

const MAX_TICKS = 60 * 60 * 30;

export function skipTo(g: BrotatoGame, target: string): SkipResult {
  // Salvo ?ir=fin: la pantalla del fin llega con MAIA cayendo; inmortal tendría que ganar las 10 oleadas quieta, y
  // verify se quedaba sin tiempo (2026-10-27)
  g.guarded = target !== 'fin';
  try {
    for (let t = 0; t < MAX_TICKS; t++) {
      if (target === 'tienda' && g.phase === 'shop') return { reached: true, phase: g.phase };
      if (target === 'limpia' && g.phase === 'wave' && g.current.status === 'open') return { reached: true, phase: g.phase };
      // Los pisos: con la salida abierta (tras la primera tienda), o ya en el segundo piso
      if (target === 'salida' && g.phase === 'wave' && g.current.status === 'exit') return { reached: true, phase: g.phase };
      if (target === 'piso2' && g.run.floor >= 1) return { reached: true, phase: g.phase };
      if (g.phase === 'dead' || g.phase === 'victory') return { reached: target === 'fin', phase: g.phase };
      if (g.phase === 'shop') g.leaveShop();
      // El piso nuevo se hornea al volver al bucle (aquí no se pinta nada)
      if (g.awaitingFloor) g.floorReady();
      // Con la salida abierta, MAIA salta a ella (salvo si se pidió verla)
      const exit = g.run.arena.exit;
      if (g.current.status === 'exit' && exit && target !== 'salida') Object.assign(g.current.player, { x: exit.x, y: exit.y });
      // Con la oleada limpia, MAIA salta junto a la entrada de la tienda y entra
      const open = g.current.status === 'open';
      if (open) placeAtShop(g.current.player, g.run.arena.shop);
      g.step({ dx: 0, dy: 0, stomp: false, interact: open });
    }
    return { reached: false, phase: g.phase };
  } finally {
    g.guarded = false;
  }
}
