// El sonido del juego (MAIA, 2026-10-25): efectos y música CC0 de Freesound (app/public/sfx, con su origen en
// credits.json y scripts/fetch-sfx.py). Solo la vista lo toca: suena por lo que la partida ya anuncia (sus efectos y
// sus cambios de fase), así que no entra en la simulación ni en la huella. Web Audio: los navegadores no dejan sonar
// hasta un gesto, así que el contexto nace con el primer toque o tecla (unlock). Se silencia con M o desde la
// elección de agente, y se recuerda en este navegador.

// Cada sonido: su volumen medio medido (ffmpeg volumedetect, dB) para igualarlos a TARGET_DB, su volumen en la mezcla
// y cada cuánto puede sonar como mucho (los golpes y los disparos llegan a ráfagas)
const TARGET_DB = -20;
const SOUNDS = {
  disparo: { meanDb: -10.1, mix: 0.35, every: 0.09 },
  golpe: { meanDb: -30.6, mix: 0.45, every: 0.05 },
  muerte: { meanDb: -16.9, mix: 0.5, every: 0.06 },
  dano: { meanDb: -31.1, mix: 0.8, every: 0.15 },
  recoger: { meanDb: -3.4, mix: 0.4, every: 0.06 },
  paso: { meanDb: -36.0, mix: 0.25, every: 0.3 },
  dash: { meanDb: -22.9, mix: 0.5, every: 0.1 },
  limpia: { meanDb: -29.9, mix: 0.8, every: 1 },
  tienda: { meanDb: -35.1, mix: 0.7, every: 1 },
  compra: { meanDb: -20.0, mix: 0.6, every: 0.2 },
  derrota: { meanDb: -24.2, mix: 0.8, every: 2 },
  victoria: { meanDb: -11.0, mix: 0.8, every: 2 },
  musica: { meanDb: -26.2, mix: 0.3, every: 0 },
} as const;
export type SoundName = keyof typeof SOUNDS;

const KEY = 'brotato-sonido';

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundName, AudioBuffer>();
  private readonly last = new Map<SoundName, number>();
  private musicNode: AudioBufferSourceNode | null = null;
  private wantMusic = false;
  muted: boolean;

  constructor(private readonly base = 'sfx/') {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch { /* sin almacenamiento: con sonido */ }
    this.muted = stored === 'no';
  }

  // Con el primer gesto: crea el contexto y carga los sonidos (lo que falle se queda mudo, sin romper el juego)
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    for (const name of Object.keys(SOUNDS) as SoundName[]) {
      fetch(`${this.base}${name}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((data) => this.ctx!.decodeAudioData(data))
        .then((buf) => { this.buffers.set(name, buf); if (name === 'musica') this.syncMusic(); })
        .catch(() => { /* sin ese sonido */ });
    }
  }

  toggleMuted(): void {
    this.muted = !this.muted;
    try { localStorage.setItem(KEY, this.muted ? 'no' : 'si'); } catch { /* solo esta vez */ }
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  play(name: SoundName): void {
    const ctx = this.ctx, buf = this.buffers.get(name);
    if (!ctx || !buf || this.muted) return;
    const s = SOUNDS[name], now = ctx.currentTime;
    if (now - (this.last.get(name) ?? -Infinity) < s.every) return;
    this.last.set(name, now);
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf;
    gain.gain.value = s.mix * 10 ** ((TARGET_DB - s.meanDb) / 20);
    src.connect(gain).connect(this.master!);
    src.start();
  }

  // La música suena en bucle mientras on (las oleadas)
  music(on: boolean): void {
    if (on === this.wantMusic) return;
    this.wantMusic = on;
    this.syncMusic();
  }

  private syncMusic(): void {
    const ctx = this.ctx, buf = this.buffers.get('musica');
    if (this.wantMusic && !this.musicNode && ctx && buf) {
      const src = ctx.createBufferSource(), gain = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      gain.gain.value = SOUNDS.musica.mix * 10 ** ((TARGET_DB - SOUNDS.musica.meanDb) / 20);
      src.connect(gain).connect(this.master!);
      src.start();
      this.musicNode = src;
    } else if (!this.wantMusic && this.musicNode) {
      this.musicNode.stop();
      this.musicNode = null;
    }
  }
}
