import { CONFIG } from '../config';
import { formationTargets } from '../formation/formation';
import { distToWall } from '../entities/structures';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { Team } from '../types';
import { creativeTeamOf, type CreativeTeam } from './creative';

export type CreativeObjective = 'DEFEND_CASTLE' | 'CAPTURE_MINE' | 'ATTACK_ENEMY' | 'DEFEND_MINE';

export interface CreativeAiSquad {
  team: CreativeTeam;
  units: Unit[];
  objective: CreativeObjective;
  targetX: number;
  targetY: number;
  structure: Structure | null;
  holdTimer: number;
}

const TICK = 0.5;
const HOLD_MIN = 3;

function mineOwnerTeam(mine: Structure): CreativeTeam | null {
  if (mine.owner === 'player') return 'blue';
  if (mine.owner === 'enemy') return 'red';
  return null;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segmentHitsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: Structure,
): boolean {
  const minX = s.x - s.w * 0.5;
  const maxX = s.x + s.w * 0.5;
  const minY = s.y - s.h * 0.5;
  const maxY = s.y + s.h * 0.5;
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  for (const [p, q] of [
    [-dx, x0 - minX],
    [dx, maxX - x0],
    [-dy, y0 - minY],
    [dy, maxY - y0],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}

function wallOnPath(structures: Structure[], foeTeam: Team, fromX: number, fromY: number, to: Structure): Structure | null {
  let best: Structure | null = null;
  let bestD = Infinity;
  for (const s of structures) {
    if (!s.alive || s.kind !== 'wall' || s.team !== foeTeam) continue;
    if (!segmentHitsRect(fromX, fromY, to.x, to.y, s)) continue;
    const d = distToWall(s, fromX, fromY);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

export class CreativeAI {
  private blueSquads: CreativeAiSquad[] = [];
  private redSquads: CreativeAiSquad[] = [];
  private blueTimer = 0;
  private redTimer = 0;

  reset(): void {
    this.blueSquads = [];
    this.redSquads = [];
    this.blueTimer = 0;
    this.redTimer = 0;
  }

  update(team: CreativeTeam, units: Unit[], structures: Structure[], dt: number): void {
    if (team === 'blue') this.blueTimer += dt;
    else this.redTimer += dt;
    const squads = team === 'blue' ? this.blueSquads : this.redSquads;
    for (const sq of squads) {
      sq.units = sq.units.filter((u) => u.alive);
      sq.holdTimer = Math.max(0, sq.holdTimer - dt);
    }
    const timer = team === 'blue' ? this.blueTimer : this.redTimer;
    if (timer < TICK) return;
    if (team === 'blue') this.blueTimer = 0;
    else this.redTimer = 0;
    this.decide(team, units, structures, squads);
  }

  private decide(team: CreativeTeam, units: Unit[], structures: Structure[], squads: CreativeAiSquad[]): void {
    const teamUnit = creativeTeamOf(team);
    const foeTeam: Team = teamUnit === 'player' ? 'enemy' : 'player';

    for (let i = squads.length - 1; i >= 0; i--) {
      const sq = squads[i];
      if (sq.units.length === 0) {
        squads.splice(i, 1);
        continue;
      }
      let keep = true;
      if (sq.objective === 'CAPTURE_MINE') {
        const mine = sq.structure;
        if (!mine || !mine.alive || mine.kind !== 'mine' || mineOwnerTeam(mine) === team) keep = false;
      } else if (sq.objective === 'ATTACK_ENEMY') {
        if (sq.structure && (!sq.structure.alive || sq.structure.team === teamUnit)) keep = false;
      } else if (sq.objective === 'DEFEND_CASTLE') {
        if (sq.holdTimer <= 0 && !this.baseThreatened(team, units, structures)) keep = false;
      } else {
        const mine = sq.structure;
        if (!mine || !mine.alive || mine.kind !== 'mine') keep = false;
        else if (mineOwnerTeam(mine) !== team) keep = false;
      }
      if (!keep) squads.splice(i, 1);
    }

    const assigned = new Set<Unit>();
    for (const sq of squads) for (const u of sq.units) assigned.add(u);

    const alive = units.filter((u) => u.alive && u.team === teamUnit);
    const free = alive.filter((u) => !assigned.has(u));
    const freeFront = free.filter((u) => u.role !== 'backline');
    const freeArchers = free.filter((u) => u.role === 'backline');

    const ownBase = structures.find((s) => s.alive && s.kind === 'base' && s.team === teamUnit) ?? null;

    if (ownBase && this.baseThreatened(team, units, structures)) {
      const threat = this.nearestEnemyOf(units, foeTeam, ownBase.x, ownBase.y, 700);
      const tx = threat ? threat.x : ownBase.x;
      const ty = threat ? threat.y : ownBase.y;
      let fx = tx - ownBase.x;
      let fy = ty - ownBase.y;
      const d = Math.hypot(fx, fy) || 1;
      fx /= d;
      fy /= d;
      const cx = ownBase.x + fx * 120;
      const cy = ownBase.y + fy * 120;
      const members = free;
      if (members.length > 0) {
        const sq: CreativeAiSquad = {
          team,
          units: members,
          objective: 'DEFEND_CASTLE',
          targetX: cx,
          targetY: cy,
          structure: null,
          holdTimer: HOLD_MIN,
        };
        squads.push(sq);
        this.issue(sq, cx, cy);
        return;
      }
    }

    if (freeFront.length + freeArchers.length >= 2) {
      const mine = this.threatenedMine(team, units, structures);
      if (mine) {
        const members = freeFront.slice(0, Math.min(freeFront.length, 3)).concat(freeArchers.slice(0, 1));
        if (members.length > 0) {
          const sq: CreativeAiSquad = {
            team,
            units: members,
            objective: 'DEFEND_MINE',
            targetX: mine.x,
            targetY: mine.y,
            structure: mine,
            holdTimer: HOLD_MIN,
          };
          squads.push(sq);
          this.issue(sq, mine.x, mine.y);
        }
      } else {
        const mine = this.captureCandidate(team, structures, freeFront);
        if (mine && freeFront.length >= 2) {
          const count = Math.max(2, Math.min(freeFront.length, Math.ceil(freeFront.length * 0.35)));
          const members = freeFront.slice(0, count);
          const sq: CreativeAiSquad = {
            team,
            units: members,
            objective: 'CAPTURE_MINE',
            targetX: mine.x,
            targetY: mine.y,
            structure: mine,
            holdTimer: HOLD_MIN,
          };
          squads.push(sq);
          this.issue(sq, mine.x, mine.y);
        }
      }
    }

    const assigned2 = new Set<Unit>();
    for (const sq of squads) for (const u of sq.units) assigned2.add(u);
    const attackers = alive.filter((u) => !assigned2.has(u));
    if (attackers.length > 0) {
      const target = this.attackTarget(team, units, structures, attackers);
      let structure: Structure | null = null;
      let tx = target.x;
      let ty = target.y;
      if (target.structure) {
        let cx = 0;
        let cy = 0;
        for (const u of attackers) {
          cx += u.x;
          cy += u.y;
        }
        cx /= attackers.length;
        cy /= attackers.length;
        const wall = wallOnPath(structures, foeTeam, cx, cy, target.structure);
        structure = wall ?? target.structure;
        tx = structure.x;
        ty = structure.y;
      }
      const sq: CreativeAiSquad = {
        team,
        units: attackers,
        objective: 'ATTACK_ENEMY',
        targetX: tx,
        targetY: ty,
        structure,
        holdTimer: HOLD_MIN,
      };
      squads.push(sq);
      this.issue(sq, tx, ty);
    }
  }

  private issue(sq: CreativeAiSquad, focusX: number, focusY: number): void {
    const n = sq.units.length;
    if (n === 0) return;
    sq.units.sort((a, b) => (a.role === 'backline' ? 1 : 0) - (b.role === 'backline' ? 1 : 0));
    let cx = 0;
    let cy = 0;
    for (const u of sq.units) {
      cx += u.x;
      cy += u.y;
    }
    cx /= n;
    cy /= n;
    let fx = focusX - cx;
    let fy = focusY - cy;
    const d = Math.hypot(fx, fy) || 1;
    fx /= d;
    fy /= d;
    const kind = sq.objective === 'ATTACK_ENEMY' || sq.objective === 'DEFEND_CASTLE' ? 'defense' : 'line';
    const targets = formationTargets(kind, sq.units, { x: sq.targetX, y: sq.targetY }, { x: fx, y: fy });
    for (const [u, slot] of targets) {
      u.aiControl = true;
      u.moveTarget = slot;
      if (sq.objective === 'CAPTURE_MINE') {
        u.searchRadius = Math.min(u.searchRadius, 160);
        u.attackTarget = null;
        u.structureTarget = null;
      } else if (sq.structure && sq.objective === 'ATTACK_ENEMY') {
        if (!u.structureTarget || !u.structureTarget.alive || u.structureTarget.team === u.team) {
          u.structureTarget = sq.structure;
        }
      } else {
        u.structureTarget = null;
      }
    }
  }

  private baseThreatened(team: CreativeTeam, units: Unit[], structures: Structure[]): boolean {
    const teamUnit = creativeTeamOf(team);
    const foeTeam: Team = teamUnit === 'player' ? 'enemy' : 'player';
    const base = structures.find((s) => s.alive && s.kind === 'base' && s.team === teamUnit);
    if (!base) return false;
    if (base.hp < base.maxHp * 0.6) return true;
    return this.nearestEnemyOf(units, foeTeam, base.x, base.y, 650) !== null;
  }

  private nearestEnemyOf(units: Unit[], foeTeam: Team, x: number, y: number, radius: number): Unit | null {
    let best: Unit | null = null;
    let bestD = radius * radius;
    for (const u of units) {
      if (!u.alive || u.team !== foeTeam) continue;
      const d = dist2(u.x, u.y, x, y);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  private threatenedMine(team: CreativeTeam, units: Unit[], structures: Structure[]): Structure | null {
    const teamUnit = creativeTeamOf(team);
    const foeTeam: Team = teamUnit === 'player' ? 'enemy' : 'player';
    let best: Structure | null = null;
    let bestD = Infinity;
    for (const s of structures) {
      if (!s.alive || s.kind !== 'mine' || mineOwnerTeam(s) !== team) continue;
      const foe = this.nearestEnemyOf(units, foeTeam, s.x, s.y, 380);
      if (!foe) continue;
      const d = dist2(s.x, s.y, foe.x, foe.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private captureCandidate(team: CreativeTeam, structures: Structure[], units: Unit[]): Structure | null {
    let best: Structure | null = null;
    let bestD = Infinity;
    for (const s of structures) {
      if (!s.alive || s.kind !== 'mine' || mineOwnerTeam(s) === team) continue;
      let cx = 0;
      let cy = 0;
      for (const u of units) {
        cx += u.x;
        cy += u.y;
      }
      const n = Math.max(1, units.length);
      const d = dist2(cx / n, cy / n, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private attackTarget(
    team: CreativeTeam,
    units: Unit[],
    structures: Structure[],
    attackers: Unit[],
  ): { x: number; y: number; structure: Structure | null } {
    const teamUnit = creativeTeamOf(team);
    const foeTeam: Team = teamUnit === 'player' ? 'enemy' : 'player';
    let cx = 0;
    let cy = 0;
    for (const u of attackers) {
      cx += u.x;
      cy += u.y;
    }
    cx /= attackers.length;
    cy /= attackers.length;

    const pick = (kinds: string[]): Structure | null => {
      let best: Structure | null = null;
      let bestD = Infinity;
      for (const s of structures) {
        if (!s.alive || s.team !== foeTeam) continue;
        if (!kinds.includes(s.kind)) continue;
        const d = dist2(s.x, s.y, cx, cy);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return best;
    };

    const base = pick(['base']);
    if (base) return { x: base.x, y: base.y, structure: base };
    const tower = pick(['tower']);
    if (tower) return { x: tower.x, y: tower.y, structure: tower };
    const mine = pick(['mine']);
    if (mine) return { x: mine.x, y: mine.y, structure: mine };

    let ex = 0;
    let ey = 0;
    let count = 0;
    for (const u of units) {
      if (!u.alive || u.team !== foeTeam) continue;
      ex += u.x;
      ey += u.y;
      count++;
    }
    if (count > 0) return { x: ex / count, y: ey / count, structure: null };

    const ownBase = structures.find((s) => s.alive && s.kind === 'base' && s.team === teamUnit);
    if (ownBase) return { x: ownBase.x, y: ownBase.y, structure: null };
    return { x: cx, y: cy, structure: null };
  }
}

export function updateCreativeCaptures(structures: Structure[], units: Unit[], dt: number): void {
  const cfg = CONFIG.adventure.capture;
  const radiusSq = cfg.radius * cfg.radius;
  for (const s of structures) {
    if (s.kind !== 'mine' || !s.alive) continue;
    const current = mineOwnerTeam(s);
    let progressing: CreativeTeam | null = null;
    for (const team of ['blue', 'red'] as CreativeTeam[]) {
      if (team === current) continue;
      const uTeam = creativeTeamOf(team);
      for (const u of units) {
        if (!u.alive || u.team !== uTeam) continue;
        if (dist2(u.x, u.y, s.x, s.y) <= radiusSq) {
          progressing = team;
          break;
        }
      }
      if (progressing) break;
    }
    if (progressing) {
      s.captureProgress = (s.captureProgress ?? 0) + dt;
      if (s.captureProgress >= cfg.time) {
        s.captureProgress = 0;
        const newOwner = creativeTeamOf(progressing);
        s.owner = newOwner;
        s.team = newOwner;
        s.color = CONFIG.mine.color;
      }
    } else {
      s.captureProgress = Math.max(0, (s.captureProgress ?? 0) - dt * 1.5);
    }
  }
}
