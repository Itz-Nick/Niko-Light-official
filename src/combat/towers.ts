import { CONFIG } from '../config';
import type { SpatialGrid } from '../core/grid';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import { spawnTowerShot } from './projectile';
import type { Projectile } from './projectile';

const candidates: Unit[] = [];

export function updateTowers(
  structures: Structure[],
  grid: SpatialGrid,
  projectiles: Projectile[],
  dt: number,
): number {
  let shots = 0;
  for (const t of structures) {
    if (!t.alive || t.kind !== 'tower') continue;
    t.attackTimer -= dt;
    const target = t.attackTarget;
    if (target) {
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      if (!target.alive || dx * dx + dy * dy > t.attackRange * t.attackRange) t.attackTarget = null;
    }
    if (!t.attackTarget) {
      grid.queryCircle(t.x, t.y, t.attackRange, candidates);
      let best: Unit | null = null;
      let bestScore = Infinity;
      for (const c of candidates) {
        if (!c.alive || c.team === t.team) continue;
        const score = towerPriority(t, c, structures);
        if (score < bestScore) {
          bestScore = score;
          best = c;
        }
      }
      t.attackTarget = best;
    }
    if (t.attackTarget && t.attackTimer <= 0) {
      projectiles.push(spawnTowerShot(t.x, t.y, t.damage, t.attackTarget, t.team));
      t.attackTimer = t.attackCooldown;
      t.flashTimer = CONFIG.ui.hitFlashDuration;
      shots++;
    }
  }
  return shots;
}

function towerPriority(tower: Structure, enemy: Unit, structures: Structure[]): number {
  const dx = enemy.x - tower.x;
  const dy = enemy.y - tower.y;
  let score = dx * dx + dy * dy;
  if (enemy.structureTarget && enemy.structureTarget.alive && enemy.structureTarget.kind === 'wall') {
    score -= 100000;
  }
  const castle = findCastle(structures);
  if (castle) {
    const cdx = enemy.x - castle.x;
    const cdy = enemy.y - castle.y;
    if (Math.abs(cdx) <= CONFIG.castle.wallHalf && Math.abs(cdy) <= CONFIG.castle.wallHalf) score -= 50000;
    score += Math.hypot(cdx, cdy);
  }
  return score;
}

function findCastle(structures: Structure[]): Structure | null {
  for (const s of structures) {
    if (s.alive && s.kind === 'base') return s;
  }
  return null;
}