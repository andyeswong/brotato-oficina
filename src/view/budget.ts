// VISTA (FERN): el presupuesto de cada cuadro para el trabajo de la vista que no cabe de una vez (rehornear trozos,
// recalcular pesos de luces, lo que venga). Lo que no cabe se hace más despacio, no más caro: es la regla que MAIA
// aprobó en el Brotato (efb1a39), donde el p95 volvió a 16,8 ms con la CPU a 6x. Usa el reloj, así que vive aquí y
// no en src/game: la simulación no lo puede leer.

// Un trabajo que se puede reanudar. run trabaja hasta pasar `deadline` (ms de performance.now) o acabar, y devuelve
// true si acabó. Cada llamada hace al menos una unidad de trabajo, aunque el plazo ya haya vencido: si no, no
// avanzaría nunca. Mientras no acaba, la vista sigue enseñando lo viejo.
export interface ViewJob {
  readonly key: string;     // lo que rehace ("light:12", "rect:3,4"): un trabajo nuevo con la misma key sustituye al viejo
  run(deadline: number): boolean;
}

// Cuadros seguidos sin presupuesto (porque otra cosa lo gastó) antes de dar una porción igualmente
const STARVE_FRAMES = 4;

export class FrameBudget {
  private queue: ViewJob[] = [];
  private starved = 0;

  constructor(readonly ms = 3, private readonly now: () => number = () => performance.now()) {}

  get pending(): number {
    return this.queue.length;
  }

  // Encola. Si ya hay uno con la misma key, el nuevo ocupa su sitio en la cola (no vuelve al final: lo que cambia
  // a menudo no se quedaría nunca sin hacer) y el viejo se descarta sin acabar.
  push(job: ViewJob): void {
    const i = this.queue.findIndex((j) => j.key === job.key);
    if (i >= 0) this.queue[i] = job;
    else this.queue.push(job);
  }

  // Una vez por cuadro. spentMs: lo que ya se llevó la vista en este cuadro de lo que cuenta contra el mismo
  // presupuesto. Devuelve los ms gastados aquí.
  run(spentMs = 0): number {
    if (!this.queue.length) return 0;
    const start = this.now();
    let deadline = start + this.ms - spentMs;
    if (deadline <= start) {
      if (++this.starved < STARVE_FRAMES) return 0;
      deadline = start;          // una porción mínima: el primer trabajo hace una unidad y para
    }
    this.starved = 0;
    do {
      const job = this.queue[0]!;
      const t = this.now();
      if (job.run(deadline)) this.queue.shift();
      else if (this.now() === t) break;   // no acabó y no gastó nada: no insistir en este cuadro
    } while (this.queue.length && this.now() < deadline);
    return this.now() - start;
  }
}
