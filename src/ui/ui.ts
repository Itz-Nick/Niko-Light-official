import { CONFIG } from '../config';
import type { Economy } from '../economy/economy';
import type { SettingsStore } from '../settings/settings';
import type { CampaignStore } from '../story/campaign';
import { levelMeta } from '../story/levels';
import type { LevelDef, LevelStats } from '../story/story';
import type { PlayerTroopType, TroopType } from '../types';
import type { UpgradeDef, UpgradeId } from '../upgrades/upgrades';
import type { WaveManager } from '../waves/wave-manager';

type ScreenName =
  | 'menu'
  | 'modes'
  | 'pause'
  | 'settings'
  | 'controls'
  | 'gameover'
  | 'storyselect'
  | 'phaseintro'
  | 'storywin'
  | 'storyteaser'
  | 'storylose'
  | 'campaigncomplete';
type UnderlyingScreen = 'menu' | 'pause';

const SCREENS: ScreenName[] = [
  'menu',
  'modes',
  'pause',
  'settings',
  'controls',
  'gameover',
  'storyselect',
  'phaseintro',
  'storywin',
  'storyteaser',
  'storylose',
  'campaigncomplete',
];

const ARMY_TYPES: PlayerTroopType[] = ['knight', 'archer', 'tank', 'champion'];

const ARMY_NAMES: Record<TroopType, string> = {
  knight: 'Cavaleiros',
  archer: 'Arqueiros',
  tank: 'Tanques',
  champion: 'Campeões',
  boss: 'Senhor da Ruína',
};

interface UiHandlers {
  onOpenModes: () => void;
  onPlayInfinite: () => void;
  onBackToMenu: () => void;
  onOpenStory: () => void;
  onStoryBack: () => void;
  onStoryPlay: (levelNumber: number) => void;
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
  onResume: () => void;
  onQuitToMenu: () => void;
  onRestart: () => void;
  onUpgrade: (id: UpgradeId) => void;
  onStartWave: () => void;
  onRecruit?: (type: PlayerTroopType) => void;
  onSettingsChange?: () => void;
}

export class Ui {
  private readonly els: Record<ScreenName, HTMLElement>;
  private current: ScreenName | null = null;
  private underlying: UnderlyingScreen = 'menu';
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
  private readonly upgradesEl: HTMLElement;
  private readonly finalWaveEl: HTMLElement;
  private readonly armyEls: Record<PlayerTroopType, HTMLButtonElement>;
  private readonly statEls: Record<'gold' | 'wave' | 'troops' | 'army' | 'base' | 'cart', HTMLElement>;
  private readonly cartFillEl: HTMLElement;
  private readonly cartHpEl: HTMLElement;
  private readonly tutorialEl: HTMLElement;
  private readonly tutorialTextEl: HTMLElement;
  private readonly storyWinTitleEl: HTMLElement;
  private readonly storyWinStarsEl: HTMLElement;
  private readonly storyWinTextEl: HTMLElement;
  private readonly storyWinUnlockEl: HTMLElement;
  private readonly storyLoseTextEl: HTMLElement;
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
  private readonly campaignBannerEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly prepSecsEl: HTMLElement;
  private toastTimer: number | null = null;
  private readonly last = {
    gold: -1,
    wave: -1,
    units: -1,
    countdown: -1,
    hpPct: -1,
    army: '',
    cartPct: -1,
    storyUnits: -1,
    storyFps: -1,
    bossPct: -1,
  };
  private lastUpgradeKey = '';

  constructor(
    private readonly settings: SettingsStore,
    private readonly handlers: UiHandlers,
    private readonly campaign: CampaignStore,
  ) {
    this.els = {
      menu: this.el('menu'),
      modes: this.el('modes'),
      pause: this.el('pause'),
      settings: this.el('settings'),
      controls: this.el('controls'),
      gameover: this.el('gameover'),
      storyselect: this.el('storyselect'),
      phaseintro: this.el('phaseintro'),
      storywin: this.el('storywin'),
      storyteaser: this.el('storyteaser'),
      storylose: this.el('storylose'),
      campaigncomplete: this.el('campaigncomplete'),
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
    this.upgradesEl = this.el('upgrades');
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
    this.storyWinStarsEl = this.el('storyWinStars');
    this.storyWinTextEl = this.el('storyWinText');
    this.storyWinUnlockEl = this.el('storyWinUnlock');
    this.storyLoseTextEl = this.el('storyLoseText');
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
    this.campaignBannerEl = this.el('campaignBanner');
    this.toastEl = this.el('toast');
    this.prepSecsEl = this.el('prepSecs');
    this.initScreens();
    this.initSettings();
    this.initArmy();
  }

  updateHud(
    economy: Economy,
    waves: WaveManager,
    unitCount: number,
    baseHp: number,
    baseMaxHp: number,
    fps: number,
    troopCounts: Record<TroopType, number>,
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
    if (this.last.units !== unitCount) {
      this.last.units = unitCount;
      this.unitsEl.textContent = unitCount.toString();
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
    this.updateArmy(economy, unitCount, troopCounts);
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

  setMode(mode: 'infinite' | 'story'): void {
    const isStory = mode === 'story';
    this.statEls.gold.hidden = isStory;
    this.statEls.wave.hidden = isStory;
    this.statEls.army.hidden = isStory;
    this.statEls.base.hidden = isStory;
    this.statEls.troops.hidden = false;
    const armyPanel = this.hudEl.querySelector('.army-panel');
    if (armyPanel) (armyPanel as HTMLElement).hidden = isStory;
    this.prepEl.hidden = true;
    this.upgradesEl.textContent = '';
    this.last.countdown = -1;
    this.bossBarEl.hidden = true;
    this.last.bossPct = -1;
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

  private updateArmy(economy: Economy, playerCount: number, troopCounts: Record<TroopType, number>): void {
    const key = `${Math.floor(economy.gold)}:${playerCount}:${this.settings.value.maxUnits}:${troopCounts.knight}:${troopCounts.archer}:${troopCounts.tank}:${troopCounts.champion}`;
    if (key === this.last.army) return;
    this.last.army = key;
    for (const type of ARMY_TYPES) {
      const rec = CONFIG.recruits[type];
      const affordable = economy.canAfford(rec.cost) && playerCount + rec.count <= this.settings.value.maxUnits;
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

  showPreparation(wave: number, options: UpgradeDef[], secondsLeft: number): void {
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
    this.renderUpgrades(options);
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
    this.show('modes');
  }

  showStorySelect(): void {
    this.hudEl.hidden = true;
    this.renderStoryGrid();
    this.show('storyselect');
  }

  private renderStoryGrid(): void {
    const grid = this.el('storyGrid');
    grid.textContent = '';
    this.campaignBannerEl.hidden = !this.campaign.isComplete();
    for (let n = 1; n <= 10; n++) {
      const meta = levelMeta(n);
      const unlocked = this.campaign.isUnlocked(n);
      const completed = this.campaign.isCompleted(n);
      const stars = this.campaign.starsOf(n);
      const card = document.createElement('div');
      card.className = `story-card ${completed ? 'story-completed' : unlocked ? 'story-available' : 'story-locked'}`;
      let stateHtml: string;
      let button = '';
      if (completed) {
        stateHtml = `<span class="state-badge state-completed">✅ CONCLUÍDA</span>
          <div class="stars">${'⭐'.repeat(stars)}<span class="stars-dim">${'⭐'.repeat(3 - stars)}</span></div>`;
        button = `<button class="btn" data-story-play="${n}">Jogar novamente</button>`;
      } else if (unlocked) {
        stateHtml = `<span class="state-badge state-available">🔓 DISPONÍVEL</span>`;
        button = `<button class="btn btn-primary" data-story-play="${n}">Jogar</button>`;
      } else {
        stateHtml = `<span class="state-badge state-locked">🔒 BLOQUEADA</span>`;
      }
      card.innerHTML = `
        <h3>Fase ${n}</h3>
        <p>${meta ? `${meta.name} — ${meta.description}` : ''}</p>
        ${stateHtml}
        ${button}
      `;
      grid.appendChild(card);
    }
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
    this.storyWinStarsEl.innerHTML = `${'⭐'.repeat(stars)}<span class="stars-dim">${'⭐'.repeat(3 - stars)}</span>`;
    const lines = level
      .summary(stats)
      .map((l) => `<li>${l.label}: <strong>${l.value}</strong></li>`)
      .join('');
    this.storyWinTextEl.innerHTML = `<li>Objetivo concluído ✓</li>${lines}`;
    if (unlockedText) {
      this.storyWinUnlockEl.textContent = unlockedText;
      this.storyWinUnlockEl.hidden = false;
    } else {
      this.storyWinUnlockEl.hidden = true;
    }
    this.show('storywin');
  }

  showStoryLose(name: string): void {
    this.storyLoseTextEl.textContent = `Missão falhou durante "${name}". Tente novamente.`;
    this.show('storylose');
  }

  showStoryTeaser(level: LevelDef, stars: number, _stats: LevelStats): void {
    this.storyTeaserTitleEl.textContent = `FASE ${level.number} CONCLUÍDA`;
    this.storyTeaserStarsEl.innerHTML = `${'⭐'.repeat(stars)}<span class="stars-dim">${'⭐'.repeat(3 - stars)}</span>`;
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
    this.campaignCompleteStarsEl.innerHTML = `${'⭐'.repeat(stars)}<span class="stars-dim">${'⭐'.repeat(3 - stars)}</span>`;
    this.campaignCompleteNarrationEl.innerHTML = [
      'O reino está salvo...',
      'por enquanto.',
      'FIM DA PRIMEIRA CAMPANHA',
    ]
      .map((p) => `<p>${p}</p>`)
      .join('');
    this.show('campaigncomplete');
  }

  startGame(): void {
    this.hudEl.hidden = false;
    this.show(null);
  }

  showPause(): void {
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
    for (const name of SCREENS) this.els[name].hidden = name !== screen;
    this.current = screen;
  }

  private renderUpgrades(options: UpgradeDef[]): void {
    const key = options.map((o) => o.id).join(',');
    if (key === this.lastUpgradeKey) return;
    this.lastUpgradeKey = key;
    this.upgradesEl.textContent = '';
    for (const o of options) {
      const btn = document.createElement('button');
      btn.className = 'upgrade-btn';
      btn.innerHTML = `<strong>${o.icon} ${o.name}</strong><small>${o.description}</small>`;
      btn.addEventListener('click', () => this.handlers.onUpgrade(o.id));
      this.upgradesEl.appendChild(btn);
    }
  }

  private initScreens(): void {
    this.el('btn-play').addEventListener('click', () => this.handlers.onOpenModes());
    this.el('btn-mode-infinite').addEventListener('click', () => this.handlers.onPlayInfinite());
    this.el('btn-mode-story').addEventListener('click', () => this.handlers.onOpenStory());
    this.el('btn-modes-back').addEventListener('click', () => this.handlers.onBackToMenu());
    this.el('storyGrid').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-story-play]');
      if (btn) this.handlers.onStoryPlay(Number(btn.dataset.storyPlay));
    });
    this.el('btn-story-back').addEventListener('click', () => this.handlers.onStoryBack());
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