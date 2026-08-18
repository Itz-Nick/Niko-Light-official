import { CONFIG } from '../config';
import type { SpatialGrid } from '../core/grid';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { Team } from '../types';
import { formationTargets } from './formation';
import type { FormationKind } from './formation';

export type SquadMode = 'auto' | 'manual' | 'manual_moving';

export interface Squad {
  id: number;
  units: Unit[];
  anchorX: number;
  anchorY: number;
  facingX: number;
  facingY: number;
  destX: number;
  destY: number;
  hasFrontline: boolean;
  timer: number;
  mode: SquadMode;
  formationKind: FormationKind | null;
}

interface TeamState {
  anchorX: number;
  anchorY: number;
  facingX: number;
  facingY: number;
  hasFrontline: boolean;
  timer: number;
}

const TICK = CONFIG.formation.tick;
let nextSquadId = 1;
const squads: Squad[] = [];
const unitSquad = new WeakMap<Unit, Squad>();
const enemyState: TeamState = {
  anchorX: CONFIG.positions.base.x,
  anchorY: CONFIG.positions.base.y,
  facingX: 0,
  facingY: 1,
  hasFrontline: false,
  timer: TICK,
};
const scratch: Unit[] = [];

export function commandSquad(units: readonly Unit[], destX: number, destY: number): Squad | null {
  const alive: Unit[] = [];
  let mode: SquadMode = 'auto';
  let kind: FormationKind | null = null;
  let layoutFx = 0;
  let layoutFy = -1;
  let cx = 0;
  let cy = 0;
  for (const u of units) {
    if (!u.alive) continue;
    const prev = unitSquad.get(u);
    if (prev && prev.mode !== 'auto') {
      // carry the manual state explicitly; a fresh unit must not flip it to auto
      mode = 'manual';
      if (prev.formationKind && kind === null) {
        kind = prev.formationKind;
        layoutFx = prev.facingX;
        layoutFy = prev.facingY;
      }
    }
    removeFromSquad(u);
    alive.push(u);
    cx += u.x;
    cy += u.y;
  }
  const count = alive.length;
  if (count === 0) return null;
  cx /= count;
  cy /= count;

  let fx = 0;
  let fy = -1;
  const dx = destX - cx;
  const dy = destY - cy;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    fx = dx / d;
    fy = dy / d;
  }

  const sq: Squad = {
    id: nextSquadId++,
    units: alive,
    anchorX: destX,
    anchorY: destY,
    facingX: kind !== null ? layoutFx : fx,
    facingY: kind !== null ? layoutFy : fy,
    destX,
    destY,
    hasFrontline: false,
    timer: TICK,
    mode,
    formationKind: kind,
  };
  for (const u of alive) unitSquad.set(u, sq);
  squads.push(sq);

  if (mode === 'manual' && kind !== null) {
    const missingOffset = sq.units.some((u) => u.formationOffset === null);
    if (missingOffset) recomputeManualLayout(sq);
  }
  return sq;
}

function recomputeManualLayout(sq: Squad): void {
  const kind = sq.formationKind;
  if (!kind) return;
  const targets = formationTargets(
    kind,
    sq.units,
    { x: sq.anchorX, y: sq.anchorY },
    { x: sq.facingX, y: sq.facingY },
  );
  for (const [u, target] of targets) {
    u.formationOffset = { x: target.x - sq.anchorX, y: target.y - sq.anchorY };
    u.moveTarget = target;
    u.attackTarget = null;
    u.formationSlot = null;
  }
}

function removeFromSquad(u: Unit): void {
  const sq = unitSquad.get(u);
  if (!sq) return;
  const i = sq.units.indexOf(u);
  if (i >= 0) sq.units.splice(i, 1);
  unitSquad.delete(u);
}

export function getSquadFor(u: Unit): Squad | null {
  return unitSquad.get(u) ?? null;
}

export function getEnemyFormationState(): TeamState {
  return enemyState;
}

export function resetAutoFormation(): void {
  squads.length = 0;
  const base = CONFIG.positions.base;
  enemyState.anchorX = base.x;
  enemyState.anchorY = base.y;
  enemyState.facingX = 0;
  enemyState.facingY = 1;
  enemyState.hasFrontline = false;
  enemyState.timer = TICK;
}

export function updateAutoFormation(
  units: Unit[],
  grid: SpatialGrid,
  structures: Structure[],
  dt: number,
): void {
  for (const sq of squads) {
    pruneSquad(sq);
    if (sq.mode !== 'auto') {
      if (sq.mode === 'manual_moving') {
        let arrived = true;
        for (const u of sq.units) {
          if (u.moveTarget !== null) {
            arrived = false;
            break;
          }
        }
        if (arrived) sq.mode = 'manual';
      }
      continue;
    }
    sq.timer -= dt;
    if (sq.timer <= 0) {
      sq.timer = TICK;
      // auto formation disabled: player units never get automatic slots
      for (const u of sq.units) u.formationSlot = null;
    }
  }
  for (let i = squads.length - 1; i >= 0; i--) {
    if (squads[i].units.length === 0) squads.splice(i, 1);
  }
  enemyState.timer -= dt;
  if (enemyState.timer <= 0) {
    enemyState.timer = TICK;
    recomputeEnemy(units, grid, structures);
  }
}

function pruneSquad(sq: Squad): void {
  let w = 0;
  for (let i = 0; i < sq.units.length; i++) {
    const u = sq.units[i];
    if (u.alive) {
      sq.units[w++] = u;
    } else {
      unitSquad.delete(u);
      u.formationSlot = null;
    }
  }
  sq.units.length = w;
}

function recomputeEnemy(units: Unit[], grid: SpatialGrid, structures: Structure[]): void {
  scratch.length = 0;
  for (const u of units) {
    if (u.alive && u.team === 'enemy' && u.moveTarget === null && u.troopType !== 'boss') scratch.push(u);
  }
  const n = scratch.length;
  if (n === 0) return;

  const objectiveOf = (u: Unit): { x: number; y: number } | null => {
    let best: { x: number; y: number } | null = null;
    let bestSq = Infinity;
    for (const s of structures) {
      if (!s.alive) continue;
      if (s.kind !== 'cart' && s.kind !== 'base') continue;
      const dx = s.x - u.x;
      const dy = s.y - u.y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        best = { x: s.x, y: s.y };
      }
    }
    return best;
  };

  const groups: Unit[][] = [];
  for (const u of scratch) {
    const key = objectiveOf(u);
    let placed = false;
    for (const g of groups) {
      const a = objectiveOf(g[0]);
      const same = (a === null && key === null) || (a !== null && key !== null && a.x === key.x && a.y === key.y);
      if (same) {
        g.push(u);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([u]);
  }

  for (const group of groups) {
    placeEnemyGroup(group, grid, structures);
  }

  let biggest = groups[0];
  for (const g of groups) {
    if (g.length > biggest.length) biggest = g;
  }
  let gcx = 0;
  let gcy = 0;
  for (const u of biggest) {
    gcx += u.x;
    gcy += u.y;
  }
  gcx /= biggest.length;
  gcy /= biggest.length;
  let hasFront = false;
  for (const u of biggest) {
    if (u.role === 'frontline') {
      hasFront = true;
      break;
    }
  }
  const threat = findThreat('enemy', gcx, gcy, grid, structures);
  if (threat) {
    const dx = threat.x - gcx;
    const dy = threat.y - gcy;
    const d = Math.hypot(dx, dy) || 1;
    enemyState.facingX = dx / d;
    enemyState.facingY = dy / d;
  }
  enemyState.anchorX = gcx;
  enemyState.anchorY = gcy;
  enemyState.hasFrontline = hasFront;
}

function placeEnemyGroup(group: Unit[], grid: SpatialGrid, structures: Structure[]): void {
  const n = group.length;
  if (n === 0) return;
  let cx = 0;
  let cy = 0;
  for (const u of group) {
    cx += u.x;
    cy += u.y;
  }
  cx /= n;
  cy /= n;

  const threat = findThreat('enemy', cx, cy, grid, structures);
  let fx: number;
  let fy: number;
  if (threat) {
    const dx = threat.x - cx;
    const dy = threat.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    fx = dx / d;
    fy = dy / d;
  } else {
    fx = enemyState.facingX;
    fy = enemyState.facingY;
  }
  const px = -fy;
  const py = fx;

  const front: Unit[] = [];
  const back: Unit[] = [];
  const elite: Unit[] = [];
  for (const u of group) {
    if (u.role === 'frontline') front.push(u);
    else if (u.role === 'backline') back.push(u);
    else elite.push(u);
  }

  const spacing = CONFIG.selection.spacing;
  const frontDepth = spacing * CONFIG.formation.frontDepth;
  const backDepth = spacing * CONFIG.formation.backDepth;

  placeRows(front, cx, cy, fx, fy, px, py, frontDepth, spacing);
  placeRows(elite, cx, cy, fx, fy, px, py, spacing * CONFIG.formation.eliteDepth, spacing);
  if (back.length > 0) {
    if (front.length === 0 && threat) {
      placeArchersAtRange(back, threat, spacing);
    } else {
      placeRows(back, cx, cy, fx, fy, px, py, -backDepth, spacing);
    }
  }
}

function placeRows(
  list: Unit[],
  cx: number,
  cy: number,
  fx: number,
  fy: number,
  px: number,
  py: number,
  depth: number,
  spacing: number,
): void {
  const n = list.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lat = (col - (cols - 1) / 2) * spacing;
    const d = depth - row * spacing;
    list[i].formationSlot = { x: cx + fx * d + px * lat, y: cy + fy * d + py * lat };
  }
}

function placeArchersAtRange(list: Unit[], threat: { x: number; y: number }, spacing: number): void {
  const n = list.length;
  let cx = 0;
  let cy = 0;
  for (const u of list) {
    cx += u.x;
    cy += u.y;
  }
  cx /= n;
  cy /= n;
  const dx = threat.x - cx;
  const dy = threat.y - cy;
  const d = Math.hypot(dx, dy) || 1;
  const fx = dx / d;
  const fy = dy / d;
  const px = -fy;
  const py = fx;
  const range = list[0].attackRange;
  const depth = Math.max(0, d - range * 0.9);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lat = (col - (cols - 1) / 2) * spacing;
    list[i].formationSlot = { x: cx + fx * (depth - row * spacing) + px * lat, y: cy + fy * (depth - row * spacing) + py * lat };
  }
}

function findThreat(
  team: Team,
  cx: number,
  cy: number,
  grid: SpatialGrid,
  structures: Structure[],
): { x: number; y: number } | null {
  const foes: Unit[] = [];
  grid.queryCircle(cx, cy, CONFIG.formation.threatRadius, foes);
  let best: { x: number; y: number } | null = null;
  let bestSq = Infinity;
  for (const f of foes) {
    if (!f.alive || f.team === team) continue;
    const dx = f.x - cx;
    const dy = f.y - cy;
    const d = dx * dx + dy * dy;
    if (d < bestSq) {
      bestSq = d;
      best = { x: f.x, y: f.y };
    }
  }
  if (best) return best;
  if (team === 'enemy') {
    let bestTarget: Structure | null = null;
    let bestSq = Infinity;
    for (const s of structures) {
      if (!s.alive) continue;
      if (s.kind !== 'cart' && s.kind !== 'base') continue;
      const dx = s.x - cx;
      const dy = s.y - cy;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        bestTarget = s;
      }
    }
    if (bestTarget) return { x: bestTarget.x, y: bestTarget.y };
  }
  return null;
}