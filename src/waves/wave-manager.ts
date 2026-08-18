import { CONFIG } from '../config';
import { createUnit } from '../entities/unit';
import type { Unit } from '../entities/unit';
import { ROLE_BY_TYPE } from '../types';
import type { TroopType, UnitScale } from '../types';

export type WavePhase = 'preparation' | 'battle';

interface PendingSpawn {
  x: number;
  y: number;
  time: number;
  type: TroopType;
  advanceOffset?: { x: number; y: number };
  flankPoint?: { x: number; y: number };
}

const TIER_POOLS: Record<number, TroopType[]> = {
  1: ['knight', 'knight', 'knight', 'archer'],
  2: ['knight', 'knight', 'archer', 'tank', 'archer'],
  3: ['knight', 'archer', 'tank', 'champion', 'archer', 'tank'],
  4: ['tank', 'archer', 'champion', 'knight', 'tank', 'champion'],
  5: ['champion', 'tank', 'archer', 'champion', 'knight', 'tank'],
};

export class WaveManager {
  wave = 0;
  phase: WavePhase = 'preparation';
  timer: number = CONFIG.waves.prepTime;
  onWaveComplete: ((wave: number) => void) | null = null;

  private pending: PendingSpawn[] = [];
  private sink: ((u: Unit) => void) | null = null;
  private scale: UnitScale = unitScaleForWave(0);

  setSpawnSink(sink: (u: Unit) => void): void {
    this.sink = sink;
  }

  reset(): void {
    this.wave = 0;
    this.phase = 'preparation';
    this.timer = CONFIG.waves.prepTime;
    this.pending = [];
    this.scale = unitScaleForWave(0);
  }

  beginBattle(): void {
    if (this.phase === 'preparation') this.startBattle();
  }

  update(dt: number, activeEnemies: number): void {
    if (this.phase === 'preparation') {
      this.timer -= dt;
      if (this.timer <= 0) this.startBattle();
      return;
    }

    if (this.pending.length === 0 && activeEnemies === 0) {
      this.completeWave();
      return;
    }

    for (const p of this.pending) p.time -= dt;
    while (this.pending.length > 0 && this.pending[0].time <= 0) {
      const spawn = this.pending.shift();
      if (!spawn) continue;
      const unit = createUnit('enemy', spawn.type, spawn.x, spawn.y, undefined, this.scale);
      if (spawn.advanceOffset) unit.advanceOffset = spawn.advanceOffset;
      if (spawn.flankPoint) unit.flankPoint = spawn.flankPoint;
      this.sink?.(unit);
    }
  }

  private startBattle(): void {
    this.wave += 1;
    this.phase = 'battle';
    this.scale = unitScaleForWave(this.wave);
    this.pending = this.buildWave(this.wave);
  }

  private completeWave(): void {
    this.onWaveComplete?.(this.wave);
    this.phase = 'preparation';
    this.timer = CONFIG.waves.prepTime;
  }

  private buildWave(wave: number): PendingSpawn[] {
    const count = Math.min(
      Math.floor(CONFIG.waves.baseCount * Math.pow(CONFIG.waves.growth, wave - 1)),
      CONFIG.waves.maxPerWave,
    );
    const points = CONFIG.positions.enemySpawns;
    const base = CONFIG.positions.base;
    const tier = enemyTier(wave);
    const pending: PendingSpawn[] = [];
    for (let i = 0; i < count; i++) {
      const point = points[Math.floor(i / CONFIG.waves.clusterSize) % points.length];
      const k = i % CONFIG.waves.clusterSize;
      const angle = (k / CONFIG.waves.clusterSize) * Math.PI * 2;
      let x = point.x + Math.cos(angle) * CONFIG.waves.clusterRadius;
      let y = point.y + Math.sin(angle) * CONFIG.waves.clusterRadius;
      const type = pickEnemyType(tier);
      const spawn: PendingSpawn = {
        x,
        y,
        time: i * CONFIG.waves.spawnStagger,
        type,
      };
      if (tier >= 2) {
        const dx = base.x - x;
        const dy = base.y - y;
        const d = Math.hypot(dx, dy) || 1;
        const dirX = dx / d;
        const dirY = dy / d;
        const role = ROLE_BY_TYPE[type];
        const off = role === 'frontline' ? 30 : role === 'backline' ? -45 : 15;
        x += dirX * off;
        y += dirY * off;
        spawn.x = x;
        spawn.y = y;
        spawn.advanceOffset = { x: dirX * off, y: dirY * off };
      }
      if (tier >= 3 && i % 5 === 0) {
        const dx = base.x - x;
        const dy = base.y - y;
        const d = Math.hypot(dx, dy) || 1;
        spawn.flankPoint = { x: base.x + (-dy / d) * 700, y: base.y + (dx / d) * 700 };
      }
      pending.push(spawn);
    }
    return pending;
  }
}

function enemyTier(wave: number): number {
  if (wave <= 5) return 1;
  if (wave <= 10) return 2;
  if (wave <= 15) return 3;
  if (wave <= 20) return 4;
  return 5;
}

function pickEnemyType(tier: number): TroopType {
  const pool = TIER_POOLS[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function unitScaleForWave(wave: number): UnitScale {
  const k = wave - 1;
  return {
    hp: Math.min(CONFIG.waves.hpCap, 1 + k * CONFIG.waves.hpGrowth),
    damage: Math.min(CONFIG.waves.damageCap, 1 + k * CONFIG.waves.damageGrowth),
    speed: Math.min(CONFIG.waves.speedCap, 1 + k * CONFIG.waves.speedGrowth),
    attackRange: Math.min(CONFIG.waves.rangeCap, 1 + k * CONFIG.waves.rangeGrowth),
    attackCooldown: Math.max(CONFIG.waves.cooldownMin, 1 - k * CONFIG.waves.cooldownGrowth),
  };
}