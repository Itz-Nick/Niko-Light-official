export interface LevelRecord {
  completed: boolean;
  stars: number;
  bestTime: number;
  bestCastlePct: number;
  bestCartPct: number;
  bestLosses: number;
}

export interface CampaignStoreData {
  highestUnlocked: number;
  campaignComplete: boolean;
  levels: Record<number, LevelRecord>;
}

const STORAGE_KEY = 'nikolight-campaign';
const MAX_LEVELS = 10;

function cloneBase(): CampaignStoreData {
  return { highestUnlocked: 1, campaignComplete: false, levels: {} };
}

export class CampaignStore {
  private data: CampaignStoreData = cloneBase();

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.data = { ...cloneBase(), ...JSON.parse(raw) };
    } catch {
      // keep defaults when storage is unavailable
    }
  }

  isUnlocked(levelNumber: number): boolean {
    return levelNumber <= this.data.highestUnlocked;
  }

  isCompleted(levelNumber: number): boolean {
    return !!this.data.levels[levelNumber]?.completed;
  }

  isComplete(): boolean {
    return this.data.campaignComplete;
  }

  starsOf(levelNumber: number): number {
    return this.data.levels[levelNumber]?.stars ?? 0;
  }

  record(levelNumber: number, stars: number, stats: { time: number; castlePct: number; cartPct: number; losses: number }): void {
    const prev = this.data.levels[levelNumber];
    const next: LevelRecord = {
      completed: true,
      stars: Math.max(prev?.stars ?? 0, stars),
      bestTime: prev ? Math.min(prev.bestTime, stats.time) : stats.time,
      bestCastlePct: prev ? Math.max(prev.bestCastlePct, stats.castlePct) : stats.castlePct,
      bestCartPct: prev ? Math.max(prev.bestCartPct, stats.cartPct) : stats.cartPct,
      bestLosses: prev ? Math.min(prev.bestLosses, stats.losses) : stats.losses,
    };
    this.data.levels[levelNumber] = next;
    if (levelNumber >= MAX_LEVELS) {
      this.data.campaignComplete = true;
    } else {
      this.data.highestUnlocked = Math.max(this.data.highestUnlocked, levelNumber + 1);
    }
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