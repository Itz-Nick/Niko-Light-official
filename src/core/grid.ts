import type { Unit } from '../entities/unit';

export class SpatialGrid {
  private readonly cellSize: number;
  private cells = new Map<string, Unit[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(unit: Unit): void {
    const key = `${Math.floor(unit.x / this.cellSize)},${Math.floor(unit.y / this.cellSize)}`;
    let list = this.cells.get(key);
    if (!list) {
      list = [];
      this.cells.set(key, list);
    }
    list.push(unit);
  }

  queryCircle(x: number, y: number, radius: number, out: Unit[]): Unit[] {
    out.length = 0;
    const minCX = Math.floor((x - radius) / this.cellSize);
    const maxCX = Math.floor((x + radius) / this.cellSize);
    const minCY = Math.floor((y - radius) / this.cellSize);
    const maxCY = Math.floor((y + radius) / this.cellSize);
    const radiusSq = radius * radius;
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const list = this.cells.get(`${cx},${cy}`);
        if (!list) continue;
        for (const u of list) {
          const dx = u.x - x;
          const dy = u.y - y;
          if (dx * dx + dy * dy <= radiusSq) out.push(u);
        }
      }
    }
    return out;
  }
}