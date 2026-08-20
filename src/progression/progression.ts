import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import type { Economy } from '../economy/economy';
import type { PlayerTroopType, TroopModifiers } from '../types';

export type BuildingKind = 'house' | 'market' | 'tower';

export interface TroopUpgradeInfo {
  level: number;
  maxLevel: number;
  cost: number;
  currency: 'gold' | 'diamond';
  affordable: boolean;
}

export interface ProgressionSnapshot {
  gold: number;
  castleLevel: number;
  castleMaxLevel: number;
  castleCost: number;
  castleMaxed: boolean;
  castleAffordable: boolean;
  castleHpBonus: number;
  castleTowerMult: number;
  buildingCount: number;
  buildingCap: number;
  buildingCapReached: boolean;
  diamonds: number;
  troopCap: number;
  troops: Record<PlayerTroopType, TroopUpgradeInfo>;
  buildCosts: Record<BuildingKind, number>;
}

export const PLAYER_TROOPS: PlayerTroopType[] = ['knight', 'archer', 'tank', 'champion'];

export class Progression {
  castleLevel = 1;
  troopLevels: Record<PlayerTroopType, number> = { knight: 1, archer: 1, tank: 1, champion: 1 };
  diamonds = 0;

  reset(): void {
    this.castleLevel = 1;
    this.troopLevels = { knight: 1, archer: 1, tank: 1, champion: 1 };
    this.diamonds = 0;
  }

  castleCost(): number {
    if (this.castleMaxed()) return 0;
    return CONFIG.progression.castle.costs[this.castleLevel - 1];
  }

  castleMaxed(): boolean {
    return this.castleLevel >= CONFIG.progression.castle.maxLevel;
  }

  castleHpBonus(): number {
    return CONFIG.progression.castle.hpBonus[this.castleLevel - 1];
  }

  castleTowerMult(): number {
    return CONFIG.progression.castle.towerCooldown[this.castleLevel - 1];
  }

  buildingCap(): number {
    return CONFIG.progression.castle.buildingCap[this.castleLevel - 1];
  }

  buildingCount(structures: Structure[]): number {
    let n = 0;
    for (const s of structures) if (s.alive && s.playerBuilt) n++;
    return n;
  }

  troopCap(structures: Structure[]): number {
    let houses = 0;
    for (const s of structures) if (s.alive && s.kind === 'house') houses++;
    return CONFIG.progression.buildings.baseTroopCap + houses * CONFIG.progression.buildings.house.troopCapBonus;
  }

  canUpgradeCastle(gold: number): boolean {
    return !this.castleMaxed() && gold >= this.castleCost();
  }

  upgradeCastle(economy: Economy): boolean {
    if (!this.canUpgradeCastle(economy.gold)) return false;
    economy.spend(this.castleCost());
    this.castleLevel++;
    return true;
  }

  troopUpgradeInfo(type: PlayerTroopType, gold: number): TroopUpgradeInfo {
    const level = this.troopLevels[type];
    const maxLevel = CONFIG.progression.troops.maxLevel;
    if (level >= maxLevel) return { level, maxLevel, cost: 0, currency: 'gold', affordable: false };
    const cfg = CONFIG.progression.troops[type];
    const cost = cfg.costs[level - 1];
    const currency: 'gold' | 'diamond' = cfg.costsDiamond ? 'diamond' : 'gold';
    const affordable = currency === 'diamond' ? this.diamonds >= cost : gold >= cost;
    return { level, maxLevel, cost, currency, affordable };
  }

  canUpgradeTroop(type: PlayerTroopType, gold: number): boolean {
    const info = this.troopUpgradeInfo(type, gold);
    return info.level < info.maxLevel && info.affordable;
  }

  upgradeTroop(type: PlayerTroopType, economy: Economy): boolean {
    const info = this.troopUpgradeInfo(type, economy.gold);
    if (info.level >= info.maxLevel || !info.affordable) return false;
    if (info.currency === 'diamond') this.diamonds -= info.cost;
    else economy.spend(info.cost);
    this.troopLevels[type]++;
    return true;
  }

  modsFor(type: PlayerTroopType): TroopModifiers {
    const cfg = CONFIG.progression.troops[type];
    const l = this.troopLevels[type] - 1;
    return {
      damage: cfg.damage[l],
      health: cfg.hp[l],
      speed: cfg.speed[l],
      attackSpeed: cfg.attackSpeed[l],
      range: cfg.range[l],
      defense: cfg.defense[l],
    };
  }

  snapshot(gold: number, structures: Structure[]): ProgressionSnapshot {
    const troops = {} as Record<PlayerTroopType, TroopUpgradeInfo>;
    for (const type of PLAYER_TROOPS) troops[type] = this.troopUpgradeInfo(type, gold);
    const buildingCount = this.buildingCount(structures);
    const buildingCap = this.buildingCap();
    return {
      gold,
      castleLevel: this.castleLevel,
      castleMaxLevel: CONFIG.progression.castle.maxLevel,
      castleCost: this.castleCost(),
      castleMaxed: this.castleMaxed(),
      castleAffordable: this.canUpgradeCastle(gold),
      castleHpBonus: this.castleHpBonus(),
      castleTowerMult: this.castleTowerMult(),
      buildingCount,
      buildingCap,
      buildingCapReached: buildingCount >= buildingCap,
      diamonds: this.diamonds,
      troopCap: this.troopCap(structures),
      troops,
      buildCosts: {
        house: CONFIG.progression.buildings.house.cost,
        market: CONFIG.progression.buildings.market.cost,
        tower: CONFIG.progression.buildings.tower.cost,
      },
    };
  }
}