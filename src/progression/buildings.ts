import { CONFIG } from '../config';
import { distToWall } from '../entities/structures';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { BuildingKind } from './progression';

export const BUILDING_NAMES: Record<BuildingKind, string> = {
  house: 'Casa',
  market: 'Mercado',
  tower: 'Torre',
};

export const BUILDING_ICONS: Record<BuildingKind, string> = {
  house: '🏠',
  market: '🏪',
  tower: '🗼',
};

export function buildingCost(kind: BuildingKind): number {
  return CONFIG.progression.buildings[kind].cost;
}

export function createBuilding(kind: BuildingKind, x: number, y: number, towerCooldownMult: number): Structure {
  const cfg = CONFIG.progression.buildings[kind];
  const r = cfg.radius;
  const s: Structure = {
    kind,
    team: 'player',
    x,
    y,
    hp: cfg.hp,
    maxHp: cfg.hp,
    radius: r,
    color: '#e8b96a',
    alive: true,
    w: r * 2,
    h: r * 2,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
    playerBuilt: true,
  };
  if (kind === 'tower') {
    const tower = CONFIG.progression.buildings.tower;
    s.damage = tower.damage;
    s.attackRange = tower.range;
    s.attackCooldown = CONFIG.castle.towerCooldown * towerCooldownMult;
  }
  return s;
}

export function canPlaceBuilding(
  kind: BuildingKind,
  x: number,
  y: number,
  units: Unit[],
  structures: Structure[],
  worldW: number,
  worldH: number,
): boolean {
  const cfg = CONFIG.progression.buildings[kind];
  const r = cfg.radius;
  const margin = 4;
  if (x - r < margin || x + r > worldW - margin || y - r < margin || y + r > worldH - margin) return false;
  for (const s of structures) {
    if (!s.alive) continue;
    if (s.kind === 'wall') {
      if (distToWall(s, x, y) < r) return false;
      continue;
    }
    const dx = s.x - x;
    const dy = s.y - y;
    const min = s.radius + r;
    if (dx * dx + dy * dy < min * min) return false;
  }
  for (const u of units) {
    if (!u.alive) continue;
    const dx = u.x - x;
    const dy = u.y - y;
    const min = u.radius + r + 2;
    if (dx * dx + dy * dy < min * min) return false;
  }
  const zones = worldW > CONFIG.world.width ? CONFIG.progression.noBuild.adventure : CONFIG.progression.noBuild.infinite;
  for (const z of zones) {
    if (distToSegment(x, y, z.x1, z.y1, z.x2, z.y2) < z.width + r) return false;
  }
  return true;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}