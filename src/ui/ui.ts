import { CONFIG } from '../config';
import type { Difficulty } from '../config';
import type { Economy } from '../economy/economy';
import type { SettingsStore } from '../settings/settings';
import type { CampaignStore } from '../story/campaign';
import { formatTime } from '../story/story';
import type { LevelDef, LevelStats, StatLine } from '../story/story';
import type { PlayerTroopType, TroopType } from '../types';
import type { BuildingKind, ProgressionSnapshot } from '../progression/progression';
import type { WaveManager } from '../waves/wave-manager';
import { TERRITORY_COLS, TERRITORY_ROWS } from '../adventure/territory';
import type { CreativePick, CreativeTeam } from '../creative/creative';

export interface AdventureStats {
  time: number;
  territories: number;
  minesCaptured: number;
  minesTotal: number;
}

type ScreenName =
  | 'menu'
  | 'modes'
  | 'difficulty'
  | 'creative'
  | 'creative-editor'
  | 'pause'
  | 'settings'
  | 'controls'
  | 'gameover'
  | 'storymap'
  | 'phaseintro'
  | 'storywin'
  | 'storyteaser'
  | 'storylose'
  | 'campaigncomplete'
  | 'advwin'
  | 'advlose'
  | 'creativresult';
type UnderlyingScreen = 'menu' | 'pause';

const SCREENS: ScreenName[] = [
  'menu',
  'modes',
  'difficulty',
  'creative',
  'creative-editor',
  'pause',
  'settings',
  'controls',
  'gameover',
  'phaseintro',
  'storywin',
  'storyteaser',
  'storylose',
  'campaigncomplete',
  'advwin',
  'advlose',
  'creativresult',
];

const ARMY_TYPES: PlayerTroopType[] = ['knight', 'archer', 'tank', 'champion'];

const ARMY_NAMES: Record<TroopType, string> = {
  knight: 'Cavaleiros',
  archer: 'Arqueiros',
  tank: 'Tanques',
  champion: 'Campeões',
  boss: 'Senhor da Ruína',
};

function starsHtml(stars: number): string {
  const s = Math.max(0, Math.min(3, stars));
  return `${'⭐'.repeat(s)}<span class="stars-dim">${'⭐'.repeat(3 - s)}</span>`;
}

function performanceText(stars: number): string {
  if (stars >= 3) return 'Desempenho excepcional!';
  if (stars === 2) return 'Bom trabalho!';
  return 'Missão cumprida!';
}

interface UiHandlers {
  onOpenModes: () => void;
  onPlayInfinite: () => void;
  onDifficultySelect: (difficulty: Difficulty) => void;
  onDifficultyBack: () => void;
  onPlayAdventure: () => void;
  onPlayCreative: () => void;
  onCreativeBack: () => void;
  onCreativeStart: () => void;
  onCreativeEditorBack: () => void;
  onCreativeTeam: (team: CreativeTeam) => void;
  onCreativePick: (pick: CreativePick) => void;
  onCreativeRemove: () => void;
  onCreativeStartBattle: () => void;
  onCoopLocked?: () => void;
  onBackToMenu: () => void;
  onOpenStory: () => void;
  onStoryMapBack: () => void;
  onStoryMapPlay: (levelNumber: number) => void;
  onStoryWinContinue: () => void;
  onStoryWinRetry: () => void;
  onStoryWinMenu: () => void;
  onPhaseIntroContinue: () => void;
  onStoryTeaserContinue: () => void;
  onStoryTeaserMenu: () => void;
  onCampaignCompleteContinue: () => void;
  onCampaignCompleteMenu: () => void;
  onStoryLoseRetry: () => void;
  onStoryLoseMenu: () => void;
  onAdventureWinRestart: () => void;
  onAdventureWinContinue: () => void;
  onAdventureWinMenu: () => void;
  onAdventureLoseRetry: () => void;
  onAdventureLoseContinent: () => void;
  onAdventureLoseMenu: () => void;
  onCreativeRetry: () => void;
  onCreativeEdit: () => void;
  onCreativeResultMenu: () => void;
  onCreativeSpeed: (speed: 1 | 2 | 4) => void;
  onCreativePause: () => void;
  onResume: () => void;
  onQuitToMenu: () => void;
  onRestart: () => void;
  onToggleProgress: () => void;
  onUpgradeCastle: () => void;
  onUpgradeTroop: (type: PlayerTroopType) => void;
  onBuild: (kind: BuildingKind) => void;
  onStartWave: () => void;
  onRecruit?: (type: PlayerTroopType) => void;
  onSettingsChange?: () => void;
}

export class Ui {
  private readonly els: Record<ScreenName, HTMLElement>;
  private current: ScreenName | null = null;
  private underlying: UnderlyingScreen = 'menu';
  private transitionTimer: number | null = null;
  private transitionOutgoing: HTMLElement | null = null;
  private readonly hudEl: HTMLElement;
  private readonly goldEl: HTMLElement;
  private readonly goldGainEl: HTMLElement;
  private readonly baseFillEl: HTMLElement;
  private readonly baseHpEl: HTMLElement;
  private readonly waveEl: HTMLElement;
  private readonly waveStatusEl: HTMLElement;
  private readonly unitsEl: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly prepEl: HTMLElement;
  private readonly prepBannerEl: HTMLElement;
  private readonly prepCountdownEl: HTMLElement;
  private readonly progressionEl: HTMLElement;
  private readonly blockProgressEl: HTMLElement;
  private readonly progressHudEl: HTMLElement;
  private readonly progDiamondsEl: HTMLElement;
  private readonly progCastlePipsEl: HTMLElement;
  private readonly progCastleInfoEl: HTMLElement;
  private readonly progCastleBtnEl: HTMLButtonElement;
  private readonly progTroopsEl: HTMLElement;
  private readonly progBuildCountEl: HTMLElement;
  private readonly progBuildInfoEl: HTMLElement;
  private readonly buildHouseEl: HTMLButtonElement;
  private readonly buildMarketEl: HTMLButtonElement;
  private readonly buildTowerEl: HTMLButtonElement;
  private readonly buildHintEl: HTMLElement;
  private placing: BuildingKind | null = null;
  private progressionVisibleState = false;
  private lastProgressionKey = '';
  private readonly finalWaveEl: HTMLElement;
  private readonly armyEls: Record<PlayerTroopType, HTMLButtonElement>;
  private readonly statEls: Record<'gold' | 'wave' | 'troops' | 'army' | 'base' | 'cart', HTMLElement>;
  private readonly cartFillEl: HTMLElement;
  private readonly cartHpEl: HTMLElement;
  private readonly tutorialEl: HTMLElement;
  private readonly tutorialTextEl: HTMLElement;
  private readonly storyWinTitleEl: HTMLElement;
  private readonly storyWinSubtitleEl: HTMLElement;
  private readonly storyWinStarsEl: HTMLElement;
  private readonly storyWinObjectiveEl: HTMLElement;
  private readonly storyWinStatsEl: HTMLElement;
  private readonly storyWinUnlockEl: HTMLElement;
  private readonly storyLoseTextEl: HTMLElement;
  private readonly storyLoseStatsEl: HTMLElement;
  private readonly storyTeaserTitleEl: HTMLElement;
  private readonly storyTeaserStarsEl: HTMLElement;
  private readonly storyTeaserNarrationEl: HTMLElement;
  private readonly storyTeaserUnlockEl: HTMLElement;
  private readonly bossBarEl: HTMLElement;
  private readonly bossFillEl: HTMLElement;
  private readonly bossNameEl: HTMLElement;
  private readonly bossHpEl: HTMLElement;
  private readonly campaignCompleteTitleEl: HTMLElement;
  private readonly campaignCompleteStarsEl: HTMLElement;
  private readonly campaignCompleteNarrationEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly prepSecsEl: HTMLElement;
  private readonly blockResourcesEl: HTMLElement;
  private readonly blockWaveEl: HTMLElement;
  private readonly blockModeEl: HTMLElement;
  private readonly blockAdventureEl: HTMLElement;
  private readonly objectiveBannerEl: HTMLElement;
  private readonly enemyCastleBarEl: HTMLElement;
  private readonly enemyCastleFillEl: HTMLElement;
  private readonly enemyCastleHpEl: HTMLElement;
  private toastTimer: number | null = null;
  private coopLockTimer: number | null = null;
  private hardcoreLockTimer: number | null = null;
  private readonly last = {
    gold: -1,
    wave: -1,
    units: -1,
    unitCap: -1,
    countdown: -1,
    hpPct: -1,
    army: '',
    cartPct: -1,
    storyUnits: -1,
    storyFps: -1,
    bossPct: -1,
    enemyHpPct: -1,
    advArmy: '',
  };

  constructor(
    private readonly settings: SettingsStore,
    private readonly handlers: UiHandlers,
    private readonly campaign: CampaignStore,
  ) {
    this.els = {
      menu: this.el('menu'),
      modes: this.el('modes'),
      difficulty: this.el('difficulty'),
      creative: this.el('creative'),
      'creative-editor': this.el('creative-editor'),
      pause: this.el('pause'),
      settings: this.el('settings'),
      controls: this.el('controls'),
      gameover: this.el('gameover'),
      storymap: this.el('storymap'),
      phaseintro: this.el('phaseintro'),
      storywin: this.el('storywin'),
      storyteaser: this.el('storyteaser'),
      storylose: this.el('storylose'),
      campaigncomplete: this.el('campaigncomplete'),
      advwin: this.el('advwin'),
      advlose: this.el('advlose'),
      creativresult: this.el('creativresult'),
    };
    this.hudEl = this.el('hud');
    this.goldEl = this.el('gold');
    this.goldGainEl = this.el('goldGain');
    this.baseFillEl = this.el('baseFill');
    this.baseHpEl = this.el('baseHp');
    this.waveEl = this.el('wave');
    this.waveStatusEl = this.el('waveStatus');
    this.unitsEl = this.el('units');
    this.fpsEl = this.el('fps');
    this.prepEl = this.el('prep');
    this.prepBannerEl = this.el('prepBanner');
    this.prepCountdownEl = this.el('prepCountdown');
    this.progressionEl = this.el('progression');
    this.blockProgressEl = this.el('block-progress');
    this.progressHudEl = this.el('prog-hud');
    this.progDiamondsEl = this.el('prog-diamonds');
    this.progCastlePipsEl = this.el('prog-castle-pips');
    this.progCastleInfoEl = this.el('prog-castle-info');
    this.progCastleBtnEl = this.el<HTMLButtonElement>('prog-castle-btn');
    this.progTroopsEl = this.el('prog-troops');
    this.progBuildCountEl = this.el('prog-build-count');
    this.progBuildInfoEl = this.el('prog-build-info');
    this.buildHouseEl = this.el<HTMLButtonElement>('prog-build-house');
    this.buildMarketEl = this.el<HTMLButtonElement>('prog-build-market');
    this.buildTowerEl = this.el<HTMLButtonElement>('prog-build-tower');
    this.buildHintEl = this.el('build-hint');
    this.finalWaveEl = this.el('finalWave');
    this.armyEls = {
      knight: this.el<HTMLButtonElement>('army-knight'),
      archer: this.el<HTMLButtonElement>('army-archer'),
      tank: this.el<HTMLButtonElement>('army-tank'),
      champion: this.el<HTMLButtonElement>('army-champion'),
    };
    this.statEls = {
      gold: this.el('stat-gold'),
      wave: this.el('stat-wave'),
      troops: this.el('stat-troops'),
      army: this.el('stat-army'),
      base: this.el('stat-base'),
      cart: this.el('stat-cart'),
    };
    this.cartFillEl = this.el('cartFill');
    this.cartHpEl = this.el('cartHp');
    this.tutorialEl = this.el('tutorial');
    this.tutorialTextEl = this.el('tutorialText');
    this.storyWinTitleEl = this.el('storyWinTitle');
    this.storyWinSubtitleEl = this.el('storyWinSubtitle');
    this.storyWinStarsEl = this.el('storyWinStars');
    this.storyWinObjectiveEl = this.el('storyWinObjective');
    this.storyWinStatsEl = this.el('storyWinStats');
    this.storyWinUnlockEl = this.el('storyWinUnlock');
    this.storyLoseTextEl = this.el('storyLoseText');
    this.storyLoseStatsEl = this.el('storyLoseStats');
    this.storyTeaserTitleEl = this.el('storyTeaserTitle');
    this.storyTeaserStarsEl = this.el('storyTeaserStars');
    this.storyTeaserNarrationEl = this.el('storyTeaserNarration');
    this.storyTeaserUnlockEl = this.el('storyTeaserUnlock');
    this.bossBarEl = this.el('bossBar');
    this.bossFillEl = this.el('bossFill');
    this.bossNameEl = this.el('bossName');
    this.bossHpEl = this.el('bossHp');
    this.campaignCompleteTitleEl = this.el('campaignCompleteTitle');
    this.campaignCompleteStarsEl = this.el('campaignCompleteStars');
    this.campaignCompleteNarrationEl = this.el('campaignCompleteNarration');
    this.toastEl = this.el('toast');
    this.prepSecsEl = this.el('prepSecs');
    this.blockResourcesEl = this.el('block-resources');
    this.blockWaveEl = this.el('block-wave');
    this.blockModeEl = this.el('block-mode');
    this.blockAdventureEl = this.el('block-adventure');
    this.objectiveBannerEl = this.el('objectiveBanner');
    this.enemyCastleBarEl = this.el('enemyCastleBar');
    this.enemyCastleFillEl = this.el('enemyCastleFill');
    this.enemyCastleHpEl = this.el('enemyCastleHp');
    this.initScreens();
    this.initSettings();
    this.initArmy();
    this.initProgressionPanel();
  }

  updateHud(
    economy: Economy,
    waves: WaveManager,
    unitCount: number,
    baseHp: number,
    baseMaxHp: number,
    fps: number,
    troopCounts: Record<TroopType, number>,
    cap: number,
  ): void {
    const gold = Math.floor(economy.gold);
    if (this.last.gold !== gold) {
      this.last.gold = gold;
      this.goldEl.textContent = gold.toString();
    }
    if (this.last.wave !== waves.wave) {
      this.last.wave = waves.wave;
      this.waveEl.textContent = waves.wave.toString();
    }
    if (this.last.units !== unitCount || this.last.unitCap !== cap) {
      this.last.units = unitCount;
      this.last.unitCap = cap;
      this.unitsEl.textContent = `${unitCount}/${cap}`;
    }
    const hpPct = Math.max(0, Math.ceil((baseHp / baseMaxHp) * 100));
    if (this.last.hpPct !== hpPct) {
      this.last.hpPct = hpPct;
      this.baseFillEl.style.width = `${hpPct}%`;
      this.baseHpEl.textContent = `${hpPct}%`;
    }
    this.baseFillEl.classList.toggle('warn', hpPct > 25 && hpPct <= 60);
    this.baseFillEl.classList.toggle('crit', hpPct <= 25);
    const battle = waves.phase === 'battle';
    const status = battle ? 'EM BATALHA' : 'PREPARAÇÃO';
    if (this.waveStatusEl.textContent !== status) this.waveStatusEl.textContent = status;
    this.waveStatusEl.classList.toggle('battle', battle);
    this.waveStatusEl.classList.toggle('prep', !battle);
    this.updateFps(fps);
    this.updateArmy(economy, unitCount, troopCounts, cap, false);
  }

  updateStoryHud(
    cartHp: number,
    cartMaxHp: number,
    baseHp: number,
    baseMaxHp: number,
    unitCount: number,
    fps: number,
  ): void {
    const cp = cartMaxHp > 0 ? Math.max(0, Math.ceil((cartHp / cartMaxHp) * 100)) : 0;
    if (cartMaxHp > 0 && this.last.cartPct !== cp) {
      this.last.cartPct = cp;
      this.cartFillEl.style.width = `${cp}%`;
      this.cartHpEl.textContent = `${Math.ceil(cartHp)}/${Math.ceil(cartMaxHp)}`;
    }
    const bp = baseMaxHp > 0 ? Math.max(0, Math.ceil((baseHp / baseMaxHp) * 100)) : 0;
    if (baseMaxHp > 0 && this.last.hpPct !== bp) {
      this.last.hpPct = bp;
      this.baseFillEl.style.width = `${bp}%`;
      this.baseHpEl.textContent = `${bp}%`;
    }
    this.baseFillEl.classList.toggle('warn', bp > 25 && bp <= 60);
    this.baseFillEl.classList.toggle('crit', bp <= 25);
    if (this.last.storyUnits !== unitCount) {
      this.last.storyUnits = unitCount;
      this.unitsEl.textContent = unitCount.toString();
    }
    this.updateFps(fps);
  }

  updateBossHud(hp: number, maxHp: number, name: string): void {
    if (this.bossBarEl.hidden) this.bossBarEl.hidden = false;
    const pct = Math.max(0, Math.ceil((hp / maxHp) * 100));
    if (this.last.bossPct !== pct) {
      this.last.bossPct = pct;
      this.bossFillEl.style.width = `${pct}%`;
      this.bossHpEl.textContent = `${pct}%`;
    }
    if (this.bossNameEl.textContent !== name) this.bossNameEl.textContent = name;
  }

  hideBossHud(): void {
    if (!this.bossBarEl.hidden) {
      this.bossBarEl.hidden = true;
      this.last.bossPct = -1;
    }
  }

  updateAdventureHud(
    economy: Economy,
    unitCount: number,
    playerBaseHp: number,
    playerBaseMaxHp: number,
    enemyBaseHp: number,
    enemyBaseMaxHp: number,
    fps: number,
    cap: number,
  ): void {
    const gold = Math.floor(economy.gold);
    if (this.last.gold !== gold) {
      this.last.gold = gold;
      this.goldEl.textContent = gold.toString();
    }
    if (this.last.units !== unitCount || this.last.unitCap !== cap) {
      this.last.units = unitCount;
      this.last.unitCap = cap;
      this.unitsEl.textContent = `${unitCount}/${cap}`;
    }
    const army = `${unitCount}/${cap}`;
    if (this.last.advArmy !== army) {
      this.last.advArmy = army;
      this.statEls.army.title = `Exército: ${army}`;
    }
    const pp = playerBaseMaxHp > 0 ? Math.max(0, Math.ceil((playerBaseHp / playerBaseMaxHp) * 100)) : 0;
    if (this.last.hpPct !== pp) {
      this.last.hpPct = pp;
      this.baseFillEl.style.width = `${pp}%`;
      this.baseHpEl.textContent = `${pp}%`;
    }
    this.baseFillEl.classList.toggle('warn', pp > 25 && pp <= 60);
    this.baseFillEl.classList.toggle('crit', pp <= 25);
    const ep = enemyBaseMaxHp > 0 ? Math.max(0, Math.ceil((enemyBaseHp / enemyBaseMaxHp) * 100)) : 0;
    if (this.last.enemyHpPct !== ep) {
      this.last.enemyHpPct = ep;
      this.enemyCastleFillEl.style.width = `${ep}%`;
      this.enemyCastleHpEl.textContent = `${ep}%`;
    }
    this.enemyCastleBarEl.classList.toggle('crit', ep <= 25);
    const counts: Record<TroopType, number> = { knight: unitCount, archer: 0, tank: 0, champion: 0, boss: 0 };
    this.updateArmy(economy, unitCount, counts, cap, true);
    this.updateFps(fps);
  }

  private updateFps(fps: number): void {
    if (this.settings.value.showFps) {
      this.fpsEl.hidden = false;
      if (this.last.storyFps !== fps) {
        this.last.storyFps = fps;
        this.fpsEl.textContent = `${fps} FPS`;
      }
    } else if (!this.fpsEl.hidden) {
      this.fpsEl.hidden = true;
    }
  }

  setMode(mode: 'infinite' | 'story' | 'adventures'): void {
    const isStory = mode === 'story';
    const isAdv = mode === 'adventures';
    this.blockResourcesEl.hidden = isStory;
    this.blockWaveEl.hidden = isStory || isAdv;
    this.statEls.army.hidden = isStory;
    this.statEls.troops.hidden = false;
    if (!isStory) this.statEls.cart.hidden = true;
    this.prepEl.hidden = true;
    this.blockProgressEl.hidden = isStory;
    this.last.countdown = -1;
    this.setPlacing(null);
    this.setProgressionVisible(false);
    this.bossBarEl.hidden = true;
    this.last.bossPct = -1;
    this.blockModeEl.hidden = !isAdv;
    this.blockAdventureEl.hidden = !isAdv;
    this.objectiveBannerEl.hidden = !isAdv;
    this.enemyCastleBarEl.hidden = !isAdv;
    if (isAdv) {
      for (const type of ARMY_TYPES) this.armyEls[type].hidden = type !== 'knight';
    } else {
      for (const type of ARMY_TYPES) this.armyEls[type].hidden = false;
    }
  }

  setStoryHud(hasCart: boolean, hasBase: boolean): void {
    this.statEls.cart.hidden = !hasCart;
    this.statEls.base.hidden = !hasBase;
    this.statEls.troops.hidden = false;
    this.last.cartPct = -1;
    this.last.hpPct = -1;
  }

  showTutorial(message: string): void {
    this.tutorialTextEl.textContent = message;
    this.tutorialEl.hidden = false;
  }

  hideTutorial(): void {
    this.tutorialEl.hidden = true;
  }

  private updateArmy(
    economy: Economy,
    playerCount: number,
    troopCounts: Record<TroopType, number>,
    cap: number,
    knightOnly: boolean,
  ): void {
    const key = `${Math.floor(economy.gold)}:${playerCount}:${cap}:${troopCounts.knight}:${troopCounts.archer}:${troopCounts.tank}:${troopCounts.champion}:${knightOnly ? 1 : 0}`;
    if (key === this.last.army) return;
    this.last.army = key;
    for (const type of ARMY_TYPES) {
      if (knightOnly && type !== 'knight') continue;
      const rec = CONFIG.recruits[type];
      const affordable = economy.canAfford(rec.cost) && playerCount + rec.count <= cap;
      this.armyEls[type].disabled = !affordable;
      this.armyEls[type].querySelector('.army-count')!.textContent = troopCounts[type].toString();
      this.armyEls[type].title = affordable
        ? `${rec.count} ${ARMY_NAMES[type]}`
        : economy.canAfford(rec.cost)
          ? 'Limite de tropas atingido'
          : 'Ouro insuficiente';
    }
  }

  private initArmy(): void {
    for (const type of ARMY_TYPES) {
      const rec = CONFIG.recruits[type];
      const btn = this.armyEls[type];
      btn.querySelector('b')!.textContent = `${rec.count} ${ARMY_NAMES[type]}`;
      btn.querySelector('.army-cost')!.textContent = rec.cost.toString();
      btn.addEventListener('click', () => this.handlers.onRecruit?.(type));
    }
  }

  showToast(text: string, variant: 'info' | 'success' | 'alert' = 'info'): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('info', 'success', 'alert');
    this.toastEl.classList.add('show', variant);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.toastTimer = null;
    }, CONFIG.ui.toastDuration * 1000);
  }

  private triggerCoopLock(card: HTMLElement): void {
    if (this.coopLockTimer !== null) window.clearTimeout(this.coopLockTimer);
    card.classList.remove('lock-shake');
    void card.offsetWidth;
    card.classList.add('lock-shake');
    this.coopLockTimer = window.setTimeout(() => {
      card.classList.remove('lock-shake');
      this.coopLockTimer = null;
    }, 500);
    this.showToast('COOP · EM DESENVOLVIMENTO', 'alert');
    this.handlers.onCoopLocked?.();
  }

  private triggerHardcoreLock(card: HTMLElement): void {
    if (this.hardcoreLockTimer !== null) window.clearTimeout(this.hardcoreLockTimer);
    card.classList.remove('lock-shake');
    void card.offsetWidth;
    card.classList.add('lock-shake');
    this.hardcoreLockTimer = window.setTimeout(() => {
      card.classList.remove('lock-shake');
      this.hardcoreLockTimer = null;
    }, 500);
    this.showToast('HARDCORE · EM DESENVOLVIMENTO', 'alert');
    this.handlers.onCoopLocked?.();
  }

  flashGoldInsufficient(): void {
    this.goldEl.classList.remove('insufficient');
    void this.goldEl.offsetWidth;
    this.goldEl.classList.add('insufficient');
    window.setTimeout(() => this.goldEl.classList.remove('insufficient'), 520);
  }

  showGoldGain(amount: number): void {
    this.goldGainEl.textContent = `+${Math.round(amount)}`;
    this.goldGainEl.classList.remove('gain');
    void this.goldGainEl.offsetWidth;
    this.goldGainEl.classList.add('gain');
  }

  showPreparation(wave: number, secondsLeft: number): void {
    this.prepEl.hidden = false;
    this.prepBannerEl.textContent = wave === 0 ? 'PREPARAÇÃO' : `WAVE ${wave} COMPLETA`;
    const secs = Math.ceil(secondsLeft);
    if (this.last.countdown !== secs) {
      this.last.countdown = secs;
      this.prepSecsEl.textContent = secs.toString();
    }
    const warn = secs <= CONFIG.ui.countdownWarnAt;
    this.prepCountdownEl.classList.toggle('warn', warn);
    this.el<HTMLButtonElement>('btn-start-wave').classList.toggle('warn', warn);
  }

  hidePreparation(): void {
    this.prepEl.hidden = true;
    this.last.countdown = -1;
  }

  showMenu(): void {
    this.hudEl.hidden = true;
    this.show('menu');
  }

  showModes(): void {
    this.hudEl.hidden = true;
    this.updateModeStoryCard();
    this.show('modes');
  }

  showDifficulty(): void {
    this.hudEl.hidden = true;
    this.show('difficulty');
  }

  showContinent(): void {
    this.hudEl.hidden = true;
    this.fpsEl.hidden = true;
    this.show(null);
  }

  showCreative(): void {
    this.hudEl.hidden = true;
    this.show('creative');
  }

  showCreativeEditor(): void {
    this.hudEl.hidden = true;
    this.fpsEl.hidden = true;
    this.show('creative-editor');
  }

  setCreativeTeam(team: CreativeTeam): void {
    const blue = this.el<HTMLButtonElement>('creative-team-blue');
    const red = this.el<HTMLButtonElement>('creative-team-red');
    blue.classList.toggle('active', team === 'blue');
    red.classList.toggle('active', team === 'red');
    const hud = this.el('creative-hud');
    hud.classList.toggle('team-blue', team === 'blue');
    hud.classList.toggle('team-red', team === 'red');
    const label = this.el('creative-current-team');
    label.textContent = team === 'blue' ? 'TIME ATUAL 🔵 AZUL' : 'TIME ATUAL 🔴 VERMELHO';
  }

  setCreativePick(pick: CreativePick | null): void {
    const editor = this.els['creative-editor'];
    for (const btn of editor.querySelectorAll<HTMLButtonElement>('.palette-btn')) {
      const active = pick !== null && btn.dataset.creativeKind === pick.kind && btn.dataset.creativeType === pick.type;
      btn.classList.toggle('active', active);
    }
  }

  updateCreativeCounts(blue: number, red: number): void {
    this.el('creative-count-blue').textContent = String(blue);
    this.el('creative-count-red').textContent = String(red);
  }

  setCreativeLocked(locked: boolean): void {
    const editor = this.els['creative-editor'];
    for (const btn of editor.querySelectorAll<HTMLButtonElement>('button')) {
      if (btn.closest('.creative-spectator')) continue;
      btn.disabled = locked;
    }
    const hud = this.el('creative-hud');
    hud.classList.toggle('locked', locked);
    this.el('creative-current-team').hidden = locked;
    this.el('creative-seg').hidden = locked;
    this.el('creative-palette').hidden = locked;
    this.el('creative-actions').hidden = locked;
    this.el('creative-spectator').hidden = !locked;
    this.el('btn-creative-start').hidden = locked;
  }

  setCreativeBattleTime(time: number): void {
    this.el('creative-battle-time').textContent = formatTime(time);
  }

  setCreativeTroopCounts(blue: number, red: number): void {
    this.el('creative-blue-count').textContent = String(blue);
    this.el('creative-red-count').textContent = String(red);
  }

  setCreativeSpeed(speed: 1 | 2 | 4): void {
    for (const btn of this.els['creative-editor'].querySelectorAll<HTMLButtonElement>('.spec-speed-btn')) {
      btn.classList.toggle('active', Number(btn.dataset.speed) === speed);
    }
  }

  showCreativeResult(winner: CreativeTeam, time: number, blueRemaining: number, redRemaining: number, blueKills: number, redKills: number, blueLosses: number, redLosses: number): void {
    this.el('creativeResultTitle').textContent = '⚔️ BATALHA FINALIZADA';
    const winnerEl = this.el('creativeResultWinner');
    winnerEl.textContent = winner === 'blue' ? '🔵 AZUL VENCEU' : '🔴 VERMELHO VENCEU';
    winnerEl.classList.toggle('winner-blue', winner === 'blue');
    winnerEl.classList.toggle('winner-red', winner === 'red');
    this.el('creativeResultTime').textContent = formatTime(time);
    this.el('creativeResultBlueTroops').textContent = String(blueRemaining);
    this.el('creativeResultRedTroops').textContent = String(redRemaining);
    this.el('creativeResultBlueKills').textContent = String(blueKills);
    this.el('creativeResultRedKills').textContent = String(redKills);
    this.el('creativeResultBlueLosses').textContent = String(blueLosses);
    this.el('creativeResultRedLosses').textContent = String(redLosses);
    this.hudEl.hidden = true;
    this.show('creativresult');
  }

  private updateModeStoryCard(): void {
    const { completed, stars } = this.campaignProgress();
    const prog = this.el('mode-story-progress');
    prog.hidden = false;
    this.el('mode-story-progress-text').textContent = `${completed} / 10 fases`;
    const bar = this.el('mode-story-stars');
    bar.textContent = '';
    for (let i = 0; i < 10; i++) {
      const seg = document.createElement('span');
      seg.className = `seg${i < completed ? ' on' : ''}`;
      bar.appendChild(seg);
    }
    const desc = this.el('mode-story-desc');
    desc.textContent = `Campanha narrativa com 10 fases progressivas e uma batalha final. ${stars} de 30 estrelas.`;
  }

  private campaignProgress(): { completed: number; stars: number } {
    let completed = 0;
    let stars = 0;
    for (let n = 1; n <= 10; n++) {
      if (this.campaign.isCompleted(n)) completed++;
      stars += this.campaign.starsOf(n);
    }
    return { completed, stars };
  }

  showStoryMap(): void {
    this.hudEl.hidden = true;
    this.show('storymap');
  }

  showPhaseIntro(level: LevelDef): void {
    this.hudEl.hidden = true;
    this.el('phaseIntroTitle').textContent = `FASE ${level.number}`;
    this.el('phaseIntroName').textContent = level.name;
    this.el('phaseIntroDesc').textContent = level.description;
    this.show('phaseintro');
  }

  showStoryResult(level: LevelDef, stars: number, stats: LevelStats, unlockedText: string | null): void {
    this.storyWinTitleEl.textContent = `FASE ${level.number} CONCLUÍDA`;
    this.storyWinSubtitleEl.textContent = performanceText(stars);
    this.storyWinStarsEl.innerHTML = starsHtml(stars);
    this.storyWinObjectiveEl.innerHTML = `<strong>✓</strong> ${level.objective}`;
    const cells = level
      .summary(stats)
      .map((l) => `<div class="cell"><span>${l.label}</span><b>${l.value}</b></div>`)
      .join('');
    this.storyWinStatsEl.innerHTML = cells;
    if (unlockedText) {
      this.storyWinUnlockEl.textContent = unlockedText;
      this.storyWinUnlockEl.hidden = false;
    } else {
      this.storyWinUnlockEl.hidden = true;
    }
    this.show('storywin');
  }

  showStoryLose(name: string, stats: LevelStats): void {
    this.storyLoseTextEl.textContent = `A fase "${name}" foi perdida antes do objetivo ser concluído.`;
    const cells: StatLine[] = [
      { label: 'Tempo', value: formatTime(stats.time) },
      { label: 'Tropas perdidas', value: `${stats.losses}` },
    ];
    if (stats.cartPct > 0) cells.push({ label: 'Carroça', value: `${Math.round(stats.cartPct)}%` });
    if (stats.castlePct > 0) cells.push({ label: 'Castelo', value: `${Math.round(stats.castlePct)}%` });
    this.storyLoseStatsEl.innerHTML = cells
      .map((c) => `<div class="cell"><span>${c.label}</span><b>${c.value}</b></div>`)
      .join('');
    this.show('storylose');
  }

  showStoryTeaser(level: LevelDef, stars: number, _stats: LevelStats): void {
    this.storyTeaserTitleEl.textContent = `FASE ${level.number} CONCLUÍDA`;
    this.storyTeaserStarsEl.innerHTML = starsHtml(stars);
    this.storyTeaserNarrationEl.innerHTML = [
      'A batalha terminou.',
      'Mas encontramos algo no horizonte...',
      'Um exército desconhecido está se aproximando.',
      'O próximo confronto será diferente.',
    ]
      .map((p) => `<p>${p}</p>`)
      .join('');
    this.storyTeaserUnlockEl.textContent = 'FASE 10 DESBLOQUEADA!';
    this.show('storyteaser');
  }

  showCampaignComplete(level: LevelDef, stars: number): void {
    this.campaignCompleteTitleEl.textContent = `FASE ${level.number} — SENHOR DA RUÍNA DERROTADO`;
    this.campaignCompleteStarsEl.innerHTML = starsHtml(stars);
    this.campaignCompleteNarrationEl.innerHTML = [
      'O reino está salvo...',
      'por enquanto.',
      'FIM DA PRIMEIRA CAMPANHA',
    ]
      .map((p) => `<p>${p}</p>`)
      .join('');
    this.show('campaigncomplete');
  }

  showAdventureResultWon(stats: AdventureStats): void {
    this.el('advWinTitle').textContent = 'VITÓRIA!';
    this.el('advWinSubtitle').textContent = 'FASE 1 CONCLUÍDA · Fases 2 e 3 reveladas no mapa do continente.';
    this.el('advWinStats').innerHTML = this.adventureStatsHtml(stats);
    this.show('advwin');
  }

  showAdventureResultLost(stats: AdventureStats): void {
    this.el('advLoseTitle').textContent = 'DERROTA';
    this.el('advLoseText').textContent = 'O seu castelo foi destruído. Volte ao mapa do continente e tente novamente.';
    this.el('advLoseStats').innerHTML = this.adventureStatsHtml(stats);
    this.show('advlose');
  }

  private adventureStatsHtml(stats: AdventureStats): string {
    const total = TERRITORY_COLS * TERRITORY_ROWS;
    return [
      { label: 'Tempo', value: formatTime(stats.time) },
      { label: 'Minas capturadas', value: `${stats.minesCaptured}/${stats.minesTotal}` },
      { label: 'Territórios revelados', value: `${stats.territories}/${total}` },
    ]
      .map((l) => `<div class="cell"><span>${l.label}</span><b>${l.value}</b></div>`)
      .join('');
  }

  startGame(): void {
    this.hudEl.hidden = false;
    this.show(null);
  }

  showPause(title = 'Pausa'): void {
    this.el('pause-title').textContent = title;
    this.show('pause');
  }

  hidePause(): void {
    this.show(null);
  }

  openSettings(): void {
    this.underlying = this.current === 'pause' ? 'pause' : 'menu';
    this.show('settings');
  }

  openControls(): void {
    this.underlying = this.current === 'pause' ? 'pause' : 'menu';
    this.show('controls');
  }

  closeOverlays(): void {
    if (this.current !== 'settings' && this.current !== 'controls') return;
    this.show(this.underlying);
  }

  isOverlayOpen(): boolean {
    return this.current === 'settings' || this.current === 'controls';
  }

  showGameOver(wave: number): void {
    this.finalWaveEl.textContent = wave.toString();
    this.show('gameover');
  }

  private el<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  private show(screen: ScreenName | null): void {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
      if (this.transitionOutgoing) {
        this.transitionOutgoing.classList.remove('screen-exit');
        this.transitionOutgoing.hidden = true;
        this.transitionOutgoing = null;
      }
    }
    const previous = this.current;
    this.current = screen;
    const outgoing = previous !== null && previous !== screen ? this.els[previous] : null;
    for (const name of SCREENS) {
      const el = this.els[name];
      el.hidden = name !== screen;
      el.classList.remove('screen-enter', 'screen-exit');
    }
    if (outgoing) {
      outgoing.hidden = false;
      void outgoing.offsetWidth;
      outgoing.classList.add('screen-exit');
      this.transitionOutgoing = outgoing;
      this.transitionTimer = window.setTimeout(() => {
        outgoing.classList.remove('screen-exit');
        outgoing.hidden = true;
        this.transitionOutgoing = null;
        this.transitionTimer = null;
      }, Math.max(1, Math.round(CONFIG.ui.screenTransition * 1000)));
    }
    const incoming = screen !== null ? this.els[screen] : null;
    if (incoming) {
      void incoming.offsetWidth;
      incoming.classList.add('screen-enter');
    }
  }

  setProgressionVisible(visible: boolean): void {
    this.progressionVisibleState = visible;
    this.progressionEl.hidden = !visible;
  }

  progressionVisible(): boolean {
    return this.progressionVisibleState;
  }

  setPlacing(kind: BuildingKind | null): void {
    this.placing = kind;
    this.buildHintEl.hidden = kind === null;
  }

  updateProgression(snap: ProgressionSnapshot): void {
    const t = snap.troops;
    const key = [
      Math.floor(snap.gold),
      snap.castleLevel,
      snap.castleCost,
      snap.castleAffordable ? 1 : 0,
      snap.castleHpBonus,
      snap.castleTowerMult,
      snap.buildingCount,
      snap.buildingCap,
      snap.buildingCapReached ? 1 : 0,
      snap.diamonds,
      snap.troopCap,
      t.knight.level,
      t.knight.affordable ? 1 : 0,
      t.archer.level,
      t.archer.affordable ? 1 : 0,
      t.tank.level,
      t.tank.affordable ? 1 : 0,
      t.champion.level,
      t.champion.affordable ? 1 : 0,
      this.placing ?? 'none',
      this.progressionVisibleState ? 1 : 0,
    ].join(':');
    if (key === this.lastProgressionKey) return;
    this.lastProgressionKey = key;

    this.progressHudEl.textContent = `🏰${snap.castleLevel} 💎${snap.diamonds}`;
    this.progDiamondsEl.textContent = snap.diamonds.toString();
    this.renderPips(this.progCastlePipsEl, snap.castleLevel, snap.castleMaxLevel);
    this.progCastleInfoEl.textContent = `Nível ${snap.castleLevel}/${snap.castleMaxLevel} · HP +${snap.castleHpBonus} · Torres ×${snap.castleTowerMult.toFixed(2)} · Cap ${snap.buildingCap}`;
    if (snap.castleMaxed) {
      this.progCastleBtnEl.disabled = true;
      this.progCastleBtnEl.textContent = 'MÁXIMO';
    } else if (!snap.castleAffordable) {
      this.progCastleBtnEl.disabled = true;
      this.progCastleBtnEl.textContent = 'OURO INSUFICIENTE';
    } else {
      this.progCastleBtnEl.disabled = false;
      this.progCastleBtnEl.textContent = `MELHORAR · 🪙${snap.castleCost}`;
    }

    this.progBuildCountEl.textContent = `${snap.buildingCount}/${snap.buildingCap}`;
    if (snap.buildingCapReached) {
      this.progBuildInfoEl.textContent = 'LIMITE DE CONSTRUÇÕES ATINGIDO';
      this.progBuildInfoEl.classList.add('warn');
    } else {
      this.progBuildInfoEl.textContent = `${snap.buildingCount}/${snap.buildingCap} construções usadas`;
      this.progBuildInfoEl.classList.remove('warn');
    }
    this.updateBuildButton(this.buildHouseEl, 'house', snap, '🏠 Casa');
    this.updateBuildButton(this.buildMarketEl, 'market', snap, '🏪 Mercado');
    this.updateBuildButton(this.buildTowerEl, 'tower', snap, '🗼 Torre');

    for (const type of ARMY_TYPES) {
      const info = t[type];
      const btn = this.el<HTMLButtonElement>(`prog-troop-${type}`);
      btn.disabled = info.level >= info.maxLevel || !info.affordable;
      if (info.level >= info.maxLevel) {
        btn.textContent = 'MÁX';
      } else if (!info.affordable) {
        btn.textContent = info.currency === 'diamond' ? 'DIAMANTE INSUFICIENTE' : 'OURO INSUFICIENTE';
      } else {
        btn.textContent = `${info.currency === 'diamond' ? '💎' : '🪙'}${info.cost}`;
      }
      this.renderPips(this.el(`prog-troop-pips-${type}`), info.level, info.maxLevel);
    }
  }

  private updateBuildButton(btn: HTMLButtonElement, kind: BuildingKind, snap: ProgressionSnapshot, label: string): void {
    if (this.placing === kind) {
      btn.disabled = false;
      btn.classList.add('active');
      btn.innerHTML = `${label}<br><small>✕ CANCELAR</small>`;
      return;
    }
    btn.classList.remove('active');
    const cost = snap.buildCosts[kind];
    const atCap = snap.buildingCapReached;
    const affordable = snap.gold >= cost && !atCap;
    btn.disabled = !affordable;
    const note = atCap ? 'LIMITE' : `🪙${cost}`;
    btn.innerHTML = `${label}<br><small>${note}</small>`;
  }

  private renderPips(el: HTMLElement, level: number, max: number): void {
    el.textContent = '';
    for (let i = 0; i < max; i++) {
      const dot = document.createElement('span');
      dot.className = `pip${i < level ? ' on' : ''}`;
      el.appendChild(dot);
    }
  }

  private initProgressionPanel(): void {
    this.buildHouseEl.innerHTML = '🏠 Casa<br><small>🪙60</small>';
    this.buildMarketEl.innerHTML = '🏪 Mercado<br><small>🪙120</small>';
    this.buildTowerEl.innerHTML = '🗼 Torre<br><small>🪙500</small>';
    for (const type of ARMY_TYPES) {
      const row = document.createElement('div');
      row.className = 'prog-troop-row';
      const name = document.createElement('span');
      name.className = 'prog-troop-name';
      name.textContent = `${CONFIG.recruits[type].icon} ${ARMY_NAMES[type]}`;
      const pips = document.createElement('div');
      pips.className = 'prog-pips troop';
      pips.id = `prog-troop-pips-${type}`;
      const btn = document.createElement('button');
      btn.className = 'prog-btn small';
      btn.id = `prog-troop-${type}`;
      btn.dataset.troopUp = type;
      row.append(name, pips, btn);
      this.progTroopsEl.appendChild(row);
    }
  }

  private initScreens(): void {
    this.el('btn-play').addEventListener('click', () => this.handlers.onOpenModes());
    this.el('btn-mode-infinite').addEventListener('click', () => this.handlers.onPlayInfinite());
    this.el('btn-difficulty-back').addEventListener('click', () => this.handlers.onDifficultyBack());
    this.el('difficulty-grid').addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-difficulty]');
      if (!card) return;
      const d = card.dataset.difficulty;
      if (d === 'hardcore') {
        this.triggerHardcoreLock(card);
        return;
      }
      if (d === 'easy' || d === 'medium' || d === 'hard') this.handlers.onDifficultySelect(d);
    });
    this.el('btn-mode-adventure').addEventListener('click', () => this.handlers.onPlayAdventure());
    this.el('menu-creative-card').addEventListener('click', () => this.handlers.onPlayCreative());
    this.el('menu-coop-card').addEventListener('click', () => this.triggerCoopLock(this.el('menu-coop-card')));
    this.el('btn-creative-back').addEventListener('click', () => this.handlers.onCreativeBack());
    this.el('btn-creative-start-editor').addEventListener('click', () => this.handlers.onCreativeStart());
    this.el('btn-creative-editor-back').addEventListener('click', () => this.handlers.onCreativeEditorBack());
    this.el('creative-team-blue').addEventListener('click', () => this.handlers.onCreativeTeam('blue'));
    this.el('creative-team-red').addEventListener('click', () => this.handlers.onCreativeTeam('red'));
    this.el('creative-palette').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-creative-kind]');
      if (!btn) return;
      this.handlers.onCreativePick({
        kind: btn.dataset.creativeKind as CreativePick['kind'],
        type: btn.dataset.creativeType as CreativePick['type'],
      });
    });
    this.el('btn-creative-remove').addEventListener('click', () => this.handlers.onCreativeRemove());
    this.el('btn-creative-start').addEventListener('click', () => this.handlers.onCreativeStartBattle());
    this.el('btn-creative-retry').addEventListener('click', () => this.handlers.onCreativeRetry());
    this.el('btn-creative-edit').addEventListener('click', () => this.handlers.onCreativeEdit());
    this.el('btn-creative-result-menu').addEventListener('click', () => this.handlers.onCreativeResultMenu());
    this.el('btn-creative-pause').addEventListener('click', () => this.handlers.onCreativePause());
    this.el('creative-spectator').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.spec-speed-btn');
      if (btn) this.handlers.onCreativeSpeed(Number(btn.dataset.speed) as 1 | 2 | 4);
    });
    this.el('btn-mode-story').addEventListener('click', () => this.handlers.onOpenStory());
    this.el('btn-modes-back').addEventListener('click', () => this.handlers.onBackToMenu());
    this.el('btn-story-win-continue').addEventListener('click', () => this.handlers.onStoryWinContinue());
    this.el('btn-story-win-select').addEventListener('click', () => this.handlers.onStoryWinContinue());
    this.el('btn-story-win-retry').addEventListener('click', () => this.handlers.onStoryWinRetry());
    this.el('btn-story-win-menu').addEventListener('click', () => this.handlers.onStoryWinMenu());
    this.el('btn-phase-intro').addEventListener('click', () => this.handlers.onPhaseIntroContinue());
    this.el('btn-story-teaser-continue').addEventListener('click', () => this.handlers.onStoryTeaserContinue());
    this.el('btn-story-teaser-menu').addEventListener('click', () => this.handlers.onStoryTeaserMenu());
    this.el('btn-campaign-continue').addEventListener('click', () => this.handlers.onCampaignCompleteContinue());
    this.el('btn-campaign-menu').addEventListener('click', () => this.handlers.onCampaignCompleteMenu());
    this.el('btn-story-lose-retry').addEventListener('click', () => this.handlers.onStoryLoseRetry());
    this.el('btn-story-lose-menu').addEventListener('click', () => this.handlers.onStoryLoseMenu());
    this.el('btn-adv-win-restart').addEventListener('click', () => this.handlers.onAdventureWinRestart());
    this.el('btn-adv-win-continue').addEventListener('click', () => this.handlers.onAdventureWinContinue());
    this.el('btn-adv-win-menu').addEventListener('click', () => this.handlers.onAdventureWinMenu());
    this.el('btn-adv-lose-retry').addEventListener('click', () => this.handlers.onAdventureLoseRetry());
    this.el('btn-adv-lose-continent').addEventListener('click', () => this.handlers.onAdventureLoseContinent());
    this.el('btn-adv-lose-menu').addEventListener('click', () => this.handlers.onAdventureLoseMenu());
    this.el('tutorialClose').addEventListener('click', () => this.hideTutorial());
    this.el('btn-controls').addEventListener('click', () => this.openControls());
    this.el('btn-settings').addEventListener('click', () => this.openSettings());
    this.el('btn-resume').addEventListener('click', () => this.handlers.onResume());
    this.el('btn-pause-controls').addEventListener('click', () => this.openControls());
    this.el('btn-pause-settings').addEventListener('click', () => this.openSettings());
    this.el('btn-pause-menu').addEventListener('click', () => this.handlers.onQuitToMenu());
    this.el('btn-settings-back').addEventListener('click', () => this.closeOverlays());
    this.el('btn-controls-back').addEventListener('click', () => this.closeOverlays());
    this.el('btn-retry').addEventListener('click', () => this.handlers.onRestart());
    this.el('btn-gameover-menu').addEventListener('click', () => this.handlers.onQuitToMenu());
    this.el('btn-start-wave').addEventListener('click', () => this.handlers.onStartWave());
    this.el('btn-progress').addEventListener('click', () => this.handlers.onToggleProgress());
    this.el('prog-close').addEventListener('click', () => this.handlers.onToggleProgress());
    this.el('prog-castle-btn').addEventListener('click', () => this.handlers.onUpgradeCastle());
    this.el('prog-troops').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-troop-up]');
      if (btn) this.handlers.onUpgradeTroop(btn.dataset.troopUp as PlayerTroopType);
    });
    this.el('prog-build-house').addEventListener('click', () => this.handlers.onBuild('house'));
    this.el('prog-build-market').addEventListener('click', () => this.handlers.onBuild('market'));
    this.el('prog-build-tower').addEventListener('click', () => this.handlers.onBuild('tower'));
  }

  private initSettings(): void {
    const music = this.el<HTMLInputElement>('set-music');
    const sfx = this.el<HTMLInputElement>('set-sfx');
    const fps = this.el<HTMLInputElement>('set-fps');
    const musicVol = this.el<HTMLInputElement>('set-music-vol');
    const sfxVol = this.el<HTMLInputElement>('set-sfx-vol');
    const ifaceVol = this.el<HTMLInputElement>('set-iface-vol');
    const ambient = this.el<HTMLInputElement>('set-ambient');
    const ambVol = this.el<HTMLInputElement>('set-amb-vol');
    const units = this.el<HTMLSelectElement>('set-units');

    music.checked = this.settings.value.music;
    sfx.checked = this.settings.value.sfx;
    fps.checked = this.settings.value.showFps;
    musicVol.value = Math.round(this.settings.value.musicVolume * 100).toString();
    sfxVol.value = Math.round(this.settings.value.sfxVolume * 100).toString();
    ifaceVol.value = Math.round(this.settings.value.interfaceVolume * 100).toString();
    ambient.checked = this.settings.value.ambient;
    ambVol.value = Math.round(this.settings.value.ambientVolume * 100).toString();
    units.value = this.settings.value.maxUnits.toString();

    music.addEventListener('change', () => {
      this.settings.set('music', music.checked);
      this.handlers.onSettingsChange?.();
    });
    sfx.addEventListener('change', () => {
      this.settings.set('sfx', sfx.checked);
      this.handlers.onSettingsChange?.();
    });
    fps.addEventListener('change', () => this.settings.set('showFps', fps.checked));
    musicVol.addEventListener('input', () => {
      this.settings.set('musicVolume', Number(musicVol.value) / 100);
      this.handlers.onSettingsChange?.();
    });
    sfxVol.addEventListener('input', () => {
      this.settings.set('sfxVolume', Number(sfxVol.value) / 100);
      this.handlers.onSettingsChange?.();
    });
    ifaceVol.addEventListener('input', () => {
      this.settings.set('interfaceVolume', Number(ifaceVol.value) / 100);
      this.handlers.onSettingsChange?.();
    });
    ambient.addEventListener('change', () => {
      this.settings.set('ambient', ambient.checked);
      this.handlers.onSettingsChange?.();
    });
    ambVol.addEventListener('input', () => {
      this.settings.set('ambientVolume', Number(ambVol.value) / 100);
      this.handlers.onSettingsChange?.();
    });
    units.addEventListener('change', () => this.settings.set('maxUnits', Number(units.value)));
  }
}