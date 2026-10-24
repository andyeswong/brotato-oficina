import Phaser from 'phaser';
import type { CharacterModule, StatModule } from '../../registry/schemas';
import type { Registry } from '../../registry/validate';
import { pickLevel } from '../../sim/map';
import { Run } from '../../sim/Run';
import { describeModifier } from '../../stats/describe';
import { frameOf, textureKey } from '../anims';
import { CHAR_W, FONT_SIZE, text, uiScale, wrapText } from '../font';

const COLORS = {
  bg: '#12101c', card: 0x1f1c30, edge: 0x7a5bd6, text: 0xfdf6ff, dim: 0x8a94a6,
  good: 0x7bd88f, bad: 0xff4d5e, gold: 0xf0b951, accent: 0x7a5bd6,
};
const MAX_CARD_CHARS = 56;  // ancho máximo de una ficha, en letras
const PORTRAIT_H = 48;      // alto objetivo del retrato a escala x1 de la UI

// Elegir agente. Un personaje nuevo aparece aquí solo con existir su módulo: la ficha (ventajas,
// desventajas, arma inicial) se escribe sola desde sus datos. Teclado: 1–9 elige, Intro elige el marcado.
export class SelectScene extends Phaser.Scene {
  private registry_!: Registry;
  private selected = 0;

  constructor() {
    super('Select');
  }

  init(data: { registry: Registry }): void {
    this.registry_ = data.registry;
    this.selected = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.draw();
    this.scale.on('resize', this.draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.draw, this));
    const characters = this.registry_.characters();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
      if (digit && Number(digit[2]) >= 1 && Number(digit[2]) <= characters.length) this.start(Number(digit[2]) - 1);
      else if (e.key === 'Enter' || e.key === ' ') this.start(this.selected);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.move(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.move(-1);
    });
  }

  private move(delta: number): void {
    const n = this.registry_.characters().length;
    this.selected = (this.selected + delta + n) % n;
    this.draw();
  }

  private start(i: number): void {
    const character = this.registry_.characters()[i];
    if (!character) return;
    // El mapa (y con él el tema) sale de la semilla de la partida
    const seed = Date.now() >>> 0;
    this.scene.start('Arena', { run: new Run(this.registry_, character, pickLevel(this.registry_.levels(), seed), seed) });
  }

  private draw(): void {
    this.children.removeAll(true);
    const u = uiScale();
    const W = this.scale.width;
    const H = this.scale.height;
    const line = FONT_SIZE * u;
    const pad = 6 * u;

    text(this, Math.floor(W / 2), pad, 'Elige agente', u * 2).setOrigin(0.5, 0).setTint(COLORS.text);
    let y = pad + line * 2 + 4 * u;

    const cardW = Math.min(W - pad * 2, MAX_CARD_CHARS * CHAR_W * u);
    const x = Math.floor((W - cardW) / 2);
    const characters = this.registry_.characters();
    characters.forEach((c, i) => {
      y += this.card(c, i, x, y, cardW, u) + 4 * u;
    });

    text(this, Math.floor(W / 2), H - pad - line, 'toca la ficha o pulsa intro', u).setOrigin(0.5, 0).setTint(COLORS.dim);
  }

  // Devuelve el alto que ocupó
  private card(c: CharacterModule, i: number, x: number, y: number, w: number, u: number): number {
    const line = FONT_SIZE * u;
    const p = 5 * u;
    const g = this.add.graphics();

    // Retrato: el tag "portrait" si lo hay; si no, el primer frame idle. A escala entera, cerca de 48×u de alto
    const anim = c.sprites.portrait ? 'portrait' : 'idle';
    const frameName = c.sprites.portrait
      ? Object.keys(c.sprites.atlas.frames)[c.sprites.atlas.meta.frameTags.find((t) => t.name === c.sprites.portrait)!.from]!
      : frameOf(c.sprites, anim);
    const frameH = c.sprites.atlas.frames[frameName]!.frame.h;
    const scale = Math.max(1, Math.round((PORTRAIT_H * u) / frameH));
    const portrait = this.add.image(x + p, y + p, textureKey('character', c.id), frameName).setOrigin(0, 0).setScale(scale);

    const tx = x + p + portrait.displayWidth + 5 * u;
    const maxChars = Math.max(8, Math.floor((x + w - p - tx) / (CHAR_W * u)));
    let ty = y + p;
    text(this, tx, ty, c.name, u * 2).setTint(COLORS.text);
    ty += line * 2 + 2 * u;
    for (const l of wrapText(c.description ?? '', maxChars)) {
      text(this, tx, ty, l, u).setTint(COLORS.dim);
      ty += line;
    }
    ty += 3 * u;

    const stats = new Map<string, StatModule>(this.registry_.stats().map((s) => [s.id, s]));
    for (const m of c.modifiers ?? []) {
      const d = describeModifier(m, stats);
      for (const l of wrapText(d.text, maxChars)) {
        text(this, tx, ty, l, u).setTint(d.good ? COLORS.good : COLORS.bad);
        ty += line;
      }
    }
    const weapons = (c.startingWeapons ?? []).map((id) => this.registry_.weapon(id).name);
    if (weapons.length > 0) {
      ty += 3 * u;
      for (const l of wrapText(`empieza con: ${weapons.join(', ')}`, maxChars)) {
        text(this, tx, ty, l, u).setTint(COLORS.gold);
        ty += line;
      }
    }

    const h = Math.max(ty + p, y + p * 2 + portrait.displayHeight) - y;
    g.fillStyle(COLORS.card).fillRect(x, y, w, h);
    g.lineStyle(u, i === this.selected ? COLORS.edge : COLORS.dim, i === this.selected ? 1 : 0.4).strokeRect(x, y, w, h);
    g.setDepth(-1);
    this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.start(i));
    return h;
  }
}
