import type { LevelContext } from './story';
import type { TroopType } from '../types';

export type Direction = 'n' | 's' | 'e' | 'w';

export interface GroupSpec {
  type: TroopType;
  count: number;
}

export function spawnGroup(ctx: LevelContext, x: number, y: number, groups: GroupSpec[], spread = 140): void {
  for (const g of groups) {
    for (let i = 0; i < g.count; i++) {
      const dx = (Math.random() - 0.5) * spread;
      const dy = (Math.random() - 0.5) * spread;
      ctx.spawnEnemy(g.type, x + dx, y + dy);
    }
  }
}

export function attackPoint(center: { x: number; y: number }, dir: Direction, dist: number): { x: number; y: number } {
  switch (dir) {
    case 'n':
      return { x: center.x, y: center.y - dist };
    case 's':
      return { x: center.x, y: center.y + dist };
    case 'e':
      return { x: center.x + dist, y: center.y };
    case 'w':
      return { x: center.x - dist, y: center.y };
  }
}

export function anyEnemyAlive(ctx: LevelContext): boolean {
  for (const u of ctx.units) {
    if (u.alive && u.team === 'enemy') return true;
  }
  return false;
}

export function placeArmy(
  ctx: LevelContext,
  center: { x: number; y: number },
  counts: Partial<Record<TroopType, number>>,
  spacing = 55,
): void {
  const order: TroopType[] = ['champion', 'knight', 'archer', 'tank'];
  const list: TroopType[] = [];
  for (const t of order) {
    const n = counts[t] ?? 0;
    for (let i = 0; i < n; i++) list.push(t);
  }
  list.forEach((t, i) => {
    const a = (i / list.length) * Math.PI * 2 + (t === 'champion' ? 0.5 : 0);
    ctx.createPlayerUnit(t, center.x + Math.cos(a) * spacing, center.y + Math.sin(a) * spacing);
  });
}