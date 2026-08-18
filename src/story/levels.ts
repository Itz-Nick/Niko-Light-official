import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import { level4 } from './level4';
import { level5 } from './level5';
import { level6 } from './level6';
import { level7 } from './level7';
import { level8 } from './level8';
import { level9 } from './level9';
import { level10 } from './level10';
import type { LevelDef } from './story';

export const LEVELS: LevelDef[] = [
  level1,
  level2,
  level3,
  level4,
  level5,
  level6,
  level7,
  level8,
  level9,
  level10,
];

export interface PlannedLevel {
  number: number;
  name: string;
  description: string;
}

export const PLANNED_LEVELS: PlannedLevel[] = [];

export function levelByNumber(n: number): LevelDef | undefined {
  return LEVELS.find((l) => l.number === n);
}

export function levelMeta(n: number): { name: string; description: string } | null {
  const l = levelByNumber(n);
  if (l) return { name: l.name, description: l.objective };
  const p = PLANNED_LEVELS.find((x) => x.number === n);
  return p ? { name: p.name, description: p.description } : null;
}