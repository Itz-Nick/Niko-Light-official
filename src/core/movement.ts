import { CONFIG } from '../config';
import type { SpatialGrid } from '../core/grid';
import { clamp } from '../core/vector';
import { getSquadFor, getEnemyFormationState } from '../formation/auto-formation';
import type { Squad } from '../formation/auto-formation';
import { distToWall } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { Structure } from '../entities/structures';

interface FormCtx {
  anchorX: number;
  anchorY: number;
  facingX: number;
  facingY: number;
  hasFrontline: boolean;
}

const neighbors: Unit[] = [];

export function updateUnits(
  units: Unit[],
  grid: SpatialGrid,
  structures: Structure[],
  dt: number,
  worldW: number = CONFIG.world.width,
  worldH: number = CONFIG.world.height,
): void {
  const sepRadius = CONFIG.separation.radius;
  const walls = structures.filter((s) => s.alive && s.kind === 'wall');
  const blockers = structures.filter((s) => s.alive && s.playerBuilt);
  for (const u of units) {
    if (!u.alive) continue;
    let vx = 0;
    let vy = 0;
    if (u.aiControl) {
      const v = aiSteer(u);
      vx += v.x;
      vy += v.y;
    } else if (u.team === 'player' && u.moveTarget) {
      // explicit player command always wins
      const dx = u.moveTarget.x - u.x;
      const dy = u.moveTarget.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d < 6) {
        u.moveTarget = null;
        u.formationSlot = null;
      } else {
        vx = (dx / d) * u.speed;
        vy = (dy / d) * u.speed;
      }
    } else if (u.team === 'player') {
      // player units only move on an explicit reason: holding a manual
      // formation slot, or melee closing distance to an active target
      const squad: Squad | null = getSquadFor(u);
      if (squad && squad.mode !== 'auto') {
        const v = holdAt(u, manualSlot(u, squad), CONFIG.formation.idleLeash);
        vx += v.x;
        vy += v.y;
      } else {
        const target = u.attackTarget && u.attackTarget.alive ? u.attackTarget : null;
        if (target && u.troopType !== 'archer' && !inAttackRange(u, target)) {
          const v = steerTo(u, target, 1);
          vx += v.x;
          vy += v.y;
        }
      }
    } else {
      // enemies keep their AI movement unchanged
      if (u.troopType === 'boss') {
        const v = bossMovement(u);
        vx += v.x;
        vy += v.y;
      } else {
        const ctx: FormCtx = getEnemyFormationState();
        const target = u.attackTarget && u.attackTarget.alive ? u.attackTarget : null;
        if (target && inAttackRange(u, target)) {
          if (u.troopType === 'archer') {
            const dx = target.x - u.x;
            const dy = target.y - u.y;
            const d = Math.hypot(dx, dy);
            if (d < u.attackRange * 0.45) {
              const v = steerTo(u, slotTarget(u, ctx), 1);
              vx += v.x;
              vy += v.y;
            } else {
              const v = holdNearSlot(u, CONFIG.formation.holdLeash, ctx);
              vx += v.x;
              vy += v.y;
            }
          } else {
            const v = holdNearSlot(u, CONFIG.formation.holdLeash, ctx);
            vx += v.x;
            vy += v.y;
          }
        } else if (target) {
          const v = advanceToSlot(u, ctx);
          vx += v.x;
          vy += v.y;
        } else if (u.structureTarget && u.structureTarget.alive) {
          if (u.structureTarget.kind === 'wall') {
            // stand still and attack the wall until it breaks
          } else {
            const v = ringAround(u, u.structureTarget);
            vx += v.x;
            vy += v.y;
          }
        } else if (u.advanceTarget) {
          const dx = u.advanceTarget.x - u.x;
          const dy = u.advanceTarget.y - u.y;
          const d = Math.hypot(dx, dy);
          if (d > 1) {
            vx = (dx / d) * u.speed;
            vy = (dy / d) * u.speed;
          }
        } else {
          const v = idleToSlot(u, ctx);
          vx += v.x;
          vy += v.y;
        }
      }
    }

    grid.queryCircle(u.x, u.y, sepRadius, neighbors);
    let sx = 0;
    let sy = 0;
    for (const n of neighbors) {
      if (n === u) continue;
      const dx = u.x - n.x;
      const dy = u.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < sepRadius) {
        const push = (sepRadius - d) / sepRadius;
        sx += (dx / d) * push;
        sy += (dy / d) * push;
      }
    }
    vx += sx * CONFIG.separation.strength;
    vy += sy * CONFIG.separation.strength;

    let nx = u.x + vx * dt;
    let ny = u.y + vy * dt;
    for (const w of walls) {
      if (hitWall(nx, u.y, u.radius, w)) nx = u.x;
    }
    for (const w of walls) {
      if (hitWall(u.x, ny, u.radius, w)) ny = u.y;
    }
    for (let iter = 0; iter < 2; iter++) {
      for (const b of blockers) {
        const dx = nx - b.x;
        const dy = ny - b.y;
        const d = Math.hypot(dx, dy);
        const minD = b.radius + u.radius;
        if (d >= minD) continue;
        const dirX = d > 0.5 ? dx / d : 1;
        const dirY = d > 0.5 ? dy / d : 0;
        nx = b.x + dirX * minD;
        ny = b.y + dirY * minD;
      }
    }

    u.x = clamp(nx, u.radius, worldW - u.radius);
    u.y = clamp(ny, u.radius, worldH - u.radius);
  }
}

function hitWall(x: number, y: number, r: number, w: Structure): boolean {
  return x > w.x - w.w / 2 - r && x < w.x + w.w / 2 + r && y > w.y - w.h / 2 - r && y < w.y + w.h / 2 + r;
}

function bossMovement(u: Unit): { x: number; y: number } {
  const ab = u.ability;
  if (ab && ab.phase !== 'idle') return { x: 0, y: 0 };
  const target = u.attackTarget && u.attackTarget.alive ? u.attackTarget : null;
  if (target) {
    if (inAttackRange(u, target)) return { x: 0, y: 0 };
    return steerTo(u, target, 1);
  }
  if (u.structureTarget && u.structureTarget.alive) return { x: 0, y: 0 };
  if (u.advanceTarget) return steerTo(u, u.advanceTarget, 1);
  return { x: 0, y: 0 };
}

function manualSlot(u: Unit, squad: Squad): { x: number; y: number } | null {
  if (!u.formationOffset) return null;
  return { x: squad.anchorX + u.formationOffset.x, y: squad.anchorY + u.formationOffset.y };
}

function holdAt(u: Unit, slot: { x: number; y: number } | null, leash: number): { x: number; y: number } {
  if (!slot) return { x: 0, y: 0 };
  const dx = slot.x - u.x;
  const dy = slot.y - u.y;
  if (dx * dx + dy * dy <= leash * leash) return { x: 0, y: 0 };
  return steerTo(u, slot, 0.7);
}

function slotTarget(u: Unit, ctx: FormCtx | null): { x: number; y: number } | null {
  if (u.formationSlot) return u.formationSlot;
  if (!ctx) return null;
  const spacing = CONFIG.selection.spacing;
  const depth = u.role === 'frontline' ? spacing : u.role === 'backline' ? -spacing : 0;
  return { x: ctx.anchorX + ctx.facingX * depth, y: ctx.anchorY + ctx.facingY * depth };
}

function steerTo(u: Unit, target: { x: number; y: number } | null, factor: number): { x: number; y: number } {
  if (!target) return { x: 0, y: 0 };
  const dx = target.x - u.x;
  const dy = target.y - u.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.0001) return { x: 0, y: 0 };
  const ease = Math.min(1, d / 8);
  const k = (u.speed * factor * ease) / d;
  return { x: dx * k, y: dy * k };
}

function holdNearSlot(u: Unit, leash: number, ctx: FormCtx | null): { x: number; y: number } {
  const t = slotTarget(u, ctx);
  if (!t) return { x: 0, y: 0 };
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  if (dx * dx + dy * dy > leash * leash) return steerTo(u, t, 0.7);
  return { x: 0, y: 0 };
}

function idleToSlot(u: Unit, ctx: FormCtx | null): { x: number; y: number } {
  const t = slotTarget(u, ctx);
  if (!t) return { x: 0, y: 0 };
  const dx = t.x - u.x;
  const dy = t.y - u.y;
  const leash = CONFIG.formation.idleLeash;
  if (dx * dx + dy * dy <= leash * leash) return { x: 0, y: 0 };
  return steerTo(u, t, 0.7);
}

function advanceToSlot(u: Unit, ctx: FormCtx): { x: number; y: number } {
  const t = slotTarget(u, ctx);
  if (!t) return { x: 0, y: 0 };
  let tx = t.x;
  let ty = t.y;
  if (u.troopType === 'archer' && ctx.hasFrontline) {
    // approach the enemy, but never cross the line of front units
    const spacing = CONFIG.selection.spacing;
    const maxDepth = -spacing * 0.5;
    const along = (tx - ctx.anchorX) * ctx.facingX + (ty - ctx.anchorY) * ctx.facingY;
    if (along < maxDepth) {
      const latX = -ctx.facingY;
      const latY = ctx.facingX;
      const lat = (tx - ctx.anchorX) * latX + (ty - ctx.anchorY) * latY;
      tx = ctx.anchorX + ctx.facingX * maxDepth + latX * lat;
      ty = ctx.anchorY + ctx.facingY * maxDepth + latY * lat;
    }
  }
  const dx = tx - u.x;
  const dy = ty - u.y;
  const leash = CONFIG.formation.idleLeash;
  if (dx * dx + dy * dy <= leash * leash) return { x: 0, y: 0 };
  return steerTo(u, { x: tx, y: ty }, 1);
}

function ringAround(u: Unit, s: { x: number; y: number; radius: number }): { x: number; y: number } {
  const dx = u.x - s.x;
  const dy = u.y - s.y;
  const d = Math.hypot(dx, dy) || 1;
  const ring = s.radius + u.attackRange * 0.8;
  const lat = ((u.id % 7) - 3) * 12;
  const lx = -dy / d;
  const ly = dx / d;
  return steerTo(u, { x: s.x + (dx / d) * ring + lx * lat, y: s.y + (dy / d) * ring + ly * lat }, 0.8);
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

function aiSteer(u: Unit): { x: number; y: number } {
  if (u.troopType === 'boss') {
    const ab = u.ability;
    if (ab && ab.phase !== 'idle') return { x: 0, y: 0 };
  }
  const target = u.attackTarget && u.attackTarget.alive ? u.attackTarget : null;
  if (target) {
    if (u.troopType === 'archer') {
      const dx = target.x - u.x;
      const dy = target.y - u.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001 && d < u.attackRange * 0.5) {
        const back = { x: u.x - (dx / d) * 80, y: u.y - (dy / d) * 80 };
        return steerTo(u, back, 1);
      }
    }
    if (inAttackRange(u, target)) return { x: 0, y: 0 };
    return steerTo(u, target, 1);
  }
  if (u.structureTarget && u.structureTarget.alive) {
    if (u.structureTarget.kind === 'wall') {
      if (distToWall(u.structureTarget, u.x, u.y) <= u.attackRange + 4) return { x: 0, y: 0 };
      return steerTo(u, u.structureTarget, 1);
    }
    if (inStructureRange(u, u.structureTarget)) return { x: 0, y: 0 };
    return ringAround(u, u.structureTarget);
  }
  if (u.moveTarget) {
    const dx = u.moveTarget.x - u.x;
    const dy = u.moveTarget.y - u.y;
    if (dx * dx + dy * dy < 36) return { x: 0, y: 0 };
    return steerTo(u, u.moveTarget, 1);
  }
  return { x: 0, y: 0 };
}