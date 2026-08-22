import { CONFIG } from '../config';
import type { Difficulty } from '../config';
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
import { updateEffects, clearEffects, spawnSparks, spawnRing, spawnDust } from '../effects';
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
import type { BuildPreview, MenuVariant, RenderOverlay, WorldMarker, StoryMapView, StoryMapNode } from '../render/renderer';
import { STORY_MAP_PATH, STORY_MAP_NODE_ICONS, STORY_MAP_DESIGN_W, STORY_MAP_DESIGN_H } from '../render/renderer';
import { StoryMapCamera } from '../render/renderer';
import { SettingsStore } from '../settings/settings';
import { CampaignStore } from '../story/campaign';
import { levelByNumber } from '../story/levels';
import { starsFor } from '../story/story';
import type { LevelContext, LevelDef, LevelStats } from '../story/story';
import type { HitInfo, PlayerTroopType, TroopType } from '../types';
import { Ui } from '../ui/ui';
import { Progression } from '../progression/progression';
import type { BuildingKind } from '../progression/progression';
import { BUILDING_NAMES, buildingCost, canPlaceBuilding, createBuilding } from '../progression/buildings';
import { WaveManager } from '../waves/wave-manager';
import type { WavePhase } from '../waves/wave-manager';
import { AdventureLevel } from '../adventure/adventure';
import { AdventureStore } from '../adventure/adventure-store';
import {
  buildContinentRegions,
  continentDiscovered,
  continentTransform,
  regionScreenRect,
  CONTINENT_BACK_BUTTON,
  type ContinentRegion,
  type ContinentView,
} from '../adventure/continent';
import type { AdventureStats } from '../ui/ui';
import {
  addCreativeEntity,
  createCreativeScenario,
  createCreativeStructure,
  createCreativeUnit,
  creativeEntityRadius,
  creativePickDims,
  creativePickRadius,
  creativeTeamOf,
  moveCreativeEntity,
  removeCreativeEntity,
  type CreativeEntity,
  type CreativePhase,
  type CreativePick,
  type CreativeScenario,
  type CreativeTeam,
} from '../creative/creative';
import { CreativeAI, updateCreativeCaptures } from '../creative/creative-ai';
import type { CreativeEditorView, CreativeGhost, CreativeSelected } from '../render/renderer';

type Screen = 'menu' | 'modes' | 'difficulty' | 'creative' | 'creative-editor' | 'playing' | 'paused' | 'storymap' | 'phaseintro' | 'continent';

const BIOME_TRANSITION_TIME = 1.6;

const BIOME_ICONS: Record<BiomeId, string> = {
  field: '🌾',
  desert: '🏜️',
  snow: '❄️',
  volcanic: '🌋',
  ruins: '🏚️',
  cosmic: '🌌',
};

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
  private mode: 'infinite' | 'story' | 'adventures' | null = null;
  private readonly campaign = new CampaignStore();
  private readonly adventureStore = new AdventureStore();
  private continentRegions: ContinentRegion[] = [];
  private level: LevelDef | null = null;
  private levelNumber = 0;
  private adventure: AdventureLevel | null = null;
  private adventureElapsed = 0;
  private adventureOver = false;
  private adventureResultShown = false;
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
  private playerUnitCount = 0;
  private readonly progression = new Progression();
  private placingBuild: BuildingKind | null = null;
  private buildPreview: BuildPreview | null = null;
  private lastPhase: WavePhase = 'preparation';
  private markers: WorldMarker[] = [];
  private screen: Screen = 'menu';
  private difficulty: Difficulty = 'medium';
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
  private lastEnemyBaseHp = -1;
  private creativeScenario: CreativeScenario | null = null;
  private creativeUnits: Unit[] = [];
  private creativeStructures: Structure[] = [];
  private creativeTeam: CreativeTeam = 'blue';
  private creativePlacing: CreativePick | null = null;
  private creativePhase: CreativePhase = 'prep';
  private creativeCountdown = 0;
  private lastCreativeCount = -1;
  private creativeSelectedId: number | null = null;
  private creativeRotation = 0;
  private creativeAi = new CreativeAI();
  private creativeBlueEconomy = new Economy();
  private creativeRedEconomy = new Economy();
  private creativeKills: Record<CreativeTeam, number> = { blue: 0, red: 0 };
  private creativeElapsed = 0;
  private creativePaused = false;
  private creativeResultShown = false;
  private creativeBlueHadBase = false;
  private creativeRedHadBase = false;
  private creativeRecruitTimers: Record<CreativeTeam, number> = { blue: 0, red: 0 };
  private creativeBlueAlivePrev = 0;
  private creativeRedAlivePrev = 0;
  private creativeSpeed: 1 | 2 | 4 = 1;
  private creativeBattleFlash = 0;
  private storyMapCamera: StoryMapCamera | null = null;

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
      onPlayInfinite: () => {
        this.screen = 'difficulty';
        this.ui.showDifficulty();
        this.audio.playSfx('ui-confirm');
        this.syncMusic();
      },
      onDifficultySelect: (difficulty) => this.startMatch(difficulty),
      onDifficultyBack: () => {
        this.screen = 'modes';
        this.ui.showModes();
        this.audio.playSfx('ui-click');
        this.syncMusic();
      },
      onPlayAdventure: () => this.showContinent(),
      onPlayCreative: () => this.showCreative(),
      onCreativeBack: () => {
        this.screen = 'modes';
        this.ui.showModes();
        this.syncMusic();
      },
      onCreativeStart: () => this.startCreativeEditor(),
      onCreativeEditorBack: () => this.exitCreativeEditor(),
      onCreativeTeam: (team) => this.setCreativeTeam(team),
      onCreativePick: (pick) => this.handleCreativePick(pick),
      onCreativeRemove: () => this.handleCreativeRemove(),
      onCreativeStartBattle: () => this.startCreativeBattle(),
      onCreativeRetry: () => this.retryCreativeBattle(),
      onCreativeEdit: () => this.editCreativeScenario(),
      onCreativeResultMenu: () => this.quitToMenu(),
      onCreativeSpeed: (speed) => this.setCreativeSpeed(speed),
      onCreativePause: () => {
        if (this.creativePaused) {
          this.creativePaused = false;
          this.ui.showCreativeEditor();
        } else {
          this.creativePaused = true;
          this.ui.showPause('CRIATIVO — PAUSADO');
        }
      },
      onCoopLocked: () => this.audio.playSfx('ui-denied'),
      onBackToMenu: () => {
        this.screen = 'menu';
        this.ui.showMenu();
        this.syncMusic();
      },
      onOpenStory: () => {
        this.audio.playSfx('ui-confirm');
        this.showStoryMap();
      },
      onStoryMapBack: () => {
        this.screen = 'modes';
        this.ui.showModes();
        this.syncMusic();
      },
      onStoryMapPlay: (n) => this.startStoryLevel(n),
      onStoryWinContinue: () => this.showStoryMap(),
      onStoryWinRetry: () => this.startStoryLevel(this.levelNumber),
      onStoryWinMenu: () => this.quitToMenu(),
      onPhaseIntroContinue: () => this.beginPhase(),
      onStoryTeaserContinue: () => this.showStoryMap(),
      onStoryTeaserMenu: () => this.quitToMenu(),
      onCampaignCompleteContinue: () => this.showStoryMap(),
      onCampaignCompleteMenu: () => this.quitToMenu(),
      onStoryLoseRetry: () => this.startStoryLevel(this.levelNumber),
      onStoryLoseMenu: () => this.quitToMenu(),
      onAdventureWinRestart: () => this.startAdventure(),
      onAdventureWinContinue: () => this.showContinent(),
      onAdventureWinMenu: () => this.quitToMenu(),
      onAdventureLoseRetry: () => this.startAdventure(),
      onAdventureLoseContinent: () => this.showContinent(),
      onAdventureLoseMenu: () => this.quitToMenu(),
      onResume: () => this.resume(),
      onQuitToMenu: () => this.quitToMenu(),
      onRestart: () => this.startMatch(),
      onToggleProgress: () => {
        this.ui.setProgressionVisible(!this.ui.progressionVisible());
        this.audio.playSfx('ui-click');
      },
      onUpgradeCastle: () => this.tryUpgradeCastle(),
      onUpgradeTroop: (type) => this.tryUpgradeTroop(type),
      onBuild: (kind) => this.toggleBuildMode(kind),
      onStartWave: () => this.waves.beginBattle(),
      onRecruit: (type) => this.handleRecruit(type),
      onSettingsChange: () => this.audio.applySettings(),
    }, this.campaign);
    this.wireUiSounds();
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.base = createBase();
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
    this.storyMapCamera = new StoryMapCamera(window.innerWidth, window.innerHeight, STORY_MAP_DESIGN_W, STORY_MAP_DESIGN_H);
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
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.screen .btn, .screen .side-card');
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
      const btn = target.closest<HTMLButtonElement>('.btn, .army-btn, .prog-btn, .prog-open');
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
    if (this.storyMapCamera) {
      this.storyMapCamera.setViewSize(window.innerWidth, window.innerHeight);
    }
  }

  private loop = (time: number): void => {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.fps = dt > 0 ? Math.round(1 / dt) : 0;

    for (const e of this.input.drainEvents()) {
      if (e.type === 'pause') {
        if (this.placingBuild) {
          this.cancelBuildMode();
          continue;
        }
        if (this.screen === 'creative-editor' && this.creativePlacing) {
          this.setCreativePlacing(null);
          continue;
        }
        this.handlePauseKey();
        continue;
      }
      if (e.type === 'wheel') {
        if (this.screen === 'storymap' && this.storyMapCamera) {
          this.storyMapCamera.zoomAt(e.x, e.y, e.deltaY < 0 ? 1.12 : 0.89);
        } else {
          this.camera.zoomAt(e.x, e.y, e.deltaY < 0 ? 1.08 : 0.925);
        }
        continue;
      }
      if (this.screen === 'continent') {
        if (e.type === 'select') this.handleContinentClick(e.x, e.y);
        if (e.type === 'hover') this.handleContinentHover(e.x, e.y);
        continue;
      }
      if (this.screen === 'storymap') {
        if (e.type === 'select') this.handleStoryMapClick(e.x, e.y);
        if (e.type === 'hover') this.handleStoryMapHover(e.x, e.y);
        if (e.type === 'drag' && this.storyMapCamera) {
          this.storyMapCamera.startDrag(e.x1, e.y1);
          this.storyMapCamera.drag(e.x2, e.y2);
          this.storyMapCamera.endDrag();
        }
        if (e.type === 'rotate') {
          this.reframeStoryMap();
          this.audio.playSfx('ui-confirm');
        }
        continue;
      }
      if (this.screen === 'creative-editor') {
        this.handleCreativeEvent(e);
        continue;
      }
      if (this.screen === 'playing' && !this.gameOver && !this.storyOver && !this.adventureOver) this.handleEvent(e);
    }

    this.update(dt);
    this.updateMarkers(dt);
    updateEffects(dt);

    const cart = this.mode === 'story' ? this.getCart() : null;
    const menuVariant = this.menuBackdropVariant();
    if (this.screen === 'continent') {
      this.renderer.renderContinent(dt, this.continentView());
    } else if (this.screen === 'storymap') {
      this.renderer.renderStoryMap(dt, this.storyMapView());
    } else if (this.screen === 'creative-editor') {
      this.renderer.renderCreativeEditor(this.camera, this.creativeUnits, this.creativeStructures, this.creativeView(), this.projectiles, this.markers);
    } else if (menuVariant) {
      this.renderer.renderMenu(dt, menuVariant);
    } else {
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
        this.mode === 'adventures' && this.adventure ? this.adventure.renderData() : null,
        this.buildPreview,
      );
    }

    if (this.mode === 'adventures' && this.adventure) {
      const pb = this.adventure.structures[0];
      const eb = this.adventure.structures[1];
      this.ui.updateAdventureHud(
        this.economy,
        this.playerUnitCount,
        pb ? pb.hp : 0,
        pb ? pb.maxHp : 1,
        eb ? eb.hp : 0,
        eb ? eb.maxHp : 1,
        this.fps,
        this.progression.troopCap(this.structures),
      );
      this.ui.updateProgression(this.progression.snapshot(this.economy.gold, this.structures));
      if (this.goldDelta > CONFIG.ui.goldGainThreshold) this.ui.showGoldGain(this.goldDelta);
    } else if (this.mode === 'story') {
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
      this.ui.updateHud(this.economy, this.waves, this.playerUnitCount, this.base.hp, this.base.maxHp, this.fps, this.troopCounts, this.progression.troopCap(this.structures));
      this.ui.updateProgression(this.progression.snapshot(this.economy.gold, this.structures));
      if (this.waves.phase === 'preparation') {
        this.ui.showPreparation(this.waves.wave, this.waves.timer);
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
    clearEffects();
    this.selected.clear();
    this.economy.gold = CONFIG.economy.startingGold;
    this.playerUnitCount = 0;
    this.lastPhase = 'preparation';
    this.progression.reset();
    this.placingBuild = null;
    this.buildPreview = null;
    this.renderedBiome = getBiomeForWave(1);
    this.biomeTransition = -1;
    this.lastPrepSec = -1;
    this.lastAliveWalls = -1;
    this.lastAliveTowers = -1;
    this.lastMines = -1;
    this.lastBaseHp = -1;
    this.lastEnemyBaseHp = -1;
    this.waves.reset();
    this.waves.setDifficulty(this.difficulty);
    resetAutoFormation();
    this.ui.setMode('infinite');
    this.adventure = null;
    this.adventureElapsed = 0;
    this.adventureOver = false;
    this.adventureResultShown = false;
    const cx = CONFIG.positions.base.x;
    const cy = CONFIG.positions.base.y;
    this.camera.setWorldSize(CONFIG.world.width, CONFIG.world.height);
    this.camera.x = cx;
    this.camera.y = cy;
    const starting: PlayerTroopType[] = [];
    const startingConfig = CONFIG.player.startingTroops;
    for (const [type, count] of Object.entries(startingConfig) as [PlayerTroopType, number][]) {
      for (let i = 0; i < count; i++) starting.push(type);
    }
    if (this.difficulty === 'easy') starting.push('champion');
    starting.forEach((type, i) => {
      const a = (i / starting.length) * Math.PI * 2;
      this.units.push(createUnit('player', type, cx + Math.cos(a) * 90, cy + Math.sin(a) * 90, this.progression.modsFor(type)));
    });
    this.applyDifficultyBuildings(cx, cy);
  }

  private applyDifficultyBuildings(cx: number, cy: number): void {
    const towerMult = this.progression.castleTowerMult();
    if (this.difficulty !== 'hard') {
      this.structures.push(createBuilding('house', cx + 60, cy - 130, towerMult));
      this.structures.push(createBuilding('house', cx, cy + 160, towerMult));
    }
    if (this.difficulty === 'easy') {
      this.structures.push(createBuilding('market', cx - 60, cy + 60, towerMult));
    }
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
    clearEffects();
    this.selected.clear();
    this.playerUnitCount = 0;
    this.renderedBiome = 'field';
    this.biomeTransition = -1;
    resetAutoFormation();
    this.ui.setMode('story');
    this.ui.hideBossHud();
    this.adventure = null;
    this.adventureElapsed = 0;
    this.adventureOver = false;
    this.adventureResultShown = false;
    this.camera.setWorldSize(CONFIG.world.width, CONFIG.world.height);
  }

  private update(dt: number): void {
    if (this.screen === 'creative-editor') {
      this.updateCreative(dt);
      return;
    }
    if (this.screen === 'storymap') {
      this.storyMapTime += dt;
      this.goldDelta = 0;
      this.audio.stopAmbient();
      if (this.storyMapCamera) {
        this.storyMapCamera.update(dt);
        this.handleStoryMapKeyboardPan(dt);
      }
      return;
    }
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
    if (this.mode === 'adventures') {
      if (!this.adventureOver) this.updateAdventure(dt);
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
        spawnRing(u.x, u.y, 'rgba(255,100,120,0.6)', u.radius + 2, 0.3);
        spawnSparks(u.x, u.y, 3, u.color, 60, 0.25);
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
    this.updateBuildPreview();
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
        spawnRing(u.x, u.y, 'rgba(255,100,120,0.6)', u.radius + 2, 0.3);
        spawnSparks(u.x, u.y, 3, u.color, 60, 0.25);
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

  private updateAdventure(dt: number): void {
    const adv = this.adventure;
    if (!adv) return;
    const goldBefore = this.economy.gold;
    this.input.updateCamera(this.camera, dt);
    this.adventureElapsed += dt;

    this.grid.clear();
    this.playerUnitCount = 0;
    for (const u of this.units) {
      if (!u.alive) continue;
      this.grid.insert(u);
      if (u.team === 'player') this.playerUnitCount++;
    }

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
    updateUnits(this.units, this.grid, this.structures, dt, CONFIG.adventure.worldW, CONFIG.adventure.worldH);
    adv.update(dt);
    this.updateStructures(dt);

    let deaths = 0;
    for (const u of this.units) {
      if (!u.alive) {
        this.pushMarker(u.x, u.y, 'death');
        spawnRing(u.x, u.y, 'rgba(255,100,120,0.6)', u.radius + 2, 0.3);
        spawnSparks(u.x, u.y, 3, u.color, 60, 0.25);
        deaths++;
      }
    }
    if (deaths > 0) this.playSfx('death', 'unit-death', 0.12);
    this.units = this.units.filter((u) => u.alive);
    this.pruneSelection();

    const pBase = this.structures[0];
    const eBase = this.structures[1];
    if (this.lastBaseHp >= 0 && pBase && pBase.hp < this.lastBaseHp) this.playSfx('castle', 'castle-hit', 0.3);
    if (this.lastEnemyBaseHp >= 0 && eBase && eBase.hp < this.lastEnemyBaseHp) this.playSfx('castle', 'castle-hit', 0.3);
    this.lastBaseHp = pBase ? pBase.hp : 0;
    this.lastEnemyBaseHp = eBase ? eBase.hp : 0;

    if (eBase && eBase.hp <= 0) this.handleAdventureVictory();
    else if (pBase && pBase.hp <= 0) this.handleAdventureDefeat();
    this.goldDelta = this.economy.gold - goldBefore;
    this.updateBuildPreview();
  }

  private adventureStats(): AdventureStats {
    let territories = 0;
    let minesCaptured = 0;
    let minesTotal = 0;
    if (this.adventure) {
      for (const t of this.adventure.territories) if (t.state === 'revealed') territories++;
      minesCaptured = this.adventure.minesCaptured;
      minesTotal = this.adventure.minesTotal;
    }
    return { time: this.adventureElapsed, territories, minesCaptured, minesTotal };
  }

  private handleAdventureVictory(): void {
    if (this.adventureOver) return;
    this.adventureOver = true;
    this.adventureResultShown = true;
    this.ui.hideTutorial();
    const stats = this.adventureStats();
    this.adventureStore.recordPhase1({ time: stats.time, minesCaptured: stats.minesCaptured, regionsRevealed: stats.territories });
    this.ui.showAdventureResultWon(stats);
    this.audio.playSfx('wave-complete');
  }

  private handleAdventureDefeat(): void {
    if (this.adventureOver) return;
    this.adventureOver = true;
    this.adventureResultShown = true;
    this.ui.hideTutorial();
    this.ui.showAdventureResultLost(this.adventureStats());
    this.audio.playSfx('ui-denied');
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
      const stats = this.computeLevelStats();
      this.ui.showStoryLose(this.level?.name ?? '', stats);
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
    if (this.mode !== 'adventures' && this.waves.phase === 'preparation') return;
    const basePassive = this.mode === 'adventures' ? CONFIG.adventure.passiveGoldPerSecond : CONFIG.economy.passiveGoldPerSecond;
    let passive = basePassive;
    for (const s of this.structures) {
      if (!s.alive) continue;
      if (s.kind === 'mine' && (s.owner === undefined || s.owner === 'player')) {
        passive += CONFIG.mine.goldPerSecond;
      } else if (s.kind === 'market') {
        passive += CONFIG.progression.buildings.market.goldPerSecond;
      }
    }
    this.economy.update(dt, passive);
  }

  private menuBackdropVariant(): MenuVariant | null {
    switch (this.screen) {
      case 'menu':
        return 'menu';
      case 'modes':
        return 'modes';
      case 'difficulty':
        return 'modes';
      case 'creative':
        return 'creative';
      case 'storymap':
        return 'story';
      default:
        return null;
    }
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
      progress: t,
      tint: BIOMES[this.renderedBiome].background,
      icon: BIOME_ICONS[this.renderedBiome],
    };
  }

  private handleEvent(e: InputEvent): void {
    switch (e.type) {
      case 'select': {
        if (this.placingBuild) {
          this.placeBuilding(e.x, e.y);
          break;
        }
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
        if (this.placingBuild) {
          this.cancelBuildMode();
          break;
        }
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
      case 'rotate':
        break;
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
      u.structureTarget = null;
      i++;
    }
  }

  private handleRecruit(type: PlayerTroopType): void {
    if (this.mode !== 'infinite' && this.mode !== 'adventures') return;
    if (this.mode === 'adventures' && type !== 'knight') return;
    if (!this.base) return;
    const cap = this.progression.troopCap(this.structures);
    const rec = CONFIG.recruits[type];
    if (!this.economy.canAfford(rec.cost)) {
      this.playSfx('denied', 'ui-denied', 0.3);
      this.ui.flashGoldInsufficient();
      this.pushMarker(this.base.x, this.base.y - this.base.radius, 'denied', 'OURO INSUFICIENTE');
      this.ui.showToast('OURO INSUFICIENTE', 'alert');
      return;
    }
    if (this.playerUnitCount + rec.count > cap) {
      this.playSfx('denied', 'ui-denied', 0.3);
      this.pushMarker(this.base.x, this.base.y - this.base.radius, 'denied', 'LIMITE DE TROPAS');
      this.ui.showToast('LIMITE DE TROPAS ATINGIDO', 'alert');
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
      if (h.source !== 'unit') {
        spawnDust(h.x, h.y, 2);
      } else {
        spawnSparks(h.x, h.y, 2, '#ffffff', 80, 0.15);
      }
    }
  }

  private recruit(type: PlayerTroopType): Unit | null {
    if (this.mode !== 'infinite' && this.mode !== 'adventures') return null;
    if (!this.base) return null;
    const cap = this.progression.troopCap(this.structures);
    const rec = CONFIG.recruits[type];
    if (!this.economy.canAfford(rec.cost)) return null;
    if (this.playerUnitCount + rec.count > cap) {
      this.ui.showToast('LIMITE DE TROPAS ATINGIDO', 'alert');
      return null;
    }
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
        this.progression.modsFor(type),
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
      u.structureTarget = null;
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
    const bonus = CONFIG.waves.clearBonusBase + wave * CONFIG.waves.clearBonusPerWave;
    this.economy.add(bonus);
    if (wave % CONFIG.progression.diamonds.everyWaves === 0) {
      this.progression.diamonds++;
      this.ui.showToast('💎 +1 DIAMANTE!', 'success');
    }
    this.playSfx('wave-complete', 'wave-complete', 0.5);
    this.ui.showToast(`WAVE ${wave} COMPLETA · +${Math.round(bonus)} OURO`, 'success');
  }

  private tryUpgradeCastle(): void {
    if (!this.base) return;
    const prev = this.progression.castleHpBonus();
    if (!this.progression.upgradeCastle(this.economy)) {
      this.audio.playSfx('ui-denied');
      return;
    }
    const delta = this.progression.castleHpBonus() - prev;
    this.base.maxHp += delta;
    this.base.hp = Math.min(this.base.maxHp, this.base.hp + delta);
    this.refreshTowerCooldowns();
    this.audio.playSfx('ui-click');
    this.ui.showToast(`CASTELO NÍVEL ${this.progression.castleLevel} · HP +${delta}`, 'success');
  }

  private tryUpgradeTroop(type: PlayerTroopType): void {
    if (!this.progression.upgradeTroop(type, this.economy)) {
      this.audio.playSfx('ui-denied');
      return;
    }
    this.refreshTroopClass(type);
    this.audio.playSfx('ui-click');
    this.ui.showToast(`${TROOP_LABELS[type]} AGORA É NÍVEL ${this.progression.troopLevels[type]}`, 'success');
  }

  private refreshTroopClass(type: PlayerTroopType): void {
    const mods = this.progression.modsFor(type);
    for (const u of this.units) {
      if (!u.alive || u.team !== 'player' || u.troopType !== type) continue;
      applyTroopMods(u, mods);
    }
  }

  private refreshTowerCooldowns(): void {
    const mult = this.progression.castleTowerMult();
    for (const s of this.structures) {
      if (!s.alive || s.kind !== 'tower' || !s.playerBuilt) continue;
      s.attackCooldown = CONFIG.castle.towerCooldown * mult;
    }
  }

  private toggleBuildMode(kind: BuildingKind): void {
    if (this.placingBuild === kind) {
      this.cancelBuildMode();
      return;
    }
    if (this.mode !== 'infinite' && this.mode !== 'adventures') return;
    if (this.progression.buildingCount(this.structures) >= this.progression.buildingCap()) {
      this.audio.playSfx('ui-denied');
      this.ui.showToast('LIMITE DE CONSTRUÇÕES ATINGIDO', 'alert');
      return;
    }
    if (!this.economy.canAfford(buildingCost(kind))) {
      this.audio.playSfx('ui-denied');
      this.ui.showToast('OURO INSUFICIENTE', 'alert');
      return;
    }
    this.placingBuild = kind;
    this.ui.setPlacing(kind);
    this.audio.playSfx('ui-click');
  }

  private cancelBuildMode(): void {
    this.placingBuild = null;
    this.ui.setPlacing(null);
  }

  private placeBuilding(screenX: number, screenY: number): void {
    const kind = this.placingBuild;
    if (!kind) return;
    if (this.progression.buildingCount(this.structures) >= this.progression.buildingCap()) {
      this.audio.playSfx('ui-denied');
      this.ui.showToast('LIMITE DE CONSTRUÇÕES ATINGIDO', 'alert');
      this.cancelBuildMode();
      return;
    }
    const world = this.camera.screenToWorld(screenX, screenY);
    const worldW = this.mode === 'adventures' ? CONFIG.adventure.worldW : CONFIG.world.width;
    const worldH = this.mode === 'adventures' ? CONFIG.adventure.worldH : CONFIG.world.height;
    if (!canPlaceBuilding(kind, world.x, world.y, this.units, this.structures, worldW, worldH)) {
      this.audio.playSfx('ui-denied');
      this.ui.showToast('NÃO PODE CONSTRUIR AQUI', 'alert');
      return;
    }
    if (!this.economy.canAfford(buildingCost(kind))) {
      this.audio.playSfx('ui-denied');
      this.ui.showToast('OURO INSUFICIENTE', 'alert');
      return;
    }
    this.economy.spend(buildingCost(kind));
    this.structures.push(createBuilding(kind, world.x, world.y, this.progression.castleTowerMult()));
    this.audio.playSfx('ui-click');
    this.ui.showToast(`${BUILDING_NAMES[kind]} CONSTRUÍDA!`, 'success');
  }

  private updateBuildPreview(): void {
    if (!this.placingBuild) {
      this.buildPreview = null;
      return;
    }
    const p = this.input.pointerScreen();
    const w = this.camera.screenToWorld(p.x, p.y);
    const worldW = this.mode === 'adventures' ? CONFIG.adventure.worldW : CONFIG.world.width;
    const worldH = this.mode === 'adventures' ? CONFIG.adventure.worldH : CONFIG.world.height;
    this.buildPreview = {
      x: w.x,
      y: w.y,
      kind: this.placingBuild,
      valid: canPlaceBuilding(this.placingBuild, w.x, w.y, this.units, this.structures, worldW, worldH),
    };
  }

  private pruneSelection(): void {
    if (this.selected.size === 0) return;
    for (const u of this.selected) {
      if (!u.alive) this.selected.delete(u);
    }
  }

  private startMatch(difficulty: Difficulty = this.difficulty): void {
    this.difficulty = difficulty;
    this.reset();
    this.screen = 'playing';
    this.ui.startGame();
    this.ui.setProgressionVisible(true);
    this.audio.playMusic('battle');
    this.audio.setMusicLevel(this.settings.value.musicVolume * CONFIG.ui.prepareMusicFactor);
    this.audio.playSfx('ui-confirm');
  }

  private startAdventure(): void {
    this.resetAdventure();
    this.screen = 'playing';
    this.ui.startGame();
    this.audio.playMusic('battle');
    this.audio.setMusicLevel(this.settings.value.musicVolume);
    this.audio.playSfx('ui-confirm');
  }

  private showContinent(): void {
    this.mode = null;
    this.adventure = null;
    this.screen = 'continent';
    this.continentRegions = buildContinentRegions(this.adventureStore.phase1Completed);
    this.ui.showContinent();
    this.syncMusic();
    this.audio.playSfx('ui-confirm');
  }

  private showCreative(): void {
    this.mode = null;
    this.screen = 'creative';
    this.ui.showCreative();
    this.syncMusic();
    this.audio.playSfx('ui-confirm');
  }

  private startCreativeEditor(): void {
    this.mode = null;
    this.creativeScenario = createCreativeScenario(CONFIG.world.width, CONFIG.world.height);
    this.creativeUnits = [];
    this.creativeStructures = [];
    this.creativeTeam = 'blue';
    this.creativePlacing = null;
    this.creativePhase = 'prep';
    this.creativeCountdown = 0;
    this.lastCreativeCount = -1;
    this.creativeSelectedId = null;
    this.creativeSpeed = 1;
    this.ui.setCreativeSpeed(1);
    this.projectiles = [];
    this.markers.length = 0;
    clearEffects();
    this.selected.clear();
    this.camera.setWorldSize(CONFIG.world.width, CONFIG.world.height);
    this.camera.x = CONFIG.world.width / 2;
    this.camera.y = CONFIG.world.height / 2;
    this.camera.zoom = 0.7;
    this.screen = 'creative-editor';
    this.ui.showCreativeEditor();
    this.ui.setCreativeTeam('blue');
    this.ui.setCreativePick(null);
    this.ui.setCreativeLocked(false);
    this.ui.updateCreativeCounts(0, 0);
    this.syncMusic();
    this.audio.playSfx('ui-confirm');
  }

  private exitCreativeEditor(): void {
    this.creativeScenario = null;
    this.creativeUnits = [];
    this.creativeStructures = [];
    this.creativePhase = 'prep';
    this.creativeCountdown = 0;
    this.creativeSelectedId = null;
    this.creativePlacing = null;
    this.screen = 'creative';
    this.ui.showCreative();
    this.syncMusic();
    this.audio.playSfx('ui-click');
  }

  private handleCreativeEvent(e: InputEvent): void {
    if (this.creativePhase !== 'prep') {
      if (e.type === 'drag' && !this.creativePlacing) {
        this.camera.move(-(e.x2 - e.x1) / this.camera.zoom, -(e.y2 - e.y1) / this.camera.zoom);
      }
      return;
    }
    switch (e.type) {
      case 'select': {
        const world = this.camera.screenToWorld(e.x, e.y);
        if (this.creativePlacing) {
          this.placeCreativeEntity(world.x, world.y);
        } else {
          this.selectCreativeEntity(world.x, world.y);
        }
        break;
      }
      case 'drag': {
        if (this.creativePlacing) break;
        const a = this.camera.screenToWorld(e.x1, e.y1);
        const b = this.camera.screenToWorld(e.x2, e.y2);
        const entity = this.creativeEntityAt(a.x, a.y);
        if (entity) {
          this.creativeSelectedId = entity.id;
          this.moveCreativeEntity(entity.id, b.x, b.y);
          this.audio.playSfx('ui-click');
        } else {
          this.camera.move(-(e.x2 - e.x1) / this.camera.zoom, -(e.y2 - e.y1) / this.camera.zoom);
        }
        break;
      }
      case 'move': {
        if (this.creativePlacing) {
          this.setCreativePlacing(null);
          break;
        }
        const world = this.camera.screenToWorld(e.x, e.y);
        const entity = this.creativeEntityAt(world.x, world.y);
        if (entity) {
          this.creativeSelectedId = entity.id;
          this.moveCreativeEntity(entity.id, world.x, world.y);
          this.audio.playSfx('ui-click');
        } else if (this.creativeSelectedId !== null) {
          this.moveCreativeEntity(this.creativeSelectedId, world.x, world.y);
          this.audio.playSfx('ui-click');
        }
        break;
      }
      case 'rotate': {
        if (this.creativePlacing && this.creativePlacing.kind === 'structure') {
          this.creativeRotation = (this.creativeRotation + 90) % 360;
          this.audio.playSfx('ui-formation');
        }
        break;
      }
      case 'recruit':
      case 'formation':
        break;
    }
  }

  private updateCreative(dt: number): void {
    this.input.updateCamera(this.camera, dt);
    if (this.creativePaused) return;
    if (this.creativePhase === 'countdown') {
      this.creativeCountdown -= dt;
      const sec = Math.ceil(this.creativeCountdown);
      if (sec !== this.lastCreativeCount) {
        this.lastCreativeCount = sec;
        this.audio.playSfx(sec > 1 ? 'prep-tick' : 'ui-select');
      }
      if (this.creativeCountdown <= 0) {
        this.creativePhase = 'battle';
        this.lastCreativeCount = -1;
        this.creativeBattleFlash = 1;
        this.beginCreativeBattle();
        this.audio.playSfx('wave-start');
      }
      return;
    }
    if (this.creativePhase === 'battle') {
      if (this.creativeBattleFlash > 0) this.creativeBattleFlash = Math.max(0, this.creativeBattleFlash - dt * 1.4);
      this.updateCreativeBattle(dt * this.creativeSpeed);
    }
  }

  private setCreativeTeam(team: CreativeTeam): void {
    if (this.creativePhase !== 'prep') return;
    this.creativeTeam = team;
    this.ui.setCreativeTeam(team);
    this.ui.setCreativePick(this.creativePlacing);
    this.audio.playSfx('ui-click');
  }

  private setCreativeSpeed(speed: 1 | 2 | 4): void {
    this.creativeSpeed = speed;
    this.ui.setCreativeSpeed(speed);
    this.audio.playSfx('ui-click');
  }

  private handleCreativePick(pick: CreativePick): void {
    if (this.creativePhase !== 'prep') return;
    const same = this.creativePlacing !== null && this.creativePlacing.kind === pick.kind && this.creativePlacing.type === pick.type;
    this.setCreativePlacing(same ? null : pick);
  }

  private setCreativePlacing(pick: CreativePick | null): void {
    this.creativePlacing = pick;
    this.creativeRotation = 0;
    this.creativeSelectedId = null;
    this.ui.setCreativePick(pick);
    if (pick) this.audio.playSfx('ui-select');
  }

  private handleCreativeRemove(): void {
    if (this.creativePhase !== 'prep' || this.creativeSelectedId === null) {
      this.audio.playSfx('ui-denied');
      return;
    }
    this.removeCreativeEntity(this.creativeSelectedId);
    this.creativeSelectedId = null;
    this.audio.playSfx('ui-click');
  }

  private startCreativeBattle(): void {
    if (this.creativePhase !== 'prep' || !this.creativeScenario) return;
    let blue = 0;
    let red = 0;
    for (const e of this.creativeScenario.entities) {
      if (e.team === 'blue') blue++;
      else red++;
    }
    if (blue === 0 || red === 0) {
      this.ui.showToast('MONTE OS DOIS TIMES ANTES DE COMEÇAR', 'alert');
      this.audio.playSfx('ui-denied');
      return;
    }
    let combat = 0;
    for (const e of this.creativeScenario.entities) {
      if (e.kind === 'unit') combat++;
      else if (e.type === 'base' || e.type === 'tower') combat++;
    }
    if (combat === 0) {
      this.ui.showToast('ADICIONE PELO MENOS UMA ENTIDADE DE COMBATE', 'alert');
      this.audio.playSfx('ui-denied');
      return;
    }
    this.creativeSelectedId = null;
    this.setCreativePlacing(null);
    this.creativePhase = 'countdown';
    this.creativeCountdown = 3;
    this.lastCreativeCount = -1;
    this.ui.setCreativeLocked(true);
    this.audio.playSfx('ui-confirm');
  }

  private beginCreativeBattle(): void {
    this.creativeBlueHadBase = this.creativeStructures.some((s) => s.kind === 'base' && s.team === 'player');
    this.creativeRedHadBase = this.creativeStructures.some((s) => s.kind === 'base' && s.team === 'enemy');
    this.creativeBlueEconomy.gold = CONFIG.economy.startingGold;
    this.creativeRedEconomy.gold = CONFIG.economy.startingGold;
    this.creativeKills = { blue: 0, red: 0 };
    this.creativeElapsed = 0;
    this.creativeResultShown = false;
    this.creativePaused = false;
    this.creativeRecruitTimers = { blue: 0, red: 0 };
    this.creativeAi.reset();
    this.creativeBlueAlivePrev = this.creativeUnits.filter((u) => u.alive && u.team === 'player').length;
    this.creativeRedAlivePrev = this.creativeUnits.filter((u) => u.alive && u.team === 'enemy').length;
    for (const u of this.creativeUnits) u.aiControl = true;
    this.ui.setCreativeBattleTime(0);
    this.ui.setCreativeTroopCounts(this.creativeBlueAlivePrev, this.creativeRedAlivePrev);
    this.ui.setCreativeSpeed(this.creativeSpeed);
  }

  private updateCreativeBattle(dt: number): void {
    this.creativeElapsed += dt;
    this.grid.clear();
    for (const u of this.creativeUnits) {
      if (u.alive) this.grid.insert(u);
    }

    const { spawned, hits } = updateCombat(this.creativeUnits, this.creativeStructures, this.grid, this.economy, dt);
    this.projectiles.push(...spawned);
    const towerShots = updateTowers(this.creativeStructures, this.grid, this.projectiles, dt);
    const projHits = updateProjectiles(this.projectiles, dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    const allHits = hits.length > 0 || projHits.length > 0 ? [...hits, ...projHits] : hits;
    if (allHits.length > 0) this.applyHits(allHits);
    this.playCombatSounds(allHits, spawned);
    if (towerShots > 0) this.playSfx('tower', 'tower-shot', 0.06);

    this.creativeAi.update('blue', this.creativeUnits, this.creativeStructures, dt);
    this.creativeAi.update('red', this.creativeUnits, this.creativeStructures, dt);

    updateUnits(this.creativeUnits, this.grid, this.creativeStructures, dt);
    updateCreativeCaptures(this.creativeStructures, this.creativeUnits, dt);

    for (const team of ['blue', 'red'] as CreativeTeam[]) {
      this.creativeRecruitTimers[team] += dt;
      if (this.creativeRecruitTimers[team] >= 2) {
        this.creativeRecruitTimers[team] = 0;
        this.creativeRecruit(team);
      }
      this.updateCreativeEconomy(team, dt);
    }

    for (const u of this.creativeUnits) {
      if (!u.alive) {
        this.pushMarker(u.x, u.y, 'death');
        spawnRing(u.x, u.y, 'rgba(255,100,120,0.6)', u.radius + 2, 0.3);
        spawnSparks(u.x, u.y, 3, u.color, 60, 0.25);
      }
    }
    this.creativeUnits = this.creativeUnits.filter((u) => u.alive);
    this.creativeStructures = this.creativeStructures.filter((s) => s.alive);
    for (const s of this.creativeStructures) if (s.flashTimer > 0) s.flashTimer -= dt;
    this.updateCreativeKills();
    this.ui.setCreativeBattleTime(this.creativeElapsed);
    this.ui.setCreativeTroopCounts(
      this.creativeUnits.filter((u) => u.alive && u.team === 'player').length,
      this.creativeUnits.filter((u) => u.alive && u.team === 'enemy').length,
    );

    if (!this.creativeResultShown) {
      const winner = this.creativeWinner();
      if (winner) {
        this.creativeResultShown = true;
        this.audio.playSfx('wave-start');
        this.showCreativeResult(winner);
      }
    }
  }

  private updateCreativeKills(): void {
    const blueAlive = this.creativeUnits.filter((u) => u.alive && u.team === 'player').length;
    const redAlive = this.creativeUnits.filter((u) => u.alive && u.team === 'enemy').length;
    this.creativeKills.blue += Math.max(0, this.creativeRedAlivePrev - redAlive);
    this.creativeKills.red += Math.max(0, this.creativeBlueAlivePrev - blueAlive);
    this.creativeBlueAlivePrev = blueAlive;
    this.creativeRedAlivePrev = redAlive;
  }

  private updateCreativeEconomy(team: CreativeTeam, dt: number): void {
    const unitTeam = creativeTeamOf(team);
    let income = CONFIG.economy.passiveGoldPerSecond;
    for (const s of this.creativeStructures) {
      if (!s.alive) continue;
      if (s.kind === 'mine' && s.owner === unitTeam) income += CONFIG.mine.goldPerSecond;
      else if (s.kind === 'market' && s.team === unitTeam) income += CONFIG.progression.buildings.market.goldPerSecond;
    }
    const economy = team === 'blue' ? this.creativeBlueEconomy : this.creativeRedEconomy;
    economy.update(dt, income);
  }

  private creativeTroopCap(team: CreativeTeam): number {
    const unitTeam = creativeTeamOf(team);
    let houses = 0;
    for (const s of this.creativeStructures) {
      if (s.alive && s.kind === 'house' && s.team === unitTeam) houses++;
    }
    return 50 + houses * 10;
  }

  private creativeRecruit(team: CreativeTeam): void {
    if (this.creativeResultShown) return;
    const unitTeam = creativeTeamOf(team);
    const economy = team === 'blue' ? this.creativeBlueEconomy : this.creativeRedEconomy;
    const base = this.creativeStructures.find((s) => s.alive && s.kind === 'base' && s.team === unitTeam);
    if (!base) return;
    const count = this.creativeUnits.reduce((acc, u) => acc + (u.alive && u.team === unitTeam ? 1 : 0), 0);
    if (count >= this.creativeTroopCap(team)) return;
    const weights: [PlayerTroopType, number][] = [
      ['knight', 3],
      ['archer', 2],
      ['tank', 2],
      ['champion', 1],
    ];
    let total = 0;
    for (const [, w] of weights) total += w;
    let roll = Math.random() * total;
    let type: PlayerTroopType = 'knight';
    for (const [t, w] of weights) {
      roll -= w;
      if (roll <= 0) {
        type = t;
        break;
      }
    }
    const cost = CONFIG.recruits[type].cost;
    if (economy.gold < cost) return;
    economy.spend(cost);
    const offset = 60 + Math.random() * 30;
    const u = createUnit(unitTeam, type, base.x + (unitTeam === 'enemy' ? offset : -offset), base.y + (Math.random() * 40 - 20));
    u.aiControl = true;
    this.creativeUnits.push(u);
    this.audio.playSfx(RECRUIT_SFX[type]);
  }

  private creativeWinner(): CreativeTeam | null {
    const blueBase = this.creativeStructures.some((s) => s.alive && s.kind === 'base' && s.team === 'player');
    const redBase = this.creativeStructures.some((s) => s.alive && s.kind === 'base' && s.team === 'enemy');
    if (this.creativeBlueHadBase && !blueBase) return 'red';
    if (this.creativeRedHadBase && !redBase) return 'blue';
    const blueAlive = this.creativeUnits.some((u) => u.alive && u.team === 'player');
    const blueTowers = this.creativeStructures.some((s) => s.alive && s.kind === 'tower' && s.team === 'player');
    const redAlive = this.creativeUnits.some((u) => u.alive && u.team === 'enemy');
    const redTowers = this.creativeStructures.some((s) => s.alive && s.kind === 'tower' && s.team === 'enemy');
    if (!blueAlive && !blueTowers && !blueBase) return 'red';
    if (!redAlive && !redTowers && !redBase) return 'blue';
    if (!blueBase && !redBase) {
      if (!blueAlive && !blueTowers) return 'red';
      if (!redAlive && !redTowers) return 'blue';
      if (!blueAlive && !blueTowers && !redAlive && !redTowers) return 'blue';
    }
    return null;
  }

  private showCreativeResult(winner: CreativeTeam): void {
    const blueRemaining = this.creativeUnits.filter((u) => u.alive && u.team === 'player').length;
    const redRemaining = this.creativeUnits.filter((u) => u.alive && u.team === 'enemy').length;
    this.ui.showCreativeResult(
      winner,
      this.creativeElapsed,
      blueRemaining,
      redRemaining,
      this.creativeKills.blue,
      this.creativeKills.red,
      this.creativeKills.red,
      this.creativeKills.blue,
    );
  }

  private retryCreativeBattle(): void {
    const scenario = this.creativeScenario;
    if (!scenario) return;
    this.creativeUnits = [];
    this.creativeStructures = [];
    for (const e of scenario.entities) {
      if (e.kind === 'unit') {
        const u = createCreativeUnit(e);
        u.creativeId = e.id;
        this.creativeUnits.push(u);
      } else {
        const s = createCreativeStructure(e);
        s.creativeId = e.id;
        this.creativeStructures.push(s);
      }
    }
    this.projectiles = [];
    this.markers.length = 0;
    clearEffects();
    this.creativePhase = 'countdown';
    this.creativeCountdown = 3;
    this.lastCreativeCount = -1;
    this.creativeResultShown = false;
    this.creativePaused = false;
    this.ui.setCreativeLocked(true);
    this.screen = 'creative-editor';
    this.ui.showCreativeEditor();
    this.audio.playSfx('ui-confirm');
  }

  private editCreativeScenario(): void {
    const scenario = this.creativeScenario;
    if (!scenario) return;
    this.creativeUnits = [];
    this.creativeStructures = [];
    for (const e of scenario.entities) {
      if (e.kind === 'unit') {
        const u = createCreativeUnit(e);
        u.creativeId = e.id;
        this.creativeUnits.push(u);
      } else {
        const s = createCreativeStructure(e);
        s.creativeId = e.id;
        this.creativeStructures.push(s);
      }
    }
    this.projectiles = [];
    this.markers.length = 0;
    clearEffects();
    this.creativePhase = 'prep';
    this.creativeCountdown = 0;
    this.creativeSelectedId = null;
    this.setCreativePlacing(null);
    this.creativePaused = false;
    this.creativeResultShown = false;
    this.ui.setCreativeLocked(false);
    this.screen = 'creative-editor';
    this.ui.showCreativeEditor();
    this.syncCreativeCounts();
    this.audio.playSfx('ui-confirm');
  }

  private creativeEntityAt(x: number, y: number): CreativeEntity | null {
    const scenario = this.creativeScenario;
    if (!scenario) return null;
    let best: CreativeEntity | null = null;
    let bestSq = Infinity;
    for (const e of scenario.entities) {
      const r = creativeEntityRadius(e);
      const dx = e.x - x;
      const dy = e.y - y;
      const d = dx * dx + dy * dy;
      if (d < r * r && d < bestSq) {
        bestSq = d;
        best = e;
      }
    }
    return best;
  }

  private selectCreativeEntity(x: number, y: number): void {
    const entity = this.creativeEntityAt(x, y);
    this.creativeSelectedId = entity ? entity.id : null;
    if (entity) this.audio.playSfx('ui-select');
  }

  private placeCreativeEntity(x: number, y: number): void {
    const scenario = this.creativeScenario;
    const pick = this.creativePlacing;
    if (!scenario || !pick) return;
    const r = creativePickRadius(pick, this.creativeTeam);
    const cx = Math.max(r, Math.min(scenario.width - r, x));
    const cy = Math.max(r, Math.min(scenario.height - r, y));
    if (!this.creativePlaceValid(cx, cy, r, this.creativeTeam)) {
      this.audio.playSfx('ui-denied');
      return;
    }
    const entity = addCreativeEntity(scenario, this.creativeTeam, pick.kind, pick.type, cx, cy, this.creativeRotation);
    if (entity.kind === 'unit') {
      const u = createCreativeUnit(entity);
      u.creativeId = entity.id;
      this.creativeUnits.push(u);
    } else {
      const s = createCreativeStructure(entity);
      s.creativeId = entity.id;
      this.creativeStructures.push(s);
    }
    this.syncCreativeCounts();
    this.audio.playSfx(pick.kind === 'unit' ? 'ui-select' : 'ui-click');
  }

  private moveCreativeEntity(id: number, x: number, y: number): void {
    const scenario = this.creativeScenario;
    if (!scenario) return;
    const entity = scenario.entities.find((e) => e.id === id);
    if (!entity) return;
    const r = creativeEntityRadius(entity);
    const center = scenario.width / 2;
    let cx = Math.max(r, Math.min(scenario.width - r, x));
    let cy = Math.max(r, Math.min(scenario.height - r, y));
    if (entity.team === 'blue') cx = Math.min(cx, center - r);
    else cx = Math.max(cx, center + r);
    moveCreativeEntity(scenario, id, cx, cy);
    if (entity.kind === 'unit') {
      const u = this.creativeUnits.find((unit) => unit.creativeId === id);
      if (u) {
        u.x = cx;
        u.y = cy;
      }
    } else {
      const s = this.creativeStructures.find((st) => st.creativeId === id);
      if (s) {
        s.x = cx;
        s.y = cy;
      }
    }
  }

  private removeCreativeEntity(id: number): void {
    const scenario = this.creativeScenario;
    if (!scenario) return;
    if (this.creativeUnits.some((u) => u.creativeId === id)) {
      const i = this.creativeUnits.findIndex((u) => u.creativeId === id);
      if (i >= 0) this.creativeUnits.splice(i, 1);
    } else {
      const i = this.creativeStructures.findIndex((s) => s.creativeId === id);
      if (i >= 0) this.creativeStructures.splice(i, 1);
    }
    removeCreativeEntity(scenario, id);
    this.syncCreativeCounts();
  }

  private syncCreativeCounts(): void {
    const scenario = this.creativeScenario;
    if (!scenario) return;
    let blue = 0;
    let red = 0;
    for (const e of scenario.entities) {
      if (e.team === 'blue') blue++;
      else red++;
    }
    this.ui.updateCreativeCounts(blue, red);
  }

  private creativePlaceValid(x: number, y: number, r: number, team: CreativeTeam): boolean {
    const scenario = this.creativeScenario;
    if (!scenario) return false;
    if (x - r < 0 || x + r > scenario.width || y - r < 0 || y + r > scenario.height) return false;
    const center = scenario.width / 2;
    if (team === 'blue' && x >= center) return false;
    if (team === 'red' && x < center) return false;
    for (const e of scenario.entities) {
      const er = creativeEntityRadius(e);
      const dx = e.x - x;
      const dy = e.y - y;
      const min = er + r;
      if (dx * dx + dy * dy < min * min) return false;
    }
    return true;
  }

  private creativeView(): CreativeEditorView {
    let ghost: CreativeGhost | null = null;
    if (this.creativePlacing) {
      const p = this.input.pointerScreen();
      const w = this.camera.screenToWorld(p.x, p.y);
      const r = creativePickRadius(this.creativePlacing, this.creativeTeam);
      const dims = creativePickDims(this.creativePlacing, this.creativeTeam, this.creativeRotation);
      ghost = {
        x: w.x,
        y: w.y,
        valid: this.creativePlaceValid(w.x, w.y, r, this.creativeTeam),
        team: this.creativeTeam,
        unit: this.creativePlacing.kind === 'unit',
        size: r,
        w: dims.w,
        h: dims.h,
      };
    }
    let selected: CreativeSelected | null = null;
    if (this.creativeSelectedId !== null && this.creativeScenario) {
      const e = this.creativeScenario.entities.find((en) => en.id === this.creativeSelectedId);
      if (e) {
        selected = {
          x: e.x,
          y: e.y,
          r: creativeEntityRadius(e),
          color: e.team === 'blue' ? '#38b6ff' : '#ff4655',
          unit: e.kind === 'unit',
        };
      }
    }
    return { phase: this.creativePhase, countdown: this.creativeCountdown, ghost, selected, flash: this.creativeBattleFlash };
  }

  private continentView(): ContinentView {
    return {
      regions: this.continentRegions,
      discovered: continentDiscovered(this.continentRegions),
      total: this.continentRegions.length,
    };
  }

  private storyMapView(): StoryMapView {
    const nodes: StoryMapNode[] = [];
    for (let n = 1; n <= 10; n++) {
      const meta = levelByNumber(n);
      const completed = this.campaign.isCompleted(n);
      const unlocked = this.campaign.isUnlocked(n);
      const stars = this.campaign.starsOf(n);
      let state: 'locked' | 'available' | 'completed';
      if (completed) state = 'completed';
      else if (unlocked) state = 'available';
      else state = 'locked';

      nodes.push({
        number: n,
        x: STORY_MAP_PATH[n - 1].x,
        y: STORY_MAP_PATH[n - 1].y,
        name: meta?.name ?? `Fase ${n}`,
        description: meta?.objective ?? '',
        objective: meta?.objective ?? '',
        biome: meta?.biome ?? 'field',
        stars,
        state,
        icon: STORY_MAP_NODE_ICONS[n] ?? '🏰',
      });
    }

    let completedCount = 0;
    let totalStars = 0;
    for (let n = 1; n <= 10; n++) {
      if (this.campaign.isCompleted(n)) completedCount++;
      totalStars += this.campaign.starsOf(n);
    }

    // Safe area: reserve top for title/progress and the campaign-complete panel,
    // and bottom for the back/reframe buttons.
    const campaignComplete = this.campaign.isComplete();
    const topSafe = campaignComplete ? 140 : 90;
    if (this.storyMapCamera) {
      this.storyMapCamera.setSafeArea(topSafe, 90, 20, 20);
    }

    return {
      nodes,
      hoveredNode: this.storyMapHoveredNode,
      campaignComplete,
      totalStars,
      completedCount,
      time: this.storyMapTime,
      camera: this.storyMapCamera!,
    };
  }

  private storyMapTime = 0;
  private storyMapHoveredNode: number | null = null;

  private handleContinentClick(screenX: number, screenY: number): void {
    const t = continentTransform(window.innerWidth, window.innerHeight);
    const back = regionScreenRect(CONTINENT_BACK_BUTTON, t);
    if (screenX >= back.x && screenX < back.x + back.w && screenY >= back.y && screenY < back.y + back.h) {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
      this.audio.playSfx('ui-click');
      return;
    }
    for (const r of this.continentRegions) {
      const rect = regionScreenRect(r, t);
      if (screenX < rect.x || screenX >= rect.x + rect.w) continue;
      if (screenY < rect.y || screenY >= rect.y + rect.h) continue;
      if (r.phase === 1) {
        this.startAdventure();
      } else {
        this.ui.showToast('EM DESENVOLVIMENTO', 'info');
        this.audio.playSfx('ui-denied');
      }
      return;
    }
  }

  private handleContinentHover(_screenX: number, _screenY: number): void {
    // No-op for now - continent doesn't need hover handling
  }

  private handleStoryMapClick(screenX: number, screenY: number): void {
    if (!this.storyMapCamera) return;
    const h = window.innerHeight;

    const backRect = { x: 20, y: h - 70, w: 120, h: 50 };
    if (screenX >= backRect.x && screenX < backRect.x + backRect.w && screenY >= backRect.y && screenY < backRect.y + backRect.h) {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
      this.audio.playSfx('ui-click');
      return;
    }

    const reframeRect = { x: backRect.x + backRect.w + 10, y: h - 70, w: 50, h: 50 };
    if (screenX >= reframeRect.x && screenX < reframeRect.x + reframeRect.w && screenY >= reframeRect.y && screenY < reframeRect.y + reframeRect.h) {
      this.reframeStoryMap();
      this.audio.playSfx('ui-confirm');
      return;
    }

    const worldPos = this.storyMapCamera.screenToWorld(screenX, screenY);
    const view = this.storyMapView();
    for (const node of view.nodes) {
      const dx = worldPos.x - node.x;
      const dy = worldPos.y - node.y;
      const radius = 36; // map coordinate radius
      if (dx * dx + dy * dy <= radius * radius) {
        if (node.state === 'available' || node.state === 'completed') {
          this.audio.playSfx('ui-confirm');
          this.startStoryLevel(node.number);
        } else if (node.state === 'locked') {
          this.audio.playSfx('ui-denied');
          this.ui.showToast('Fase bloqueada — conclua a fase anterior', 'alert');
        }
        return;
      }
    }
  }

  private handleStoryMapHover(screenX: number, screenY: number): void {
    if (!this.storyMapCamera) return;
    // Suppress hover/tooltip while a drag is in progress
    if (this.input.dragRect) {
      this.storyMapHoveredNode = null;
      return;
    }
    const h = window.innerHeight;

    const backRect = { x: 20, y: h - 70, w: 120, h: 50 };
    if (screenX >= backRect.x && screenX < backRect.x + backRect.w && screenY >= backRect.y && screenY < backRect.y + backRect.h) {
      this.storyMapHoveredNode = -1;
      return;
    }

    const reframeRect = { x: backRect.x + backRect.w + 10, y: h - 70, w: 50, h: 50 };
    if (screenX >= reframeRect.x && screenX < reframeRect.x + reframeRect.w && screenY >= reframeRect.y && screenY < reframeRect.y + reframeRect.h) {
      this.storyMapHoveredNode = -2;
      return;
    }

    const worldPos = this.storyMapCamera.screenToWorld(screenX, screenY);
    const view = this.storyMapView();
    let hovered: number | null = null;
    for (const node of view.nodes) {
      const dx = worldPos.x - node.x;
      const dy = worldPos.y - node.y;
      const radius = 36; // map coordinate radius
      if (dx * dx + dy * dy <= radius * radius) {
        hovered = node.number;
        break;
      }
    }
    this.storyMapHoveredNode = hovered;
  }

  private handleStoryMapKeyboardPan(dt: number): void {
    if (!this.storyMapCamera) return;
    const keys = this.input.keys;
    const moveSpeed = 400 / this.storyMapCamera.getZoom(); // map units per second
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx = (dx / len) * moveSpeed * dt;
      dy = (dy / len) * moveSpeed * dt;
      this.storyMapCamera.move(dx, dy);
    }
  }

  private resetAdventure(): void {
    this.mode = 'adventures';
    this.level = null;
    this.levelNumber = 0;
    this.storyElapsed = 0;
    this.storyRoute = [];
    this.projectiles = [];
    this.storyResultShown = false;
    this.storyOver = false;
    this.adventure = new AdventureLevel();
    this.units = this.adventure.units;
    this.structures = this.adventure.structures;
    this.base = this.structures[0];
    this.adventureElapsed = 0;
    this.adventureOver = false;
    this.adventureResultShown = false;
    this.gameOver = false;
    this.goldDelta = 0;
    this.markers.length = 0;
    clearEffects();
    this.selected.clear();
    this.economy.gold = CONFIG.adventure.startingGold;
    this.playerUnitCount = 0;
    this.progression.reset();
    this.placingBuild = null;
    this.buildPreview = null;
    this.renderedBiome = 'field';
    this.biomeTransition = -1;
    this.lastPrepSec = -1;
    this.lastAliveWalls = -1;
    this.lastAliveTowers = -1;
    this.lastMines = -1;
    this.lastBaseHp = -1;
    this.lastEnemyBaseHp = -1;
    resetAutoFormation();
    this.ui.setMode('adventures');
    this.camera.setWorldSize(CONFIG.adventure.worldW, CONFIG.adventure.worldH);
    this.camera.x = CONFIG.adventure.playerBase.x;
    this.camera.y = CONFIG.adventure.playerBase.y;
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

  private showStoryMap(): void {
    this.screen = 'storymap';
    this.mode = null;
    this.level = null;
    this.storyOver = false;
    this.storyResultShown = false;
    this.ui.setMode('infinite');
    this.ui.showStoryMap();
    this.syncMusic();
    this.setupStoryMapInitialFrame();
  }

  private storyMapFocusNode(): number {
    // Find the next available phase, or the last completed one, or phase 1
    let targetNode = 1;
    for (let n = 1; n <= 10; n++) {
      if (this.campaign.isUnlocked(n) && !this.campaign.isCompleted(n)) {
        targetNode = n;
        break;
      }
      if (this.campaign.isCompleted(n)) {
        targetNode = n;
      }
    }

    // If campaign is complete, focus on phase 10
    if (this.campaign.isComplete()) {
      targetNode = 10;
    }
    return targetNode;
  }

  private setupStoryMapInitialFrame(): void {
    if (!this.storyMapCamera) return;
    const target = STORY_MAP_PATH[this.storyMapFocusNode() - 1];
    this.storyMapCamera.setPositionAndZoom(target.x, target.y, 1.0);
  }

  private reframeStoryMap(): void {
    if (!this.storyMapCamera) return;
    const target = STORY_MAP_PATH[this.storyMapFocusNode() - 1];
    this.storyMapCamera.setTargetPosition(target.x, target.y);
    this.storyMapCamera.setTargetZoom(1.0);
  }

  private resume(): void {
    if (this.creativePaused) {
      this.creativePaused = false;
      this.screen = 'creative-editor';
      this.ui.showCreativeEditor();
      this.audio.playSfx('ui-confirm');
      return;
    }
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
    this.creativePaused = false;
    this.creativeResultShown = false;
    this.creativePhase = 'prep';
    this.audio.stopAmbient();
    this.audio.playSfx('ui-click');
    this.syncMusic();
  }

  private syncMusic(): void {
    if (this.screen === 'menu' || this.screen === 'modes' || this.screen === 'difficulty' || this.screen === 'creative' || this.screen === 'storymap' || this.screen === 'continent') {
      this.audio.playMusic('menu');
    } else {
      this.audio.playMusic('battle');
    }
  }

  private handlePauseKey(): void {
    if (this.mode === 'story' && this.storyResultShown) return;
    if (this.mode === 'adventures' && this.adventureResultShown) return;
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
    } else if (this.screen === 'storymap') {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
    } else if (this.screen === 'creative') {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
    } else if (this.screen === 'creative-editor') {
      if (this.creativePhase === 'battle' || this.creativePhase === 'countdown') {
        if (this.creativeResultShown) return;
        if (this.creativePaused) {
          this.creativePaused = false;
          this.ui.showCreativeEditor();
        } else {
          this.creativePaused = true;
          this.ui.showPause('CRIATIVO — PAUSADO');
        }
      } else {
        this.exitCreativeEditor();
      }
    } else if (this.screen === 'continent') {
      this.screen = 'modes';
      this.ui.showModes();
      this.syncMusic();
    }
  }
}