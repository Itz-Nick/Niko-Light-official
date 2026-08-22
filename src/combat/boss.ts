import { CONFIG } from '../config';
import type { SpatialGrid } from '../core/grid';
import type { Unit } from '../entities/unit';
import type { HitInfo } from '../types';

export type BossAbilityPhase = 'idle' | 'telegraph' | 'impact';

export interface BossAbility {
  phase: BossAbilityPhase;
  timer: number;
  radius: number;
  cooldown: number;
}

const scratch: Unit[] = [];

export function createBossAbility(): BossAbility {
  return {
    phase: 'idle',
    timer: 0,
    radius: CONFIG.boss.abilityRadius,
    cooldown: 0,
  };
}

export function updateBossAbilities(
  units: Unit[],
  grid: SpatialGrid,
  dt: number,
  hits: HitInfo[],
): void {
  for (const boss of units) {
    if (!boss.alive || boss.troopType !== 'boss') continue;
    const ab = boss.ability;
    if (!ab) continue;

    if (ab.cooldown > 0) ab.cooldown -= dt;

    if (ab.phase === 'idle') {
      if (ab.cooldown <= 0 && boss.attackTarget) {
        const dx = boss.attackTarget.x - boss.x;
        const dy = boss.attackTarget.y - boss.y;
        if (dx * dx + dy * dy <= CONFIG.boss.abilityTriggerRange * CONFIG.boss.abilityTriggerRange) {
          ab.phase = 'telegraph';
          ab.timer = CONFIG.boss.abilityTelegraph;
        }
      }
      continue;
    }

    if (ab.phase === 'telegraph') {
      ab.timer -= dt;
      if (ab.timer <= 0) {
        ab.phase = 'impact';
        ab.timer = CONFIG.boss.abilityImpact;
      }
      continue;
    }

    if (ab.phase === 'impact') {
      ab.timer -= dt;
      if (ab.timer > 0) continue;
      ab.phase = 'idle';
      ab.cooldown = CONFIG.boss.abilityCooldown;
      boss.attackPhase = 0.18;

      const radiusSq = ab.radius * ab.radius;
      scratch.length = 0;
      grid.queryCircle(boss.x, boss.y, ab.radius, scratch);
      for (const u of scratch) {
        if (!u.alive || u.team === boss.team) continue;
        const dx = u.x - boss.x;
        const dy = u.y - boss.y;
        if (dx * dx + dy * dy <= radiusSq) {
          u.hp -= CONFIG.boss.abilityDamage;
          if (u.hp <= 0) u.alive = false;
          u.flashTimer = 0.35;
        }
      }

      hits.push({
        x: boss.x,
        y: boss.y,
        damage: CONFIG.boss.abilityDamage,
        source: 'unit',
        ranged: false,
      });
    }
  }
}
