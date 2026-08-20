import { CONFIG } from '../config';
import { createBaseAt, createEnemyBaseAt, createMineAt, type MineOwner, type Structure } from '../entities/structures';
import { createUnit } from '../entities/unit';
import type { Unit } from '../entities/unit';
import { buildTerritories, type Territory } from './territory';

export interface AdventureRenderData {
  territoryLabels: { x: number; y: number; name: string }[];
  enemyBase: { x: number; y: number; hp: number; maxHp: number };
  playerBase: { x: number; y: number; hp: number; maxHp: number };
  background: HTMLCanvasElement;
  fog: Float32Array;
  fogCols: number;
  fogRows: number;
  fogCell: number;
}

const TERRAIN_TILES = [
  { r: 84, g: 108, b: 60 },
  { r: 76, g: 100, b: 58 },
  { r: 92, g: 116, b: 64 },
  { r: 70, g: 94, b: 56 },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBackground(worldW: number, worldH: number): HTMLCanvasElement {
  const scale = 0.2;
  const bg = document.createElement('canvas');
  bg.width = Math.max(2, Math.round(worldW * scale));
  bg.height = Math.max(2, Math.round(worldH * scale));
  const ctx = bg.getContext('2d')!;
  const rand = mulberry32(1337);

  for (let x = 0; x < bg.width; x++) {
    for (let y = 0; y < bg.height; y++) {
      const tile = TERRAIN_TILES[Math.floor(rand() * TERRAIN_TILES.length)];
      ctx.fillStyle = `rgb(${tile.r},${tile.g},${tile.b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  for (let i = 0; i < 700; i++) {
    const x = rand() * bg.width;
    const y = rand() * bg.height;
    const r = rand() * 2.2 + 0.6;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(34,48,26,0.5)' : 'rgba(52,70,38,0.6)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 26; i++) {
    const x = rand() * bg.width;
    const y = rand() * bg.height;
    const s = 3 + rand() * 5;
    ctx.fillStyle = 'rgba(40,52,32,0.55)';
    ctx.fillRect(x, y, s, s);
    ctx.fillRect(x + s * 0.5, y - s * 0.5, s * 0.7, s * 0.7);
  }

  const pb = CONFIG.adventure.playerBase;
  const eb = CONFIG.adventure.enemyBase;
  const sx = Math.round(pb.x * scale);
  const sy = Math.round(pb.y * scale);
  const ex = Math.round(eb.x * scale);
  const ey = Math.round(eb.y * scale);
  ctx.strokeStyle = 'rgba(58,66,44,0.6)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo((sx + ex) / 2 + (rand() - 0.5) * 30, (sy + ey) / 2 + (rand() - 0.5) * 30, ex, ey);
  ctx.stroke();

  return bg;
}

export class AdventureLevel {
  structures: Structure[];
  units: Unit[];
  fog: Float32Array;
  fogTarget: Float32Array;
  territories: Territory[];
  background: HTMLCanvasElement;
  cols: number;
  rows: number;
  minesCaptured = 0;
  minesTotal: number;

  constructor() {
    const cfg = CONFIG.adventure;
    this.cols = Math.ceil(cfg.worldW / cfg.fogCellSize);
    this.rows = Math.ceil(cfg.worldH / cfg.fogCellSize);
    const n = this.cols * this.rows;
    this.fog = new Float32Array(n);
    this.fogTarget = new Float32Array(n);

    this.structures = [
      createBaseAt(cfg.playerBase.x, cfg.playerBase.y),
      createEnemyBaseAt(cfg.enemyBase.x, cfg.enemyBase.y),
    ];
    const pBase = this.structures[0];
    pBase.hp = cfg.baseHp;
    pBase.maxHp = cfg.baseHp;
    this.placeMines();
    this.minesTotal = this.structures.filter((s) => s.kind === 'mine').length;

    this.units = [];
    for (let i = 0; i < cfg.startingKnights; i++) {
      const u = createUnit('player', 'knight', cfg.playerBase.x + (i - (cfg.startingKnights - 1) / 2) * 34, cfg.playerBase.y + 120);
      u.alive = true;
      u.hp = u.maxHp;
      this.units.push(u);
    }
    this.spawnDefenders();

    this.territories = buildTerritories(cfg.worldW, cfg.worldH);
    this.territories[0].state = 'revealed';
    this.revealTerritory(0, true);

    this.background = buildBackground(cfg.worldW, cfg.worldH);
  }

  private placeMines(): void {
    const rand = mulberry32(99);
    const centers: { x: number; y: number; owner: MineOwner }[] = [
      { x: 1800, y: 2400, owner: 'neutral' },
      { x: 2200, y: 1600, owner: 'neutral' },
      { x: 1300, y: 1900, owner: 'neutral' },
      { x: 2700, y: 2500, owner: 'neutral' },
      { x: 2100, y: 3000, owner: 'neutral' },
      { x: 2900, y: 1250, owner: 'enemy' },
      { x: 2680, y: 560, owner: 'enemy' },
    ];
    for (const c of centers) {
      const m = createMineAt(c.x + (rand() - 0.5) * 160, c.y + (rand() - 0.5) * 160, c.owner);
      m.alive = true;
      m.hp = m.maxHp;
      this.structures.push(m);
    }
  }

  private spawnDefenders(): void {
    const d = CONFIG.adventure.defenders;
    const eb = CONFIG.adventure.enemyBase;
    const types: ('knight' | 'archer' | 'tank')[] = [];
    for (let i = 0; i < d.knights; i++) types.push('knight');
    for (let i = 0; i < d.archers; i++) types.push('archer');
    for (let i = 0; i < d.tanks; i++) types.push('tank');
    types.forEach((type, i) => {
      const a = (i / types.length) * Math.PI * 2;
      const u = createUnit('enemy', type, eb.x + Math.cos(a) * d.ringRadius, eb.y + Math.sin(a) * d.ringRadius);
      u.alive = true;
      u.hp = u.maxHp;
      u.defendPoint = { x: eb.x + Math.cos(a) * d.ringRadius * 0.5, y: eb.y + Math.sin(a) * d.ringRadius * 0.5 };
      u.searchRadius = d.searchRadius;
      this.units.push(u);
    });
  }

  territoryAt(x: number, y: number): Territory {
    return this.territories.find((t) => x >= t.x && y >= t.y && x < t.x + t.w && y < t.y + t.h) ?? this.territories[0];
  }

  revealTerritory(id: number, force: boolean): void {
    const t = this.territories[id];
    if (!t) return;
    if (!force && t.state === 'revealed') return;
    t.state = 'revealed';
    const cfg = CONFIG.adventure;
    const c0x = Math.max(0, Math.floor(t.x / cfg.fogCellSize));
    const c0y = Math.max(0, Math.floor(t.y / cfg.fogCellSize));
    const c1x = Math.min(this.cols - 1, Math.floor((t.x + t.w) / cfg.fogCellSize));
    const c1y = Math.min(this.rows - 1, Math.floor((t.y + t.h) / cfg.fogCellSize));
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        this.fogTarget[cy * this.cols + cx] = 0;
      }
    }
  }

  revealAround(x: number, y: number): void {
    const cfg = CONFIG.adventure;
    const cx0 = Math.max(0, Math.floor((x - cfg.revealRadius) / cfg.fogCellSize));
    const cy0 = Math.max(0, Math.floor((y - cfg.revealRadius) / cfg.fogCellSize));
    const cx1 = Math.min(this.cols - 1, Math.floor((x + cfg.revealRadius) / cfg.fogCellSize));
    const cy1 = Math.min(this.rows - 1, Math.floor((y + cfg.revealRadius) / cfg.fogCellSize));
    const r2 = cfg.revealRadius * cfg.revealRadius;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const px = (cx + 0.5) * cfg.fogCellSize;
        const py = (cy + 0.5) * cfg.fogCellSize;
        const dx = px - x;
        const dy = py - y;
        if (dx * dx + dy * dy <= r2) {
          this.fogTarget[cy * this.cols + cx] = 0;
        }
      }
    }
  }

  update(dt: number): void {
    const n = this.fog.length;
    for (let i = 0; i < n; i++) {
      if (this.fog[i] > 0 && this.fogTarget[i] === 0) {
        this.fog[i] = Math.max(0, this.fog[i] - CONFIG.adventure.revealSpeed * dt);
      }
    }
    for (const u of this.units) {
      if (!u.alive) continue;
      this.revealAround(u.x, u.y);
      const t = this.territoryAt(u.x, u.y);
      if (t.state === 'unknown') this.revealTerritory(t.id, false);
    }
    for (const s of this.structures) {
      if (!s.alive) continue;
      if (s.kind === 'mine' || s.kind === 'base') {
        const t = this.territoryAt(s.x, s.y);
        if (t.state === 'unknown') this.revealTerritory(t.id, false);
      }
    }
    this.updateMineCapture(dt);
  }

  private updateMineCapture(dt: number): void {
    const cfg = CONFIG.adventure.capture;
    const radiusSq = cfg.radius * cfg.radius;
    for (const s of this.structures) {
      if (s.kind !== 'mine' || !s.alive || s.owner === 'player') continue;
      let nearby = false;
      for (const u of this.units) {
        if (!u.alive || u.team !== 'player') continue;
        const dx = u.x - s.x;
        const dy = u.y - s.y;
        if (dx * dx + dy * dy <= radiusSq) {
          nearby = true;
          break;
        }
      }
      if (nearby) {
        s.captureProgress = (s.captureProgress ?? 0) + dt;
        if (s.captureProgress >= cfg.time) {
          s.captureProgress = 0;
          s.owner = 'player';
          s.color = CONFIG.mine.color;
          this.minesCaptured++;
        }
      } else {
        s.captureProgress = Math.max(0, (s.captureProgress ?? 0) - dt * 1.5);
      }
    }
  }

  renderData(): AdventureRenderData {
    const playerBase = this.structures[0];
    const enemyBase = this.structures[1];
    return {
      territoryLabels: this.territories
        .filter((t) => t.state === 'revealed')
        .map((t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2, name: t.name })),
      enemyBase: { x: enemyBase.x, y: enemyBase.y, hp: enemyBase.hp, maxHp: enemyBase.maxHp },
      playerBase: { x: playerBase.x, y: playerBase.y, hp: playerBase.hp, maxHp: playerBase.maxHp },
      background: this.background,
      fog: this.fog,
      fogCols: this.cols,
      fogRows: this.rows,
      fogCell: CONFIG.adventure.fogCellSize,
    };
  }
}