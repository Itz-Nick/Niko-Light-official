import type { SpatialGrid } from '../core/grid';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import type { BiomeId } from '../biomes/biomes';
import type { TroopType } from '../types';

export type StoryResult = 'running' | 'won' | 'lost';

export interface LevelContext {
  units: Unit[];
  structures: Structure[];
  grid: SpatialGrid;
  spawnEnemy: (type: TroopType, x: number, y: number) => Unit;
  createPlayerUnit: (type: TroopType, x: number, y: number) => Unit;
  createCart: (x: number, y: number) => Structure;
  createBase: () => Structure;
  createBaseAt: (x: number, y: number) => Structure;
  createDefense: () => Structure[];
  createMines: () => Structure[];
  createMineAt: (x: number, y: number) => Structure;
  showMessage: (message: string) => void;
  hideTutorial: () => void;
}

export interface LevelStats {
  castlePct: number;
  cartPct: number;
  losses: number;
  time: number;
  aliveArchers: number;
  aliveTanks: number;
  aliveChampions: number;
  basesPct: number[];
  minesPct: number;
  wallsPct: number;
}

export interface StatLine {
  label: string;
  value: string;
}

export interface LevelDef {
  number: number;
  id: string;
  name: string;
  description: string;
  objective: string;
  biome: BiomeId;
  hasCart: boolean;
  hasCastle: boolean;
  route: { x: number; y: number }[];
  result: StoryResult;
  star2: (s: LevelStats) => boolean;
  star3: (s: LevelStats) => boolean;
  summary: (s: LevelStats) => StatLine[];
  setup: (ctx: LevelContext) => void;
  update: (ctx: LevelContext, dt: number) => void;
  onMoveCommand?: () => void;
  onFormation?: () => void;
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function starsFor(def: LevelDef, stats: LevelStats): number {
  let stars = 1;
  if (def.star2(stats)) stars = 2;
  if (def.star3(stats)) stars = 3;
  return stars;
}