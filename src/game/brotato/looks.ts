// El aspecto de un arma o un enemigo en el mundo de una partida (solo para la vista: la simulación no lo lee).
// Un mundo sin aspecto propio usa el de la oficina, que es obligatorio.
import type { EnemyModule, Look, ThemeId, WeaponModule } from './registry/schemas';

export function lookOf(mod: WeaponModule | EnemyModule, theme: ThemeId): Look {
  return mod.looks[theme] ?? mod.looks.oficina;
}
