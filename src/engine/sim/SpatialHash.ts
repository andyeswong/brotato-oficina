// Rejilla espacial para "¿quién está cerca?" sin recorrer todas las entidades
export class SpatialHash<T extends { x: number; y: number }> {
  private readonly cells = new Map<number, T[]>();

  constructor(private readonly cellSize = 32) {}

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const key = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    const cell = this.cells.get(key);
    if (cell) cell.push(item);
    else this.cells.set(key, [item]);
  }

  // Todo lo que está en las celdas que toca el círculo; quien llama filtra por distancia exacta
  query(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const x0 = Math.floor((x - radius) / this.cellSize);
    const x1 = Math.floor((x + radius) / this.cellSize);
    const y0 = Math.floor((y - radius) / this.cellSize);
    const y1 = Math.floor((y + radius) / this.cellSize);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (cell) for (const item of cell) out.push(item);
      }
    }
    return out;
  }

  private key(cx: number, cy: number): number {
    // Las arenas miden mucho menos de 2^15 celdas por lado
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }
}
