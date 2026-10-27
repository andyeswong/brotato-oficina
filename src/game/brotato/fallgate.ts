// La vista durante la caída del piso nuevo (sim/dropin.ts). Mientras cae:
//   - los otros 3 giros no se hornean en segundo plano: leerían el mundo a medio montar (las piezas aún no están en los
//     vóxeles) y se quedarían con un piso vacío; se hornean al acabar;
//   - no se gira (no hay giros horneados a los que ir);
//   - al llegar la última pieza, los vóxeles vuelven al mundo y el giro actual se hornea de golpe detrás del letrero
//     (bakeFinal). Por el budget, a 3 ms por cuadro, eran 10-11 s de espera en el Flip con un cuadro de 200 ms
//     (2026-10-27). Las piezas se sueltan y la oleada empieza (floorReady) solo con el budget vacío: nada se hornea con
//     la oleada en marcha.
import { bakeWorld, rebakeChangedJobs, type Baked } from '@voxpix/world/bake';
import { WorldView, type Quarter } from '@voxpix/world/view';
import type { ViewJob } from '@voxpix/view/budget';
import type { WorldState } from '@voxpix/world/state';
import type { BrotatoGame } from './play';

type Game = Pick<BrotatoGame, 'awaitingFloor' | 'floorReady'> & { run: { arena: { fall: unknown; falling: boolean } } };

// El horneado final: el giro q de golpe con el piso ya montado, y lo que aún le quedaría al budget (vacío si el
// horneado está al día)
export function bakeFinal(state: WorldState, q: Quarter, opts: Parameters<typeof bakeWorld>[1], view: ConstructorParameters<typeof WorldView>[2] = {}): { view: WorldView; baked: Baked; left: ViewJob[] } {
  const v = new WorldView(state, q, view);
  const baked = bakeWorld(v.bakeable(), opts);
  return { view: v, baked, left: rebakeChangedJobs(baked, v.lights) };
}

export class FallGate {
  private deferred = false;
  private finishing = false;
  private waiting = false;

  // start: pone en marcha el horneado de los otros 3 giros. finish: hornea el giro actual detrás del letrero (bakeFinal)
  // y llama a done con los trabajos que le quedan al budget
  constructor(private readonly start: () => void, private readonly finish: (done: (pending: number) => void) => void) {}

  // Recién horneado el giro actual del piso: los otros 3 ya, o al acabar la caída. Devuelve si la oleada puede empezar ya
  // (no hay caída)
  baked(g: Game): boolean {
    if (g.run.arena.fall) { this.deferred = true; return false; }
    this.deferred = false;
    this.start();
    return true;
  }

  // Cada cuadro (pending: los trabajos que le quedan al budget)
  frame(g: Game, pending: number): void {
    const a = g.run.arena;
    if (this.waiting) { if (pending === 0) this.release(g); return; }
    if (this.finishing || !g.awaitingFloor || !a.fall || a.falling) return;
    this.finishing = true;
    this.finish((left) => {
      this.finishing = false;
      if (left > 0) this.waiting = true; else this.release(g);
    });
  }

  canTurn(g: Game): boolean {
    return !g.run.arena.fall;
  }

  reset(): void {
    this.deferred = false;
    this.finishing = false;
    this.waiting = false;
  }

  private release(g: Game): void {
    this.waiting = false;
    g.floorReady();
    if (this.deferred) { this.deferred = false; this.start(); }
  }
}
