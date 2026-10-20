import Phaser from 'phaser';
import { formatErrors } from '../../registry/ContentError';
import { discoverContent } from '../../registry/discover';
import type { Sprites } from '../../registry/schemas';
import { validateContent, type Registry } from '../../registry/validate';
import { Run } from '../../sim/Run';
import { createAnims, loadSheet, textureKey } from '../anims';
import { createPixelFont } from '../font';
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
    for (const [kind, id, sprites] of this.sheets()) loadSheet(this, textureKey(kind, id), sprites);
  }

  create(): void {
    if (!this.registry_) return;
    createPixelFont(this);
    for (const [kind, id, sprites] of this.sheets()) createAnims(this, textureKey(kind, id), sprites, kind, id);

    // Un solo nivel por ahora: el primero. Con parámetros de prueba, también el primer personaje
    const character = this.registry_.characters()[0];
    const level = this.registry_.levels()[0];
    if (!character || !level) {
      showContentErrors('✗ No hay ningún personaje o ningún nivel en src/content/.');
      return;
    }
    // Parámetros de prueba (para verificar sin jugar hasta ahí):
    //   ?weapons=buzon,regla  armas iniciales   ?wave=4  empezar en esa oleada
    //   ?materials=50  materiales iniciales      ?shop    empezar en la tienda
    const query = new URLSearchParams(location.search);
    const override = query.get('weapons');
    const weapons = override?.split(',').map((w) => w.trim()).filter(Boolean);
    const unknown = weapons?.filter((w) => !this.registry_.has('weapon', w)) ?? [];
    if (unknown.length > 0) {
      showContentErrors(`✗ ?weapons= pide armas que no existen: ${unknown.join(', ')}.\n\n  Hay: ${this.registry_.ids('weapon').join(', ')}`);
      return;
    }
    // Sin parámetros de prueba, se empieza eligiendo agente
    if (!['weapons', 'wave', 'materials', 'shop'].some((k) => query.has(k))) {
      this.scene.start('Select', { registry: this.registry_, level });
      return;
    }
    const run = new Run(this.registry_, character, level, undefined, { weapons });
    const wave = Number(query.get('wave'));
    if (Number.isInteger(wave) && wave >= 1) run.waveIndex = Math.min(wave, run.totalWaves) - 1;
    const materials = Number(query.get('materials'));
    if (Number.isInteger(materials) && materials > 0) run.materials = materials;
    if (query.has('shop')) {
      run.shop.open();
      this.scene.start('Shop', { run });
      return;
    }
    this.scene.start('Arena', { run });
  }

  private sheets(): Array<[string, string, Sprites]> {
    return [
      ...this.registry_.characters().map((c) => ['character', c.id, c.sprites] as [string, string, Sprites]),
      ...this.registry_.enemies().map((e) => ['enemy', e.id, e.sprites] as [string, string, Sprites]),
      ...this.registry_.weapons().map((w) => ['weapon', w.id, w.sprites] as [string, string, Sprites]),
      ...this.registry_.levels().map((l) => ['level', l.id, l.sprites] as [string, string, Sprites]),
      ...this.registry_.items().filter((i) => i.sprites).map((i) => ['item', i.id, i.sprites!] as [string, string, Sprites]),
    ];
  }
}
