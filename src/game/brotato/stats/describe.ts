import type { CounterId, Modifier, StatModule } from '../registry/schemas';

// Texto de un modificador para la pantalla de selección o la tienda, generado desde los datos:
// un personaje o ítem nuevo no necesita escribir su ficha a mano para que se lea bien.
const COUNTER_LABELS: Record<CounterId, [singular: string, plural: string]> = {
  'distinct-weapons': ['arma distinta', 'armas distintas'],
  wave: ['oleada', 'oleadas'],
  kills: ['baja', 'bajas'],
  materials: ['material', 'materiales'],
  items: ['ítem', 'ítems'],
};

export interface ModifierLine {
  text: string;
  good: boolean; // de momento todas las stats son "más es mejor"
}

export function describeModifier(m: Modifier, stats: ReadonlyMap<string, StatModule>): ModifierLine {
  const stat = stats.get(m.stat);
  const name = (stat?.name ?? m.stat).toLowerCase();
  const unit = stat?.display === 'percent' ? ' %' : '';
  let text: string;
  let value: number;
  if (m.mul !== undefined) {
    value = m.mul - 1;
    text = `${name} ×${num(m.mul)}`;
  } else if (m.pct !== undefined) {
    value = m.pct;
    text = `${signed(m.pct)} % de ${name}`;
  } else {
    value = m.add ?? 0;
    text = `${signed(value)}${unit} de ${name}`;
  }
  if (m.per) {
    const [one, many] = COUNTER_LABELS[m.per.counter];
    text += m.per.every === 1 ? ` por cada ${one}` : ` por cada ${num(m.per.every)} ${many}`;
  }
  if (m.weaponTag) text += ` con armas ${m.weaponTag.replace(/-/g, ' ')}`;
  return { text, good: value >= 0 };
}

function num(v: number): string {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

function signed(v: number): string {
  return `${v >= 0 ? '+' : '-'}${num(Math.abs(v))}`;
}
