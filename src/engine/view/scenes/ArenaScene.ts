import Phaser from 'phaser';
import type { Point } from '../../api';
import type { Run } from '../../sim/Run';
import { PLAYER_BODY_OFFSET, type World } from '../../sim/World';
import { animKey, textureKey } from '../anims';
import { text } from '../font';
import { MoveInput } from '../input';
import { setPaused, showContentErrors } from '../overlay';

const STEP = 1 / 60;          // la simulación corre a paso fijo
const MAX_STEPS = 5;          // tras un tirón no se intenta recuperar más de 5 pasos
const TILE = 16;
const COLORS = { hp: 0xff4d5e, hpBack: 0x12101c, threat: 0xff4d5e, text: 0xfdf6ff, gold: 0xf0b951 };

interface Floating {
  obj: Phaser.GameObjects.BitmapText;
  life: number;
  at: Point | null; // null: sigue al jugador
}

// Pinta lo que dice el World; no decide nada de juego
export class ArenaScene extends Phaser.Scene {
  private run!: Run;
  private world!: World;
  private input_!: MoveInput;
  private player!: Phaser.GameObjects.Sprite;
  private readonly enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private telegraphs!: Phaser.GameObjects.Graphics;
  private hud!: { bar: Phaser.GameObjects.Graphics; hp: Phaser.GameObjects.BitmapText; wave: Phaser.GameObjects.BitmapText; timer: Phaser.GameObjects.BitmapText };
  private floating: Floating[] = [];
  private readonly move = new Phaser.Math.Vector2();
  private acc = 0;
  private paused = false;
  private ended = false;

  constructor() {
    super('Arena');
  }

  init(data: { run: Run }): void {
    this.run = data.run;
    this.enemySprites.clear();
    this.floating = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
  }

  create(): void {
    const { width, height } = this.run.level.arena;
    this.drawFloor(width, height);
    this.telegraphs = this.add.graphics().setDepth(1);

    this.run.onFloatingText = (value, at) => this.floatText(value, at, COLORS.text);
    this.run.onHookError = (message) => this.hookError(message);
    this.world = this.run.startWave();

    const id = this.run.character.id;
    this.player = this.add
      .sprite(this.world.player.x, this.world.player.y, textureKey('character', id))
      .setOrigin(0.5, 1) // pie centrado: cae en píxel entero con celdas de ancho par
      .setDepth(2)
      .play(animKey('character', id, 'idle'));

    this.input_ = new MoveInput(this);
    this.createHud();

    // Andrés se va a mirar a los agentes en mitad de la oleada: el juego se para solo
    const onBlur = () => this.setPausedState(true);
    const onFocus = () => this.setPausedState(false);
    const onVisibility = () => this.setPausedState(document.hidden);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      this.scale.off('resize', this.layoutHud, this);
      setPaused(false);
    });
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused || this.ended) return;
    const dt = deltaMs / 1000;
    this.acc = Math.min(this.acc + dt, STEP * MAX_STEPS);
    try {
      while (this.acc >= STEP && this.world.status === 'playing') {
        this.input_.read(this.move);
        this.world.step(STEP, this.move);
        this.acc -= STEP;
      }
    } catch (e) {
      // Un comportamiento de contenido que revienta: se dice cuál y se para
      this.ended = true;
      const message = (e as Error).message;
      console.error(e);
      showContentErrors(`✗ La partida se paró por un error de contenido.\n\n  ${message}`);
      return;
    }
    this.render(dt);
    if (this.world.status !== 'playing') this.endWave();
  }

  private endWave(): void {
    this.ended = true;
    if (this.world.status === 'dead') {
      this.run.lose();
      this.time.delayedCall(700, () => this.scene.start('End', { run: this.run, result: 'defeat' }));
      return;
    }
    const next = this.run.finishWave();
    if (next === 'victory') {
      this.scene.start('End', { run: this.run, result: 'victory' });
      return;
    }
    // Hito 3: aquí va la tienda. Por ahora, la siguiente oleada directa tras un respiro
    this.floatText(`Oleada ${this.run.waveNumber - 1} superada`, undefined, COLORS.gold);
    this.time.delayedCall(1200, () => this.scene.restart({ run: this.run }));
  }

  private render(dt: number): void {
    const w = this.world;
    const p = w.player;

    // La simulación va en flotante; se pinta redondeado
    const px = Math.round(p.x);
    const py = Math.round(p.y);
    this.player.setPosition(px, py);
    const moving = p.vx * p.vx + p.vy * p.vy > 1;
    const id = this.run.character.id;
    const anim = animKey('character', id, moving ? 'walk' : 'idle');
    if (this.player.anims.currentAnim?.key !== anim) this.player.play(anim);
    if (p.vx !== 0) this.player.setFlipX(p.vx < 0);
    this.player.setAlpha(p.iframes > 0 && Math.floor(p.iframes * 12) % 2 === 0 ? 0.35 : 1);

    this.syncEnemies();
    this.drawTelegraphs();
    this.drainFx();
    this.updateFloating(dt);
    this.updateHud();

    // La cámara se pega a la posición YA redondeada: si se redondean por separado, el personaje tiembla 1 px
    const cam = this.cameras.main;
    cam.setScroll(px - Math.floor(cam.width / 2), py - PLAYER_BODY_OFFSET - Math.floor(cam.height / 2));
    this.input_.draw();
  }

  private syncEnemies(): void {
    const alive = new Set<number>();
    for (const e of this.world.enemies) {
      alive.add(e.uid);
      let s = this.enemySprites.get(e.uid);
      if (!s) {
        s = this.add.sprite(0, 0, textureKey('enemy', e.def.id)).setOrigin(0.5, 1).setDepth(2);
        s.play(animKey('enemy', e.def.id, 'walk'));
        this.enemySprites.set(e.uid, s);
      }
      s.setPosition(Math.round(e.x), Math.round(e.y));
      if (Math.abs(e.vx) > 1) s.setFlipX(e.vx < 0);
      s.setDepth(2 + e.y / 10000); // los de abajo tapan a los de arriba
    }
    for (const [uid, s] of this.enemySprites) {
      if (alive.has(uid)) continue;
      s.destroy();
      this.enemySprites.delete(uid);
    }
    this.player.setDepth(2 + this.world.player.y / 10000);
  }

  // El aviso antes de que aparezca un enemigo: una X roja que parpadea más rápido al final
  private drawTelegraphs(): void {
    const g = this.telegraphs.clear();
    for (const t of this.world.telegraphs) {
      if (Math.floor(t.t * (t.t < 0.4 ? 16 : 8)) % 2 === 1) continue;
      const x = Math.round(t.x);
      const y = Math.round(t.y) - 4;
      g.fillStyle(COLORS.threat);
      for (let i = -3; i <= 3; i++) {
        g.fillRect(x + i, y + i, 1, 1);
        g.fillRect(x + i, y - i, 1, 1);
      }
    }
  }

  private drainFx(): void {
    for (const fx of this.world.fx) {
      if (fx.type === 'player-hit') {
        this.floatText(`-${fx.amount}`, undefined, COLORS.threat);
        // Destello rojo solo sobre el personaje: tintar la pantalla entera tapa lo que pasa alrededor
        this.player.setTintFill(COLORS.threat);
        this.time.delayedCall(90, () => this.player.clearTint());
      } else if (fx.type === 'dodge') {
        this.floatText('esquiva', undefined, COLORS.text);
      }
    }
    this.world.fx.length = 0;
  }

  private floatText(value: string, at: Point | undefined, color: number): void {
    const p = at ?? this.world?.player ?? { x: 0, y: 0 };
    const obj = text(this, 0, 0, value).setTint(color).setDepth(50).setOrigin(0.5, 1);
    obj.setPosition(Math.round(p.x), Math.round(p.y) - 34);
    this.floating.push({ obj, life: 1.4, at: at ? { x: at.x, y: at.y } : null });
  }

  private updateFloating(dt: number): void {
    const p = this.world.player;
    this.floating = this.floating.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) {
        f.obj.destroy();
        return false;
      }
      const base = f.at ?? p;
      const rise = Math.round((1.4 - f.life) * 10);
      f.obj.setPosition(Math.round(base.x), Math.round(base.y) - 34 - rise);
      f.obj.setAlpha(f.life < 0.3 ? 0.5 : 1);
      return true;
    });
  }

  private createHud(): void {
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) =>
      o.setScrollFactor(0).setDepth(100);
    this.hud = {
      bar: fixed(this.add.graphics()),
      hp: fixed(text(this, 0, 0, '')),
      wave: fixed(text(this, 0, 0, '').setOrigin(0.5, 0)),
      timer: fixed(text(this, 0, 0, '').setOrigin(0.5, 0).setTint(COLORS.gold)),
    };
    this.scale.on('resize', this.layoutHud, this);
    this.layoutHud();
  }

  // Anclado a las esquinas del área visible, que cambia con cada pantalla
  private layoutHud(): void {
    const w = this.scale.width;
    this.hud.hp.setPosition(4 + 52 + 3, 3);
    this.hud.wave.setPosition(Math.floor(w / 2), 3);
    this.hud.timer.setPosition(Math.floor(w / 2), 11);
  }

  private updateHud(): void {
    const p = this.world.player;
    const g = this.hud.bar.clear();
    g.fillStyle(COLORS.hpBack).fillRect(4, 4, 52, 5);
    g.fillStyle(COLORS.hp).fillRect(4, 4, Math.round((52 * p.hp) / p.maxHp), 5);
    this.hud.hp.setText(`${p.hp}/${p.maxHp}`);
    this.hud.wave.setText(`OLEADA ${this.run.waveNumber}/${this.run.totalWaves}`);
    this.hud.timer.setText(String(Math.ceil(this.world.timeLeft)));
  }

  private hookError(message: string): void {
    if (import.meta.env.DEV) {
      // En desarrollo se para y se enseña: es un fallo de contenido que hay que arreglar ya
      this.ended = true;
      showContentErrors(`✗ ${message}`);
    } else {
      this.floatText('un efecto falló y se desactivó', undefined, COLORS.threat);
    }
  }

  private setPausedState(paused: boolean): void {
    if (this.paused === paused || this.ended) return;
    this.paused = paused;
    this.acc = 0;
    setPaused(paused);
    if (paused) this.anims.pauseAll();
    else this.anims.resumeAll();
  }

  // Suelo de relleno hasta que lleguen las losetas de VIN en la hoja del nivel
  private drawFloor(width: number, height: number): void {
    const g = this.add.graphics().setDepth(0);
    for (let ty = 0; ty < height / TILE; ty++) {
      for (let tx = 0; tx < width / TILE; tx++) {
        g.fillStyle((tx + ty) % 2 === 0 ? 0x8a94a6 : 0x848ea0);
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    g.lineStyle(2, 0x6e7a8d).strokeRect(1, 1, width - 2, height - 2);
    this.cameras.main.setBackgroundColor('#12101c');
  }
}
