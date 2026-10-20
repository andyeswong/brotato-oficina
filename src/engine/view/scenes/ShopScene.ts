import Phaser from 'phaser';
import { MAX_WEAPONS } from '../../registry/schemas';
import type { Run } from '../../sim/Run';
import type { Offer } from '../../sim/Shop';
import { frameOf, textureKey } from '../anims';
import { CHAR_W, FONT_SIZE, text, uiScale, wrapText } from '../font';

const COLORS = {
  bg: '#12101c', row: 0x1f1c30, rowLocked: 0x2c2645, edge: 0x4a4463, edgeLocked: 0xf0b951,
  text: 0xfdf6ff, dim: 0x8a94a6, gold: 0xf0b951, bad: 0xff4d5e, accent: 0x7a5bd6,
};
const MAX_ROW_W = 100; // ancho máximo de una fila, en letras: en pantallas anchas no se estira de lado a lado
const ICON = 16;       // lado del icono a escala x1

// La tienda entre oleadas. Solo pinta y traduce toques/teclas a llamadas a run.shop: las reglas viven en Shop.
// Es una lista de filas que reparte el alto disponible, para caber igual en el escritorio que en la tapa del Flip.
// Teclado: 1–8 compra, Mayús+número pone/quita candado, R vuelve a tirar, Intro o Espacio sigue.
export class ShopScene extends Phaser.Scene {
  private run!: Run;
  private message = '';
  private messageColor = COLORS.dim;

  constructor() {
    super('Shop');
  }

  init(data: { run: Run }): void {
    this.run = data.run;
    this.message = '';
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.draw();
    this.scale.on('resize', this.draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.draw, this));

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
      if (digit) {
        const i = Number(digit[2]) - 1;
        if (i >= 0 && i < this.run.shop.offers.length) {
          if (e.shiftKey) this.lock(i);
          else this.buy(i);
        }
      } else if (e.key === 'r' || e.key === 'R') this.reroll();
      else if (e.key === 'Enter' || e.key === ' ') this.next();
    });
  }

  private buy(i: number): void {
    const result = this.run.shop.buy(i);
    this.say(result.ok ? 'comprado' : result.reason, result.ok ? COLORS.gold : COLORS.bad);
  }

  private lock(i: number): void {
    this.run.shop.toggleLock(i);
    this.draw();
  }

  private reroll(): void {
    const result = this.run.shop.reroll();
    this.say(result.ok ? '' : result.reason, COLORS.bad);
  }

  private next(): void {
    this.scene.start('Arena', { run: this.run });
  }

  private say(message: string, color: number): void {
    this.message = message;
    this.messageColor = color;
    this.draw();
  }

  // Se redibuja entera tras cada acción y en cada cambio de tamaño: son pocas piezas
  private draw(): void {
    this.children.removeAll(true);
    const u = uiScale();
    const W = this.scale.width;
    const H = this.scale.height;
    const line = FONT_SIZE * u;
    const pad = 6 * u;
    const run = this.run;
    const rowW = Math.min(W - pad * 2, MAX_ROW_W * CHAR_W * u);
    const left = Math.floor((W - rowW) / 2);

    // Cabecera: título y materiales en una línea; debajo, la oleada
    let y = pad;
    text(this, left, y, 'Tienda', u).setTint(COLORS.text);
    const money = text(this, left + rowW, y, String(run.materials), u).setTint(COLORS.gold).setOrigin(1, 0);
    this.add
      .image(money.x - money.width - 2 * u, y - u, textureKey('level', run.level.id), frameOf(run.level.sprites, 'material'))
      .setOrigin(1, 0)
      .setScale(u);
    y += line;
    for (const l of wrapText(`oleada ${run.waveIndex} superada · viene la ${run.waveNumber} de ${run.totalWaves}`, Math.floor(rowW / (CHAR_W * u)))) {
      text(this, left, y, l, u).setTint(COLORS.dim);
      y += line;
    }
    y += 2 * u;

    // Pie (de abajo arriba): botones, armas y mensaje. Lo que sobra en medio es para las filas.
    const buttonH = line + 6 * u;
    const rerollLabel = `volver a tirar · ${run.shop.rerollPrice()}`;
    const nextLabel = 'seguir »';
    // Los dos botones en una línea si caben; si no (pantallas estrechas), uno encima del otro
    const fits = (rerollLabel.length + nextLabel.length) * CHAR_W * u + 24 * u <= rowW;
    const footerTop = H - pad - buttonH * (fits ? 1 : 2) - (fits ? 0 : 3 * u);
    const rerollColor = run.materials >= run.shop.rerollPrice() ? COLORS.text : COLORS.dim;
    this.button(left, footerTop, rerollLabel, rerollColor, u, buttonH, () => this.reroll());
    this.button(left + rowW, fits ? footerTop : footerTop + buttonH + 3 * u, nextLabel, COLORS.gold, u, buttonH, () => this.next(), true);
    const weaponsTop = footerTop - 4 * u - (ICON * u);
    this.weaponsBar(left, weaponsTop, u);
    const messageTop = weaponsTop - line - 2 * u;
    if (this.message) text(this, left, messageTop, this.message, u).setTint(this.messageColor);

    // Filas: el alto que quede, repartido; como mucho el que necesita una descripción de 4 líneas
    const n = run.shop.offers.length;
    const gap = 2 * u;
    const space = messageTop - gap - y;
    const rowH = Math.min(Math.floor((space - gap * (n - 1)) / n), line * 6 + 6 * u);
    run.shop.offers.forEach((offer, i) => this.row(offer, i, left, y + i * (rowH + gap), rowW, rowH, u));
  }

  private row(offer: Offer | null, i: number, x: number, y: number, w: number, h: number, u: number): void {
    const g = this.add.graphics();
    const line = FONT_SIZE * u;
    const p = 3 * u;
    if (!offer) {
      g.lineStyle(u, COLORS.edge, 0.5).strokeRect(x, y, w, h);
      text(this, x + w / 2, y + Math.floor((h - line) / 2), 'vendido', u).setOrigin(0.5, 0).setTint(COLORS.dim);
      return;
    }
    const run = this.run;
    g.fillStyle(offer.locked ? COLORS.rowLocked : COLORS.row).fillRect(x, y, w, h);
    g.lineStyle(u, offer.locked ? COLORS.edgeLocked : COLORS.edge).strokeRect(x, y, w, h);

    // Icono: el sprite del módulo a escala entera; un ítem sin arte lleva su inicial en un cuadro
    const mod = offer.kind === 'weapon' ? run.registry.weapon(offer.id) : run.registry.item(offer.id);
    const iconBox = ICON * u;
    if (mod.sprites) {
      const frame = frameOf(mod.sprites, offer.kind === 'weapon' ? 'idle' : 'icon');
      const img = this.add.image(x + p, y + p, textureKey(offer.kind, offer.id), frame).setOrigin(0, 0).setScale(u);
      img.setPosition(x + p + Math.floor((iconBox - img.displayWidth) / 2), y + p + Math.floor((iconBox - img.displayHeight) / 2));
    } else {
      g.fillStyle(COLORS.accent).fillRect(x + p, y + p, iconBox, iconBox);
      text(this, x + p + iconBox / 2, y + p + Math.floor((iconBox - line) / 2) + u, mod.name[0]!, u).setOrigin(0.5, 0);
    }

    // A la derecha, de arriba abajo: número de tecla, precio y candado
    const affordable = run.materials >= offer.price;
    const right = x + w - p;
    const price = text(this, right, y + p, `${offer.price}`, u).setOrigin(1, 0).setTint(affordable ? COLORS.gold : COLORS.bad);
    text(this, price.x - price.width - 2 * CHAR_W * u, y + p, `${i + 1}`, u).setOrigin(1, 0).setTint(COLORS.dim);
    const lockLabel = offer.locked ? 'fijada' : 'fijar';
    const lock = text(this, right, y + h - p - line, lockLabel, u).setOrigin(1, 0).setTint(offer.locked ? COLORS.gold : COLORS.dim);

    // En medio: nombre y tipo, y la descripción en las líneas que quepan
    const tx = x + p + iconBox + 3 * u;
    const textW = right - lock.width - 3 * u - tx;
    const maxChars = Math.max(4, Math.floor(textW / (CHAR_W * u)));
    const kind = offer.kind === 'weapon' ? `arma ${['I', 'II', 'III', 'IV'][offer.tier]}` : 'ítem';
    text(this, tx, y + p, wrapText(mod.name, maxChars, 1)[0] ?? '', u).setTint(COLORS.text);
    text(this, tx, y + p + line, kind, u).setTint(COLORS.accent);
    const descLines = Math.floor((h - p * 2 - line * 2) / line);
    wrapText(mod.description ?? '', maxChars, descLines).forEach((l, k) => {
      text(this, tx, y + p + line * (2 + k), l, u).setTint(COLORS.dim);
    });

    // Zonas táctiles: la fila compra, salvo la esquina del candado
    const lockW = lock.width + p * 2;
    const lockH = line + p * 2;
    this.zone(x, y, w, h - lockH, () => this.buy(i));
    this.zone(x, y + h - lockH, w - lockW, lockH, () => this.buy(i));
    this.zone(x + w - lockW, y + h - lockH, lockW, lockH, () => this.lock(i));
  }

  private weaponsBar(x: number, y: number, u: number): void {
    const run = this.run;
    const label = text(this, x, y + Math.floor((ICON * u - FONT_SIZE * u) / 2), `armas ${run.weapons.length}/${MAX_WEAPONS}`, u).setTint(COLORS.dim);
    let wx = x + label.width + 4 * u;
    for (const w of run.weapons) {
      const def = run.registry.weapon(w.id);
      const img = this.add.image(wx, y, textureKey('weapon', w.id), frameOf(def.sprites, 'idle')).setOrigin(0, 0).setScale(u);
      wx += img.displayWidth + 2 * u;
      if (w.tier > 0) wx += text(this, wx, y, ['', 'II', 'III', 'IV'][w.tier]!, u).setTint(COLORS.gold).width + 2 * u;
    }
    if (run.items.length > 0) text(this, wx + 4 * u, label.y, `· ${run.items.length} ítems`, u).setTint(COLORS.dim);
  }

  private button(x: number, y: number, label: string, color: number, u: number, h: number, onTap: () => void, alignRight = false): void {
    const t = text(this, x, y + 3 * u, label, u).setTint(color).setOrigin(alignRight ? 1 : 0, 0);
    const bw = t.width + 8 * u;
    const bx = alignRight ? x - bw : x;
    t.setX(alignRight ? x - 4 * u : x + 4 * u);
    this.add.graphics().lineStyle(u, color).strokeRect(bx, y, bw, h);
    this.zone(bx, y, bw, h, onTap);
  }

  private zone(x: number, y: number, w: number, h: number, onTap: () => void): void {
    this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', onTap);
  }
}
