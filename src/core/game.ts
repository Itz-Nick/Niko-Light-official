import { CONFIG } from '../config';
import { SpatialGrid } from './grid';
import { AudioManager } from '../audio/audio-manager';
import type { SfxKind } from '../audio/audio-manager';
import { BIOMES, getBiomeForWave } from '../biomes/biomes';
import type { BiomeId } from '../biomes/biomes';
import { Camera } from '../camera/camera';
import { updateCombat } from '../combat/combat';
import { updateProjectiles } from '../combat/projectile';
import type { Projectile } from '../combat/projectile';
import { updateUnits } from './movement';
import { createBase, createBaseAt, createCart, createMines, createMineAt, createCastleDefense } from '../entities/structures';
import type { Structure } from '../entities/structures';
import { applyTroopMods, createUnit } from '../entities/unit';
import type { Unit } from '../entities/unit';
import { Economy } from '../economy/economy';
import { updateTowers } from '../combat/towers';
import { formationTargets } from '../formation/formation';
import type { FormationKind } from '../formation/formation';
import { updateAutoFormation, resetAutoFormation, commandSquad } from '../formation/auto-formation';
import { Input } from '../input/input';
import type { InputEvent } from '../input/input';
import { Renderer } from '../render/renderer';
import type { RenderOverlay, WorldMarker } from '../render/renderer';
import { SettingsStore } from '../settings/settings';
import { CampaignStore } from '../story/campaign';
import { levelByNumber } from '../story/levels';
import { starsFor } from '../story/story';
import type { LevelContext, LevelDef, LevelStats } from '../story/story';
import type { EconomyModifiers, HitInfo, PlayerTroopType, TroopModifiers, TroopType } from '../types';
import { Ui } from '../ui/ui';
import type { UpgradeDef, UpgradeId } from '../upgrades/upgrades';
import { WaveManager } from '../waves/wave-manager';
import type { WavePhase } from '../waves/wave-manager';

type Screen = 'menu' | 'modes' | 'playing' | 'paused' | 'storyselect' | 'phaseintro';

const BIOME_TRANSITION_TIME = 1.6;

const TROOP_LABELS: Record<TroopType, string> = {
  knight: 'Cavaleiros',
  archer: 'Arqueiros',
  tank: 'Tanques',
  champion: 'Campeão',
  boss: 'Senhor da Ruína',
};

const FORMATION_NAMES: Record<FormationKind, string> = {
  line: 'LINHA',
  v: 'V',
  square: 'QUADRADO',
  defense: 'DEFENSIVA',
};

const RECRUIT_SFX: Record<TroopType, SfxKind> = {
  knight: 'recruit-knight',
  archer: 'recruit-archer',
  tank: 'recruit-tank',
  champion: 'recruit-champion',
  boss: 'recruit-champion',
};

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: Renderer;
  private readonly input: Input;
  private readonly settings = new SettingsStore();
  private readonly audio = new AudioManager(this.settings);
  private readonly ui: Ui;
  private readonly camera: Camera;
  private readonly grid = new SpatialGrid(CONFIG.grid.cellSize);
  private readonly economy = new Economy();
  private readonly waves = new WaveManager();
  private units: Unit[] = [];
  private structures: Structure[] = [];
  private base: Structure | null = null;
  private mode: 'infinite' | 'story' | null = null;
  private readonly campaign = new CampaignStore();
  private level: LevelDef | null = null;
  private levelNumber = 0;
  private storyElapsed = 0;
  private storyStartPlayerCount = 0;
  private storyMineTotal = 0;
  private storyWallTotal = 0;
  private storyRoute: { x: number; y: number }[] = [];
  private projectiles: Projectile[] = [];
  private storyResultShown = false;
  private storyOver = false;
  private bossAnnounced = false;
  private selected = new Set<Unit>();
  private recruitIndex = 0;
  private troopMods: TroopModifiers = { damage: 1, health: 1, speed: 1, attackSpeed: 1, range: 1, defense: 0 };
  private econMods: EconomyModifiers = { mineIncome: 1, waveBonus: 0 };
  private recentUpgrades: UpgradeId[] = [];
  private playerUnitCount = 0;
  private upgradeOptions: UpgradeDef[] = [];
  private lastPhase: WavePhase = 'preparation';
  private markers: WorldMarker[] = [];
  private screen: Screen = 'menu';
  private renderedBiome: BiomeId = 'field';
  private biomeTransition = -1;
  private goldDelta = 0;
  private fps = 0;
  private gameOver = false;
  private gameOverShown = false;
  private lastTime = 0;
  private damageMarkerCount = 0;
  private troopCounts: Record<TroopType, number> = { knight: 0, archer: 0, tank: 0, champion: 0, boss: 0 };
  private sfxCooldowns = new Map<string, number>();
  private lastPrepSec = -1;
  private lastAliveWalls = -1;
  private lastAliveTowers = -1;
  private lastMines = -1;
  private lastBaseHp = -1;

  constructor() {
    this.canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new Renderer(this.canvas);
    this.input = new Input(this.canvas);
    this.ui = new Ui(this.settings, {
      onOpenModes: () => {
        this.screen = 'modes';
        this.ui.showModes();
        this.audio.playSfx('ui-confirm');
        this.syncMusic();
      },
      onPlayInfinite: () => this.startMatch(),
      onBackToMenu: () => {
        this.screen = 'menu';
        this.ui.showMenu();
        this.syncMusic();
      },
      onOpenStory: () => {
        this.audio.playSfx('ui-confirm');
        this.showStorySelect();
      },
      onStoryBack: () => {
        this.screen = 'modes';
        this.ui.showModes();
        this.syncMusic();
      },
      onStoryPlay: (n) => this.startStoryLevel(n),
      onStoryWinContinue: () => this.showStorySelect(),
      onStoryWinRetry: () => this.startStoryLevel(this.levelNumber),
      onStoryWinMenu: () => this.quitToMenu(),
      onPhaseIntroContinue: () => this.beginPhase(),
      onStoryTeaserContinue: () => this.showStorySelect(),
      onStoryTeaserMenu: () => this.quitToMenu(),
      onCampaignCompleteContinue: () => this.showStorySelect(),
      onCampaignCompleteMenu: () => this.quitToMenu(),
      onStoryLoseRetry: () => this.startStoryLevel(this.levelNumber),
      onStoryLoseMenu: () => this.quitToMenu(),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onRestart: () => this.startMatch(),
      onUpgrade: (id) => this.applyUpgrade(id),
      onStartWave: () => this.waves.beginBattle(),
      onRecruit: (type) => this.handleRecruit(type),
      onSettingsChange: () => this.audio.applySettings(),
    }, this.campaign);
    this.wireUiSounds();
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.base = createBase();
    this.input.onWheel = (e) => this.camera.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 0.925);
    this.waves.setSpawnSink((u) => this.units.push(u));
    this.waves.onWaveComplete = (w) => this.onWaveComplete(w);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener(
      'pointerdown',
      () => {
        this.audio.unlock();
        this.syncMusic();
      },
      { once: true },
    );
    this.resize();
    this.reset();
    this.ui.showMenu();
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private wireUiSounds(): void {
    let lastHoverBtn: HTMLElement | null = null;
    document.addEventListener('mouseover', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.screen .btn');
      if (!btn) {
        lastHoverBtn = null;
        return;
      }
      if ((btn as HTMLButtonElement).disabled || btn === lastHoverBtn) return;
      lastHoverBtn = btn;
      this.audio.playSfx('ui-hover');
    });
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const btn = target.closest<HTMLButtonElement>('.btn, .army-btn, .upgrade-btn');
      if (btn && !btn.disabled) this.audio.playSfx('ui-click');
    });
  }

  private playSfx(key: string, kind: SfxKind, gapSec: number): void {
    const now = performance.now();
    const last = this.sfxCooldowns.get(key) ?? -Infinity;
    if (now - last < gapSec * 1000) return;
    this.sfxCooldowns.set(key, now);
    this.audio.playSfx(kind);
  }

  private playCombatSounds(hits: HitInfo[], spawned: Projectile[]): void {
    if (spawned.length > 0) this.playSfx('arrow', 'arrow-shot', 0.08);
    for (const h of hits) {
      if (h.source === 'unit') {
        this.playSfx(h.ranged ? 'arrow-hit' : 'melee', h.ranged ? 'arrow-impact' : 'melee-hit', 0.06);
      } else if (h.source === 'wall') {
        this.playSfx('wall', 'wall-hit', 0.12);
      } else if (h.source !== 'base') {
        this.playSfx('structure', 'structure-hit', 0.15);
      }
    }
  }

  private resize(): void {
    this.renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    this.camera.setViewSize(window.innerWidth, window.innerHeight);
  }

  private loop = (time: number): void => {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.fps = dt > 0 ? Math.round(1 / dt) : 0;

    for (const e of this.input.drainEvents()) {
      if (e.type === 'pause') {
        this.handlePauseKey();
        continue;
      }
      if (this.screen === 'playing' && !this.gameOver && !this.storyOver) this.handleEvent(e);
    }

    this.update(dt);
    this.updateMarkers(dt);

    const cart = this.mode === 'story' ? this.getCart() : null;
    this.renderer.render(
      this.camera,
      this.units,
      this.structures,
      this.selected,
      this.input.dragRect,
      this.markers,
      this.renderedBiome,
      this.biomeOverlay(),
      this.projectiles,
      this.mode === 'story' ? this.storyRoute : null,
      cart,
    );

    if (this.mode === 'story') {
      const base = this.getWeakestBase();
      this.ui.updateStoryHud(
        cart ? cart.hp : 0,
        cart ? cart.maxHp : 1,
        base ? base.hp : 0,
        base ? base.maxHp : 1,
        this.playerUnitCount,
        this.fps,
      );
    } else if (this.base) {
      this.ui.updateHud(this.economy, this.waves, this.playerUnitCount, this.base.hp, this.base.maxHp, this.fps, this.troopCounts);
      if (this.waves.phase === 'preparation') {
        this.ui.showPreparation(this.waves.wave, this.upgradeOptions, this.waves.timer);
      } else {
        this.ui.hidePreparation();
      }
      if (this.goldDelta > CONFIG.ui.goldGainThreshold) this.ui.showGoldGain(this.goldDelta);
    }

    requestAnimationFrame(this.loop);
  };

  private reset(): void {
    this.units = [];
    this.structures = [createBase(), ...createMines(), ...createCastleDefense()];
    this.base = this.structures.find((s) => s.kind === 'base') ?? null;
    this.mode = 'infinite';
    this.level = null;
    this.levelNumber = 0;
    this.storyElapsed = 0;
    this.storyStartPlayerCount = 0;
    this.storyMineTotal = 0;
    this.storyWallTotal = 0;
    this.storyRoute = [];
    this.projectiles = [];
    this.storyResultShown = false;
    this.storyOver = false;
    this.gameOver = false;
    this.gameOverShown = false;
    this.goldDelta = 0;
    this.markers.length = 0;
    this.selected.clear();
    this.economy.gold = CONFIG.economy.startingGold;
    this.troopMods = { damage: 1, health: 1, speed: 1, attackSpeed: 1, range: 1, defense: 0 };
    this.econMods = { mineIncome: 1, waveBonus: 0 };
    this.recentUpgrades = [];
    this.playerUnitCount = 0;
    this.upgradeOptions = [];
    this.lastPhase = 'preparation';
    this.renderedBiome = getBiomeForWave(1);
    this.biomeTransition = -1;
    this.lastPrepSec = -1;
    this.lastAliveWalls = -1;
    this.lastAliveTowers = -1;
    this.lastMines = -1;
    this.lastBaseHp = -1;
    this.waves.reset();
    resetAutoFormation();
    this.ui.setMode('infinite');
    const cx = CONFIG.positions.base.x;
    const cy = CONFIG.positions.base.y;
    const starting: TroopType[] = [];
    const startingConfig = CONFIG.player.startingTroops;
    for (const [type, count] of Object.entries(startingConfig) as [TroopType, number][]) {
      for (let i = 0; i < count; i++) starting.push(type);
    }
    starting.forEach((type, i) => {
      const a = (i / starting.length) * Math.PI * 2;
      this.units.push(createUnit('player', type, cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, this.troopMods));
    });
  }

  private resetStory(): void {
    this.units = [];
    this.structures = [];
    this.base = null;
    this.mode = 'story';
    this.level = null;
    this.levelNumber = 0;
    this.storyElapsed = 0;
    this.storyStartPlayerCount = 0;
    this.storyMineTotal = 0;
    this.storyWallTotal = 0;
    this.storyRoute = [];
    this.projectiles = [];
    this.storyResultShown = false;
    this.storyOver = false;
    this.bossAnnounced = false;
    this.gameOver = false;
    this.goldDelta = 0;
    this.markers.length = 0;
    this.selected.clear();
    this.playerUnitCount = 0;
    this.renderedBiome = 'field';
    this.biomeTransition = -1;
    resetAutoFormation();
    this.ui.setMode('story');
    this.ui.hideBossHud();
  }

  private update(dt: number): void {
    if (this.screen !== 'playing') {
      this.goldDelta = 0;
      this.audio.stopAmbient();
      return;
    }
    if (this.mode === 'story') {
      if (!this.storyOver) this.updateStory(dt);
      this.goldDelta = 0;
      return;
    }
    if (this.gameOver) {
      this.goldDelta = 0;
      this.audio.stopAmbient();
      return;
    }
    this.updateInfinite(dt);
  }

  private updateInfinite(dt: number): void {
    const goldBefore = this.economy.gold;
    this.input.updateCamera(this.camera, dt);

    this.grid.clear();
    let activeEnemies = 0;
    this.playerUnitCount = 0;
    this.troopCounts.knight = 0;
    this.troopCounts.archer = 0;
    this.troopCounts.tank = 0;
    this.troopCounts.champion = 0;
    this.troopCounts.boss = 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.grid.insert(u);
      if (u.team === 'enemy') activeEnemies++;
      else {
        this.playerUnitCount++;
        this.troopCounts[u.troopType]++;
      }
    }

    this.waves.update(dt, activeEnemies);
    const { spawned, hits } = updateCombat(this.units, this.structures, this.grid, this.economy, dt);
    this.projectiles.push(...spawned);
    const towerShots = updateTowers(this.structures, this.grid, this.projectiles, dt);
    const projHits = updateProjectiles(this.projectiles, dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    const allHits = hits.length > 0 || projHits.length > 0 ? [...hits, ...projHits] : hits;
    if (allHits.length > 0) this.applyHits(allHits);
    this.playCombatSounds(allHits, spawned);
    if (towerShots > 0) this.playSfx('tower', 'tower-shot', 0.06);
    updateAutoFormation(this.units, this.grid, this.structures, dt);
    updateUnits(this.units, this.grid, this.structures, dt);

    this.updateStructures(dt);
    this.updateBiomeTransition(dt);
    for (const s of this.structures) if (s.flashTimer > 0) s.flashTimer -= dt;

    if (this.lastPhase === 'preparation' && this.waves.phase === 'battle') {
      this.upgradeOptions = [];
      this.ui.showToast(`WAVE ${this.waves.wave} EM BATALHA!`, 'alert');
      this.playSfx('wave', 'wave-start', 0.5);
      this.audio.setMusicLevel(this.settings.value.musicVolume);
    } else if (this.lastPhase === 'battle' && this.waves.phase === 'preparation') {
      this.audio.setMusicLevel(this.settings.value.musicVolume * CONFIG.ui.prepareMusicFactor);
    }
    this.lastPhase = this.waves.phase;

    if (this.waves.phase === 'preparation') {
      const prepSec = Math.ceil(this.waves.timer);
      if (prepSec !== this.lastPrepSec && prepSec > 0 && prepSec <= 5) this.playSfx('prep', 'prep-tick', 0.9);
      this.lastPrepSec = prepSec;
    }

    let deaths = 0;
    for (const u of this.units) {
      if (!u.alive) {
        this.pushMarker(u.x, u.y, 'death');
        deaths++;
      }
    }
    if (deaths > 0) this.playSfx('death', 'unit-death', 0.12);
    this.units = this.units.filter((u) => u.alive);
    this.base = this.structures.find((s) => s.kind === 'base') ?? null;
    this.gameOver = this.base ? this.base.hp <= 0 : false;
    if (this.gameOver && !this.gameOverShown) {
      this.gameOverShown = true;
      this.ui.showGameOver(this.waves.wave);
    }
    this.pruneSelection();
    this.goldDelta = this.economy.gold - goldBefore;
    this.audio.setBiome(this.renderedBiome);

    let walls = 0;
    let towers = 0;
    let mines = 0;
    for (const s of this.structures) {
      if (!s.alive) continue;
      if (s.kind === 'wall') walls++;
      else if (s.kind === 'tower') towers++;
      else if (s.kind === 'mine') mines++;
    }
    if (this.lastAliveWalls >= 0 && walls < this.lastAliveWalls) this.playSfx('wall-break', 'wall-break', 0.2);
    if (this.lastAliveTowers >= 0 && towers < this.lastAliveTowers) this.playSfx('tower-break', 'wall-break', 0.2);
    if (this.lastMines >= 0 && mines < this.lastMines) this.playSfx('mine-break', 'structure-hit', 0.2);
    if (this.base && this.lastBaseHp >= 0 && this.base.hp < this.lastBaseHp) this.playSfx('castle', 'castle-hit', 0.3);
    this.lastAliveWalls = walls;
    this.lastAliveTowers = towers;
    this.lastMines = mines;
    this.lastBaseHp = this.base ? this.base.hp : 0;
  }

  private updateStory(dt: number): void {
    this.input.updateCamera(this.camera, dt);
    this.storyElapsed += dt;

    this.grid.clear();
    this.playerUnitCount = 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.grid.insert(u);
      if (u.team === 'player') this.playerUnitCount++;
    }

    this.level?.update(this.storyCtx(), dt);
    const { spawned, hits } = updateCombat(this.units, this.structures, this.grid, this.economy, dt);
    this.projectiles.push(...spawned);
    const towerShots = updateTowers(this.structures, this.grid, this.projectiles, dt);
    const projHits = updateProjectiles(this.projectiles, dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    const allHits = hits.length > 0 || projHits.length > 0 ? [...hits, ...projHits] : hits;
    if (allHits.length > 0) this.applyHits(allHits);
    this.playCombatSounds(allHits, spawned);
    if (towerShots > 0) this.playSfx('tower', 'tower-shot', 0.06);
    updateAutoFormation(this.units, this.grid, this.structures, dt);
    updateUnits(this.units, this.grid, this.structures, dt);
    for (const s of this.structures) if (s.flashTimer > 0) s.flashTimer -= dt;

    let deaths = 0;
    for (const u of this.units) {
      if (!u.alive) {
        this.pushMarker(u.x, u.y, 'death');
        deaths++;
      }
    }
    if (deaths > 0) this.playSfx('death', 'unit-death', 0.12);
    this.units = this.units.filter((u) => u.alive);
    this.structures = this.structures.filter((s) => s.alive);
    this.updateBossHud();
    this.handleStoryResult();
    this.pruneSelection();
    this.audio.setBiome(this.level?.biome ?? 'field');
  }

  private storyCtx(): LevelContext {
    return {
      units: this.units,
      structures: this.structures,
      grid: this.grid,
      spawnEnemy: (type, x, y) => {
        const u = createUnit('enemy', type, x, y);
        this.units.push(u);
        return u;
      },
      createPlayerUnit: (type, x, y) => {
        const u = createUnit('player', type, x, y);
        this.units.push(u);
        return u;
      },
      createCart: (x, y) => {
        const c = createCart(x, y);
        this.structures.push(c);
        return c;
      },
      createBase: () => {
        const b = createBase();
        this.structures.push(b);
        return b;
      },
      createBaseAt: (x, y) => {
        const b = createBaseAt(x, y);
        this.structures.push(b);
        return b;
      },
      createDefense: () => {
        const d = createCastleDefense();
        this.structures.push(...d);
        this.storyWallTotal += d.filter((s) => s.kind === 'wall').length;
        return d;
      },
      createMines: () => {
        const m = createMines();
        this.structures.push(...m);
        this.storyMineTotal += m.length;
        return m;
      },
      createMineAt: (x, y) => {
        const mine = createMineAt(x, y);
        this.structures.push(mine);
        this.storyMineTotal++;
        return mine;
      },
      showMessage: (message) => this.ui.showTutorial(message),
      hideTutorial: () => this.ui.hideTutorial(),
    };
  }

  private updateBossHud(): void {
    let boss: Unit | null = null;
    for (const u of this.units) {
      if (u.alive && u.troopType === 'boss') {
        boss = u;
        break;
      }
    }
    if (!boss) {
      this.ui.hideBossHud();
      return;
    }
    if (!this.bossAnnounced) {
      this.bossAnnounced = true;
      this.audio.playSfx('wave-start');
    }
    this.ui.updateBossHud(boss.hp, boss.maxHp, CONFIG.boss.name);
  }

  private handleStoryResult(): void {
    const res = this.level?.result ?? 'running';
    if (res === 'running' || this.storyResultShown) return;
    this.storyResultShown = true;
    this.storyOver = true;
    this.ui.hideTutorial();
    if (res === 'won' && this.level) {
      const stats = this.computeLevelStats();
      const stars = starsFor(this.level, stats);
      const next = this.levelNumber + 1;
      const prevUnlocked = this.campaign.isUnlocked(next);
      this.campaign.record(this.levelNumber, stars, stats);
      this.audio.playSfx('wave-complete');
      if (this.levelNumber === 10) {
        this.ui.showCampaignComplete(this.level, stars);
      } else if (this.levelNumber === 9) {
        this.ui.showStoryTeaser(this.level, stars, stats);
      } else {
        const unlockedText =
          next <= 10 && !prevUnlocked && this.campaign.isUnlocked(next) ? `FASE ${next} DESBLOQUEADA!` : null;
        this.ui.showStoryResult(this.level, stars, stats, unlockedText);
      }
    } else {
      this.ui.showStoryLose(this.level?.name ?? '');
      this.audio.playSfx('ui-denied');
    }
  }

  private computeLevelStats(): LevelStats {
    const basesPct: number[] = [];
    let castlePct = 0;
    let cartPct = 0;
    let minesHp = 0;
    let wallsHp = 0;
    for (const s of this.structures) {
      if (s.kind === 'base') {
        const pct = s.maxHp > 0 ? (s.hp / s.maxHp) * 100 : 0;
        basesPct.push(pct);
        if (castlePct === 0) castlePct = pct;
      } else if (s.kind === 'cart') {
        cartPct = s.maxHp > 0 ? (s.hp / s.maxHp) * 100 : 0;
      } else if (s.kind === 'mine') {
        minesHp += s.hp;
      } else if (s.kind === 'wall') {
        wallsHp += s.hp;
      }
    }
    let alivePlayer = 0;
    let aliveArchers = 0;
    let aliveTanks = 0;
    let aliveChampions = 0;
    for (const u of this.units) {
      if (u.alive && u.team === 'player') {
        alivePlayer++;
        if (u.troopType === 'archer') aliveArchers++;
        else if (u.troopType === 'tank') aliveTanks++;
        else if (u.troopType === 'champion') aliveChampions++;
      }
    }
    return {
      castlePct,
      cartPct,
      losses: Math.max(0, this.storyStartPlayerCount - alivePlayer),
      time: this.storyElapsed,
      aliveArchers,
      aliveTanks,
      aliveChampions,
      basesPct,
      minesPct: this.storyMineTotal > 0 ? (minesHp / (this.storyMineTotal * CONFIG.mine.hp)) * 100 : 0,
      wallsPct: this.storyWallTotal > 0 ? (wallsHp / (this.storyWallTotal * CONFIG.castle.wallHp)) * 100 : 0,
    };
  }

  private countPlayerUnits(): number {
    let n = 0;
    for (const u of this.units) if (u.alive && u.team === 'player') n++;
    return n;
  }

  private getWeakestBase(): Structure | null {
    let best: Structure | null = null;
    let bestPct = Infinity;
    for (const s of this.structures) {
      if (!s.alive || s.kind !== 'base') continue;
      const pct = s.maxHp > 0 ? s.hp / s.maxHp : 0;
      if (pct < bestPct) {
        bestPct = pct;
        best = s;
      }
    }
    return best;
  }

  private getCart(): Structure | null {
    for (const s of this.structures) {
      if (s.alive && s.kind === 'cart') return s;
    }
    return null;
  }

  private updateStructures(dt: number): void {
    if (this.waves.phase === 'preparation') return;
    let passive = CONFIG.economy.passiveGoldPerSecond;
    for (const s of this.structures) {
      if (s.alive && s.kind === 'mine') passive += CONFIG.mine.goldPerSecond * this.econMods.mineIncome;
    }
    this.economy.update(dt, passive);
  }

  private updateBiomeTransition(dt: number): void {
    if (this.biomeTransition >= 0) {
      this.biomeTransition += dt;
      if (this.biomeTransition >= BIOME_TRANSITION_TIME) this.biomeTransition = -1;
      return;
    }
    if (this.waves.phase !== 'preparation' || this.waves.wave < 1) return;
    const target = getBiomeForWave(this.waves.wave + 1);
    if (target !== this.renderedBiome) {
      this.renderedBiome = target;
      this.biomeTransition = 0;
    }
  }

  private biomeOverlay(): RenderOverlay | null {
    if (this.biomeTransition < 0) return null;
    const t = this.biomeTransition / BIOME_TRANSITION_TIME;
    const alpha = t < 0.35 ? t / 0.35 : t > 0.75 ? (1 - t) / 0.25 : 1;
    return {
      alpha: Math.max(0, Math.min(1, alpha)) * 0.85,
      title: BIOMES[this.renderedBiome].name.toUpperCase(),
      subtitle: this.waves.phase === 'battle' ? `WAVE ${this.waves.wave}` : `WAVE ${this.waves.wave + 1}`,
    };
  }

  private handleEvent(e: InputEvent): void {
    switch (e.type) {
      case 'select': {
        const world = this.camera.screenToWorld(e.x, e.y);
        const unit = this.pickUnit(world.x, world.y);
        this.selected.clear();
        if (unit) {
          this.selected.add(unit);
          this.playSfx('select', 'ui-select', 0.12);
        }
        break;
      }
      case 'drag': {
        const a = this.camera.screenToWorld(e.x1, e.y1);
        const b = this.camera.screenToWorld(e.x2, e.y2);
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        this.selected.clear();
        for (const u of this.units) {
          if (u.alive && u.team === 'player' && u.x >= minX && u.x <= maxX && u.y >= minY && u.y <= maxY) {
            this.selected.add(u);
          }
        }
        if (this.selected.size > 0) this.playSfx('select', 'ui-select', 0.12);
        break;
      }
      case 'move': {
        const world = this.camera.screenToWorld(e.x, e.y);
        if (this.selected.size > 0) {
          this.commandMove(world.x, world.y);
          this.pushMarker(world.x, world.y, 'move');
          this.level?.onMoveCommand?.();
        }
        break;
      }
      case 'recruit': {
        this.handleRecruit(e.troopType);
        break;
      }
      case 'formation': {
        if (this.selected.size > 0) {
          this.formFormation(e.kind);
          this.ui.showToast(`FORMAÇÃO: ${FORMATION_NAMES[e.kind]}`, 'info');
          this.audio.playSfx('ui-formation');
          this.level?.onFormation?.();
        }
        break;
      }
    }
  }

  private pickUnit(x: number, y: number): Unit | null {
    const candidates: Unit[] = [];
    this.grid.queryCircle(x, y, CONFIG.selection.pickRadius, candidates);
    let best: Unit | null = null;
    let bestSq = Infinity;
    for (const u of candidates) {
      if (!u.alive || u.team !== 'player') continue;
      const dx = u.x - x;
      const dy = u.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        best = u;
      }
    }
    return best;
  }

  private commandMove(x: number, y: number): void {
    const n = this.selected.size;
    if (n === 0) return;
    const sq = commandSquad([...this.selected], x, y);
    if (sq && sq.mode === 'manual') sq.mode = 'manual_moving';
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const rows = Math.max(1, Math.ceil(n / cols));
    let i = 0;
    for (const u of this.selected) {
      if (u.formationOffset) {
        u.moveTarget = { x: x + u.formationOffset.x, y: y + u.formationOffset.y };
      } else {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const ox = (col - (cols - 1) / 2) * CONFIG.selection.spacing;
        const oy = (row - (rows - 1) / 2) * CONFIG.selection.spacing;
        u.moveTarget = { x: x + ox, y: y + oy };
      }
      u.attackTarget = null;
      u.formationSlot = null;
      i++;
    }
  }

  private handleRecruit(type: PlayerTroopType): void {
    if (this.mode !== 'infinite' || !this.base) return;
    const rec = CONFIG.recruits[type];
    if (!this.economy.canAfford(rec.cost)) {
      this.playSfx('denied', 'ui-denied', 0.3);
      this.ui.flashGoldInsufficient();
      this.pushMarker(this.base.x, this.base.y - this.base.radius, 'denied', 'OURO INSUFICIENTE');
      return;
    }
    if (this.playerUnitCount + rec.count > this.settings.value.maxUnits) {
      this.playSfx('denied', 'ui-denied', 0.3);
      this.pushMarker(this.base.x, this.base.y - this.base.radius, 'denied', 'LIMITE DE TROPAS');
      return;
    }
    const unit = this.recruit(type);
    if (unit) {
      this.playSfx('recruit', RECRUIT_SFX[type], 0.3);
      this.pushMarker(unit.x, unit.y, 'recruit', rec.icon);
      this.ui.showToast(`+${rec.count} ${TROOP_LABELS[type]}`, 'success');
    }
  }

  private applyHits(hits: HitInfo[]): void {
    for (const h of hits) {
      this.pushMarker(h.x, h.y, 'hit');
      this.pushMarker(h.x, h.y - 6, 'damage', `-${Math.round(h.damage)}`);
    }
  }

  private recruit(type: PlayerTroopType): Unit | null {
    if (this.mode !== 'infinite' || !this.base) return null;
    const rec = CONFIG.recruits[type];
    if (!this.economy.canAfford(rec.cost)) return null;
    if (this.playerUnitCount + rec.count > this.settings.value.maxUnits) return null;
    this.economy.spend(rec.cost);
    const radius = this.base.radius + 14;
    let created: Unit | null = null;
    for (let i = 0; i < rec.count; i++) {
      const angle = this.recruitIndex * 2.399963;
      this.recruitIndex += 1;
      const unit = createUnit(
        'player',
        type,
        this.base.x + Math.cos(angle) * radius,
        this.base.y + Math.sin(angle) * radius,
        this.troopMods,
      );
      this.units.push(unit);
      created = unit;
    }
    return created;
  }

  private formFormation(kind: FormationKind): void {
    if (this.selected.size === 0) return;
    let sumX = 0;
    let sumY = 0;
    for (const u of this.selected) {
      sumX += u.x;
      sumY += u.y;
    }
    const center = { x: sumX / this.selected.size, y: sumY / this.selected.size };
    const sq = commandSquad([...this.selected], center.x, center.y);
    let facing = { x: 0, y: -1 };
    let bestSq = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.team !== 'enemy') continue;
      const dx = u.x - center.x;
      const dy = u.y - center.y;
      const d = dx * dx + dy * dy;
      if (d < bestSq) {
        bestSq = d;
        facing = { x: dx, y: dy };
      }
    }
    const fl = Math.hypot(facing.x, facing.y) || 1;
    facing = { x: facing.x / fl, y: facing.y / fl };
    const targets = formationTargets(kind, [...this.selected], center, facing);
    for (const [u, target] of targets) {
      u.formationOffset = { x: target.x - center.x, y: target.y - center.y };
      u.moveTarget = target;
      u.attackTarget = null;
      u.formationSlot = null;
    }
    if (sq) {
      sq.mode = 'manual_moving';
      sq.formationKind = kind;
      sq.facingX = facing.x;
      sq.facingY = facing.y;
    }
  }

  private pushMarker(x: number, y: number, kind: WorldMarker['kind'], text?: string): void {
    const important = kind === 'move' || kind === 'recruit' || kind === 'denied';
    if (!important && this.markers.length >= CONFIG.ui.maxMarkers) return;
    if (kind === 'damage' && this.damageMarkerCount >= CONFIG.ui.maxDamageMarkers) return;
    const duration =
      kind === 'move'
        ? CONFIG.ui.moveMarkerDuration
        : kind === 'denied'
          ? CONFIG.ui.deniedMarkerDuration
          : kind === 'hit'
            ? CONFIG.ui.hitMarkerDuration
            : kind === 'damage'
              ? CONFIG.ui.damageMarkerDuration
              : kind === 'death'
                ? CONFIG.ui.deathMarkerDuration
                : CONFIG.ui.recruitMarkerDuration;
    this.markers.push({
      x,
      y,
      kind,
      age: 0,
      duration,
      text,
    });
    if (kind === 'damage') this.damageMarkerCount++;
  }

  private updateMarkers(dt: number): void {
    for (const m of this.markers) m.age += dt;
    this.markers = this.markers.filter((m) => m.age < m.duration);
    let n = 0;
    for (const m of this.markers) if (m.kind === 'damage') n++;
    this.damageMarkerCount = n;
  }

  private onWaveComplete(wave: number): void {
    const bonus = CONFIG.waves.clearBonusBase + wave * CONFIG.waves.clearBonusPerWave + this.econMods.waveBonus;
    this.economy.add(bonus);
    this.upgradeOptions = [];
    this.playSfx('wave-complete', 'wave-complete', 0.5);
    this.ui.showToast(`WAVE ${wave} COMPLETA · +${Math.round(bonus)} OURO`, 'success');
  }

  private applyUpgrade(id: UpgradeId): void {
    switch (id) {
      case 'damage':
        this.troopMods.damage += CONFIG.upgrades.damage;
        this.refreshTroops();
        break;
      case 'health':
        this.troopMods.health += CONFIG.upgrades.health;
        this.refreshTroops();
        break;
      case 'speed':
        this.troopMods.speed += CONFIG.upgrades.speed;
        this.refreshTroops();
        break;
      case 'attackSpeed':
        this.troopMods.attackSpeed += CONFIG.upgrades.attackSpeed;
        this.refreshTroops();
        break;
      case 'range':
        this.troopMods.range += CONFIG.upgrades.range;
        this.refreshTroops();
        break;
      case 'defense':
        this.troopMods.defense = Math.min(0.6, this.troopMods.defense + CONFIG.upgrades.defense);
        this.refreshTroops();
        break;
      case 'baseMaxHp':
        if (this.base) {
          this.base.maxHp += CONFIG.upgrades.baseMaxHp;
          this.base.hp = Math.min(this.base.maxHp, this.base.hp + CONFIG.upgrades.baseMaxHp);
        }
        break;
      case 'baseRepair':
        if (this.base) this.base.hp = Math.min(this.base.maxHp, this.base.hp + CONFIG.upgrades.baseRepair);
        break;
      case 'mineIncome':
        this.econMods.mineIncome += CONFIG.upgrades.mineIncome;
        break;
      case 'waveBonus':
        this.econMods.waveBonus += CONFIG.upgrades.waveBonus;
        break;
    }
    this.recentUpgrades.push(id);
    if (this.recentUpgrades.length > 5) this.recentUpgrades.shift();
    this.upgradeOptions = [];
  }

  private refreshTroops(): void {
    for (const u of this.units) {
      if (!u.alive || u.team !== 'player') continue;
      applyTroopMods(u, this.troopMods);
    }
  }

  private pruneSelection(): void {
    if (this.selected.size === 0) return;
    for (const u of this.selected) {
      if (!u.alive) this.selected.delete(u);
    }
  }

  private startMatch(): void {
    this.reset();
    this.screen = 'playing';
    this.ui.startGame();
    this.audio.playMusic('battle');
    this.audio.setMusicLevel(this.settings.value.musicVolume * CONFIG.ui.prepareMusicFactor);
    this.audio.playSfx('ui-confirm');
  }

  private startStoryLevel(levelNumber: number): void {
    const def = levelByNumber(levelNumber);
    if (!def) return;
    this.resetStory();
    this.level = def;
    this.levelNumber = levelNumber;
    this.storyRoute = def.route;
    this.storyElapsed = 0;
    this.storyStartPlayerCount = 0;
    this.renderedBiome = def.biome;
    this.biomeTransition = -1;
    this.ui.setStoryHud(def.hasCart, def.hasCastle);
    this.screen = 'phaseintro';
    this.ui.showPhaseIntro(def);
    this.audio.playMusic('battle');
  }

  private beginPhase(): void {
    const def = this.level;
    if (!def) return;
    this.screen = 'playing';
    this.ui.startGame();
    def.setup(this.storyCtx());
    this.storyStartPlayerCount = this.countPlayerUnits();
    this.audio.playSfx('ui-confirm');
  }

  private showStorySelect(): void {
    this.screen = 'storyselect';
    this.mode = null;
    this.level = null;
    this.storyOver = false;
    this.storyResultShown = false;
    this.ui.setMode('infinite');
    this.ui.showStorySelect();
    this.syncMusic();
  }

  private resume(): void {
    this.screen = 'playing';
    this.ui.hidePause();
    this.audio.playSfx('ui-confirm');
  }

  private quitToMenu(): void {
    this.screen = 'menu';
    this.mode = null;
    this.level = null;
    this.ui.setMode('infinite');
    this.ui.showMenu();
    this.audio.stopAmbient();
    this.audio.playSfx('ui-click');
    this.syncMusic();
  }

  private syncMusic(): void {
    if (this.screen === 'menu' || this.screen === 'modes' || this.screen === 'storyselect') {
      this.audio.playMusic('menu');
    } else {
      this.audio.playMusic('battle');
    }
  }

  private handlePauseKey(): void {
    if (this.mode === 'story' && this.storyResultShown) return;
    if (this.ui.isOverlayOpen()) {
      this.ui.closeOverlays();
      return;
    }
    if (this.screen === 'playing' && !this.gameOver) {
      this.screen = 'paused';
      this.ui.showPause();
    } else if (this.screen === 'paused') {
      this.screen = 'playing';
      this.ui.hidePause();
    } else if (this.screen === 'modes') {
      this.screen = 'menu';
      this.ui.showMenu();
      this.syncMusic();
    } else if (this.screen === 'storyselect') {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
    }
  }
}