import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { Team, HitInfo } from '../types';

export interface Projectile {
  id: number;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  target: Unit | null;
  structure: Structure | null;
  lastTargetX: number;
  lastTargetY: number;
  hitRadius: number;
  age: number;
  maxLife: number;
  alive: boolean;
  prevX: number;
  prevY: number;
}

let nextProjectileId = 1;

export function spawnArrow(
  shooter: Unit,
  damage: number,
  target: Unit | null,
  structure: Structure | null,
): Projectile {
  let tx = shooter.x;
  let ty = shooter.y;
  if (target) {
    tx = target.x;
    ty = target.y;
  } else if (structure) {
    tx = structure.x;
    ty = structure.y;
  }
  const dx = tx - shooter.x;
  const dy = ty - shooter.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = CONFIG.projectiles.arrowSpeed;
  return {
    id: nextProjectileId++,
    team: shooter.team,
    x: shooter.x,
    y: shooter.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    speed,
    damage,
    target,
    structure,
    lastTargetX: tx,
    lastTargetY: ty,
    hitRadius: CONFIG.projectiles.hitRadius,
    age: 0,
    maxLife: CONFIG.projectiles.maxLife,
    alive: true,
    prevX: shooter.x,
    prevY: shooter.y,
  };
}

export function spawnTowerShot(x: number, y: number, damage: number, target: Unit, team: Team): Projectile {
  const dx = target.x - x;
  const dy = target.y - y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = CONFIG.projectiles.arrowSpeed;
  return {
    id: nextProjectileId++,
    team,
    x,
    y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    speed,
    damage,
    target,
    structure: null,
    lastTargetX: target.x,
    lastTargetY: target.y,
    hitRadius: CONFIG.projectiles.hitRadius,
    age: 0,
    maxLife: CONFIG.projectiles.maxLife,
    alive: true,
    prevX: x,
    prevY: y,
  };
}

export function updateProjectiles(projectiles: Projectile[], dt: number): HitInfo[] {
  const hits: HitInfo[] = [];
  for (const p of projectiles) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age > p.maxLife) {
      p.alive = false;
      continue;
    }
    if (p.target && p.target.alive) {
      p.lastTargetX = p.target.x;
      p.lastTargetY = p.target.y;
    } else if (p.structure && p.structure.alive) {
      p.lastTargetX = p.structure.x;
      p.lastTargetY = p.structure.y;
    } else {
      p.alive = false;
      continue;
    }
    const dx = p.lastTargetX - p.x;
    const dy = p.lastTargetY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
    p.prevX = p.x;
    p.prevY = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.target) {
      const tdx = p.target.x - p.x;
      const tdy = p.target.y - p.y;
      const rr = p.hitRadius + p.target.radius;
      if (tdx * tdx + tdy * tdy <= rr * rr) {
        const dmg = Math.max(1, p.damage * (1 - p.target.defense));
        p.target.hp -= dmg;
        p.target.flashTimer = CONFIG.ui.hitFlashDuration;
        hits.push({ x: p.target.x, y: p.target.y, damage: dmg, source: 'unit', ranged: true });
        p.alive = false;
      }
    } else if (p.structure) {
      const sdx = p.structure.x - p.x;
      const sdy = p.structure.y - p.y;
      const rr = p.hitRadius + p.structure.radius;
      if (sdx * sdx + sdy * sdy <= rr * rr) {
        p.structure.hp -= p.damage;
        p.structure.flashTimer = CONFIG.ui.hitFlashDuration;
        hits.push({
          x: p.structure.x,
          y: p.structure.y,
          damage: p.damage,
          source: p.structure.kind as HitInfo['source'],
          ranged: true,
        });
        p.alive = false;
      }
    }
  }
  return hits;
}