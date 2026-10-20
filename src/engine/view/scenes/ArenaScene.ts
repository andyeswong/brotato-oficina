import Phaser from 'phaser';
import type { CharacterModule, LevelModule } from '../../registry/schemas';
import type { Registry } from '../../registry/validate';
import { StatSheet, type StatDef } from '../../stats/StatSheet';
import { animKey, textureKey } from '../anims';
import { MoveInput } from '../input';
import { setPaused } from '../overlay';

const STEP = 1 / 60;          // la simulación corre a paso fijo
const MAX_STEPS = 5;          // tras un tirón no se intenta recuperar más de 5 pasos
const BASE_SPEED = 90;        // píxeles lógicos por segundo con speed-pct = 0
const TILE = 16;

interface ArenaData {
  registry: Registry;
  characterId: string;
  levelId: string;
}

// Esqueleto: arena vacía y el personaje caminando. Los sistemas de F1 (spawn, armas, daño…) se cuelgan del paso fijo.
export class ArenaScene extends Phaser.Scene {
  private character!: CharacterModule;
  private level!: LevelModule;
  private stats!: StatSheet;
  private input_!: MoveInput;
  private sprite!: Phaser.GameObjects.Sprite;
  private readonly pos = new Phaser.Math.Vector2();
  private readonly move = new Phaser.Math.Vector2();
  private acc = 0;
  private paused = false;

  constructor() {
    super('Arena');
  }

  init(data: ArenaData): void {
    this.character = data.registry.character(data.characterId);
    this.level = data.registry.level(data.levelId);
    const defs = new Map<string, StatDef>(data.registry.stats().map((s) => [s.id, s]));
    this.stats = new StatSheet(defs, this.character.baseStats);
    this.stats.setSource(`character:${this.character.id}`, this.character.modifiers ?? []);
  }

  create(): void {
    const { width, height } = this.level.arena;
    this.drawFloor(width, height);

    this.pos.set(Math.floor(width / 2), Math.floor(height / 2));
    // Ancla en el pie centrado: los frames de 32 y de 34 caen en píxel entero (16 y 17)
    this.sprite = this.add
      .sprite(this.pos.x, this.pos.y, textureKey('character', this.character.id))
      .setOrigin(0.5, 1)
      .play(animKey('character', this.character.id, 'idle'));

    this.input_ = new MoveInput(this);

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
    });
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused) return;
    this.acc = Math.min(this.acc + deltaMs / 1000, STEP * MAX_STEPS);
    while (this.acc >= STEP) {
      this.step(STEP);
      this.acc -= STEP;
    }
    this.render();
  }

  private step(dt: number): void {
    this.input_.read(this.move);
    const speed = BASE_SPEED * (1 + this.stats.get('speed-pct') / 100);
    const { width, height } = this.level.arena;
    this.pos.x = Phaser.Math.Clamp(this.pos.x + this.move.x * speed * dt, 8, width - 8);
    this.pos.y = Phaser.Math.Clamp(this.pos.y + this.move.y * speed * dt, 16, height - 2);
  }

  private render(): void {
    // La simulación va en flotante; se pinta redondeado
    const x = Math.round(this.pos.x);
    const y = Math.round(this.pos.y);
    this.sprite.setPosition(x, y);

    const moving = this.move.lengthSq() > 0.01;
    const anim = animKey('character', this.character.id, moving ? 'walk' : 'idle');
    if (this.sprite.anims.currentAnim?.key !== anim) this.sprite.play(anim);
    if (this.move.x !== 0) this.sprite.setFlipX(this.move.x < 0);

    // La cámara se pega a la posición YA redondeada: si se redondean por separado, el personaje tiembla 1 px
    const cam = this.cameras.main;
    cam.setScroll(x - Math.floor(cam.width / 2), y - 16 - Math.floor(cam.height / 2));

    this.input_.draw();
  }

  private setPausedState(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.acc = 0;
    setPaused(paused);
    if (paused) this.sprite.anims.pause();
    else this.sprite.anims.resume();
  }

  private drawFloor(width: number, height: number): void {
    const g = this.add.graphics();
    for (let ty = 0; ty < height / TILE; ty++) {
      for (let tx = 0; tx < width / TILE; tx++) {
        g.fillStyle((tx + ty) % 2 === 0 ? 0x2a2738 : 0x2f2c40);
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }
    g.lineStyle(2, 0x7a5bd6).strokeRect(1, 1, width - 2, height - 2);
    this.cameras.main.setBackgroundColor('#14121f');
  }
}
