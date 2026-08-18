import { CONFIG } from '../config';
import type { Team } from '../types';
import type { Unit } from './unit';

export type StructureKind = 'base' | 'wall' | 'tower' | 'mine' | 'cart';

export interface Structure {
  kind: StructureKind;
  team: Team;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  color: string;
  alive: boolean;
  w: number;
  h: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  attackTarget: Unit | null;
  flashTimer: number;
}

export function createBase(): Structure {
  return createBaseAt(CONFIG.positions.base.x, CONFIG.positions.base.y);
}

export function createBaseAt(x: number, y: number): Structure {
  const r = CONFIG.base.radius;
  return {
    kind: 'base',
    team: 'player',
    x,
    y,
    hp: CONFIG.base.hp,
    maxHp: CONFIG.base.hp,
    radius: r,
    color: CONFIG.base.color,
    alive: true,
    w: r * 2,
    h: r * 2,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}

export function createMines(): Structure[] {
  const base = CONFIG.positions.base;
  const off = CONFIG.castle.mineOffset;
  return [
    mineAt(base.x - off, base.y - off),
    mineAt(base.x + off, base.y + off),
  ];
}

export function createMineAt(x: number, y: number): Structure {
  return mineAt(x, y);
}

function mineAt(x: number, y: number): Structure {
  const r = CONFIG.mine.radius;
  return {
    kind: 'mine',
    team: 'player',
    x,
    y,
    hp: CONFIG.mine.hp,
    maxHp: CONFIG.mine.hp,
    radius: r,
    color: CONFIG.mine.color,
    alive: true,
    w: r * 2,
    h: r * 2,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}

export function createCastleDefense(): Structure[] {
  const base = CONFIG.positions.base;
  const c = CONFIG.castle;
  const out: Structure[] = [];
  const segsPerHalf = Math.floor(c.segmentsPerSide / 2);
  const span = c.wallHalf - c.gateWidth / 2;
  const segLen = span / segsPerHalf;

  for (const ySign of [-1, 1]) {
    const y = base.y + ySign * c.wallHalf;
    for (let i = 0; i < segsPerHalf; i++) {
      const x0 = base.x - c.wallHalf + i * segLen;
      out.push(createWall(x0 + segLen / 2, y, segLen + 2, c.wallThickness));
    }
    for (let i = 0; i < segsPerHalf; i++) {
      const x0 = base.x + c.gateWidth / 2 + i * segLen;
      out.push(createWall(x0 + segLen / 2, y, segLen + 2, c.wallThickness));
    }
  }
  for (const xSign of [-1, 1]) {
    const x = base.x + xSign * c.wallHalf;
    for (let i = 0; i < segsPerHalf; i++) {
      const y0 = base.y - c.wallHalf + i * segLen;
      out.push(createWall(x, y0 + segLen / 2, c.wallThickness, segLen + 2));
    }
    for (let i = 0; i < segsPerHalf; i++) {
      const y0 = base.y + c.gateWidth / 2 + i * segLen;
      out.push(createWall(x, y0 + segLen / 2, c.wallThickness, segLen + 2));
    }
  }

  const corner = c.wallHalf;
  out.push(createTower(base.x - corner, base.y - corner));
  out.push(createTower(base.x + corner, base.y - corner));
  out.push(createTower(base.x - corner, base.y + corner));
  out.push(createTower(base.x + corner, base.y + corner));
  return out;
}

function createWall(x: number, y: number, w: number, h: number): Structure {
  const c = CONFIG.castle;
  return {
    kind: 'wall',
    team: 'player',
    x,
    y,
    hp: c.wallHp,
    maxHp: c.wallHp,
    radius: Math.min(w, h) / 2,
    color: c.wallColor,
    alive: true,
    w,
    h,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}

function createTower(x: number, y: number): Structure {
  const c = CONFIG.castle;
  const r = c.towerRadius;
  return {
    kind: 'tower',
    team: 'player',
    x,
    y,
    hp: c.towerHp,
    maxHp: c.towerHp,
    radius: r,
    color: c.towerColor,
    alive: true,
    w: r * 2,
    h: r * 2,
    damage: c.towerDamage,
    attackRange: c.towerRange,
    attackCooldown: c.towerCooldown,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}

export function distToWall(s: Structure, x: number, y: number): number {
  const hx = s.w / 2;
  const hy = s.h / 2;
  const dx = Math.abs(x - s.x) - hx;
  const dy = Math.abs(y - s.y) - hy;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

export function createCart(x: number, y: number): Structure {
  return {
    kind: 'cart',
    team: 'player',
    x,
    y,
    hp: CONFIG.story.cart.hp,
    maxHp: CONFIG.story.cart.hp,
    radius: CONFIG.story.cart.radius,
    color: CONFIG.story.cart.color,
    alive: true,
    w: CONFIG.story.cart.radius * 2,
    h: CONFIG.story.cart.radius * 2,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}