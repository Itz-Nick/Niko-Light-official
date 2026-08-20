import { CONFIG } from '../config';
import { spawnArrow } from './projectile';
import { updateBossAbilities } from './boss';
import type { Projectile } from './projectile';
import type { SpatialGrid } from '../core/grid';
import type { Economy } from '../economy/economy';
import { distToWall } from '../entities/structures';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { HitInfo } from '../types';

const candidates: Unit[] = [];
const THINK_INTERVAL = 0.25;
const ARCHER_ENGAGED_BONUS = 14400;

export function updateCombat(
  units: Unit[],
  structures: Structure[],
  grid: SpatialGrid,
  economy: Economy,
  dt: number,
): { spawned: Projectile[]; hits: HitInfo[] } {
  const spawned: Projectile[] = [];
  const hits: HitInfo[] = [];

  for (const u of units) {
    if (!u.alive) continue;
    u.attackTimer = Math.max(0, u.attackTimer - dt);
    u.thinkTimer -= dt;
    u.flashTimer = Math.max(0, u.flashTimer - dt);

    if (u.team === 'player' && u.moveTarget !== null && !u.aiControl) {
      u.attackTarget = null;
      continue;
    }

    if (u.attackTarget && (!u.attackTarget.alive || u.attackTarget.team === u.team)) {
      u.attackTarget = null;
    }
    if (u.attackTarget) {
      const dx = u.attackTarget.x - u.x;
      const dy = u.attackTarget.y - u.y;
      const loseRadius = u.troopType === 'archer' ? u.attackRange * 3 : u.searchRadius * 2;
      if (dx * dx + dy * dy > loseRadius * loseRadius) u.attackTarget = null;
    }

    if (u.thinkTimer <= 0) {
      u.thinkTimer = THINK_INTERVAL;
      if (u.troopType === 'boss') {
        findBossTarget(grid, u);
      } else if (!u.attackTarget) {
        u.attackTarget =
          u.troopType === 'archer' ? findArcherTarget(grid, u) : findNearestEnemy(grid, u);
      }
    }

    if (u.team === 'player') {
      if (u.structureTarget && (!u.structureTarget.alive || u.structureTarget.team === 'player')) {
        u.structureTarget = null;
      }
      if (!u.attackTarget && !u.structureTarget) {
        u.structureTarget = findEnemyStructureInRange(u, structures);
      }
    }

    if (u.aiControl) {
      if (u.structureTarget && (!u.structureTarget.alive || u.structureTarget.team === u.team)) {
        u.structureTarget = null;
      }
      continue;
    }

    if (u.team === 'enemy') {
      if (u.attackTarget) {
        u.structureTarget = null;
        u.advanceTarget = null;
        u.flankPoint = null;
      } else if (u.troopType === 'boss') {
        bossStructureThink(u, structures);
      } else if (u.defendPoint) {
        // adventure defenders: hold near home, react to nearby foes.
        // if a player base ends up in reach (defenders were lured there),
        // siege it so defeat remains possible.
        const blocked = blockingBuilding(u, structures, u.defendPoint);
        if (blocked) {
          u.structureTarget = blocked;
          u.flankPoint = null;
        } else {
          const primary = findPlayerStructure(structures, u);
          if (primary && inStructureRange(u, primary)) {
            u.structureTarget = primary;
            u.advanceTarget = null;
            u.flankPoint = null;
          } else {
            u.structureTarget = null;
            u.advanceTarget = u.defendPoint;
            u.flankPoint = null;
          }
        }
      } else {
        const blocked = blockingBuilding(u, structures, u.advanceTarget);
        if (blocked) {
          u.structureTarget = blocked;
          u.flankPoint = null;
        } else {
          const wall = blockingWall(u, structures);
          if (wall) {
            u.structureTarget = wall;
          } else {
            const primary = findPrimaryStructure(structures, u);
            if (primary) {
              if (u.flankPoint) {
                const dx = u.flankPoint.x - u.x;
                const dy = u.flankPoint.y - u.y;
                if (dx * dx + dy * dy < 150 * 150) u.flankPoint = null;
              }
              if (u.flankPoint) {
                u.advanceTarget = { x: u.flankPoint.x, y: u.flankPoint.y };
              } else {
                u.advanceTarget = enemyDestination(u, primary);
              }
              if (inStructureRange(u, primary)) {
                u.structureTarget = primary;
              } else {
                const mine = findMineInRange(u, structures, u.searchRadius);
                u.structureTarget = mine && inStructureRange(u, mine) ? mine : null;
              }
            } else {
              u.advanceTarget = null;
              u.structureTarget = null;
            }
          }
        }
      }
    }
  }

  for (const u of units) {
    if (!u.alive || u.attackTimer > 0) continue;
    const target = u.attackTarget && u.attackTarget.alive ? u.attackTarget : null;
    if (target && inAttackRange(u, target)) {
      if (u.troopType === 'archer') {
        spawned.push(spawnArrow(u, u.damage, target, null));
      } else {
        const dmg = Math.max(1, u.damage * (1 - target.defense));
        target.hp -= dmg;
        target.flashTimer = CONFIG.ui.hitFlashDuration;
        hits.push({ x: target.x, y: target.y, damage: dmg, source: 'unit', ranged: false });
      }
      u.attackTimer = u.attackCooldown;
    } else if (u.structureTarget && u.structureTarget.alive && inStructureRange(u, u.structureTarget)) {
      if (u.troopType === 'archer') {
        spawned.push(spawnArrow(u, u.damage, null, u.structureTarget));
      } else {
        u.structureTarget.hp -= u.damage;
        u.structureTarget.flashTimer = CONFIG.ui.hitFlashDuration;
        hits.push({
          x: u.structureTarget.x,
          y: u.structureTarget.y,
          damage: u.damage,
          source: u.structureTarget.kind as HitInfo['source'],
          ranged: false,
        });
      }
      u.attackTimer = u.attackCooldown;
    }
  }

  for (const u of units) {
    if (!u.alive) continue;
    if (u.hp <= 0) {
      u.alive = false;
      if (u.team === 'enemy') economy.add(CONFIG.economy.killReward);
    }
  }

  for (const s of structures) {
    if (s.alive && s.hp <= 0) s.alive = false;
  }

  updateBossAbilities(units, grid, dt, hits);

  return { spawned, hits };
}

function findBossTarget(grid: SpatialGrid, u: Unit): void {
  const aggro = CONFIG.boss.aggroRadius;
  grid.queryCircle(u.x, u.y, aggro, candidates);
  let best: Unit | null = null;
  let bestSq = Infinity;
  for (const n of candidates) {
    if (n === u || n.team === u.team || !n.alive) continue;
    const dx = n.x - u.x;
    const dy = n.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = n;
    }
  }
  u.attackTarget = best;
}

function bossStructureThink(u: Unit, structures: Structure[]): void {
  const smashSq = CONFIG.boss.smashRange * CONFIG.boss.smashRange;
  for (const s of structures) {
    if (!s.alive || s.team !== 'player' || s.kind !== 'tower') continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    if (dx * dx + dy * dy <= smashSq) {
      u.structureTarget = s;
      u.advanceTarget = null;
      u.flankPoint = null;
      return;
    }
  }
  const blocked = blockingBuilding(u, structures, u.advanceTarget);
  if (blocked) {
    u.structureTarget = blocked;
    u.flankPoint = null;
    return;
  }
  const wall = blockingWall(u, structures);
  if (wall) {
    u.structureTarget = wall;
    u.advanceTarget = null;
    u.flankPoint = null;
    return;
  }
  const primary = findPrimaryStructure(structures, u);
  if (!primary) {
    u.structureTarget = null;
    u.advanceTarget = null;
    u.flankPoint = null;
    return;
  }
  u.advanceTarget = enemyDestination(u, primary);
  u.structureTarget = inStructureRange(u, primary) ? primary : null;
  u.flankPoint = null;
}

function findArcherTarget(grid: SpatialGrid, u: Unit): Unit | null {
  grid.queryCircle(u.x, u.y, u.searchRadius, candidates);
  let best: Unit | null = null;
  let bestScore = Infinity;
  for (const n of candidates) {
    if (n === u || n.team === u.team || !n.alive) continue;
    const dx = n.x - u.x;
    const dy = n.y - u.y;
    const d = dx * dx + dy * dy;
    const engaged = n.attackTarget !== null || n.structureTarget !== null;
    const score = d - (engaged ? ARCHER_ENGAGED_BONUS : 0);
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

function findNearestEnemy(grid: SpatialGrid, u: Unit): Unit | null {
  grid.queryCircle(u.x, u.y, u.searchRadius, candidates);
  let best: Unit | null = null;
  let bestSq = Infinity;
  for (const n of candidates) {
    if (n === u || n.team === u.team || !n.alive) continue;
    const dx = n.x - u.x;
    const dy = n.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = n;
    }
  }
  return best;
}

function findPrimaryStructure(structures: Structure[], u: Unit): Structure | null {
  let best: Structure | null = null;
  let bestSq = Infinity;
  for (const s of structures) {
    if (!s.alive) continue;
    if (s.kind !== 'cart' && s.kind !== 'base') continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = s;
    }
  }
  return best;
}

function findPlayerStructure(structures: Structure[], u: Unit): Structure | null {
  let best: Structure | null = null;
  let bestSq = Infinity;
  for (const s of structures) {
    if (!s.alive || s.team !== 'player') continue;
    if (s.kind !== 'cart' && s.kind !== 'base') continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = s;
    }
  }
  return best;
}

function findMineInRange(u: Unit, structures: Structure[], radius: number): Structure | null {
  let best: Structure | null = null;
  let bestSq = Infinity;
  for (const s of structures) {
    if (!s.alive || s.kind !== 'mine') continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    const d = dx * dx + dy * dy;
    if (d <= radius * radius && d < bestSq) {
      bestSq = d;
      best = s;
    }
  }
  return best;
}

function inAttackRange(u: Unit, target: Unit): boolean {
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  return dx * dx + dy * dy <= u.attackRange * u.attackRange;
}

function inStructureRange(u: Unit, s: Structure): boolean {
  if (s.kind === 'wall') return distToWall(s, u.x, u.y) <= u.attackRange + 4;
  const dx = s.x - u.x;
  const dy = s.y - u.y;
  const range = u.attackRange + s.radius;
  return dx * dx + dy * dy <= range * range;
}

function findEnemyStructureInRange(u: Unit, structures: Structure[]): Structure | null {
  let best: Structure | null = null;
  let bestSq = Infinity;
  for (const s of structures) {
    if (!s.alive || s.team === 'player') continue;
    if (!inStructureRange(u, s)) continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = s;
    }
  }
  return best;
}

function blockingBuilding(
  u: Unit,
  structures: Structure[],
  dest: { x: number; y: number } | null,
): Structure | null {
  if (!dest) return null;
  for (const s of structures) {
    if (!s.alive || !s.playerBuilt) continue;
    const dx = s.x - u.x;
    const dy = s.y - u.y;
    const contact = s.radius + u.radius + 6;
    if (dx * dx + dy * dy > contact * contact) continue;
    if (segmentHitsCircle(u.x, u.y, dest.x, dest.y, s.x, s.y, s.radius + u.radius)) return s;
  }
  return null;
}

function segmentHitsCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return false;
  let t = ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + t * dx;
  const py = y0 + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy <= r * r;
}

function blockingWall(u: Unit, structures: Structure[]): Structure | null {
  for (const s of structures) {
    if (!s.alive || s.kind !== 'base') continue;
    if (insideCastleAt(u, s)) return null;
  }
  if (!u.advanceTarget) return null;
  const c = CONFIG.castle;
  const contact = u.radius + c.wallThickness * 0.5 + 3;
  let best: Structure | null = null;
  let bestD = Infinity;
  for (const s of structures) {
    if (!s.alive || s.kind !== 'wall') continue;
    const d = distToWall(s, u.x, u.y);
    if (d > contact) continue;
    if (!segmentHitsRect(u.x, u.y, u.advanceTarget.x, u.advanceTarget.y, s)) continue;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, s: Structure): boolean {
  const minX = s.x - s.w * 0.5;
  const maxX = s.x + s.w * 0.5;
  const minY = s.y - s.h * 0.5;
  const maxY = s.y + s.h * 0.5;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [p, q] of [
    [-dx, x0 - minX],
    [dx, maxX - x0],
    [-dy, y0 - minY],
    [dy, maxY - y0],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function insideCastleAt(u: Unit, base: { x: number; y: number }): boolean {
  const ddx = Math.abs(u.x - base.x);
  const ddy = Math.abs(u.y - base.y);
  return ddx <= CONFIG.castle.wallHalf && ddy <= CONFIG.castle.wallHalf;
}

function enemyDestination(u: Unit, primary: Structure): { x: number; y: number } {
  if (primary.kind === 'cart') return { x: primary.x, y: primary.y };
  const base = primary;
  const wallHalf = CONFIG.castle.wallHalf;
  if (insideCastleAt(u, base)) return { x: base.x, y: base.y };
  const m = wallHalf - 24;
  const gates = [
    { x: base.x, y: base.y - m },
    { x: base.x, y: base.y + m },
    { x: base.x + m, y: base.y },
    { x: base.x - m, y: base.y },
  ];
  let best = gates[0];
  let bestD = Infinity;
  for (const g of gates) {
    const dx = g.x - u.x;
    const dy = g.y - u.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}