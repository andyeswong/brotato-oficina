// Un error de contenido siempre dice qué archivo, qué campo y qué esperaba
export interface ContentError {
  path: string;
  field?: string;
  message: string;
}

export function formatField(path: readonly PropertyKey[]): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${String(part)}` : String(part);
  }
  return out;
}

export function formatErrors(errors: readonly ContentError[]): string {
  const byPath = new Map<string, ContentError[]>();
  for (const e of errors) {
    const list = byPath.get(e.path) ?? [];
    list.push(e);
    byPath.set(e.path, list);
  }
  const n = errors.length;
  const lines = [`✗ El contenido tiene ${n} ${n === 1 ? 'error' : 'errores'}. El juego no arranca hasta arreglarlos.`];
  for (const [path, list] of byPath) {
    lines.push('', `  ${path}`);
    for (const e of list) lines.push(`    ${e.field ? `${e.field}: ` : ''}${e.message}`);
  }
  return lines.join('\n');
}

// Distancia de edición, para el "¿querías decir…?"
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(up + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length]!;
}

export function suggest(wrong: string, candidates: Iterable<string>): string {
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(wrong, c);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best !== undefined && bestDist <= Math.max(2, Math.floor(wrong.length / 3)) ? ` ¿Querías decir "${best}"?` : '';
}
