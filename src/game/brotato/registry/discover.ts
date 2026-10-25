import type { DiscoveredModule } from './validate';

// Vite resuelve el glob en build: agregar una carpeta en src/content/brotato/ basta para que el motor la vea.
// Las carpetas que empiezan por "_" quedan fuera (contenido desactivado sin borrarlo).
// Ruta relativa a este fichero: la raíz de vite es el repo en las pruebas y app/ en el build de la app, y una ruta
// absoluta (/src/...) no encontraría nada en el build
const found = import.meta.glob(['../../../content/brotato/*/*/module.ts', '!../../../content/brotato/*/_*/module.ts'], {
  eager: true,
  import: 'default',
});

export function discoverContent(): DiscoveredModule[] {
  return Object.entries(found).map(([path, value]) => ({ path, value }));
}
