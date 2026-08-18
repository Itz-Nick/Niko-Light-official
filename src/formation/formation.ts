import { CONFIG } from '../config';
import type { Unit } from '../entities/unit';

export type FormationKind = 'line' | 'v' | 'square' | 'defense';

export interface Point {
  x: number;
  y: number;
}

export function formationTargets(
  kind: FormationKind,
  units: readonly Unit[],
  center: Point,
  facing: Point = { x: 0, y: -1 },
): Map<Unit, Point> {
  const targets = new Map<Unit, Point>();
  const n = units.length;
  if (n === 0) return targets;
  const spacing = CONFIG.selection.spacing;
  const fl = Math.hypot(facing.x, facing.y) || 1;
  const fx = facing.x / fl;
  const fy = facing.y / fl;
  const ax = -fy;
  const ay = fx;
  const pts: Point[] = [];

  switch (kind) {
    case 'line': {
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * spacing;
        pts.push({ x: center.x + ax * off, y: center.y + ay * off });
      }
      break;
    }
    case 'v': {
      const depth = spacing * 2;
      const spread = spacing * 1.2;
      for (let i = 0; i < n; i++) {
        const row = Math.floor(i / 2);
        const side = i % 2 === 0 ? -1 : 1;
        pts.push({
          x: center.x - fx * row * depth + ax * side * (row + 1) * spread,
          y: center.y - fy * row * depth + ay * side * (row + 1) * spread,
        });
      }
      break;
    }
    case 'square': {
      const side = Math.max(2, Math.ceil(Math.sqrt(n)));
      const half = Math.floor(side / 2);
      for (let ring = 0; ring < Math.ceil(side / 2) && pts.length < n; ring++) {
        const lo = -half + ring;
        const hi = lo + side - ring * 2 - 1;
        for (let x = lo; x <= hi && pts.length < n; x++) {
          for (let y = lo; y <= hi && pts.length < n; y++) {
            if (x === lo || x === hi || y === lo || y === hi) {
              pts.push({ x: center.x + x * spacing, y: center.y + y * spacing });
            }
          }
        }
      }
      break;
    }
    case 'defense': {
      const front = units.filter((u) => u.role !== 'backline');
      const back = units.filter((u) => u.role === 'backline');
      const place = (list: readonly Unit[], depth: number): void => {
        const m = list.length;
        for (let i = 0; i < m; i++) {
          const off = (i - (m - 1) / 2) * spacing;
          pts.push({
            x: center.x + fx * spacing * depth + ax * off,
            y: center.y + fy * spacing * depth + ay * off,
          });
        }
      };
      place(front, 1);
      place(back, -1.4);
      break;
    }
  }

  for (let i = 0; i < n; i++) {
    const p = pts[i] ?? center;
    targets.set(units[i], p);
  }
  return targets;
}