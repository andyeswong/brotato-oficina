// Lo ÚNICO que importa el contenido. Los define* solo etiquetan el objeto para que TypeScript
// autocomplete; la validación de verdad la hace el registro al arrancar.
import type { z } from 'zod';
import type { characterSchema, levelSchema, statSchema } from '../registry/schemas';

export { z } from 'zod';
export type { Modifier, HookEvent } from '../registry/schemas';

type Input<S extends z.ZodType> = Omit<z.input<S>, 'kind'>;

export function defineStat(def: Input<typeof statSchema>) {
  return { ...def, kind: 'stat' as const };
}

export function defineCharacter(def: Input<typeof characterSchema>) {
  return { ...def, kind: 'character' as const };
}

export function defineLevel(def: Input<typeof levelSchema>) {
  return { ...def, kind: 'level' as const };
}
