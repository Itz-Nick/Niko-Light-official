import { CONFIG } from '../config';
import type { Team, TroopModifiers, TroopType, UnitRole, UnitScale } from '../types';
import { ROLE_BY_TYPE } from '../types';
import type { BossAbility } from '../combat/boss';
import { createBossAbility } from '../combat/boss';
import type { Structure } from './structures';

export interface Unit {
  id: number;
  team: Team;
  troopType: TroopType;
  role: UnitRole;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  speed: number;
  searchRadius: number;
  radius: number;
  color: string;
  defense: number;
  moveTarget: { x: number; y: number } | null;
  advanceTarget: { x: number; y: number } | null;
  advanceOffset: { x: number; y: number } | null;
  flankPoint: { x: number; y: number } | null;
  formationOffset: { x: number; y: number } | null;
  formationSlot: { x: number; y: number } | null;
  defendPoint: { x: number; y: number } | null;
  attackTarget: Unit | null;
  structureTarget: Structure | null;
  thinkTimer: number;
  flashTimer: number;
  ability: BossAbility | null;
  alive: boolean;
  creativeId?: number;
  aiControl?: boolean;
}

let nextUnitId = 1;

interface BaseStats {
  hp: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  speed: number;
  searchRadius: number;
  radius: number;
  color: string;
}

const PLAYER_STATS: Record<TroopType, BaseStats> = {
  knight: {
    hp: CONFIG.units.player.knight.hp,
    damage: CONFIG.units.player.knight.damage,
    attackRange: CONFIG.units.player.knight.attackRange,
    attackCooldown: CONFIG.units.player.knight.attackCooldown,
    speed: CONFIG.units.player.knight.speed,
    searchRadius: CONFIG.units.player.knight.searchRadius,
    radius: CONFIG.units.player.knight.radius,
    color: CONFIG.units.player.knight.color,
  },
  archer: {
    hp: CONFIG.units.player.archer.hp,
    damage: CONFIG.units.player.archer.damage,
    attackRange: CONFIG.units.player.archer.attackRange,
    attackCooldown: CONFIG.units.player.archer.attackCooldown,
    speed: CONFIG.units.player.archer.speed,
    searchRadius: CONFIG.units.player.archer.searchRadius,
    radius: CONFIG.units.player.archer.radius,
    color: CONFIG.units.player.archer.color,
  },
  tank: {
    hp: CONFIG.units.player.tank.hp,
    damage: CONFIG.units.player.tank.damage,
    attackRange: CONFIG.units.player.tank.attackRange,
    attackCooldown: CONFIG.units.player.tank.attackCooldown,
    speed: CONFIG.units.player.tank.speed,
    searchRadius: CONFIG.units.player.tank.searchRadius,
    radius: CONFIG.units.player.tank.radius,
    color: CONFIG.units.player.tank.color,
  },
  champion: {
    hp: CONFIG.units.player.champion.hp,
    damage: CONFIG.units.player.champion.damage,
    attackRange: CONFIG.units.player.champion.attackRange,
    attackCooldown: CONFIG.units.player.champion.attackCooldown,
    speed: CONFIG.units.player.champion.speed,
    searchRadius: CONFIG.units.player.champion.searchRadius,
    radius: CONFIG.units.player.champion.radius,
    color: CONFIG.units.player.champion.color,
  },
  boss: {
    hp: CONFIG.units.player.boss.hp,
    damage: CONFIG.units.player.boss.damage,
    attackRange: CONFIG.units.player.boss.attackRange,
    attackCooldown: CONFIG.units.player.boss.attackCooldown,
    speed: CONFIG.units.player.boss.speed,
    searchRadius: CONFIG.units.player.boss.searchRadius,
    radius: CONFIG.units.player.boss.radius,
    color: CONFIG.units.player.boss.color,
  },
};

const ENEMY_STATS: Record<TroopType, BaseStats> = {
  knight: {
    hp: CONFIG.units.enemy.knight.hp,
    damage: CONFIG.units.enemy.knight.damage,
    attackRange: CONFIG.units.enemy.knight.attackRange,
    attackCooldown: CONFIG.units.enemy.knight.attackCooldown,
    speed: CONFIG.units.enemy.knight.speed,
    searchRadius: CONFIG.units.enemy.knight.searchRadius,
    radius: CONFIG.units.enemy.knight.radius,
    color: CONFIG.units.enemy.knight.color,
  },
  archer: {
    hp: CONFIG.units.enemy.archer.hp,
    damage: CONFIG.units.enemy.archer.damage,
    attackRange: CONFIG.units.enemy.archer.attackRange,
    attackCooldown: CONFIG.units.enemy.archer.attackCooldown,
    speed: CONFIG.units.enemy.archer.speed,
    searchRadius: CONFIG.units.enemy.archer.searchRadius,
    radius: CONFIG.units.enemy.archer.radius,
    color: CONFIG.units.enemy.archer.color,
  },
  tank: {
    hp: CONFIG.units.enemy.tank.hp,
    damage: CONFIG.units.enemy.tank.damage,
    attackRange: CONFIG.units.enemy.tank.attackRange,
    attackCooldown: CONFIG.units.enemy.tank.attackCooldown,
    speed: CONFIG.units.enemy.tank.speed,
    searchRadius: CONFIG.units.enemy.tank.searchRadius,
    radius: CONFIG.units.enemy.tank.radius,
    color: CONFIG.units.enemy.tank.color,
  },
  champion: {
    hp: CONFIG.units.enemy.champion.hp,
    damage: CONFIG.units.enemy.champion.damage,
    attackRange: CONFIG.units.enemy.champion.attackRange,
    attackCooldown: CONFIG.units.enemy.champion.attackCooldown,
    speed: CONFIG.units.enemy.champion.speed,
    searchRadius: CONFIG.units.enemy.champion.searchRadius,
    radius: CONFIG.units.enemy.champion.radius,
    color: CONFIG.units.enemy.champion.color,
  },
  boss: {
    hp: CONFIG.units.enemy.boss.hp,
    damage: CONFIG.units.enemy.boss.damage,
    attackRange: CONFIG.units.enemy.boss.attackRange,
    attackCooldown: CONFIG.units.enemy.boss.attackCooldown,
    speed: CONFIG.units.enemy.boss.speed,
    searchRadius: CONFIG.units.enemy.boss.searchRadius,
    radius: CONFIG.units.enemy.boss.radius,
    color: CONFIG.units.enemy.boss.color,
  },
};

export function createUnit(
  team: Team,
  troopType: TroopType,
  x: number,
  y: number,
  mods?: TroopModifiers,
  scale?: UnitScale,
): Unit {
  const s = team === 'player' ? PLAYER_STATS[troopType] : ENEMY_STATS[troopType];
  const maxHp = s.hp * (mods?.health ?? 1) * (scale?.hp ?? 1);
  return {
    id: nextUnitId++,
    team,
    troopType,
    role: ROLE_BY_TYPE[troopType],
    x,
    y,
    hp: maxHp,
    maxHp,
    damage: s.damage * (mods?.damage ?? 1) * (scale?.damage ?? 1),
    attackRange: s.attackRange * (mods?.range ?? 1) * (scale?.attackRange ?? 1),
    attackCooldown: s.attackCooldown * (mods ? 1 / mods.attackSpeed : 1) * (scale?.attackCooldown ?? 1),
    attackTimer: 0,
    speed: s.speed * (mods?.speed ?? 1) * (scale?.speed ?? 1),
    searchRadius: s.searchRadius,
    radius: s.radius,
    color: s.color,
    defense: (mods?.defense ?? 0) + (scale?.defense ?? 0),
    moveTarget: null,
    advanceTarget: null,
    advanceOffset: null,
    flankPoint: null,
    formationOffset: null,
    formationSlot: null,
    defendPoint: null,
    attackTarget: null,
    structureTarget: null,
    thinkTimer: Math.random() * 0.25,
    flashTimer: 0,
    ability: troopType === 'boss' ? createBossAbility() : null,
    alive: true,
  };
}

export function applyTroopMods(u: Unit, mods: TroopModifiers): void {
  if (u.team !== 'player') return;
  const s = PLAYER_STATS[u.troopType];
  const newMax = s.hp * mods.health;
  const heal = newMax - u.maxHp;
  u.maxHp = newMax;
  u.hp = Math.min(u.maxHp, u.hp + heal);
  u.damage = s.damage * mods.damage;
  u.attackRange = s.attackRange * mods.range;
  u.attackCooldown = s.attackCooldown / mods.attackSpeed;
  u.speed = s.speed * mods.speed;
  u.defense = mods.defense;
}