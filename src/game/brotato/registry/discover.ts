import type { DiscoveredModule } from './validate';

// Vite resuelve el glob en build: agregar una carpeta en src/content/brotato/ basta para que el motor la vea.
// Las carpetas que empiezan por "_" quedan fuera (contenido desactivado sin borrarlo).
const found = import.meta.glob(['/src/content/brotato/*/*/module.ts', '!/src/content/brotato/*/_*/module.ts'], {
  eager: true,
  import: 'default',
});

export function discoverContent(): DiscoveredModule[] {
  return Object.entries(found).map(([path, value]) => ({ path, value }));
}
