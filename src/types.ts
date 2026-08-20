export type Team = 'player' | 'enemy';

export type TroopType = 'knight' | 'archer' | 'tank' | 'champion' | 'boss';

export type PlayerTroopType = Exclude<TroopType, 'boss'>;

export type UnitRole = 'frontline' | 'backline' | 'elite';

export const ROLE_BY_TYPE: Record<TroopType, UnitRole> = {
  knight: 'frontline',
  tank: 'frontline',
  archer: 'backline',
  champion: 'elite',
  boss: 'elite',
};

export interface TroopModifiers {
  damage: number;
  health: number;
  speed: number;
  attackSpeed: number;
  range: number;
  defense: number;
}

export interface EconomyModifiers {
  mineIncome: number;
  waveBonus: number;
}

export interface UnitScale {
  hp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  defense: number;
}

export interface HitInfo {
  x: number;
  y: number;
  damage: number;
  source: 'unit' | 'wall' | 'tower' | 'base' | 'mine' | 'cart';
  ranged: boolean;
}
