export interface SettingsData {
  music: boolean;
  sfx: boolean;
  ambient: boolean;
  showFps: boolean;
  maxUnits: number;
  musicVolume: number;
  sfxVolume: number;
  interfaceVolume: number;
  ambientVolume: number;
}

const DEFAULTS: SettingsData = {
  music: true,
  sfx: true,
  ambient: true,
  showFps: false,
  maxUnits: 500,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  interfaceVolume: 0.7,
  ambientVolume: 0.35,
};

const STORAGE_KEY = 'nikolight-settings';

export class SettingsStore {
  value: SettingsData = { ...DEFAULTS };

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.value = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      // keep defaults when storage is unavailable
    }
  }

  set<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void {
    this.value[key] = value;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.value));
    } catch {
      // keep value in memory when storage is unavailable
    }
  }
}