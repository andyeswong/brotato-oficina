import Phaser from 'phaser';
import { Run } from '../../sim/Run';
import { text } from '../font';

// Game over o victoria. Cualquier tecla o toque empieza otra partida con el mismo personaje y nivel.
export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(data: { run: Run; result: 'victory' | 'defeat' }): void {
    const { run, result } = data;
    this.cameras.main.setBackgroundColor('#12101c');
    const cx = Math.floor(this.scale.width / 2);
    const cy = Math.floor(this.scale.height / 2);

    const title = result === 'victory' ? '¡Victoria!' : 'Has caído';
    const detail = result === 'victory'
      ? `${run.totalWaves} oleadas superadas`
      : `en la oleada ${run.waveNumber} de ${run.totalWaves}`;
    text(this, cx, cy - 20, title).setOrigin(0.5).setTint(result === 'victory' ? 0xf0b951 : 0xff4d5e);
    text(this, cx, cy - 8, `${run.character.name} · ${detail}`).setOrigin(0.5);
    text(this, cx, cy + 14, 'pulsa una tecla o toca para jugar otra').setOrigin(0.5).setAlpha(0.7);

    // Medio segundo de gracia: que una tecla pulsada al morir no salte la pantalla
    this.time.delayedCall(500, () => {
      const again = () => this.scene.start('Arena', { run: new Run(run.registry, run.character, run.level) });
      this.input.keyboard?.once('keydown', again);
      this.input.once('pointerdown', again);
    });
  }
}
