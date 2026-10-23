// PARTE PURA: la descripción de un tema de mapa. Es solo DATOS: los nombres son claves de animación de la
// hoja del nivel (el motor no sabe qué son: eso es contenido). Un nivel que quiera un mapa distinto en cada
// partida declara un GeneratorSpec en vez de un mapa fijo.
import type { SourceKind } from '../lighting/lights';

export interface Pick {
  anim: string;
  weight: number;
}

export interface FacadeSpec {
  fill: readonly Pick[];                   // piezas que rellenan la fachada
  neutral: string;                         // la única que puede repetirse seguida
  door: string;                            // se ponen dos
  flank?: string;                          // a cada lado de cada puerta
  banner?: string;                         // repartidos por la fachada
  crest?: string;                          // dos juntos, en el centro
  emits: Readonly<Record<string, SourceKind>>;   // qué piezas son fuente de luz y de qué tipo
}

export interface WaterSpec {
  ocean: boolean;
  lake: boolean;
  puddles: number;
}

export interface GeneratorSpec {
  cols: number;                            // en tiles de 16 px: la arena mide cols*16 x rows*16
  rows: number;
  floors: readonly Pick[];                 // suelo, al azar con peso
  caps: readonly [string, string];         // tapa de las paredes: se alternan
  facade: FacadeSpec;
  water: WaterSpec;
  pillars: number;                         // columnas que bloquean luz y paso
  materials: number;                       // materiales sueltos por el suelo
}
