// El aspecto de un arma, un enemigo o un ítem en el mundo de una partida (solo para la vista: la simulación no lo
// lee). Un mundo sin aspecto propio usa el de la oficina, que es obligatorio.
import type { EnemyModule, ItemModule, Look, ThemeId, WeaponModule } from './registry/schemas';

type ItemLook = ItemModule['looks']['oficina'];

export function lookOf(mod: WeaponModule | EnemyModule, theme: ThemeId): Look;
export function lookOf(mod: ItemModule, theme: ThemeId): ItemLook;
export function lookOf(mod: WeaponModule | EnemyModule | ItemModule, theme: ThemeId): Look | ItemLook {
  return mod.looks[theme] ?? mod.looks.oficina;
}
