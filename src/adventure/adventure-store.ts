export interface AdventurePhaseRecord {
  bestTime: number;
  bestMines: number;
  bestRegions: number;
}

export interface AdventureStoreData {
  phase1Completed: boolean;
  record: AdventurePhaseRecord;
}

const STORAGE_KEY = 'nikolight-adventure';

function cloneBase(): AdventureStoreData {
  return { phase1Completed: false, record: { bestTime: 0, bestMines: 0, bestRegions: 0 } };
}

export class AdventureStore {
  private data: AdventureStoreData = cloneBase();

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = { ...cloneBase(), ...JSON.parse(raw), record: { ...cloneBase().record, ...(JSON.parse(raw).record ?? {}) } };
    } catch {
      // keep defaults when storage is unavailable
    }
  }

  get phase1Completed(): boolean {
    return this.data.phase1Completed;
  }

  get best(): AdventurePhaseRecord {
    return this.data.record;
  }

  recordPhase1(stats: { time: number; minesCaptured: number; regionsRevealed: number }): void {
    this.data.phase1Completed = true;
    const prev = this.data.record;
    this.data.record = {
      bestTime: prev.bestTime > 0 ? Math.min(prev.bestTime, stats.time) : stats.time,
      bestMines: Math.max(prev.bestMines, stats.minesCaptured),
      bestRegions: Math.max(prev.bestRegions, stats.regionsRevealed),
    };
    this.save();
  }

  reset(): void {
    this.data = cloneBase();
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // keep value in memory when storage is unavailable
    }
  }
}
