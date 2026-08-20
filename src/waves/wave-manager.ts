import { CONFIG } from '../config';
import type { Difficulty } from '../config';
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
  private scale: UnitScale = unitScaleForWave(0, 'medium');
  private difficulty: Difficulty = 'medium';

  setSpawnSink(sink: (u: Unit) => void): void {
    this.sink = sink;
  }

  setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
  }

  reset(): void {
    this.wave = 0;
    this.phase = 'preparation';
    this.timer = CONFIG.waves.prepTime;
    this.pending = [];
    this.scale = unitScaleForWave(0, this.difficulty);
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
    this.scale = unitScaleForWave(this.wave, this.difficulty);
    this.pending = this.buildWave(this.wave);
  }

  private completeWave(): void {
    this.onWaveComplete?.(this.wave);
    this.phase = 'preparation';
    this.timer = CONFIG.waves.prepTime;
  }

  private buildWave(wave: number): PendingSpawn[] {
    const raw = CONFIG.waves.baseCount * Math.pow(CONFIG.waves.growth, wave - 1) * CONFIG.difficulty[this.difficulty].spawnScaling;
    const count = Math.min(Math.floor(raw), CONFIG.waves.maxPerWave);
    const points = CONFIG.positions.enemySpawns;
    const base = CONFIG.positions.base;
    const tier = enemyTier(wave, this.difficulty);
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

function enemyTier(wave: number, difficulty: Difficulty): number {
  const w = wave * CONFIG.difficulty[difficulty].compositionScaling;
  if (w <= 5) return 1;
  if (w <= 10) return 2;
  if (w <= 15) return 3;
  if (w <= 20) return 4;
  return 5;
}

function pickEnemyType(tier: number): TroopType {
  const pool = TIER_POOLS[tier];
  return pool[Math.floor(Math.random() * pool.length)];
}

function unitScaleForWave(wave: number, difficulty: Difficulty): UnitScale {
  const k = wave - 1;
  const d = CONFIG.difficulty[difficulty];
  return {
    hp: Math.min(CONFIG.waves.hpCap, 1 + k * CONFIG.waves.hpGrowth * d.enemyScaling),
    damage: Math.min(CONFIG.waves.damageCap, 1 + k * CONFIG.waves.damageGrowth * d.enemyScaling),
    speed: Math.min(CONFIG.waves.speedCap, 1 + k * CONFIG.waves.speedGrowth * d.enemyScaling),
    attackRange: Math.min(CONFIG.waves.rangeCap, 1 + k * CONFIG.waves.rangeGrowth * d.enemyScaling),
    attackCooldown: Math.max(CONFIG.waves.cooldownMin, 1 - k * CONFIG.waves.cooldownGrowth * d.enemyScaling),
    defense: Math.min(0.25, k * d.defenseGrowth),
  };
}