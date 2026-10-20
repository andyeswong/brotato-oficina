# Genera las 10 oleadas de F1 con una rampa continua. Uso: python3 scripts/gen-waves.py [k=1.0] [pendiente=0.2]
# k escala toda la dificultad; la pendiente, cuánto crece el ritmo de bichos grapa por oleada. Ver motor/CURVA-F1.md.
import sys
k = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
slope = float(sys.argv[2]) if len(sys.argv) > 2 else 0.2
base = '/home/andyeswong/Sync/brotato-oficina/juego/src/content/waves'
def f(x): return f"{x:.2f}".rstrip('0').rstrip('.')
for n in range(1, 11):
    dur = min(20 + 5 * (n - 1), 60)
    end = dur - 2
    grapa_rate = k * (1.3 + slope * (n - 1))         # bichos grapa por segundo, rampa continua
    g = [f"    {{ enemy: 'bicho-grapa', from: 0, to: {end}, every: {f(2 / grapa_rate)}, count: 2, pattern: 'random' }},"]
    if n >= 2:
        g.append(f"    {{ enemy: 'bicho-grapa', from: {dur // 2}, to: {end}, every: 5, count: {3 + round(n * k / 2)}, pattern: 'cluster' }},")
        g.append(f"    {{ enemy: 'bicho-clip', from: 3, to: {end}, every: {f(max(1.6, (5.5 - 0.45 * n) / k))}, count: {1 + (n >= 7)}, pattern: 'edge' }},")
    if n >= 3:
        g.append(f"    {{ enemy: 'bicho-taza', from: 5, to: {end}, every: {f(max(3, (9 - 0.6 * n) / k))}, count: {1 + (n >= 8)}, pattern: 'edge' }},")
    if n >= 6:
        g.append(f"    {{ enemy: 'bicho-grapa', from: {dur - 15}, to: {dur - 5}, every: 10, count: {6 + n - 6}, pattern: 'ring' }},")
    body = "\n".join(g)
    open(f'{base}/o{n:02d}/module.ts', 'w').write(f"""import {{ defineWave }} from '@engine/api';

// Rampa continua de F1 (factor de dificultad {f(k)}): bichos grapa a 1,3 + {f(slope).replace('.', ',')} × (oleada − 1) por segundo,
// clip desde la 2 y taza desde la 3. Ver motor/CURVA-F1.md.
export default defineWave({{
  format: 1,
  id: 'o{n:02d}',
  name: 'Oleada {n}',
  duration: {dur},
  groups: [
{body}
  ],
}});
""")
