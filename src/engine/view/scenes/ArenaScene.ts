import Phaser from 'phaser';
import type { Point } from '../../api';
import type { Run } from '../../sim/Run';
import { createRng } from '../../sim/rng';
import type { Projectile, WeaponState, World } from '../../sim/World';
import { animKey, frameOf, textureKey } from '../anims';
import { cameraScroll } from '../camera';
import { FONT_SIZE, text, uiScale } from '../font';
import { MoveInput } from '../input';
import { setPaused, showContentErrors } from '../overlay';

const STEP = 1 / 60;          // la simulación corre a paso fijo
const MAX_STEPS = 5;          // tras un tirón no se intenta recuperar más de 5 pasos
const BAR_W = 52;
const BAR_H = 7;
const COLORS = { hp: 0xff4d5e, hpBack: 0x12101c, threat: 0xff4d5e, text: 0xfdf6ff, gold: 0xf0b951, outline: 0x12101c };
const HIT_FLASH_MS = 60;

interface Floating {
  obj: Phaser.GameObjects.BitmapText;
  life: number;
  at: Point | null; // null: sigue al jugador
  lift: number;
}

interface Puff {
  x: number;
  y: number;
  t: number;
}

// Pinta lo que dice el World; no decide nada de juego
export class ArenaScene extends Phaser.Scene {
  private run!: Run;
  private world!: World;
  private input_!: MoveInput;
  private player!: Phaser.GameObjects.Sprite;
  private readonly enemySprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly weaponSprites: Phaser.GameObjects.Sprite[] = [];
  private readonly projectileSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private readonly materialSprites = new Map<number, Phaser.GameObjects.Sprite>();
  private telegraphs!: Phaser.GameObjects.Graphics;
  private shapes!: Phaser.GameObjects.Graphics; // proyectiles sin sprite y nubecillas de muerte
  private hud!: {
    bar: Phaser.GameObjects.Graphics;
    hp: Phaser.GameObjects.BitmapText;
    wave: Phaser.GameObjects.BitmapText;
    timer: Phaser.GameObjects.BitmapText;
    materialIcon: Phaser.GameObjects.Image;
    materials: Phaser.GameObjects.BitmapText;
  };
  private floating: Floating[] = [];
  private puffs: Puff[] = [];
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
    this.projectileSprites.clear();
    this.materialSprites.clear();
    this.weaponSprites.length = 0;
    this.floating = [];
    this.puffs = [];
    this.acc = 0;
    this.paused = false;
    this.ended = false;
  }

  create(): void {
    const { width, height } = this.run.level.arena;
    this.drawFloor(width, height);
    this.telegraphs = this.add.graphics().setDepth(1);
    this.shapes = this.add.graphics().setDepth(3);

    this.run.onFloatingText = (value, at) => this.floatText(value, at, COLORS.text);
    this.run.onHookError = (message) => this.hookError(message);
    this.world = this.run.startWave();

    const id = this.run.character.id;
    this.player = this.add
      .sprite(this.world.player.x, this.world.player.y, textureKey('character', id))
      .setOrigin(0.5, 1) // pie centrado: cae en píxel entero con celdas de ancho par
      .setDepth(2)
      .play(animKey('character', id, 'idle'));

    for (const w of this.world.weapons) {
      this.weaponSprites.push(this.add.sprite(0, 0, textureKey('weapon', w.def.id)).play(animKey('weapon', w.def.id, 'idle')));
    }

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
    this.syncWeapons();
    this.syncPool(this.world.projectiles, this.projectileSprites, (pr) => this.projectileSprite(pr), (sp, pr) => {
      sp.setPosition(Math.round(pr.x), Math.round(pr.y)).setRotation(pr.angle);
    });
    this.syncPool(this.world.materials, this.materialSprites, () => this.materialSprite(), (sp, m) => {
      sp.setPosition(Math.round(m.x), Math.round(m.y));
    });
    this.drawShapes(dt);
    this.drawTelegraphs();
    this.drainFx();
    this.updateFloating(dt);
    this.updateHud();

    // La cámara se pega a la posición YA redondeada: si se redondean por separado, el personaje tiembla 1 px
    const cam = this.cameras.main;
    const scroll = cameraScroll({ x: px, y: py - this.run.body.centerY }, cam, this.run.level.arena);
    cam.setScroll(scroll.x, scroll.y);
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

  // Sprites que nacen y mueren con una lista del World (proyectiles, materiales)
  private syncPool<T extends { uid: number }>(
    items: readonly T[],
    pool: Map<number, Phaser.GameObjects.Sprite>,
    create: (item: T) => Phaser.GameObjects.Sprite | null,
    update: (sprite: Phaser.GameObjects.Sprite, item: T) => void,
  ): void {
    const alive = new Set<number>();
    for (const item of items) {
      alive.add(item.uid);
      let s = pool.get(item.uid);
      if (!s) {
        const made = create(item);
        if (!made) continue;
        s = made;
        pool.set(item.uid, s);
      }
      update(s, item);
    }
    for (const [uid, s] of pool) {
      if (alive.has(uid)) continue;
      s.destroy();
      pool.delete(uid);
    }
  }

  // Las armas giran hacia su objetivo desde el punto de agarre; apuntando a la izquierda se voltean
  // en vertical para no quedar boca abajo
  private syncWeapons(): void {
    this.world.weapons.forEach((w: WeaponState, i) => {
      const s = this.weaponSprites[i]!;
      const grip = w.def.grip ?? { x: 0, y: w.cell.h / 2 };
      const left = Math.cos(w.angle) < 0;
      s.setFlipY(left).setOrigin(grip.x / w.cell.w, left ? 1 - grip.y / w.cell.h : grip.y / w.cell.h);
      const lunge = w.lunge * w.cell.w * 0.8;
      s.setPosition(Math.round(w.x + Math.cos(w.angle) * lunge), Math.round(w.y + Math.sin(w.angle) * lunge));
      s.setRotation(w.angle).setDepth(2 + (w.y + 1) / 10000);
      const anim = animKey('weapon', w.def.id, w.fireT > 0 && 'fire' in w.def.sprites.anims ? 'fire' : 'idle');
      if (s.anims.currentAnim?.key !== anim) s.play(anim);
    });
  }

  private projectileSprite(p: Projectile): Phaser.GameObjects.Sprite | null {
    const [kind, id] = p.source.split(':') as [string, string];
    const mod = kind === 'weapon' ? this.run.registry.weapon(id) : this.run.registry.enemy(id);
    if (!p.anim || !(p.anim in mod.sprites.anims)) return null; // sin sprite: se dibuja en drawShapes
    return this.add.sprite(0, 0, textureKey(kind, id)).setDepth(3).play(animKey(kind, id, p.anim));
  }

  private materialSprite(): Phaser.GameObjects.Sprite {
    const id = this.run.level.id;
    return this.add.sprite(0, 0, textureKey('level', id)).setDepth(1.5).play(animKey('level', id, 'material'));
  }

  // Proyectiles sin sprite propio (los de los enemigos, por ahora) y nubecillas de muerte
  private drawShapes(dt: number): void {
    const g = this.shapes.clear();
    for (const p of this.world.projectiles) {
      if (this.projectileSprites.has(p.uid)) continue;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      g.fillStyle(COLORS.outline).fillCircle(x, y, p.radius + 1);
      g.fillStyle(p.owner === 'enemy' ? COLORS.threat : COLORS.gold).fillCircle(x, y, p.radius);
    }
    this.puffs = this.puffs.filter((f) => {
      f.t -= dt;
      if (f.t <= 0) return false;
      g.lineStyle(1, COLORS.text, f.t / 0.25).strokeCircle(Math.round(f.x), Math.round(f.y), Math.round(3 + (0.25 - f.t) * 40));
      return true;
    });
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
      } else if (fx.type === 'enemy-hit') {
        const s = this.enemySprites.get(fx.uid);
        if (s) {
          s.setTintFill(0xffffff);
          this.time.delayedCall(HIT_FLASH_MS, () => s.active && s.clearTint());
        }
        this.floatText(String(fx.amount), { x: fx.x, y: fx.y }, fx.crit ? COLORS.gold : COLORS.text, 2);
      } else if (fx.type === 'enemy-die') {
        this.puffs.push({ x: fx.x, y: fx.y, t: 0.25 });
      }
    }
    this.world.fx.length = 0;
  }

  // Sin "at", sigue al jugador y sale sobre su cabeza; con "at", se queda en ese punto
  private floatText(value: string, at: Point | undefined, color: number, lift = this.textLift()): void {
    const p = at ?? this.world?.player ?? { x: 0, y: 0 };
    const obj = text(this, 0, 0, value, uiScale(this)).setTint(color).setDepth(50).setOrigin(0.5, 1);
    obj.setPosition(Math.round(p.x), Math.round(p.y) - lift);
    this.floating.push({ obj, life: at ? 0.7 : 1.4, at: at ? { x: at.x, y: at.y } : null, lift });
  }

  // El texto flotante sale justo encima de la cabeza, mida lo que mida el personaje
  private textLift(): number {
    return this.run.body.cellH + 2;
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
      f.obj.setPosition(Math.round(base.x), Math.round(base.y) - f.lift - rise);
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
      materialIcon: fixed(this.add.image(0, 0, textureKey('level', this.run.level.id), frameOf(this.run.level.sprites, 'material')).setOrigin(0, 0)),
      materials: fixed(text(this, 0, 0, '').setTint(COLORS.gold)),
    };
    this.scale.on('resize', this.layoutHud, this);
    this.layoutHud();
  }

  // Anclado a las esquinas del área visible, que cambia con cada pantalla. Todo a escala entera u.
  private layoutHud(): void {
    const u = uiScale(this);
    for (const t of [this.hud.hp, this.hud.wave, this.hud.timer, this.hud.materials]) t.setFontSize(FONT_SIZE * u);
    this.hud.hp.setPosition((4 + BAR_W + 3) * u, 3 * u);
    // Materiales debajo de la vida: icono a la escala entera de la UI y el número al lado
    const icon = this.hud.materialIcon.setScale(u).setPosition(4 * u, (4 + BAR_H + 3) * u);
    this.hud.materials.setPosition(icon.x + icon.displayWidth + 3 * u, icon.y + Math.round((icon.displayHeight - FONT_SIZE * u) / 2) + u);
    this.placeWave();
  }

  // "OLEADA" va centrada; si en una pantalla estrecha chocaría con la vida, pasa a la esquina derecha
  private placeWave(): void {
    const u = uiScale(this);
    const w = this.scale.width;
    const hpRight = this.hud.hp.x + this.hud.hp.width + 4 * u;
    const centered = Math.floor(w / 2) - Math.ceil(this.hud.wave.width / 2) >= hpRight;
    const x = centered ? Math.floor(w / 2) : w - 4 * u;
    const originX = centered ? 0.5 : 1;
    this.hud.wave.setOrigin(originX, 0).setPosition(x, 3 * u);
    // Una línea entera de aire entre "OLEADA" y el temporizador
    this.hud.timer.setOrigin(originX, 0).setPosition(x, (3 + FONT_SIZE + 3) * u);
  }

  private updateHud(): void {
    const u = uiScale(this);
    const p = this.world.player;
    const g = this.hud.bar.clear();
    g.fillStyle(COLORS.hpBack).fillRect(4 * u, 4 * u, BAR_W * u, BAR_H * u);
    g.fillStyle(COLORS.hp).fillRect(4 * u, 4 * u, Math.round((BAR_W * p.hp) / p.maxHp) * u, BAR_H * u);
    this.hud.hp.setText(`${p.hp}/${p.maxHp}`);
    this.hud.wave.setText(`OLEADA ${this.run.waveNumber}/${this.run.totalWaves}`);
    this.hud.timer.setText(String(Math.ceil(this.world.timeLeft)));
    this.hud.materials.setText(String(this.run.materials));
    this.placeWave();
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

  // Losetas del nivel, al azar según su peso pero siempre iguales para el mismo nivel,
  // horneadas una vez en una textura (no miles de objetos)
  private drawFloor(width: number, height: number): void {
    const level = this.run.level;
    const key = textureKey('level', level.id);
    const frames = level.floor.map((f) => ({ frame: frameOf(level.sprites, f.anim), weight: f.weight }));
    const total = frames.reduce((sum, f) => sum + f.weight, 0);
    const tile = this.textures.getFrame(key, frames[0]!.frame);
    const tw = tile.width;
    const th = tile.height;
    const rng = createRng([...level.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
    const rt = this.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(0);
    for (let y = 0; y < height; y += th) {
      for (let x = 0; x < width; x += tw) {
        let roll = rng() * total;
        const pick = frames.find((f) => (roll -= f.weight) < 0) ?? frames[0]!;
        rt.drawFrame(key, pick.frame, x, y);
      }
    }
    this.cameras.main.setBackgroundColor('#12101c');
  }
}
