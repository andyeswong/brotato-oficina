import Phaser from 'phaser';
import { formatErrors } from '../../registry/ContentError';
import { discoverContent } from '../../registry/discover';
import { validateContent, type Registry } from '../../registry/validate';
import { createAnims, loadSheet, textureKey } from '../anims';
import { showContentErrors } from '../overlay';

// Descubrir → validar → (errores: se para aquí) → cargar hojas → crear animaciones → arena
export class BootScene extends Phaser.Scene {
  private registry_!: Registry;

  constructor() {
    super('Boot');
  }

  preload(): void {
    const { registry, errors } = validateContent(discoverContent());
    if (errors.length > 0) {
      const text = formatErrors(errors);
      console.error(text);
      showContentErrors(text);
      this.scene.stop();
      return;
    }
    this.registry_ = registry;
    for (const c of registry.characters()) loadSheet(this, textureKey('character', c.id), c.sprites);
  }

  create(): void {
    if (!this.registry_) return;
    for (const c of this.registry_.characters()) createAnims(this, textureKey('character', c.id), c.sprites, 'character', c.id);

    // Hasta que exista la pantalla de selección: el primer personaje y el primer nivel
    const character = this.registry_.characters()[0];
    const level = this.registry_.levels()[0];
    if (!character || !level) {
      showContentErrors('✗ No hay ningún personaje o ningún nivel en src/content/.');
      return;
    }
    this.scene.start('Arena', { registry: this.registry_, characterId: character.id, levelId: level.id });
  }
}
