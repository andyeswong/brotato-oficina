// La huella de una partida del Brotato: FNV-1a de 32 bits sobre todo su estado, en un orden fijo. La misma semilla
// y la misma entrada tienen que dar la misma huella en cada paso (MAIA, puerta de la fase 1): es lo que deja repetir
// una partida, medir el balance con semillas y encontrar a la primera dónde se rompe el determinismo.
import type { Run } from './Run';
import type { World } from './World';

class Fnv {
  private h = 0x811c9dc5;
  private readonly view = new DataView(new ArrayBuffer(8));
  private bytes(u: Uint8Array): void {
    let h = this.h;
    for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i]!, 0x01000193);
    this.h = h >>> 0;
  }
  num(n: number): void {
    this.view.setFloat64(0, n);
    this.bytes(new Uint8Array(this.view.buffer));
  }
  str(s: string): void {
    this.bytes(new TextEncoder().encode(s));
    this.num(s.length);
  }
  hex(): string {
    return this.h.toString(16).padStart(8, '0');
  }
}

// Lo privado del World que también es estado de la partida (contadores y temporizadores)
interface WorldPrivate {
  uid: number;
  regenT: number;
  stealT: number;
  nextSpawn: number[];
}

// withWorld: incluye la huella del mundo de vóxeles (agua, gotas, trozos), que es cara (recorre todo el mundo). La
// simulación de una oleada no lo cambia, así que basta con tomarla al acabar cada oleada.
export function runDigest(run: Run, world: World | null = run.world, withWorld = true): string {
  const h = new Fnv();
  h.num(run.seed); h.num(run.waveIndex); h.num(run.kills); h.num(run.materials); h.num(run.rng.state);
  for (const w of run.weapons) { h.str(w.id); h.num(w.tier); }
  h.num(-1);
  for (const id of run.items) h.str(id);
  h.num(-2);
  for (const o of run.shop.offers) {
    if (!o) { h.num(-3); continue; }
    h.str(o.kind); h.str(o.id); h.num(o.tier); h.num(o.price); h.num(o.locked ? 1 : 0);
  }
  h.num(run.shop.rerolls);
  if (withWorld) h.str(run.arena.state.hash());
  if (!world) return h.hex();

  const p = world.player;
  h.str(world.status); h.num(world.time);
  for (const v of [p.x, p.y, p.z, p.hp, p.maxHp, p.iframes, p.vx, p.vy]) h.num(v);
  const priv = world as unknown as WorldPrivate;
  h.num(priv.uid); h.num(priv.regenT); h.num(priv.stealT);
  for (const t of priv.nextSpawn) h.num(t);
  for (const e of world.enemies) {
    h.num(e.uid); h.str(e.def.id);
    for (const v of [e.x, e.y, e.z, e.vx, e.vy, e.hp, e.alive ? 1 : 0]) h.num(v);
    for (const k of Object.keys(e.mem).sort()) { h.str(k); h.num(e.mem[k]!); }
  }
  h.num(-4);
  for (const pr of world.projectiles) {
    h.num(pr.uid); h.str(pr.owner); h.str(pr.source);
    for (const v of [pr.x, pr.y, pr.vx, pr.vy, pr.travel, pr.pierce, pr.damage]) h.num(v);
    for (const uid of [...pr.hit].sort((a, b) => a - b)) h.num(uid);
  }
  h.num(-5);
  for (const m of world.materials) { h.num(m.uid); h.num(m.x); h.num(m.y); h.num(m.value); h.num(m.magnet ? 1 : 0); }
  h.num(-6);
  for (const t of world.telegraphs) { h.num(t.x); h.num(t.y); h.num(t.t); h.str(t.enemy.id); }
  h.num(-7);
  for (const w of world.weapons) for (const v of [w.slot, w.tier, w.cooldown, w.angle, w.x, w.y, w.fireT, w.lunge]) h.num(v);
  return h.hex();
}
