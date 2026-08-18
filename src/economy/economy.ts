import { CONFIG } from '../config';

export class Economy {
  gold: number = CONFIG.economy.startingGold;

  canAfford(cost: number): boolean {
    return this.gold >= cost;
  }

  spend(cost: number): void {
    this.gold -= cost;
  }

  add(amount: number): void {
    this.gold += amount;
  }

  update(dt: number, passivePerSecond: number): void {
    this.gold += passivePerSecond * dt;
  }
}