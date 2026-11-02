import { defineEnemyBehavior, steerTowards, z } from '../../../../game/brotato/api';

const APPROACH = 0;
const WINDUP = 1;
const DASH = 2;
const RECOVER = 3;
const STUN = 4;

// El jefe del piso 10 (Andrés y MAIA, 2026-10-29): se acerca, carga con aviso y embiste en línea recta arrastrando lo
// que tenga delante. Si algo lo frena en seco (una pared, una columna, que rompe, o un mueble que no consigue
// arrastrar) queda aturdido: la gracia para el jugador es llevarlo contra algo duro. Tres fases por vida: por debajo
// de phase2 llama refuerzos tras cada embestida; por debajo de phase3 embiste dos veces seguidas. mem.phase (0-2) y
// mem.state son para la vista
export default defineEnemyBehavior({
  format: 1,
  id: 'boss',
  name: 'Jefe',
  params: z.strictObject({
    triggerRange: z.number().positive().default(110),   // a qué distancia empieza a cargar
    windup: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]).default([0.9, 0.6, 0.5]),
    secondWindup: z.number().positive().default(0.25),  // la carga entre las dos embestidas de la fase 3
    dashSpeed: z.number().positive().default(5),         // multiplica su velocidad
    dashTime: z.number().positive().default(0.6),
    recover: z.number().min(0).default(1.2),
    stun: z.number().min(0).default(1),
    pushForce: z.number().min(0).default(6000),          // N con que arrastra los muebles embistiendo
    phase2: z.number().min(0).max(1).default(0.66),      // fracción de vida por debajo de la que empieza cada fase
    phase3: z.number().min(0).max(1).default(0.33),
    summon: z.string().default('perseguidor'),
    summonCount: z.number().int().min(0).default(3),
  }),
  update(self, dt, api, p) {
    const m = self.mem;
    m.state ??= APPROACH;
    m.t ??= 0;
    m.left ??= 0;   // embestidas que quedan de la tanda
    m.t -= dt;
    const f = self.hp / self.maxHp;
    const phase = f > p.phase2 ? 0 : f > p.phase3 ? 1 : 2;
    m.phase = phase;
    self.push = 0;
    self.smash = false;
    // Acaba la tanda: en la fase 2 y la 3, refuerzos
    const done = (next: number, t: number) => {
      if (phase >= 1 && p.summonCount > 0) api.summon(self, p.summon, p.summonCount);
      m.state = next;
      m.t = t;
    };

    if (m.state === APPROACH) {
      steerTowards(self, api.player, self.speed);
      if (Math.hypot(api.player.x - self.x, api.player.y - self.y) < p.triggerRange) {
        m.state = WINDUP;
        m.t = p.windup[phase]!;
        m.left = phase === 2 ? 2 : 1;
      }
    } else if (m.state === WINDUP) {
      self.vx = 0;
      self.vy = 0;
      if (m.t <= 0) {
        // Apunta a donde está MAIA ahora y no la sigue durante la embestida
        steerTowards(self, api.player, self.speed * p.dashSpeed);
        m.dx = self.vx;
        m.dy = self.vy;
        m.state = DASH;
        m.t = p.dashTime;
        self.push = p.pushForce;
        self.smash = true;
      }
    } else if (m.state === DASH) {
      if (self.blocked) {
        self.vx = 0;
        self.vy = 0;
        m.stuns = (m.stuns ?? 0) + 1;
        done(STUN, p.stun);
      } else if (m.t <= 0) {
        m.left -= 1;
        if (m.left > 0) { m.state = WINDUP; m.t = p.secondWindup; self.vx = 0; self.vy = 0; }
        else done(RECOVER, p.recover);
      } else {
        self.vx = m.dx!;
        self.vy = m.dy!;
        self.push = p.pushForce;
        self.smash = true;
      }
    } else if (m.state === STUN) {
      self.vx = 0;
      self.vy = 0;
      if (m.t <= 0) { m.state = RECOVER; m.t = 0.3; }
    } else {
      self.vx *= 0.8;
      self.vy *= 0.8;
      if (m.t <= 0) m.state = APPROACH;
    }
  },
});
