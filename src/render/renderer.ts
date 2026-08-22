import type { Camera } from '../camera/camera';
import { BIOMES } from '../biomes/biomes';
import type { BiomeId } from '../biomes/biomes';
import { CONFIG } from '../config';
import type { Projectile } from '../combat/projectile';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';
import { drawEffects } from '../effects';
import type { AdventureRenderData } from '../adventure/adventure';
import {
  CONTINENT_BACK_BUTTON,
  CONTINENT_DESIGN_H,
  CONTINENT_DESIGN_W,
  continentTransform,
  regionScreenRect,
  type ContinentView,
} from '../adventure/continent';

interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EMPTY_SELECTED: ReadonlySet<Unit> = new Set<Unit>();

export interface WorldMarker {
  x: number;
  y: number;
  age: number;
  duration: number;
  kind: 'move' | 'recruit' | 'denied' | 'hit' | 'damage' | 'death';
  text?: string;
}

export interface RenderOverlay {
  alpha: number;
  title: string;
  subtitle: string;
  progress: number;
  tint: string;
  icon: string;
}

export interface BuildPreview {
  x: number;
  y: number;
  kind: 'house' | 'market' | 'tower';
  valid: boolean;
}

export interface CreativeGhost {
  x: number;
  y: number;
  valid: boolean;
  team: 'blue' | 'red';
  unit: boolean;
  size: number;
  w: number;
  h: number;
}

export interface CreativeSelected {
  x: number;
  y: number;
  r: number;
  color: string;
  unit: boolean;
}

export interface CreativeEditorView {
  phase: 'prep' | 'countdown' | 'battle';
  countdown: number;
  ghost: CreativeGhost | null;
  selected: CreativeSelected | null;
  flash?: number;
}

export interface StoryMapNode {
  number: number;
  x: number;
  y: number;
  name: string;
  description: string;
  objective: string;
  biome: string;
  stars: number;
  state: 'locked' | 'available' | 'completed';
  icon: string;
}

export interface StoryMapChapter {
  range: [number, number];
  label: string;
  color: string;
  bgColor: string;
}

export interface StoryMapView {
  nodes: StoryMapNode[];
  hoveredNode: number | null;
  campaignComplete: boolean;
  totalStars: number;
  completedCount: number;
  time: number;
  camera: StoryMapCamera;
}

export class StoryMapCamera {
  x: number;
  y: number;
  zoom: number;
  private targetX: number;
  private targetY: number;
  private targetZoom: number;
  private viewWidth: number;
  private viewHeight: number;
  private mapW: number;
  private mapH: number;
  private minZoom: number;
  private maxZoom: number;
  private safeTop = 90;
  private safeBottom = 90;
  private safeLeft = 20;
  private safeRight = 20;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCamX = 0;
  private dragStartCamY = 0;
  private isDragging = false;

  constructor(viewWidth: number, viewHeight: number, mapW: number, mapH: number) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.mapW = mapW;
    this.mapH = mapH;
    this.minZoom = 0.5;
    this.maxZoom = 2.0;
    this.x = mapW / 2;
    this.y = mapH / 2;
    this.zoom = 1.0;
    this.targetX = this.x;
    this.targetY = this.y;
    this.targetZoom = this.zoom;
  }

  setViewSize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
  }

  setMapSize(mapW: number, mapH: number): void {
    this.mapW = mapW;
    this.mapH = mapH;
    this.clampPosition();
  }

  setSafeArea(top: number, bottom: number, left: number, right: number): void {
    this.safeTop = top;
    this.safeBottom = bottom;
    this.safeLeft = left;
    this.safeRight = right;
  }

  // Clamp a value to the range [a, b] regardless of ordering
  private clampRange(v: number, a: number, b: number): number {
    return Math.max(Math.min(a, b), Math.min(Math.max(a, b), v));
  }

  // Keep the camera such that the map edges stay within the safe screen region.
  private clampPosition(): void {
    const zoom = this.zoom;
    const xTop = (this.viewWidth / 2 - this.safeLeft) / zoom;
    const xBottom = this.mapW - (this.viewWidth / 2 - this.safeRight) / zoom;
    const yTop = (this.viewHeight / 2 - this.safeTop) / zoom;
    const yBottom = this.mapH - (this.viewHeight / 2 - this.safeBottom) / zoom;
    this.x = this.clampRange(this.x, xTop, xBottom);
    this.y = this.clampRange(this.y, yTop, yBottom);
  }

  setTargetPosition(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    const zoom = this.zoom;
    const xTop = (this.viewWidth / 2 - this.safeLeft) / zoom;
    const xBottom = this.mapW - (this.viewWidth / 2 - this.safeRight) / zoom;
    const yTop = (this.viewHeight / 2 - this.safeTop) / zoom;
    const yBottom = this.mapH - (this.viewHeight / 2 - this.safeBottom) / zoom;
    this.targetX = this.clampRange(this.targetX, xTop, xBottom);
    this.targetY = this.clampRange(this.targetY, yTop, yBottom);
  }

  setTargetZoom(zoom: number, sx?: number, sy?: number): void {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    if (sx !== undefined && sy !== undefined) {
      const before = this.screenToWorld(sx, sy);
      this.targetZoom = newZoom;
      const after = this.screenToWorld(sx, sy);
      this.targetX += before.x - after.x;
      this.targetY += before.y - after.y;
    } else {
      this.targetZoom = newZoom;
    }
    this.clampTarget();
  }

  private clampTarget(): void {
    const zoom = this.targetZoom;
    const xTop = (this.viewWidth / 2 - this.safeLeft) / zoom;
    const xBottom = this.mapW - (this.viewWidth / 2 - this.safeRight) / zoom;
    const yTop = (this.viewHeight / 2 - this.safeTop) / zoom;
    const yBottom = this.mapH - (this.viewHeight / 2 - this.safeBottom) / zoom;
    this.targetX = this.clampRange(this.targetX, xTop, xBottom);
    this.targetY = this.clampRange(this.targetY, yTop, yBottom);
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.setTargetZoom(this.zoom * factor, sx, sy);
  }

  move(dx: number, dy: number): void {
    this.setTargetPosition(this.x + dx / this.zoom, this.y + dy / this.zoom);
  }

  startDrag(sx: number, sy: number): void {
    this.isDragging = true;
    this.dragStartX = sx;
    this.dragStartY = sy;
    this.dragStartCamX = this.x;
    this.dragStartCamY = this.y;
  }

  drag(sx: number, sy: number): void {
    if (!this.isDragging) return;
    const dx = (this.dragStartX - sx) / this.zoom;
    const dy = (this.dragStartY - sy) / this.zoom;
    this.setTargetPosition(this.dragStartCamX + dx, this.dragStartCamY + dy);
  }

  endDrag(): void {
    this.isDragging = false;
  }

  update(dt: number): void {
    const lerp = 1 - Math.pow(0.001, dt);
    this.x += (this.targetX - this.x) * lerp;
    this.y += (this.targetY - this.y) * lerp;
    this.zoom += (this.targetZoom - this.zoom) * lerp;
    this.clampPosition();
  }

  // Instantly set position and zoom (for initial framing / reframe button)
  setPositionAndZoom(x: number, y: number, zoom: number): void {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = zoom;
    this.clampPosition();
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewHeight / 2) / this.zoom + this.y,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewWidth / 2,
      y: (wy - this.y) * this.zoom + this.viewHeight / 2,
    };
  }

  focusOn(wx: number, wy: number): void {
    this.setTargetPosition(wx, wy);
  }

  isDraggingActive(): boolean {
    return this.isDragging;
  }

  getZoom(): number {
    return this.zoom;
  }
}

export type MenuVariant = 'menu' | 'modes' | 'story' | 'creative';

interface MenuParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  rate: number;
  phase: number;
  hue: number;
  depth: number;
}

interface MenuOrb {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: number;
  depth: number;
  phase: number;
}

interface MenuGear {
  x: number;
  y: number;
  r: number;
  spin: number;
  speed: number;
  hue: number;
  depth: number;
}

interface ContinentParticle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  phase: number;
  alpha: number;
  glow: boolean;
}

interface ContinentTwinkle {
  x: number;
  y: number;
  phase: number;
}

const CONTINENT_RIVER: { x: number; y: number }[] = [
  { x: 760, y: 118 },
  { x: 730, y: 198 },
  { x: 644, y: 288 },
  { x: 562, y: 378 },
  { x: 505, y: 468 },
  { x: 470, y: 553 },
  { x: 490, y: 638 },
  { x: 560, y: 708 },
  { x: 600, y: 790 },
];

const CONTINENT_ROAD: { x: number; y: number }[] = [
  { x: 255, y: 525 },
  { x: 410, y: 430 },
  { x: 560, y: 330 },
  { x: 700, y: 220 },
  { x: 785, y: 340 },
  { x: 855, y: 530 },
];

const ROAD_INDEX: Record<number, number> = { 1: 0, 2: 3, 3: 5 };

export const STORY_MAP_DESIGN_W = 1200;
export const STORY_MAP_DESIGN_H = 900;

export const STORY_MAP_PATH: { x: number; y: number }[] = [
  { x: 180, y: 720 },
  { x: 280, y: 580 },
  { x: 420, y: 480 },
  { x: 560, y: 360 },
  { x: 700, y: 280 },
  { x: 840, y: 380 },
  { x: 960, y: 260 },
  { x: 980, y: 130 },
  { x: 860, y: 100 },
  { x: 740, y: 140 },
];

export const STORY_MAP_NODE_ICONS: Record<number, string> = {
  1: '🛡️',
  2: '🏰',
  3: '🏹',
  4: '⚔️',
  5: '🛡️',
  6: '🗡️',
  7: '⛏️',
  8: '🏰',
  9: '🪖',
  10: '👑',
};

const BG_SCALE = 0.2;
const HUE_CYCLE: readonly number[] = [355, 25, 46, 355, 285, 355];
const HUE_PERIOD = 22;

function menuHue(t: number): number {
  const u = (t % HUE_PERIOD) / HUE_PERIOD;
  const seg = u * (HUE_CYCLE.length - 1);
  const i = Math.min(HUE_CYCLE.length - 2, Math.floor(seg));
  const f = seg - i;
  return (HUE_CYCLE[i] + (HUE_CYCLE[i + 1] - HUE_CYCLE[i]) * f) % 360;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function star5(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const aOut = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const aIn = aOut + Math.PI / 5;
    if (i === 0) ctx.moveTo(cx + Math.cos(aOut) * outer, cy + Math.sin(aOut) * outer);
    else ctx.lineTo(cx + Math.cos(aOut) * outer, cy + Math.sin(aOut) * outer);
    ctx.lineTo(cx + Math.cos(aIn) * inner, cy + Math.sin(aIn) * inner);
  }
  ctx.closePath();
  ctx.fill();
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blobPoints(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  n: number,
  jitter: number,
  rand: () => number,
  rot = 0,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = 1 + (rand() - 0.5) * jitter;
    pts.push({ x: cx + Math.cos(a) * rx * rr, y: cy + Math.sin(a) * ry * rr });
  }
  return pts;
}

function scalePoly(pts: { x: number; y: number }[], cx: number, cy: number, k: number): { x: number; y: number }[] {
  return pts.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
}

function polyPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
    else ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.closePath();
}

function traceCurve(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgBiome: BiomeId | null = null;
  private continentBg: HTMLCanvasElement | null = null;
  private menuTime = 0;
  private menuVariant: MenuVariant | null = null;
  private menuParticles: MenuParticle[] = [];
  private menuOrbs: MenuOrb[] = [];
  private menuGears: MenuGear[] = [];
  private menuMouseX = 0.5;
  private menuMouseY = 0.5;
  private fogTime = 0;
  private continentFog: HTMLCanvasElement | null = null;
  private fogKey = '';
  private twinkleKey = '';
  private continentParticles: ContinentParticle[] = [];
  private continentTwinkles: ContinentTwinkle[] = [];
  private continentReveal = new Map<number, number>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0) {
        this.menuMouseX = (e.clientX - rect.left) / rect.width;
        this.menuMouseY = (e.clientY - rect.top) / rect.height;
      }
    });
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  render(
    camera: Camera,
    units: Unit[],
    structures: Structure[],
    selected: ReadonlySet<Unit>,
    dragRect: DragRect | null,
    markers: WorldMarker[],
    biome: BiomeId,
    overlay: RenderOverlay | null = null,
    projectiles: Projectile[] = [],
    route: { x: number; y: number }[] | null = null,
    cart: Structure | null = null,
    adventure: AdventureRenderData | null = null,
    buildPreview: BuildPreview | null = null,
  ): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BIOMES[biome].background;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (adventure) {
      this.fogTime += 0.016;
      this.drawAdventureBackground(adventure);
      this.drawTerritoryLabels(adventure);
      this.drawFog(adventure);
    } else {
      this.drawBiomeBackground(biome);
      this.drawGrid(camera, biome);
    }
    this.drawRoad(route);
    for (const s of structures) {
      if (s.alive) this.drawStructure(s);
      else this.drawRubble(s);
    }
    if (adventure) this.drawAdventureObjective(adventure);
    this.drawCart(cart);
    this.drawUnits(camera, units, selected);
    this.drawProjectiles(projectiles);
    drawEffects(ctx);
    this.drawMarkers(markers);
    this.drawSelectionGroup(selected);
    if (buildPreview) this.drawBuildPreview(buildPreview);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (dragRect) this.drawSelectionRect(dragRect);
    if (overlay) this.drawOverlay(overlay);
  }

  renderCreativeEditor(
    camera: Camera,
    units: Unit[],
    structures: Structure[],
    view: CreativeEditorView,
    projectiles?: Projectile[],
    markers?: WorldMarker[],
  ): void {
    this.render(camera, units, structures, EMPTY_SELECTED, null, markers ?? [], 'field', null, projectiles ?? [], null, null, null, null);
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(w / 2, h / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (view.phase === 'prep') {
      const worldW = CONFIG.world.width;
      const worldH = CONFIG.world.height;
      const cx = worldW / 2;
      const cy = worldH / 2;
      ctx.fillStyle = 'rgba(56, 182, 255, 0.05)';
      ctx.fillRect(0, 0, cx, worldH);
      ctx.fillStyle = 'rgba(255, 70, 85, 0.05)';
      ctx.fillRect(cx, 0, worldW - cx, worldH);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(cx - 90, cy - 90, 180, 180);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - 90, cy - 90, 180, 180);

      const st = performance.now() / 1000;
      ctx.setLineDash([10, 12]);
      ctx.lineDashOffset = -((st * 18) % 22);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, worldH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(56, 182, 255, 0.8)';
      ctx.fillText('🔵 AZUL', cx - 210, cy);
      ctx.fillStyle = 'rgba(255, 70, 85, 0.8)';
      ctx.fillText('🔴 VERMELHO', cx + 210, cy);
    }

    if (view.selected) {
      const s = view.selected;
      const st = performance.now() / 1000;
      const pulse = 0.5 + 0.5 * Math.sin(st * 4);
      const r = s.r + 7 + pulse * 3;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = s.unit ? 'rgba(56, 182, 255, 0.95)' : 'rgba(255, 209, 102, 0.95)';
      ctx.fillText(s.unit ? '🪖' : '🏰', s.x, s.y - r - 12);
    }

    if (view.ghost) {
      const g = view.ghost;
      const ok = g.valid;
      ctx.strokeStyle = ok ? (g.team === 'blue' ? 'rgba(56, 182, 255, 0.9)' : 'rgba(255, 70, 85, 0.9)') : 'rgba(255, 80, 80, 0.9)';
      ctx.fillStyle = ok ? (g.team === 'blue' ? 'rgba(56, 182, 255, 0.22)' : 'rgba(255, 70, 85, 0.22)') : 'rgba(255, 80, 80, 0.15)';
      ctx.lineWidth = 2;
      if (g.unit) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, Math.max(10, g.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
        ctx.fill();
        ctx.stroke();
      }
    }

    for (const u of units) {
      if (!u.alive) continue;
      const rgb = u.team === 'player' ? '56, 182, 255' : '255, 70, 85';
      const isBoss = u.troopType === 'boss';
      if (isBoss) {
        ctx.strokeStyle = `rgba(${rgb}, 0.8)`;
        ctx.lineWidth = 3;
        ctx.shadowColor = `rgba(${rgb}, 0.9)`;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = `rgba(${rgb}, 0.6)`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(${rgb}, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(u.x, u.y - u.radius - (isBoss ? 20 : 16));
      ctx.lineTo(u.x + 7, u.y - u.radius - (isBoss ? 11 : 8));
      ctx.lineTo(u.x - 7, u.y - u.radius - (isBoss ? 11 : 8));
      ctx.closePath();
      ctx.fill();
    }
    for (const s of structures) {
      if (!s.alive || s.kind === 'wall' || s.kind === 'mine' || s.kind === 'cart') continue;
      const rgb = s.team === 'player' ? '56, 182, 255' : '255, 70, 85';
      ctx.strokeStyle = `rgba(${rgb}, 0.55)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${rgb}, 0.9)`;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.radius - 12);
      ctx.lineTo(s.x + 6, s.y - s.radius - 6);
      ctx.lineTo(s.x - 6, s.y - s.radius - 6);
      ctx.closePath();
      ctx.fill();
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (view.phase === 'countdown') {
      const n = Math.max(1, Math.ceil(view.countdown));
      ctx.fillStyle = 'rgba(6, 9, 14, 0.45)';
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 130px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 209, 102, 0.92)';
      ctx.shadowColor = 'rgba(255, 209, 102, 0.8)';
      ctx.shadowBlur = 42;
      ctx.fillText(String(n), w / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 24px "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillText('PREPARE-SE', w / 2, h / 2 + 96);
    } else if (view.phase === 'battle' && view.flash && view.flash > 0) {
      const f = Math.max(0, Math.min(1, view.flash));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * Math.max(0, f - 0.7)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const scale = 0.8 + 0.2 * (1 - f);
      ctx.translate(w / 2, h / 2);
      ctx.scale(scale, scale);
      ctx.translate(-w / 2, -h / 2);
      ctx.font = 'bold 64px "Segoe UI", sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${f * 0.95})`;
      ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';
      ctx.shadowBlur = 30;
      ctx.fillText('⚔️ BATALHA!', w / 2, h / 2);
      ctx.shadowBlur = 0;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
  }

  renderContinent(dt: number, view: ContinentView): void {
    this.ensureContinentBg();
    this.ensureContinentParticles();
    this.fogTime += dt;
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#081a27');
    sky.addColorStop(0.6, '#0a2230');
    sky.addColorStop(1, '#06151f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    for (const r of view.regions) {
      if (r.state === 'unknown') {
        this.continentReveal.delete(r.id);
      } else {
        const p = this.continentReveal.get(r.id) ?? 0;
        if (p < 1) this.continentReveal.set(r.id, Math.min(1, p + dt * 0.55));
      }
    }

    const t = continentTransform(w, h);
    if (this.continentBg) {
      ctx.drawImage(this.continentBg, t.ox, t.oy, CONTINENT_DESIGN_W * t.scale, CONTINENT_DESIGN_H * t.scale);
    }
    this.drawContinentRoads(t, view.regions);
    for (const r of view.regions) {
      if (r.state === 'unknown') continue;
      this.drawContinentRegion(r, t);
    }
    this.drawContinentAtmosphere(dt, t, view.regions);
    this.drawContinentFog(t, view.regions);
    this.drawContinentVignette();
    this.drawContinentHeader(view);
    this.drawContinentBackButton(t);
  }

  private ensureContinentBg(): void {
    if (this.continentBg) return;
    const bg = document.createElement('canvas');
    bg.width = CONTINENT_DESIGN_W;
    bg.height = CONTINENT_DESIGN_H;
    const ctx = bg.getContext('2d')!;
    const rand = mulberry32(4242);
    const W = bg.width;
    const H = bg.height;

    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0a2432');
    sea.addColorStop(0.55, '#0d2c3c');
    sea.addColorStop(1, '#081d2a');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(6, 22, 32, 0.55)';
    for (let i = 0; i < 70; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 26 + rand() * 110;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(40, 80, 96, 0.06)';
    for (let i = 0; i < 180; i++) {
      const x = rand() * W;
      const y = rand() * H;
      ctx.beginPath();
      ctx.arc(x, y, rand() * 1.6 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const land: [number, number, number, number, number][] = [
      [560, 400, 470, 330, 0.42],
      [300, 210, 250, 150, 0.5],
      [720, 160, 260, 130, 0.45],
      [880, 400, 220, 260, 0.5],
      [560, 660, 360, 120, 0.55],
      [260, 560, 200, 150, 0.5],
    ];

    ctx.fillStyle = '#0d241d';
    for (const [cx, cy, rx, ry, j] of land) {
      polyPath(ctx, blobPoints(cx, cy, rx + 18, ry + 18, 16, j, rand, rand() * 0.4));
      ctx.fill();
    }
    ctx.fillStyle = '#163c2e';
    for (const [cx, cy, rx, ry, j] of land) {
      polyPath(ctx, blobPoints(cx, cy, rx, ry, 16, j, rand, rand() * 0.4));
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(38, 82, 60, 0.55)';
    for (const [cx, cy, rx, ry, j] of land) {
      polyPath(ctx, blobPoints(cx, cy, rx * 0.9, ry * 0.88, 16, j, rand, rand() * 0.4));
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(52, 104, 72, 0.42)';
    for (let i = 0; i < 26; i++) {
      polyPath(ctx, blobPoints(120 + rand() * 940, 80 + rand() * 620, 20 + rand() * 50, 14 + rand() * 34, 8, 0.4, rand));
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(8, 26, 18, 0.4)';
    for (let i = 0; i < 20; i++) {
      polyPath(ctx, blobPoints(140 + rand() * 900, 100 + rand() * 580, 16 + rand() * 40, 12 + rand() * 26, 8, 0.45, rand));
      ctx.fill();
    }

    const forests: [number, number, number][] = [
      [210, 475, 55],
      [300, 560, 45],
      [250, 430, 40],
      [820, 480, 45],
      [890, 520, 40],
      [760, 435, 35],
      [560, 185, 40],
      [630, 235, 34],
      [470, 130, 34],
    ];
    for (const [fx, fy, fr] of forests) {
      const n = 6 + Math.floor(rand() * 5);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * fr;
        const tx = fx + Math.cos(a) * d;
        const ty = fy + Math.sin(a) * d;
        const s = 5 + rand() * 7;
        ctx.fillStyle = 'rgba(6, 18, 12, 0.5)';
        ctx.beginPath();
        ctx.arc(tx + 1.5, ty + 2.5, s + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#12392a';
        ctx.beginPath();
        ctx.arc(tx, ty, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e5238';
        ctx.beginPath();
        ctx.arc(tx - s * 0.28, ty - s * 0.3, s * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const ridges: [number, number, number][] = [
      [620, 130, 140],
      [360, 108, 95],
      [900, 175, 74],
    ];
    for (const [rx0, ry0, rw] of ridges) {
      for (let i = 0; i < 6; i++) {
        const mx = rx0 - rw + (i + 0.5) * ((rw * 2) / 6);
        const mh = rw * 0.42 * (0.6 + rand() * 0.7);
        const mw = rw * 0.3;
        ctx.fillStyle = 'rgba(5, 14, 18, 0.5)';
        ctx.beginPath();
        ctx.moveTo(mx - mw, ry0);
        ctx.lineTo(mx + 3, ry0 - mh);
        ctx.lineTo(mx + mw + 3, ry0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#5b6a75';
        ctx.beginPath();
        ctx.moveTo(mx - mw, ry0);
        ctx.lineTo(mx, ry0 - mh);
        ctx.lineTo(mx + mw, ry0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#e8eef2';
        ctx.beginPath();
        ctx.moveTo(mx - mw * 0.28, ry0 - mh * 0.7);
        ctx.lineTo(mx, ry0 - mh);
        ctx.lineTo(mx + mw * 0.28, ry0 - mh * 0.7);
        ctx.closePath();
        ctx.fill();
      }
    }

    const lake = blobPoints(430, 556, 62, 44, 12, 0.32, rand);
    ctx.fillStyle = 'rgba(122, 102, 66, 0.3)';
    polyPath(ctx, scalePoly(lake, 430, 556, 1.16));
    ctx.fill();
    ctx.fillStyle = '#123f4d';
    polyPath(ctx, lake);
    ctx.fill();
    ctx.fillStyle = '#1c5a6e';
    polyPath(ctx, scalePoly(lake, 430, 556, 0.66));
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 214, 234, 0.16)';
    polyPath(ctx, scalePoly(lake, 430, 556, 0.4));
    ctx.fill();

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(122, 102, 66, 0.3)';
    ctx.lineWidth = 16;
    traceCurve(ctx, CONTINENT_RIVER);
    ctx.stroke();
    ctx.strokeStyle = '#123f4d';
    ctx.lineWidth = 10;
    traceCurve(ctx, CONTINENT_RIVER);
    ctx.stroke();
    ctx.strokeStyle = '#1c5a6e';
    ctx.lineWidth = 5;
    traceCurve(ctx, CONTINENT_RIVER);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(96, 76, 50, 0.24)';
    ctx.lineWidth = 8;
    traceCurve(ctx, CONTINENT_ROAD);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150, 124, 84, 0.14)';
    ctx.lineWidth = 3.4;
    traceCurve(ctx, CONTINENT_ROAD);
    ctx.stroke();

    this.continentBg = bg;
  }

  private ensureContinentParticles(): void {
    if (this.continentParticles.length > 0) return;
    const rand = mulberry32(999);
    for (let i = 0; i < 38; i++) {
      this.continentParticles.push({
        x: rand() * CONTINENT_DESIGN_W,
        y: rand() * CONTINENT_DESIGN_H,
        size: 0.7 + rand() * 1.7,
        speed: 3.5 + rand() * 8,
        drift: (rand() - 0.5) * 9,
        phase: rand() * Math.PI * 2,
        alpha: 0.12 + rand() * 0.24,
        glow: rand() < 0.24,
      });
    }
  }

  private drawContinentRoads(t: { scale: number; ox: number; oy: number }, regions: ContinentView['regions']): void {
    const known = regions
      .filter((r) => r.state !== 'unknown' && r.phase !== null)
      .sort((a, b) => (a.phase as number) - (b.phase as number));
    const { ctx } = this;
    for (let i = 0; i < known.length - 1; i++) {
      const ia = ROAD_INDEX[known[i].phase as number];
      const ib = ROAD_INDEX[known[i + 1].phase as number];
      if (ia === undefined || ib === undefined) continue;
      const seg = CONTINENT_ROAD.slice(Math.min(ia, ib), Math.max(ia, ib) + 1).map((p) => ({
        x: t.ox + p.x * t.scale,
        y: t.oy + p.y * t.scale,
      }));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255, 214, 150, 0.08)';
      ctx.lineWidth = 14 * t.scale;
      traceCurve(ctx, seg);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(96, 74, 48, 0.78)';
      ctx.lineWidth = 7 * t.scale;
      traceCurve(ctx, seg);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140, 110, 72, 0.5)';
      ctx.lineWidth = 3.4 * t.scale;
      traceCurve(ctx, seg);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 226, 178, 0.3)';
      ctx.lineWidth = 1.3 * t.scale;
      ctx.setLineDash([4 * t.scale, 9 * t.scale]);
      ctx.lineDashOffset = -this.fogTime * 16 * t.scale;
      traceCurve(ctx, seg);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      this.drawRoadNode(seg[0], i === 0);
    }
  }

  private drawRoadNode(p: { x: number; y: number }, bright: boolean): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(this.fogTime * 1.6);
    ctx.strokeStyle = bright ? `rgba(255, 214, 150, ${0.35 + 0.25 * pulse})` : 'rgba(255, 214, 150, 0.2)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(96, 74, 48, 0.7)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawContinentRegion(r: ContinentView['regions'][number], t: { scale: number; ox: number; oy: number }): void {
    const { ctx } = this;
    const rect = regionScreenRect(r, t);
    const palette =
      r.state === 'completed'
        ? {
            fillA: 'rgba(61, 220, 132, 0.10)',
            fillB: 'rgba(61, 220, 132, 0.015)',
            border: 'rgba(61, 220, 132, 0.55)',
            text: '#3ddc84',
            glow: 'rgba(61, 220, 132, 0.55)',
          }
        : r.state === 'development'
          ? {
              fillA: 'rgba(255, 209, 102, 0.06)',
              fillB: 'rgba(255, 209, 102, 0.01)',
              border: 'rgba(255, 209, 102, 0.28)',
              text: '#c9a45a',
              glow: 'rgba(255, 209, 102, 0.22)',
            }
          : {
              fillA: 'rgba(56, 182, 255, 0.12)',
              fillB: 'rgba(56, 182, 255, 0.02)',
              border: 'rgba(56, 182, 255, 0.6)',
              text: '#6ec8ff',
              glow: 'rgba(56, 182, 255, 0.6)',
            };

    const corner = 14 * Math.max(0.6, t.scale);
    const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    grad.addColorStop(0, palette.fillA);
    grad.addColorStop(1, palette.fillB);
    ctx.fillStyle = grad;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, corner);
    ctx.fill();
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1.6 * Math.max(0.7, t.scale);
    roundRectPath(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, corner);
    ctx.stroke();

    const cx = rect.x + rect.w / 2;
    const float = Math.sin(this.fogTime * 1.3 + r.id * 2.1) * 3 * t.scale;
    const iconY = rect.y + rect.h * 0.3 + float;

    if (r.state === 'available') {
      const pulse = 0.5 + 0.5 * Math.sin(this.fogTime * 2.2);
      ctx.strokeStyle = palette.glow;
      ctx.globalAlpha = 0.5 + 0.3 * pulse;
      ctx.lineWidth = 1.8 * t.scale;
      ctx.beginPath();
      ctx.arc(cx, iconY, rect.w * 0.2 + (7 + 4 * pulse) * t.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (r.state === 'completed') {
      const g = ctx.createRadialGradient(cx, iconY, 0, cx, iconY, 27 * t.scale);
      g.addColorStop(0, 'rgba(61, 220, 132, 0.26)');
      g.addColorStop(1, 'rgba(61, 220, 132, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, iconY, 27 * t.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(15, Math.round(24 * t.scale))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
    ctx.fillText(r.icon, cx, iconY);

    ctx.font = `bold ${Math.max(11, Math.round(15 * t.scale))}px "Segoe UI", sans-serif`;
    ctx.fillStyle = palette.text;
    ctx.fillText(r.phaseLabel, cx, rect.y + rect.h * 0.56);

    const badge =
      r.state === 'completed' ? '✅ CONCLUÍDA' : r.state === 'development' ? '🔒 EM DESENVOLVIMENTO' : '🎯 DISPONÍVEL';
    ctx.font = `bold ${Math.max(8, Math.round(10 * t.scale))}px "Segoe UI", sans-serif`;
    ctx.fillStyle = r.state === 'development' ? 'rgba(159, 176, 192, 0.72)' : palette.text;
    ctx.fillText(badge, cx, rect.y + rect.h * 0.82);
  }

  private ensureContinentFog(regions: ContinentView['regions']): void {
    const key = regions
      .filter((r) => r.state !== 'unknown')
      .map((r) => r.id)
      .sort((a, b) => a - b)
      .join(',');
    if (this.continentFog && this.fogKey === key) return;
    this.fogKey = key;
    this.twinkleKey = '';
    this.continentTwinkles = [];
    const fog = document.createElement('canvas');
    fog.width = CONTINENT_DESIGN_W;
    fog.height = CONTINENT_DESIGN_H;
    const ctx = fog.getContext('2d')!;
    const rand = mulberry32(777);

    ctx.fillStyle = '#0b1016';
    ctx.fillRect(0, 0, fog.width, fog.height);

    const known = regions.filter((r) => r.state !== 'unknown');
    ctx.globalCompositeOperation = 'destination-out';
    for (const r of known) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = Math.max(r.w, r.h) * 0.7 + 46;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, 'rgba(0, 0, 0, 1)');
      g.addColorStop(0.76, 'rgba(0, 0, 0, 1)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const r of known) {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rad = Math.max(r.w, r.h) * 0.7;
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2;
        const d = rad * (0.55 + rand() * 0.5);
        const bx = cx + Math.cos(a) * d;
        const by = cy + Math.sin(a) * d;
        if (bx < -10 || bx > fog.width + 10 || by < -10 || by > fog.height + 10) continue;
        ctx.beginPath();
        ctx.arc(bx, by, 7 + rand() * 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    this.continentFog = fog;
  }

  private drawContinentFog(t: { scale: number; ox: number; oy: number }, regions: ContinentView['regions']): void {
    this.ensureContinentFog(regions);
    const { ctx } = this;
    if (!this.continentFog) return;
    const s = t.scale;
    const ox = t.ox;
    const oy = t.oy;
    const fw = CONTINENT_DESIGN_W * s;
    const fh = CONTINENT_DESIGN_H * s;

    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.continentFog, ox, oy, fw, fh);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();

    const jx = Math.sin(this.fogTime * 0.7) * 1.6 * s;
    const jy = Math.cos(this.fogTime * 0.55) * 1.6 * s;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.continentFog, ox + jx, oy + jy, fw, fh);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();

    ctx.save();
    const clouds: { fx: number; fy: number; r: number; sp: number; ph: number }[] = [
      { fx: 0.2, fy: 0.3, r: 0.52, sp: 0.12, ph: 0 },
      { fx: 0.78, fy: 0.55, r: 0.55, sp: 0.09, ph: 2.1 },
      { fx: 0.5, fy: 0.82, r: 0.46, sp: 0.14, ph: 4.2 },
    ];
    for (const c of clouds) {
      const ccx = ox + (c.fx * CONTINENT_DESIGN_W + Math.sin(this.fogTime * c.sp * 2 + c.ph) * 44) * s;
      const ccy = oy + (c.fy * CONTINENT_DESIGN_H + Math.cos(this.fogTime * c.sp * 1.6 + c.ph) * 28) * s;
      const cr = c.r * CONTINENT_DESIGN_W * s;
      const g = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cr);
      g.addColorStop(0, 'rgba(8, 12, 18, 0.11)');
      g.addColorStop(0.6, 'rgba(8, 12, 18, 0.06)');
      g.addColorStop(1, 'rgba(8, 12, 18, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, fw, fh);
    }
    for (let i = 0; i < 3; i++) {
      const wx = ox + (((this.fogTime * 7 + i * 400) % (CONTINENT_DESIGN_W * 1.25)) * s) - 40 * s;
      const wy = oy + (210 + i * 185 + Math.sin(this.fogTime * 0.4 + i * 1.7) * 42) * s;
      const wr = (120 + i * 28) * s;
      const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      g.addColorStop(0, 'rgba(165, 195, 215, 0.05)');
      g.addColorStop(1, 'rgba(165, 195, 215, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, fw, fh);
    }
    ctx.restore();

    ctx.save();
    for (const [id, p] of this.continentReveal) {
      const r = regions.find((rr) => rr.id === id);
      if (!r) continue;
      const ccx = ox + (r.x + r.w / 2) * s;
      const ccy = oy + (r.y + r.h / 2) * s;
      const cr = Math.max(r.w, r.h) * 0.72 * s;
      const a = 0.9 * (1 - easeOut(p));
      const g = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cr);
      g.addColorStop(0, `rgba(10, 14, 20, ${a})`);
      g.addColorStop(0.8, `rgba(10, 14, 20, ${a * 0.6})`);
      g.addColorStop(1, 'rgba(10, 14, 20, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(ox, oy, fw, fh);
    }
    ctx.restore();
  }

  private drawContinentAtmosphere(
    dt: number,
    t: { scale: number; ox: number; oy: number },
    regions: ContinentView['regions'],
  ): void {
    const { ctx } = this;
    const s = t.scale;
    const ox = t.ox;
    const oy = t.oy;

    for (const p of this.continentParticles) {
      p.y -= p.speed * dt;
      p.x += Math.sin(this.fogTime * 0.7 + p.phase) * p.drift * dt * 2;
      if (p.y < -8) {
        p.y = CONTINENT_DESIGN_H + 8;
        p.x = (p.x + 137) % CONTINENT_DESIGN_W;
      }
    }

    ctx.save();
    for (const p of this.continentParticles) {
      const alpha = p.alpha * (0.55 + 0.45 * Math.sin(this.fogTime * 1.1 + p.phase));
      const sx = ox + p.x * s;
      const sy = oy + p.y * s;
      const r = Math.max(0.5, p.size * s);
      if (p.glow) {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
        g.addColorStop(0, `rgba(170, 214, 255, ${alpha})`);
        g.addColorStop(1, 'rgba(170, 214, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(196, 216, 230, ${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([7 * s, 11 * s]);
    ctx.lineDashOffset = -this.fogTime * 20 * s;
    ctx.strokeStyle = 'rgba(160, 224, 242, 0.1)';
    ctx.lineWidth = 2.2 * s;
    traceCurve(ctx, CONTINENT_RIVER.map((p) => ({ x: ox + p.x * s, y: oy + p.y * s })));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const lp = 0.5 + 0.5 * Math.sin(this.fogTime * 0.8);
    ctx.fillStyle = `rgba(150, 220, 240, ${0.035 + 0.035 * lp})`;
    ctx.beginPath();
    ctx.ellipse(ox + 430 * s, oy + 556 * s, 30 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    this.ensureContinentTwinkles(regions);
    for (const tw of this.continentTwinkles) {
      const a = 0.22 + 0.22 * Math.sin(this.fogTime * 1.7 + tw.phase);
      if (a < 0.12) continue;
      const sx = ox + tw.x * s;
      const sy = oy + tw.y * s;
      ctx.fillStyle = `rgba(255, 238, 196, ${a})`;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.6, (1.2 + 1.1 * a) * s), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private ensureContinentTwinkles(regions: ContinentView['regions']): void {
    if (this.twinkleKey === this.fogKey && this.continentTwinkles.length > 0) return;
    this.twinkleKey = this.fogKey;
    this.continentTwinkles = [];
    const tw = mulberry32(1337);
    for (const r of regions) {
      if (r.state === 'unknown') continue;
      const n = 4;
      for (let i = 0; i < n; i++) {
        this.continentTwinkles.push({ x: r.x + tw() * r.w, y: r.y + tw() * r.h, phase: tw() * Math.PI * 2 });
      }
    }
  }

  private drawContinentVignette(): void {
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(3, 8, 14, 0.48)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawContinentHeader(view: ContinentView): void {
    const { ctx } = this;
    const w = this.width;
    const g = ctx.createLinearGradient(0, 0, 0, 88);
    g.addColorStop(0, 'rgba(6, 12, 18, 0.55)');
    g.addColorStop(1, 'rgba(6, 12, 18, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 88);

    const cx = w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.shadowColor = 'rgba(56, 182, 255, 0.35)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#6ec8ff';
    ctx.fillText('🗺️ AVENTURAS', cx, 42);
    ctx.shadowBlur = 0;
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#9fb0c0';
    ctx.fillText(`Territórios descobertos: ${view.discovered}/${view.total}`, cx, 64);
    const pct = view.total > 0 ? view.discovered / view.total : 0;
    const barW = 150;
    const bx = cx - barW / 2;
    const by = 72;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    roundRectPath(ctx, bx, by, barW, 4, 2);
    ctx.fill();
    ctx.fillStyle = '#38b6ff';
    roundRectPath(ctx, bx, by, barW * pct, 4, 2);
    ctx.fill();
  }

  private drawContinentBackButton(t: { scale: number; ox: number; oy: number }): void {
    const { ctx } = this;
    const rect = regionScreenRect(CONTINENT_BACK_BUTTON, t);
    const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    g.addColorStop(0, 'rgba(44, 74, 92, 0.55)');
    g.addColorStop(1, 'rgba(12, 22, 32, 0.62)');
    ctx.fillStyle = g;
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110, 200, 255, 0.35)';
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 9);
    ctx.stroke();
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d7e9f5';
    ctx.fillText('← VOLTAR', rect.x + rect.w / 2 - 14, rect.y + rect.h / 2 + 1);
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(159, 176, 192, 0.8)';
    ctx.fillText('ESC', rect.x + rect.w - 32, rect.y + rect.h / 2 + 1);
  }

  renderStoryMap(dt: number, view: StoryMapView): void {
    this.storyMapTime += dt;
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    const camera = view.camera;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const darkBg = ctx.createLinearGradient(0, 0, 0, h);
    darkBg.addColorStop(0, '#0a1218');
    darkBg.addColorStop(0.5, '#0d1a22');
    darkBg.addColorStop(1, '#081016');
    ctx.fillStyle = darkBg;
    ctx.fillRect(0, 0, w, h);

    if (!camera) return;

    // Apply camera transform: translate to camera position, then scale
    const camX = camera.x;
    const camY = camera.y;
    const zoom = camera.zoom;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // Draw background
    this.ensureStoryMapBg();
    if (this.storyMapBg) {
      ctx.drawImage(this.storyMapBg, 0, 0, STORY_MAP_DESIGN_W, STORY_MAP_DESIGN_H);
    }

    const t = this.storyMapTime;

    // Draw path
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < STORY_MAP_PATH.length - 1; i++) {
      const p1 = STORY_MAP_PATH[i];
      const p2 = STORY_MAP_PATH[i + 1];
      const node1 = view.nodes.find(n => n.number === i + 1);
      const node2 = view.nodes.find(n => n.number === i + 2);
      const bothAvailable = node1 && node2 && (node1.state !== 'locked' || node2.state !== 'locked');

      const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
      if (bothAvailable) {
        grad.addColorStop(0, 'rgba(255, 209, 102, 0.15)');
        grad.addColorStop(0.5, 'rgba(255, 209, 102, 0.08)');
        grad.addColorStop(1, 'rgba(255, 209, 102, 0.15)');
      } else {
        grad.addColorStop(0, 'rgba(90, 90, 100, 0.12)');
        grad.addColorStop(1, 'rgba(90, 90, 100, 0.06)');
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (bothAvailable) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);
        ctx.strokeStyle = `rgba(255, 209, 102, ${0.25 + 0.15 * pulse})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();

    // Draw chapter region glows
    const chapterColors = [
      { range: [1, 3], color: 'rgba(90, 180, 220, 0.1)' },
      { range: [4, 6], color: 'rgba(255, 209, 102, 0.1)' },
      { range: [7, 9], color: 'rgba(255, 143, 163, 0.1)' },
      { range: [10, 10], color: 'rgba(255, 70, 85, 0.15)' },
    ];

    for (const ch of chapterColors) {
      const nodesInChapter = view.nodes.filter(n => n.number >= ch.range[0] && n.number <= ch.range[1]);
      if (nodesInChapter.length === 0) continue;
      const minX = Math.min(...nodesInChapter.map(n => n.x));
      const maxX = Math.max(...nodesInChapter.map(n => n.x));
      const minY = Math.min(...nodesInChapter.map(n => n.y));
      const maxY = Math.max(...nodesInChapter.map(n => n.y));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = (maxX - minX) * 0.5 + 120;
      const ry = (maxY - minY) * 0.5 + 80;

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, ch.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nodes
    for (const node of view.nodes) {
      const nx = node.x;
      const ny = node.y;
      const isHovered = view.hoveredNode === node.number;
      const isAvailable = node.state === 'available';
      const isCompleted = node.state === 'completed';

      const pulse = 0.5 + 0.5 * Math.sin(t * 2.5 + node.number);
      const baseRadius = 28;
      const hoverScale = isHovered ? 1.15 : 1;

      if (isCompleted) {
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, baseRadius * 1.8);
        g.addColorStop(0, 'rgba(61, 220, 132, 0.25)');
        g.addColorStop(1, 'rgba(61, 220, 132, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny, baseRadius * 1.8 * hoverScale, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isAvailable && !isCompleted) {
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, baseRadius * 1.5);
        g.addColorStop(0, `rgba(255, 209, 102, ${0.3 + 0.15 * pulse})`);
        g.addColorStop(1, 'rgba(255, 209, 102, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(nx, ny, baseRadius * 1.5 * hoverScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 209, 102, ${0.5 + 0.3 * pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, baseRadius * (0.9 + 0.2 * pulse) * hoverScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (node.state === 'locked') {
        ctx.fillStyle = 'rgba(40, 40, 50, 0.8)';
      } else if (isCompleted) {
        ctx.fillStyle = 'rgba(30, 60, 40, 0.9)';
      } else {
        ctx.fillStyle = 'rgba(60, 50, 30, 0.9)';
      }
      ctx.beginPath();
      ctx.arc(nx, ny, baseRadius * hoverScale, 0, Math.PI * 2);
      ctx.fill();

      if (isCompleted) {
        ctx.strokeStyle = 'rgba(61, 220, 132, 0.8)';
      } else if (isAvailable) {
        ctx.strokeStyle = `rgba(255, 209, 102, ${0.7 + 0.2 * pulse})`;
      } else {
        ctx.strokeStyle = 'rgba(90, 90, 100, 0.4)';
      }
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.beginPath();
      ctx.arc(nx, ny, baseRadius * hoverScale, 0, Math.PI * 2);
      ctx.stroke();

      if (node.number === 10) {
        ctx.strokeStyle = `rgba(255, 70, 85, ${0.6 + 0.3 * Math.sin(t * 3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nx, ny, baseRadius * 1.3 * hoverScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const iconSize = Math.max(16, Math.round(24 * hoverScale));
      ctx.font = `${iconSize}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
      if (node.state === 'locked') {
        ctx.fillStyle = 'rgba(150, 150, 160, 0.7)';
      } else if (isCompleted) {
        ctx.fillStyle = '#3ddc84';
      } else if (isAvailable) {
        ctx.fillStyle = '#ffd166';
      } else {
        ctx.fillStyle = '#ffd166';
      }
      ctx.fillText(node.icon, nx, ny - 2);

      if (node.number === 10) {
        ctx.fillStyle = `rgba(255, 70, 85, ${0.8 + 0.2 * Math.sin(t * 4)})`;
        ctx.font = `${Math.max(10, Math.round(14))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
        ctx.fillText('👑', nx, ny + baseRadius * hoverScale - 10);
      }

      if (isCompleted) {
        ctx.fillStyle = '#3ddc84';
        ctx.font = `bold ${Math.max(9, Math.round(11))}px "Segoe UI", sans-serif`;
        ctx.fillText('✓', nx + baseRadius * 0.5 * hoverScale, ny - baseRadius * 0.5 * hoverScale);

        const stars = '⭐'.repeat(Math.min(3, Math.max(0, node.stars)));
        if (stars) {
          ctx.font = `${Math.max(8, Math.round(10))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
          ctx.fillText(stars, nx, ny + baseRadius * 0.9 * hoverScale);
        }
      } else if (isAvailable) {
        const stars = '⭐'.repeat(Math.min(3, Math.max(0, node.stars)));
        if (stars) {
          ctx.font = `${Math.max(8, Math.round(10))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
          ctx.fillText(stars, nx, ny + baseRadius * 0.9 * hoverScale);
        }
      } else if (node.state === 'locked') {
        ctx.fillStyle = 'rgba(150, 150, 160, 0.8)';
        ctx.font = `${Math.max(10, Math.round(14))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
        ctx.fillText('🔒', nx, ny);
      }
    }

    ctx.restore(); // Restore camera transform

    // Now draw UI elements in screen space (no camera transform)
    this.drawStoryMapUI(ctx, view, w, h, camera);
  }

  private drawStoryMapTooltip(node: StoryMapNode, nx: number, ny: number, _offsetX: number, _offsetY: number, scale: number, w: number, _h: number): void {
    const { ctx } = this;
    const tooltipW = Math.min(280, w * 0.35);
    const tooltipH = 140;
    let tx = nx + 50 * scale;
    let ty = ny - tooltipH - 20 * scale;
    if (tx + tooltipW > w - 20) tx = nx - tooltipW - 50 * scale;
    if (ty < 80) ty = ny + 50 * scale;

    const g = ctx.createLinearGradient(tx, ty, tx, ty + tooltipH);
    g.addColorStop(0, 'rgba(10, 14, 20, 0.98)');
    g.addColorStop(1, 'rgba(6, 9, 14, 0.95)');
    ctx.fillStyle = g;
    roundRectPath(ctx, tx, ty, tooltipW, tooltipH, 12);
    ctx.fill();
    ctx.strokeStyle = node.state === 'completed' ? 'rgba(61, 220, 132, 0.5)' : node.state === 'available' ? 'rgba(255, 209, 102, 0.5)' : 'rgba(90, 90, 100, 0.3)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, tx + 0.5, ty + 0.5, tooltipW - 1, tooltipH - 1, 12);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let ly = ty + 24;
    ctx.font = `bold ${Math.max(12, Math.round(16 * scale))}px "Segoe UI", sans-serif`;
    ctx.fillStyle = node.state === 'completed' ? '#3ddc84' : node.state === 'available' ? '#ffd166' : '#9fb0c0';
    ctx.fillText(`${node.icon} FASE ${node.number}: ${node.name}`, tx + 16, ly);

    ly += 24;
    ctx.font = `${Math.max(11, Math.round(13 * scale))}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#c8d8e8';
    ctx.fillText(node.description, tx + 16, ly);

    ly += 22;
    const starsFilled = '⭐'.repeat(Math.min(3, Math.max(0, node.stars)));
    const starsEmpty = '⭐'.repeat(3 - node.stars);
    ctx.font = `${Math.max(11, Math.round(14 * scale))}px "Segoe UI Emoji", "Segoe UI", sans-serif`;
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`${starsFilled}${starsEmpty}`, tx + 16, ly);

    if (node.state === 'available' || node.state === 'completed') {
      ly += 24;
      const g2 = ctx.createLinearGradient(tx, ly, tx + 100, ly);
      g2.addColorStop(0, 'rgba(56, 182, 255, 0.2)');
      g2.addColorStop(1, 'rgba(56, 182, 255, 0)');
      ctx.fillStyle = g2;
      roundRectPath(ctx, tx + 16, ly - 18, tooltipW - 32, 28, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 182, 255, 0.4)';
      ctx.lineWidth = 1;
      roundRectPath(ctx, tx + 16, ly - 18, tooltipW - 32, 28, 6);
      ctx.stroke();
      ctx.font = `bold ${Math.max(11, Math.round(13 * scale))}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#6ec8ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CLIQUE PARA JOGAR', tx + tooltipW / 2, ly - 4);
    } else if (node.state === 'locked') {
      ly += 24;
      ctx.font = `${Math.max(11, Math.round(13 * scale))}px "Segoe UI", sans-serif`;
      ctx.fillStyle = 'rgba(150, 150, 160, 0.7)';
      ctx.textAlign = 'left';
      ctx.fillText('🔒 Bloqueada — conclua a fase anterior', tx + 16, ly);
    }
  }

  private drawStoryMapUI(ctx: CanvasRenderingContext2D, view: StoryMapView, w: number, h: number, _camera: StoryMapCamera): void {

    // Campaign complete panel - positioned below title/progress
    if (view.campaignComplete) {
      const panelY = 80;
      const panelH = 50;
      const cx = w / 2;
      const g = ctx.createLinearGradient(0, 0, 0, panelH);
      g.addColorStop(0, 'rgba(10, 14, 20, 0.95)');
      g.addColorStop(1, 'rgba(10, 14, 20, 0.7)');
      ctx.fillStyle = g;
      roundRectPath(ctx, cx - 220, panelY, 440, panelH, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(61, 220, 132, 0.5)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, cx - 220, panelY, 440, panelH, 12);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.fillStyle = '#3ddc84';
      ctx.shadowColor = 'rgba(61, 220, 132, 0.5)';
      ctx.shadowBlur = 10;
      ctx.fillText('🏆 CAMPANHA CONCLUÍDA', cx, panelY + panelH / 2);
      ctx.shadowBlur = 0;
    }

    // Back button
    const backRect = { x: 20, y: h - 70, w: 120, h: 50 };
    const backHovered = view.hoveredNode === -1;
    ctx.fillStyle = backHovered ? 'rgba(56, 182, 255, 0.2)' : 'rgba(44, 74, 92, 0.55)';
    roundRectPath(ctx, backRect.x, backRect.y, backRect.w, backRect.h, 9);
    ctx.fill();
    ctx.strokeStyle = backHovered ? 'rgba(56, 182, 255, 0.6)' : 'rgba(110, 200, 255, 0.35)';
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, backRect.x + 0.5, backRect.y + 0.5, backRect.w - 1, backRect.h - 1, 9);
    ctx.stroke();
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = backHovered ? '#6ec8ff' : '#d7e9f5';
    ctx.fillText('← VOLTAR', backRect.x + backRect.w / 2, backRect.y + backRect.h / 2 + 1);
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(159, 176, 192, 0.8)';
    ctx.fillText('ESC', backRect.x + backRect.w - 32, backRect.y + backRect.h / 2 + 1);

    // Reframe button
    const reframeRect = { x: backRect.x + backRect.w + 10, y: h - 70, w: 50, h: 50 };
    const reframeHovered = view.hoveredNode === -2;
    ctx.fillStyle = reframeHovered ? 'rgba(255, 209, 102, 0.2)' : 'rgba(44, 74, 92, 0.55)';
    roundRectPath(ctx, reframeRect.x, reframeRect.y, reframeRect.w, reframeRect.h, 9);
    ctx.fill();
    ctx.strokeStyle = reframeHovered ? 'rgba(255, 209, 102, 0.6)' : 'rgba(110, 200, 255, 0.35)';
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, reframeRect.x + 0.5, reframeRect.y + 0.5, reframeRect.w - 1, reframeRect.h - 1, 9);
    ctx.stroke();
    ctx.font = '20px "Segoe UI Emoji", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = reframeHovered ? '#ffd166' : '#d7e9f5';
    ctx.fillText('🎯', reframeRect.x + reframeRect.w / 2, reframeRect.y + reframeRect.h / 2 + 1);
    ctx.font = '9px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(159, 176, 192, 0.8)';
    ctx.fillText('R', reframeRect.x + reframeRect.w - 12, reframeRect.y + reframeRect.h - 8);

    // Title and progress - always at top
    const storyTitleY = 40;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.shadowColor = 'rgba(56, 182, 255, 0.35)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#6ec8ff';
    ctx.fillText('📖 HISTÓRIA', w / 2, storyTitleY);
    ctx.shadowBlur = 0;
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#9fb0c0';
    ctx.fillText(`${view.completedCount} / 10 fases  •  ${view.totalStars} / 30 ⭐`, w / 2, storyTitleY + 22);

    // Narrative lines at bottom
    const narrativeLines = [
      'A fronteira foi rompida.',
      'O inimigo avança sobre o reino.',
      'Cada vitória aproxima o exército da origem da Ruína.',
    ];
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(159, 176, 192, 0.7)';
    ctx.textAlign = 'center';
    narrativeLines.forEach((line, i) => {
      ctx.fillText(line, w / 2, h - 110 + i * 16);
    });

    // Tooltip for hovered node
    if (view.hoveredNode && view.hoveredNode > 0) {
      const node = view.nodes.find(n => n.number === view.hoveredNode);
      if (node && _camera) {
        const screenPos = _camera.worldToScreen(node.x, node.y);
        this.drawStoryMapTooltip(node, screenPos.x, screenPos.y, 0, 0, 1, w, h);
      }
    }
  }

  private ensureStoryMapBg(): void {
    if (this.storyMapBg) return;
    const bg = document.createElement('canvas');
    bg.width = STORY_MAP_DESIGN_W;
    bg.height = STORY_MAP_DESIGN_H;
    const ctx = bg.getContext('2d')!;
    const rand = mulberry32(12345);
    const W = bg.width;
    const H = bg.height;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0d1a22');
    sky.addColorStop(0.4, '#102028');
    sky.addColorStop(0.7, '#142830');
    sky.addColorStop(1, '#0a141a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < 200; i++) {
      const x = rand() * W;
      const y = rand() * H * 0.6;
      const r = 0.5 + rand() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const mountains: [number, number, number, number][] = [
      [150, 650, 200, 180],
      [350, 680, 180, 160],
      [550, 620, 220, 200],
      [800, 660, 160, 140],
      [1000, 640, 190, 170],
      [1100, 680, 150, 130],
    ];
    for (const [mx, my, mw, mh] of mountains) {
      const peak = my - mh;
      ctx.fillStyle = 'rgba(20, 30, 40, 0.6)';
      ctx.beginPath();
      ctx.moveTo(mx - mw / 2, my);
      ctx.lineTo(mx, peak + rand() * 20);
      ctx.lineTo(mx + mw / 2, my);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(30, 45, 55, 0.5)';
      ctx.beginPath();
      ctx.moveTo(mx - mw / 2.5, my);
      ctx.lineTo(mx, peak + mh * 0.3);
      ctx.lineTo(mx + mw / 2.5, my);
      ctx.closePath();
      ctx.fill();
    }

    const forests: [number, number, number][] = [
      [200, 500, 80],
      [400, 480, 70],
      [600, 420, 90],
      [850, 400, 75],
      [950, 350, 60],
    ];
    for (const [fx, fy, fr] of forests) {
      const n = 8 + Math.floor(rand() * 6);
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * fr;
        const tx = fx + Math.cos(a) * d;
        const ty = fy + Math.sin(a) * d;
        const s = 6 + rand() * 10;
        ctx.fillStyle = 'rgba(10, 25, 15, 0.6)';
        ctx.beginPath();
        ctx.arc(tx + 1, ty + 2, s + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a3d2a';
        ctx.beginPath();
        ctx.arc(tx, ty, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a5a3a';
        ctx.beginPath();
        ctx.arc(tx - s * 0.3, ty - s * 0.3, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const riverPoints = [
      { x: 100, y: 750 },
      { x: 250, y: 650 },
      { x: 450, y: 550 },
      { x: 650, y: 450 },
      { x: 850, y: 380 },
      { x: 1000, y: 320 },
      { x: 1150, y: 200 },
    ];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(80, 120, 160, 0.25)';
    ctx.lineWidth = 18;
    traceCurve(ctx, riverPoints);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60, 100, 140, 0.35)';
    ctx.lineWidth = 10;
    traceCurve(ctx, riverPoints);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(100, 150, 200, 0.2)';
    ctx.lineWidth = 4;
    traceCurve(ctx, riverPoints);
    ctx.stroke();

    const ruins: [number, number, number, number][] = [
      [1050, 180, 60, 80],
      [1120, 100, 50, 70],
      [1170, 60, 40, 60],
    ];
    for (const [rx, ry, rw, rh] of ruins) {
      ctx.fillStyle = 'rgba(40, 30, 25, 0.7)';
      ctx.fillRect(rx - rw / 2, ry - rh, rw, rh);
      ctx.fillStyle = 'rgba(60, 45, 35, 0.5)';
      ctx.fillRect(rx - rw / 2 + 5, ry - rh + 10, rw - 10, 15);
      ctx.fillRect(rx - rw / 2 + 5, ry - rh + 30, rw - 10, 15);
    }

    const lake = [
      { x: 300, y: 720 },
      { x: 380, y: 680 },
      { x: 420, y: 620 },
      { x: 350, y: 600 },
      { x: 280, y: 650 },
    ];
    ctx.fillStyle = 'rgba(60, 80, 100, 0.2)';
    ctx.beginPath();
    ctx.moveTo(lake[0].x, lake[0].y);
    for (let i = 1; i < lake.length; i++) ctx.lineTo(lake[i].x, lake[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(80, 100, 120, 0.15)';
    ctx.beginPath();
    ctx.moveTo(lake[0].x, lake[0].y);
    for (let i = 1; i < lake.length; i++) ctx.lineTo(lake[i].x * 0.95 + lake[0].x * 0.05, lake[i].y * 0.95 + lake[0].y * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(180, 150, 100, 0.08)';
    for (let i = 0; i < 12; i++) {
      const vx = 100 + rand() * 1000;
      const vy = 400 + rand() * 300;
      const vr = 30 + rand() * 40;
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, Math.PI * 2);
      ctx.fill();
    }

    this.storyMapBg = bg;
  }

  private storyMapBg: HTMLCanvasElement | null = null;
  private storyMapTime = 0;

  renderMenu(dt: number, variant: MenuVariant): void {
    this.ensureMenuParticles(variant);
    this.menuTime += dt;
    const { ctx } = this;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    const dark = variant === 'story';
    const hue = menuHue(this.menuTime);
    const px = (this.menuMouseX - 0.5) * 2;
    const py = (this.menuMouseY - 0.5) * 2;

    const neb = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.72);
    neb.addColorStop(0, `hsla(${(hue + 40) % 360}, 70%, ${dark ? 12 : 18}%, ${dark ? 0.5 : 0.75})`);
    neb.addColorStop(0.55, `hsla(${(hue - 28 + 360) % 360}, 75%, 10%, ${dark ? 0.26 : 0.4})`);
    neb.addColorStop(1, 'rgba(4, 6, 10, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    this.drawMenuEnergyOrbs(w, h, dt, dark, px, py);
    this.drawMenuWaves(w, h, hue, dark, py);

    for (const p of this.menuParticles) {
      p.life += dt * p.rate;
      if (p.life >= 1) {
        p.life = 0;
        p.x = Math.random() * w;
        p.y = h * (0.7 + Math.random() * 0.35);
        p.vx = (Math.random() - 0.5) * 8;
        p.vy = -(4 + Math.random() * 12);
        continue;
      }
      p.x += (p.vx + Math.sin(this.menuTime * 0.6 + p.phase * 6.28) * 10) * dt;
      p.y += p.vy * dt;
      const a = Math.sin(p.life * Math.PI);
      const tw = 0.55 + 0.45 * Math.sin(this.menuTime * 2.2 + p.phase * 20);
      const ox = p.x + px * p.depth * 18;
      const oy = p.y + py * p.depth * 12;
      ctx.fillStyle = `hsla(${p.hue}, 96%, ${72 + a * 16}%, ${a * tw * (dark ? 0.5 : 0.85)})`;
      const s = p.size * (0.5 + 0.7 * a);
      ctx.fillRect(ox, oy, s, s);
    }

    if (variant === 'creative') this.drawMenuGears(w, h, dt, dark);

    const bottomHue = (hue + Math.sin(this.menuTime * 0.08) * 28 + 360) % 360;
    const pulse = 0.5 + 0.5 * Math.sin(this.menuTime * 0.25);
    const bot = ctx.createLinearGradient(0, h * 0.62, 0, h);
    bot.addColorStop(0, `hsla(${bottomHue}, 90%, 42%, 0)`);
    bot.addColorStop(0.55, `hsla(${bottomHue}, 95%, 48%, ${(dark ? 0.14 : 0.24) + 0.08 * pulse})`);
    bot.addColorStop(1, `hsla(${(bottomHue + 20) % 360}, 95%, 55%, ${(dark ? 0.2 : 0.32) + 0.1 * pulse})`);
    ctx.fillStyle = bot;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    const er = Math.min(w, h) * 0.42;
    const eg = ctx.createRadialGradient(w * 0.5, h * 0.82, 0, w * 0.5, h * 0.82, er);
    eg.addColorStop(0, `hsla(${bottomHue}, 95%, 56%, ${(dark ? 0.1 : 0.17) * (0.6 + 0.4 * pulse)})`);
    eg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = eg;
    ctx.fillRect(w * 0.5 - er, h * 0.82 - er, er * 2, er * 2);

    ctx.restore();

    const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.82);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  private drawMenuEnergyOrbs(w: number, h: number, dt: number, dark: boolean, px: number, py: number): void {
    const { ctx } = this;
    for (const o of this.menuOrbs) {
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      const margin = o.r * 1.4;
      if (o.x < -margin) o.x = w + margin;
      if (o.x > w + margin) o.x = -margin;
      if (o.y < -margin) o.y = h + margin;
      if (o.y > h + margin) o.y = -margin;
      const fade = 0.5 + 0.5 * Math.sin(this.menuTime * 0.5 + o.phase);
      const ox = o.x + px * o.depth * 26;
      const oy = o.y + py * o.depth * 16;
      const oh = (o.hue + Math.sin(this.menuTime * 0.12 + o.phase) * 20 + 360) % 360;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
      g.addColorStop(0, `hsla(${oh}, 94%, ${dark ? 58 : 66}%, ${0.09 + 0.1 * fade})`);
      g.addColorStop(1, `hsla(${oh}, 90%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMenuWaves(w: number, h: number, hue: number, dark: boolean, py: number): void {
    const { ctx } = this;
    for (let i = 0; i < 3; i++) {
      const lift = Math.sin(this.menuTime * 0.13 + i * 2.1) * 24;
      const baseY = h * (0.5 + (i - 1) * 0.2) + lift + py * 8;
      const hh = (hue + i * 26 + 360) % 360;
      ctx.beginPath();
      for (let x = -8; x <= w + 8; x += 10) {
        const y =
          baseY + Math.sin(x * 0.004 + this.menuTime * 0.5 + i * 1.7) * 20 + Math.sin(x * 0.011 - this.menuTime * 0.32 + i) * 10;
        if (x === -8) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `hsla(${hh}, 90%, 62%, ${dark ? 0.016 : 0.03})`;
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${hh}, 92%, 66%, ${dark ? 0.04 : 0.075})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawMenuGears(w: number, h: number, dt: number, dark: boolean): void {
    const { ctx } = this;
    for (const g of this.menuGears) {
      g.spin += g.speed * dt;
      g.y -= 4 * dt;
      g.x += Math.sin(this.menuTime * 0.2 + g.depth * 9) * 6 * dt;
      if (g.y < -34) {
        g.y = h + 34;
        g.x = Math.random() * w;
      }
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.spin);
      ctx.strokeStyle = `hsla(${g.hue}, 75%, 66%, ${dark ? 0.1 : 0.2})`;
      ctx.lineWidth = g.r * 0.16;
      const R = g.r * 1.18;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * g.r, Math.sin(a) * g.r);
        ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, g.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private ensureMenuParticles(variant: MenuVariant): void {
    if (this.menuVariant === variant && this.menuParticles.length > 0) return;
    this.menuVariant = variant;
    const rand = mulberry32(777 + variant.length * 13);
    const w = this.width;
    const h = this.height;
    const count = Math.max(38, Math.min(110, Math.floor((w * h) / 22000)));
    this.menuParticles = [];
    for (let i = 0; i < count; i++) {
      this.menuParticles.push({
        x: rand() * w,
        y: rand() * h,
        vx: (rand() - 0.5) * 8,
        vy: -(4 + rand() * 12),
        size: 1 + rand() * 2.4,
        life: rand(),
        rate: 0.22 + rand() * 0.35,
        phase: rand(),
        hue: 185 + rand() * 105,
        depth: 0.2 + rand() * 0.8,
      });
    }
    this.menuOrbs = [];
    for (let i = 0; i < 7; i++) {
      this.menuOrbs.push({
        x: rand() * w,
        y: rand() * h,
        r: Math.min(w, h) * (0.18 + rand() * 0.17),
        vx: (rand() - 0.5) * 6,
        vy: (rand() - 0.5) * 4,
        hue: rand() * 360,
        depth: 0.25 + rand() * 0.75,
        phase: rand() * Math.PI * 2,
      });
    }
    this.menuGears = [];
    if (variant === 'creative') {
      for (let i = 0; i < 7; i++) {
        this.menuGears.push({
          x: rand() * w,
          y: rand() * h,
          r: 8 + rand() * 15,
          spin: rand() * Math.PI * 2,
          speed: 0.4 + rand() * 0.7,
          hue: 30 + rand() * 45,
          depth: 0.3 + rand() * 0.7,
        });
      }
    }
  }

  private drawBiomeBackground(biome: BiomeId): void {
    if (this.bgBiome !== biome) {
      this.buildBiomeCanvas(biome);
      this.bgBiome = biome;
    }
    if (!this.bgCanvas) return;
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bgCanvas, 0, 0, CONFIG.world.width, CONFIG.world.height);
  }

  private buildBiomeCanvas(biome: BiomeId): void {
    const w = Math.ceil(CONFIG.world.width * BG_SCALE);
    const h = Math.ceil(CONFIG.world.height * BG_SCALE);
    if (!this.bgCanvas) this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = w;
    this.bgCanvas.height = h;
    const ctx = this.bgCanvas.getContext('2d')!;
    ctx.fillStyle = BIOMES[biome].background;
    ctx.fillRect(0, 0, w, h);
    this.drawDecorations(ctx, biome);
  }

  private drawDecorations(ctx: CanvasRenderingContext2D, biome: BiomeId): void {
    const rand = mulberry32(BIOMES[biome].seed);
    const worldW = CONFIG.world.width;
    const worldH = CONFIG.world.height;
    const s = (v: number): number => v * BG_SCALE;
    const circle = (x: number, y: number, r: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s(x), s(y), Math.max(1, s(r)), 0, Math.PI * 2);
      ctx.fill();
    };
    const rect = (x: number, y: number, w: number, h: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.fillRect(s(x - w / 2), s(y - h / 2), Math.max(1, s(w)), Math.max(1, s(h)));
    };
    const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 3): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, s(width));
      ctx.beginPath();
      ctx.moveTo(s(x1), s(y1));
      ctx.lineTo(s(x2), s(y2));
      ctx.stroke();
    };
    const diamond = (x: number, y: number, r: number, color: string): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s(x), s(y - r));
      ctx.lineTo(s(x + r * 0.6), s(y));
      ctx.lineTo(s(x), s(y + r));
      ctx.lineTo(s(x - r * 0.6), s(y));
      ctx.closePath();
      ctx.fill();
    };

    switch (biome) {
      case 'field': {
        for (let i = 0; i < 10; i++) circle(rand() * worldW, rand() * worldH, 70 + rand() * 90, 'rgba(0, 0, 0, 0.06)');
        for (let i = 0; i < 40; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          line(x, y, x + 6 - rand() * 12, y - 8 - rand() * 10, 'rgba(70, 150, 90, 0.5)');
        }
        for (let i = 0; i < 16; i++) circle(rand() * worldW, rand() * worldH, 4 + rand() * 5, '#6a737d');
        for (let i = 0; i < 14; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          rect(x, y, 10, 16, '#5a3d2b');
          circle(x, y - 16, 18 + rand() * 10, '#2f7d3f');
        }
        for (let i = 0; i < 26; i++) circle(rand() * worldW, rand() * worldH, 2.5 + rand() * 3, '#e8c07a');
        for (let i = 0; i < 18; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          circle(x, y, 3 + rand() * 2, i % 2 ? '#d96b8a' : '#e8d46a');
          circle(x, y, 1, '#f4efe0');
        }
        break;
      }
      case 'desert': {
        for (let i = 0; i < 8; i++) circle(rand() * worldW, rand() * worldH, 90 + rand() * 120, 'rgba(220, 180, 110, 0.5)');
        for (let i = 0; i < 24; i++) circle(rand() * worldW, rand() * worldH, 5 + rand() * 8, '#8a7a5c');
        for (let i = 0; i < 30; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          line(x, y, x + 4 - rand() * 8, y - 6 - rand() * 8, 'rgba(140, 100, 50, 0.6)');
        }
        for (let i = 0; i < 10; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          rect(x, y - 16, 5, 16, '#5a7d4a');
          rect(x - 6, y - 9, 4, 8, '#5a7d4a');
          rect(x + 6, y - 12, 4, 8, '#5a7d4a');
        }
        for (let i = 0; i < 12; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.strokeStyle = 'rgba(140, 100, 50, 0.35)';
          ctx.lineWidth = Math.max(1, s(5));
          ctx.beginPath();
          ctx.arc(s(x), s(y), s(40 + rand() * 50), Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
        }
        break;
      }
      case 'snow': {
        for (let i = 0; i < 10; i++) circle(rand() * worldW, rand() * worldH, 60 + rand() * 90, 'rgba(255, 255, 255, 0.5)');
        for (let i = 0; i < 16; i++) diamond(rand() * worldW, rand() * worldH, 8 + rand() * 6, '#c9e2f2');
        for (let i = 0; i < 14; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = '#2e5a3a';
          ctx.beginPath();
          ctx.moveTo(s(x), s(y - 22));
          ctx.lineTo(s(x + 14), s(y + 4));
          ctx.lineTo(s(x - 14), s(y + 4));
          ctx.closePath();
          ctx.fill();
          rect(x, y + 4, 8, 12, '#3a2b20');
        }
        for (let i = 0; i < 20; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          circle(x, y, 6 + rand() * 8, 'rgba(255, 255, 255, 0.35)');
          circle(x, y, 3, 'rgba(190, 215, 235, 0.7)');
        }
        for (let i = 0; i < 18; i++) diamond(rand() * worldW, rand() * worldH, 3 + rand() * 4, '#ffffff');
        break;
      }
      case 'volcanic': {
        for (let i = 0; i < 18; i++) circle(rand() * worldW, rand() * worldH, 6 + rand() * 10, '#17100d');
        for (let i = 0; i < 12; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          const angle = rand() * Math.PI * 2;
          line(x, y, x + Math.cos(angle) * 40, y + Math.sin(angle) * 40, i % 2 ? '#ff6b35' : '#ffa94d', 5);
        }
        for (let i = 0; i < 30; i++) circle(rand() * worldW, rand() * worldH, 1.5 + rand() * 3, 'rgba(255, 180, 80, 0.8)');
        for (let i = 0; i < 6; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          circle(x, y, 20 + rand() * 26, 'rgba(120, 40, 15, 0.55)');
          circle(x, y, 10 + rand() * 14, 'rgba(255, 120, 40, 0.5)');
          circle(x, y, 4 + rand() * 6, 'rgba(255, 200, 100, 0.8)');
        }
        for (let i = 0; i < 16; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = '#20140f';
          ctx.beginPath();
          ctx.moveTo(s(x), s(y - 10));
          ctx.lineTo(s(x + 9), s(y + 6));
          ctx.lineTo(s(x - 9), s(y + 6));
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'ruins': {
        for (let i = 0; i < 20; i++) circle(rand() * worldW, rand() * worldH, 5 + rand() * 9, '#4d4d57');
        for (let i = 0; i < 10; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          rect(x, y, 16, 30, '#55555e');
          rect(x - 14, y, 10, 24, '#4d4d57');
        }
        for (let i = 0; i < 14; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          line(x, y, x + 10 + rand() * 16, y - 6, '#3f7d4f', 3);
        }
        for (let i = 0; i < 8; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = '#4a4a54';
          ctx.save();
          ctx.translate(s(x), s(y));
          ctx.rotate(-0.4 + rand() * 0.8);
          ctx.fillRect(-8, -16, 16, 32);
          ctx.restore();
          rect(x + 12, y + 6, 10, 8, '#3a3a44');
          rect(x - 16, y + 10, 12, 6, '#3a3a44');
        }
        for (let i = 0; i < 10; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = '#2e5a3a';
          ctx.beginPath();
          ctx.arc(s(x), s(y - 20), s(14), 0, Math.PI * 2);
          ctx.fill();
          rect(x, y - 10, 6, 10, '#4a3524');
        }
        break;
      }
      case 'cosmic': {
        for (let i = 0; i < 90; i++) circle(rand() * worldW, rand() * worldH, 0.5 + rand() * 1.5, 'rgba(255, 255, 255, 0.5)');
        for (let i = 0; i < 10; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = 'rgba(120, 90, 220, 0.12)';
          ctx.beginPath();
          ctx.arc(s(x), s(y), s(20 + rand() * 30), 0, Math.PI * 2);
          ctx.fill();
        }
        for (let i = 0; i < 16; i++) diamond(rand() * worldW, rand() * worldH, 6 + rand() * 6, '#8a7bd8');
        for (let i = 0; i < 3; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          ctx.fillStyle = 'rgba(70, 55, 150, 0.2)';
          ctx.beginPath();
          ctx.arc(s(x), s(y), s(70 + rand() * 60), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(180, 160, 255, 0.7)';
          ctx.beginPath();
          ctx.arc(s(x), s(y), s(18 + rand() * 14), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(160, 140, 255, 0.5)';
          ctx.lineWidth = Math.max(1, s(4));
          ctx.beginPath();
          ctx.ellipse(s(x), s(y), s(34 + rand() * 16), s(8), 0.4 + rand() * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let i = 0; i < 6; i++) {
          const x = rand() * worldW;
          const y = rand() * worldH;
          const ang = rand() * Math.PI * 2;
          line(x, y, x + Math.cos(ang) * 90, y + Math.sin(ang) * 90, 'rgba(200, 190, 255, 0.35)', 2);
        }
        break;
      }
    }
  }

  private drawGrid(camera: Camera, biome: BiomeId): void {
    const { ctx } = this;
    const view = camera.viewRect();
    const step = camera.zoom < 0.6 ? 400 : camera.zoom < 1 ? 200 : 100;
    const top = Math.max(0, view.y);
    const bottom = Math.min(CONFIG.world.height, view.y + view.h);
    const left = Math.max(0, view.x);
    const right = Math.min(CONFIG.world.width, view.x + view.w);

    ctx.strokeStyle = BIOMES[biome].grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  private drawAdventureBackground(adv: AdventureRenderData): void {
    const { ctx } = this;
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(adv.background, 0, 0, CONFIG.adventure.worldW, CONFIG.adventure.worldH);
    ctx.imageSmoothingEnabled = was;
  }

  private drawTerritoryLabels(adv: AdventureRenderData): void {
    const { ctx } = this;
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of adv.territoryLabels) {
      ctx.fillStyle = 'rgba(18, 24, 16, 0.55)';
      ctx.fillText(t.name, t.x + 1, t.y + 1);
      ctx.fillStyle = 'rgba(238, 242, 224, 0.55)';
      ctx.fillText(t.name, t.x, t.y);
    }
  }

  private drawFog(adv: AdventureRenderData): void {
    const { ctx } = this;
    const { fog, fogCols, fogRows, fogCell } = adv;
    for (let cy = 0; cy < fogRows; cy++) {
      for (let cx = 0; cx < fogCols; cx++) {
        const v = fog[cy * fogCols + cx];
        if (v <= 0.01) continue;
        const wob = 0.82 + 0.08 * Math.sin(this.fogTime * 1.4 + ((cx * 12.9898 + cy * 78.233) % 6.2832));
        ctx.fillStyle = `rgba(10, 13, 17, ${Math.min(0.95, v * wob)})`;
        ctx.fillRect(cx * fogCell, cy * fogCell, fogCell, fogCell);
      }
    }
  }

  private drawAdventureObjective(adv: AdventureRenderData): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 2.4);
    const x = adv.enemyBase.x;
    const y = adv.enemyBase.y - 92;
    ctx.strokeStyle = `rgba(255, 70, 85, ${0.55 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 26 + 5 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 70, 85, ${0.82 + 0.18 * pulse})`;
    ctx.fillText('CASTELO INIMIGO', x, y - 36);
  }

  private drawRoad(route: { x: number; y: number }[] | null): void {
    if (!route || route.length < 2) return;
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 70;
    ctx.beginPath();
    ctx.moveTo(route[0].x, route[0].y);
    for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x, route[i].y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 22]);
    ctx.beginPath();
    ctx.moveTo(route[0].x, route[0].y);
    for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x, route[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    const dest = route[route.length - 1];
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.3 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, 46 + 10 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(dest.x, dest.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCart(cart: Structure | null): void {
    if (!cart || !cart.alive) return;
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 4);
    const r = cart.radius;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cart.x, cart.y + r + 4, r * 1.4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e1e22';
    ctx.beginPath();
    ctx.arc(cart.x - r * 0.55, cart.y + r * 0.4, 7, 0, Math.PI * 2);
    ctx.arc(cart.x + r * 0.55, cart.y + r * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    for (const wx of [-r * 0.55, r * 0.55]) {
      ctx.beginPath();
      ctx.arc(cart.x + wx, cart.y + r * 0.4, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = cart.color;
    ctx.fillRect(cart.x - r, cart.y - r * 0.7, r * 2, r * 1.1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cart.x - r, cart.y - r * 0.7, r * 2, r * 1.1);

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(cart.x, cart.y - r * 0.1, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a800';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cart.x + Math.cos(a) * r * 0.6, cart.y - r * 0.55 + Math.sin(a) * r * 0.28, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + 0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cart.x, cart.y, r + 8 + 5 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(230, 237, 243, 0.95)';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚚 CARROÇA', cart.x, cart.y - r - 18);
    if (cart.flashTimer > 0) {
      const a = Math.min(1, cart.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fillRect(cart.x - r, cart.y - r * 0.7, r * 2, r * 1.1);
    }
    this.drawHpBar(cart.x, cart.y - r - 6, r * 2.6, 6, cart.hp, cart.maxHp);
  }

  private drawProjectiles(projectiles: Projectile[]): void {
    const { ctx } = this;
    for (const p of projectiles) {
      if (!p.alive) continue;
      const color = p.team === 'enemy' ? '#ff8fa3' : '#9ecbff';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.prevX, p.prevY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const tail = 0.018;
      const tx = p.x - p.vx * tail;
      const ty = p.y - p.vy * tail;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const ang = Math.atan2(p.vy, p.vx);
      const size = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(ang) * size, p.y + Math.sin(ang) * size);
      ctx.lineTo(p.x + Math.cos(ang + 2.5) * size, p.y + Math.sin(ang + 2.5) * size);
      ctx.lineTo(p.x + Math.cos(ang - 2.5) * size, p.y + Math.sin(ang - 2.5) * size);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawStructure(s: Structure): void {
    if (s.kind === 'cart') return;
    if (s.kind === 'wall') {
      this.drawWall(s);
      return;
    }
    if (s.kind === 'tower') {
      this.drawTower(s);
      return;
    }
    if (s.kind === 'base') {
      this.drawCastle(s);
      return;
    }
    if (s.kind === 'house') {
      this.drawHouse(s);
      return;
    }
    if (s.kind === 'market') {
      this.drawMarket(s);
      return;
    }
    this.drawMine(s);
  }

  private drawMine(s: Structure): void {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3);
    const neutral = s.owner === 'neutral';
    const enemy = s.owner === 'enemy';
    const glowColor = enemy ? 'rgba(255, 70, 85,' : neutral ? 'rgba(154, 160, 166,' : 'rgba(255, 209, 102,';
    const coin = enemy ? '#ff4655' : neutral ? '#9aa0a6' : '#ffd166';
    const markColor = enemy ? '#5c0e16' : neutral ? '#4a5058' : '#7a5b12';
    const mark = enemy ? '✖' : neutral ? '·' : '$';
    ctx.fillStyle = `${glowColor}${0.1 + 0.08 * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius + 6 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f2d1a';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coin;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(s.x - s.radius * 0.25, s.y - s.radius * 0.3, s.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9961c';
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i - 1) * 0.9;
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * s.radius * 0.48, s.y + Math.sin(a) * s.radius * 0.48, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = markColor;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mark, s.x, s.y + 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
    if (s.captureProgress !== undefined && s.captureProgress > 0) {
      ctx.strokeStyle = '#3ddc84';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + 4, -Math.PI / 2, -Math.PI / 2 + (s.captureProgress / CONFIG.adventure.capture.time) * Math.PI * 2);
      ctx.stroke();
    }
    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.hp < s.maxHp) this.drawHpBar(s.x, s.y - s.radius - 12, s.radius * 2, 5, s.hp, s.maxHp);
  }

  private drawRubble(s: Structure): void {
    const { ctx } = this;
    if (s.kind === 'wall') {
      ctx.fillStyle = 'rgba(60, 66, 76, 0.9)';
      ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2 + 3, s.w, 6);
      ctx.fillStyle = 'rgba(40, 44, 52, 0.9)';
      for (let i = 0; i < 4; i++) {
        const px = s.x - s.w / 2 + (s.w / 4) * i;
        ctx.fillRect(px + 2, s.y + 3, 6, 4);
      }
      return;
    }
    if (s.kind === 'house' || s.kind === 'market') {
      ctx.fillStyle = 'rgba(60, 50, 32, 0.9)';
      ctx.fillRect(s.x - s.radius, s.y - s.radius + 4, s.radius * 2, 8);
      ctx.fillStyle = 'rgba(42, 35, 24, 0.95)';
      ctx.fillRect(s.x - 7, s.y - 5, 14, 8);
      return;
    }
    if (s.kind === 'tower') {
      ctx.fillStyle = 'rgba(50, 55, 64, 0.9)';
      ctx.fillRect(s.x - s.radius, s.y - s.radius + 4, s.radius * 2, 8);
      ctx.fillStyle = 'rgba(35, 39, 46, 0.95)';
      ctx.fillRect(s.x - 8, s.y - 6, 16, 8);
      return;
    }
    if (s.kind === 'base') {
      ctx.fillStyle = 'rgba(30, 33, 40, 0.95)';
      ctx.fillRect(s.x - s.radius, s.y - s.radius, s.radius * 2, s.radius * 2);
      ctx.fillStyle = 'rgba(20, 22, 28, 0.95)';
      ctx.fillRect(s.x - s.radius * 0.5, s.y - s.radius * 0.5, s.radius, s.radius);
      return;
    }
    ctx.fillStyle = 'rgba(80, 66, 20, 0.9)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(45, 40, 20, 0.95)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawCastle(s: Structure): void {
    const { ctx } = this;
    const x = s.x;
    const y = s.y;
    const r = s.radius;
    const ratio = Math.max(0, s.hp / s.maxHp);
    const dmgShade = Math.floor((1 - ratio) * 60);
    const enemy = s.team === 'enemy';
    const stone = enemy ? [172, 96, 90] : [143, 155, 170];
    const stoneLight = enemy ? [196, 112, 104] : [165, 178, 196];
    const stoneDark = enemy ? [116, 58, 54] : [95, 107, 122];
    const towerCol = enemy ? [150, 78, 72] : [123, 133, 145];
    if (Math.abs(x - CONFIG.positions.base.x) < 4 && Math.abs(y - CONFIG.positions.base.y) < 4) {
      this.drawGateHighlights();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 1.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${stone[0] - dmgShade}, ${stone[1] - dmgShade}, ${stone[2] - dmgShade})`;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = `rgb(${stoneLight[0] - dmgShade}, ${stoneLight[1] - dmgShade}, ${stoneLight[2] - dmgShade})`;
    ctx.fillRect(x - r + 6, y - r + 6, r * 2 - 12, r * 2 - 12);

    ctx.fillStyle = `rgb(${stoneDark[0] - dmgShade}, ${stoneDark[1] - dmgShade}, ${stoneDark[2] - dmgShade})`;
    const cren = r * 2 / 5;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x - r + i * cren + 2, y - r - 8, cren - 4, 8);
    }

    const tw = r * 0.5;
    ctx.fillStyle = `rgb(${towerCol[0] - dmgShade}, ${towerCol[1] - dmgShade}, ${towerCol[2] - dmgShade})`;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      ctx.fillRect(x + sx * (r - tw / 2) - tw / 2, y + sy * (r - tw / 2) - tw / 2, tw, tw);
    }

    ctx.fillStyle = '#232830';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.12, r * 0.18, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - r * 0.18, y + r * 0.12, r * 0.36, r * 0.88);
    const gate = enemy ? 'rgba(255, 84, 92, 0.85)' : 'rgba(255, 209, 102, 0.85)';
    ctx.strokeStyle = gate;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - r * 0.18, y + r * 0.12, r * 0.36, r * 0.88);
    ctx.strokeStyle = enemy ? 'rgba(255, 84, 92, 0.7)' : 'rgba(255, 209, 102, 0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - r * 0.1, y + r * 0.12, r * 0.2, r * 0.88);

    ctx.strokeStyle = 'rgba(30, 33, 40, 0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y - r - 14);
    ctx.lineTo(x, y - r - 2);
    ctx.stroke();
    ctx.fillStyle = enemy ? '#ff4655' : '#3ddc84';
    ctx.beginPath();
    ctx.moveTo(x, y - r - 14);
    ctx.lineTo(x + r * 0.3, y - r - 10);
    ctx.lineTo(x, y - r - 6);
    ctx.closePath();
    ctx.fill();

    const st = performance.now() / 1000;
    for (let i = 0; i < 2; i++) {
      const sw = Math.sin(st * 0.6 + i * 2.4) * 5;
      const rise = (st * 7 + i * 24) % 30;
      ctx.fillStyle = `rgba(210, 220, 232, ${0.1 * (1 - rise / 30)})`;
      ctx.beginPath();
      ctx.arc(x + sw, y - r - 20 - rise, 4 + rise * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    if (ratio < 0.6) {
      ctx.strokeStyle = `rgba(20, 22, 28, ${0.5 + (0.6 - ratio) * 1.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, y - r * 0.6);
      ctx.lineTo(x - r * 0.4, y - r * 0.1);
      ctx.lineTo(x - r * 0.55, y + r * 0.45);
      ctx.moveTo(x + r * 0.2, y + r * 0.5);
      ctx.lineTo(x + r * 0.45, y + r * 0.05);
      ctx.lineTo(x + r * 0.7, y - r * 0.7);
      ctx.stroke();
    }
    if (ratio < 0.3) {
      ctx.fillStyle = 'rgba(20, 22, 28, 0.35)';
      ctx.fillRect(x - r * 0.15, y - r, r * 0.3, r * 2);
      ctx.fillRect(x - r, y - r * 0.15, r * 2, r * 0.3);
    }

    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    if (s.hp < s.maxHp) this.drawHpBar(x, y - r - 18, r * 2.4, 6, s.hp, s.maxHp);
  }

  private drawGateHighlights(): void {
    const { ctx } = this;
    const c = CONFIG.castle;
    const bx = CONFIG.positions.base.x;
    const by = CONFIG.positions.base.y;
    ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
    ctx.fillRect(bx - c.gateWidth / 2, by - c.wallHalf - 4, c.gateWidth, 8);
    ctx.fillRect(bx - c.gateWidth / 2, by + c.wallHalf - 4, c.gateWidth, 8);
    ctx.fillRect(bx - c.wallHalf - 4, by - c.gateWidth / 2, 8, c.gateWidth);
    ctx.fillRect(bx + c.wallHalf - 4, by - c.gateWidth / 2, 8, c.gateWidth);
  }

  private drawWall(s: Structure): void {
    const { ctx } = this;
    const ratio = Math.max(0, s.hp / s.maxHp);
    const dmgShade = Math.floor((1 - ratio) * 40);
    const baseShade = 123 - dmgShade;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2 + 2, s.w, s.h);
    ctx.fillStyle = `rgb(${baseShade}, ${baseShade + 10}, ${baseShade + 22})`;
    ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, Math.min(4, s.h));
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    if (s.w >= s.h) {
      ctx.beginPath();
      for (let mx = s.x - s.w / 2 + 14; mx < s.x + s.w / 2; mx += 14) {
        ctx.moveTo(mx, s.y - s.h / 2 + 1);
        ctx.lineTo(mx, s.y + s.h / 2 - 1);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      for (let my = s.y - s.h / 2 + 14; my < s.y + s.h / 2; my += 14) {
        ctx.moveTo(s.x - s.w / 2 + 1, my);
        ctx.lineTo(s.x + s.w / 2 - 1, my);
      }
      ctx.stroke();
    }
    if (ratio < 0.6) {
      ctx.strokeStyle = 'rgba(15, 17, 22, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const cx = s.x - s.w / 2 + (s.w / steps) * (i + 0.5);
        ctx.moveTo(cx - 4, s.y - s.h / 2 + 3);
        ctx.lineTo(cx, s.y + 3);
        ctx.lineTo(cx + 4, s.y - s.h / 2 + 3);
      }
      ctx.stroke();
    }
    if (ratio < 0.3) {
      ctx.fillStyle = 'rgba(15, 17, 22, 0.4)';
      ctx.fillRect(s.x - 3, s.y - s.h / 2, 6, s.h);
    }
    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fillRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h);
    }
    if (s.hp < s.maxHp) this.drawHpBar(s.x, s.y - s.h / 2 - 7, Math.min(s.w, 60), 4, s.hp, s.maxHp);
  }

  private drawTower(s: Structure): void {
    const { ctx } = this;
    const r = s.radius;
    const ratio = Math.max(0, s.hp / s.maxHp);
    const dmgShade = Math.floor((1 - ratio) * 50);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(s.x - r, s.y - r + 3, r * 2, r * 2);
    ctx.fillStyle = `rgb(${143 - dmgShade}, ${155 - dmgShade}, ${170 - dmgShade})`;
    ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(s.x - r, s.y - r, r * 2, r * 0.3);
    ctx.fillStyle = `rgb(${95 - dmgShade}, ${107 - dmgShade}, ${122 - dmgShade})`;
    ctx.fillRect(s.x - r * 0.95, s.y - r - 6, r * 0.7, 6);
    ctx.fillRect(s.x + r * 0.25, s.y - r - 6, r * 0.7, 6);
    ctx.fillStyle = '#1c2026';
    ctx.fillRect(s.x - 3, s.y - r * 0.55, 6, r * 0.55);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(s.x - 1.5, s.y - r * 0.55, 3, r * 0.55);
    const firing = s.flashTimer > 0;
    ctx.fillStyle = firing ? '#ffffff' : '#ffd166';
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.5, firing ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
    const bt = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(bt * 2.2 + s.x);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.16 + 0.18 * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.5, 7 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.8;
      ctx.fillStyle = `rgba(255, 235, 160, ${a})`;
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    if (ratio < 0.4) {
      ctx.strokeStyle = 'rgba(15, 17, 22, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x - r * 0.7, s.y - r * 0.7);
      ctx.lineTo(s.x - r * 0.2, s.y + r * 0.5);
      ctx.moveTo(s.x + r * 0.4, s.y + r * 0.4);
      ctx.lineTo(s.x + r * 0.7, s.y - r * 0.6);
      ctx.stroke();
    }
    if (s.hp < s.maxHp) this.drawHpBar(s.x, s.y - r - 13, r * 2, 4, s.hp, s.maxHp);
  }

  private drawHouse(s: Structure): void {
    const { ctx } = this;
    const r = s.radius;
    const ratio = Math.max(0, s.hp / s.maxHp);
    const dmgShade = Math.floor((1 - ratio) * 45);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(s.x - r, s.y - r * 0.6 + 3, r * 2, r * 1.6);
    ctx.fillStyle = `rgb(${200 - dmgShade}, ${166 - dmgShade}, ${118 - dmgShade})`;
    ctx.fillRect(s.x - r, s.y - r * 0.6, r * 2, r * 1.6);
    ctx.fillStyle = `rgb(${150 - dmgShade}, ${120 - dmgShade}, ${80 - dmgShade})`;
    ctx.beginPath();
    ctx.moveTo(s.x - r * 1.05, s.y - r * 0.55);
    ctx.lineTo(s.x, s.y - r * 1.5);
    ctx.lineTo(s.x + r * 1.05, s.y - r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a2c1a';
    ctx.fillRect(s.x - r * 0.28, s.y - r * 0.1, r * 0.56, r * 1.1);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.85)';
    ctx.fillRect(s.x - r * 0.16, s.y - r * 0.35, r * 0.1, r * 0.6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(s.x - r * 0.8, s.y - r * 0.5, r * 0.4, r * 0.28);
    ctx.fillRect(s.x + r * 0.4, s.y - r * 0.5, r * 0.4, r * 0.28);
    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fillRect(s.x - r, s.y - r * 1.5, r * 2, r * 2.1);
    }
    if (s.hp < s.maxHp) this.drawHpBar(s.x, s.y - r * 1.5 - 10, r * 2, 4, s.hp, s.maxHp);
  }

  private drawMarket(s: Structure): void {
    const { ctx } = this;
    const r = s.radius;
    const ratio = Math.max(0, s.hp / s.maxHp);
    const dmgShade = Math.floor((1 - ratio) * 45);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(s.x - r, s.y - r + 3, r * 2, r * 2);
    ctx.fillStyle = `rgb(${92 - dmgShade}, ${120 - dmgShade}, ${200 - dmgShade})`;
    ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(s.x - r, s.y - r, r * 2, r * 0.3);
    ctx.fillStyle = '#202a3a';
    ctx.fillRect(s.x - r * 0.7, s.y - r * 0.75, r * 0.42, r * 1.1);
    ctx.fillRect(s.x - r * 0.1, s.y - r * 0.75, r * 0.42, r * 1.1);
    ctx.fillRect(s.x + r * 0.5, s.y - r * 0.75, r * 0.42, r * 1.1);
    ctx.fillStyle = '#e8b96a';
    ctx.fillRect(s.x - r * 0.7, s.y - r * 0.15, r * 0.42, r * 0.5);
    ctx.fillRect(s.x - r * 0.1, s.y - r * 0.15, r * 0.42, r * 0.5);
    ctx.fillRect(s.x + r * 0.5, s.y - r * 0.15, r * 0.42, r * 0.5);
    const st = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(st * 3);
    ctx.fillStyle = `rgba(232, 185, 106, ${0.12 + 0.1 * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r + 5 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    if (s.flashTimer > 0) {
      const a = Math.min(1, s.flashTimer / CONFIG.ui.hitFlashDuration) * 0.7;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
    }
    if (s.hp < s.maxHp) this.drawHpBar(s.x, s.y - r - 12, r * 2, 4, s.hp, s.maxHp);
  }

  private drawBuildPreview(p: BuildPreview): void {
    const { ctx } = this;
    const cfg = CONFIG.progression.buildings[p.kind];
    const r = cfg.radius;
    const col = p.valid ? '61, 220, 132' : '255, 70, 85';
    ctx.fillStyle = `rgba(${col}, 0.22)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${col}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.stroke();
    if (p.kind === 'tower') {
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = `rgba(${col}, 0.55)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, CONFIG.progression.buildings.tower.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = p.valid ? '#3ddc84' : '#ff4655';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.valid ? '✓' : '✕', p.x, p.y - r - 10);
  }

  private drawUnits(camera: Camera, units: Unit[], selected: ReadonlySet<Unit>): void {
    const { ctx } = this;
    const view = camera.viewRect();
    const margin = 30;
    for (const u of units) {
      if (!u.alive) continue;
      if (u.x < view.x - margin || u.x > view.x + view.w + margin) continue;
      if (u.y < view.y - margin || u.y > view.y + view.h + margin) continue;
      this.drawUnitBody(u);
      if (u.flashTimer > 0) {
        const a = Math.min(1, u.flashTimer / CONFIG.ui.hitFlashDuration) * 0.75;
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (u.attackPhase > 0) {
        const ap = u.attackPhase / 0.18;
        const ar = u.radius + 3 + (1 - ap) * 6;
        ctx.globalAlpha = ap * 0.4;
        ctx.strokeStyle = u.troopType === 'champion' ? '#ffd166' : u.troopType === 'boss' ? '#ff4655' : '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, ar, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (selected.has(u)) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 6);
        const rr = u.radius + 4 + pulse * 1.5;
        ctx.fillStyle = 'rgba(141, 255, 176, 0.16)';
        ctx.beginPath();
        ctx.arc(u.x, u.y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(141, 255, 176, ${0.75 + pulse * 0.25})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(u.x, u.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (u.troopType === 'boss') {
        this.drawBossExtras(u);
      } else if (u.hp < u.maxHp) this.drawHpBar(u.x, u.y - u.radius - 7, u.radius * 2, 3, u.hp, u.maxHp);
    }
  }

  private drawSelectionGroup(selected: ReadonlySet<Unit>): void {
    if (selected.size === 0) return;
    const { ctx } = this;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const u of selected) {
      if (!u.alive) continue;
      if (u.x < minX) minX = u.x;
      if (u.y < minY) minY = u.y;
      if (u.x > maxX) maxX = u.x;
      if (u.y > maxY) maxY = u.y;
    }
    if (minX > maxX) return;
    const pad = 10;
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    ctx.fillStyle = 'rgba(141, 255, 176, 0.06)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(141, 255, 176, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    const cx = x + w / 2;
    const ty = Math.max(0, y - 16);
    const label = `${selected.size} tropas`;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    const tw = ctx.measureText(label).width + 14;
    ctx.fillStyle = 'rgba(10, 14, 19, 0.85)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, ty - 9, tw, 18, 9);
    ctx.fill();
    ctx.strokeStyle = 'rgba(141, 255, 176, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, ty - 9, tw, 18, 9);
    ctx.stroke();
    ctx.fillStyle = '#8dffb0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, ty);
  }

  private drawUnitBody(u: Unit): void {
    const { ctx } = this;
    const r = u.radius;
    const x = u.x;
    const y = u.y;
    const accent = u.team === 'player' ? '#ffffff' : '#2a0d12';
    switch (u.troopType) {
      case 'archer': {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.moveTo(x, y - r * 1.15);
        ctx.lineTo(x + r * 0.85, y + r * 0.8);
        ctx.lineTo(x - r * 0.85, y + r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.35);
        ctx.lineTo(x + r * 0.4, y + r * 0.8);
        ctx.lineTo(x - r * 0.4, y + r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.05, r * 0.45, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
        ctx.strokeStyle = u.color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(x + r * 0.7, y, r * 0.65, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,200,200,0.5)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.7, y - r * 0.55);
        ctx.lineTo(x + r * 0.7, y + r * 0.55);
        ctx.stroke();
        break;
      }
      case 'tank': {
        const tr = r * 1.15;
        ctx.fillStyle = u.color;
        ctx.fillRect(x - tr, y - tr, tr * 2, tr * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - tr, y - tr, tr * 2, tr * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fillRect(x - tr * 0.72, y - tr * 0.72, tr * 1.44, tr * 0.34);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - tr * 0.6, y - tr * 0.6, tr * 1.2, tr * 1.2);
        ctx.fillStyle = u.team === 'player' ? '#dceeff' : '#f0b6b0';
        ctx.fillRect(x - tr * 0.38, y - tr * 0.38, tr * 0.76, tr * 0.76);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, tr * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x - tr * 0.85, y - tr * 0.85, tr * 1.7, tr * 0.12);
        ctx.strokeRect(x - tr * 0.85, y + tr * 0.73, tr * 1.7, tr * 0.12);
        break;
      }
      case 'champion': {
        const t = performance.now() / 600;
        const auraA = 0.15 + Math.sin(t) * 0.08;
        ctx.strokeStyle = `rgba(255, 209, 102, ${auraA})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = u.color;
        star5(ctx, x, y, r + 1.5, r * 0.55);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'boss': {
        const bt = performance.now() / 800;
        const bAura = 0.25 + Math.sin(bt) * 0.1;
        ctx.strokeStyle = `rgba(255, 70, 85, ${bAura})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, y, r + 6 + Math.sin(bt) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 70, 85, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4655';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default: {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.28, y - r);
        ctx.lineTo(x + r * 0.88, y - r * 0.18);
        ctx.lineTo(x - r * 0.05, y + r * 0.85);
        ctx.lineTo(x - r * 0.82, y - r * 0.18);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.12, y - r * 0.1);
        ctx.lineTo(x - r * 0.12, y + r * 0.55);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(200,210,220,0.6)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.3, y - r * 0.9);
        ctx.lineTo(x + r * 0.75, y - r * 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + r * 0.22, y - r * 0.82);
        ctx.lineTo(x + r * 0.38, y - r * 0.98);
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,195,210,0.35)';
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y + r * 0.1, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,210,220,0.4)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(x - r * 0.4, y + r * 0.1, r * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(x, y - r * 0.1, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  private drawHpBar(x: number, y: number, width: number, height: number, hp: number, maxHp: number): void {
    const { ctx } = this;
    const ratio = Math.max(0, hp / maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - width / 2, y, width, height);
    ctx.fillStyle = ratio > 0.5 ? '#3ddc84' : ratio > 0.25 ? '#ffd166' : '#ff4655';
    ctx.fillRect(x - width / 2, y, width * ratio, height);
  }

  private drawBossExtras(u: Unit): void {
    const { ctx } = this;
    const ab = u.ability;
    if (ab && ab.phase === 'telegraph') {
      const progress = 1 - Math.max(0, ab.timer) / CONFIG.boss.abilityTelegraph;
      ctx.fillStyle = `rgba(255, 70, 85, ${0.1 + progress * 0.18})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, ab.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 70, 85, ${0.5 + progress * 0.5})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(u.x, u.y, ab.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ff4655';
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠️ ATAQUE DA RUÍNA', u.x, u.y - u.radius - 60);
    }
    if (ab && ab.phase === 'impact') {
      const t = 1 - Math.max(0, ab.timer) / CONFIG.boss.abilityImpact;
      ctx.fillStyle = `rgba(255, 140, 60, ${0.4 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, ab.radius * (0.3 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    const name = CONFIG.boss.name;
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(name).width + 12;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(u.x - tw / 2, u.y - u.radius - 52, tw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#ff6b7a';
    ctx.fillText(name, u.x, u.y - u.radius - 44);
    this.drawHpBar(u.x, u.y - u.radius - 31, u.radius * 2.4, 6, u.hp, u.maxHp);
  }

  private drawSelectionRect(rect: DragRect): void {
    const { ctx } = this;
    const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    grad.addColorStop(0, 'rgba(141, 255, 176, 0.16)');
    grad.addColorStop(1, 'rgba(56, 182, 255, 0.14)');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = 'rgba(141, 255, 176, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 5]);
    ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, Math.max(0, rect.w - 1.5), Math.max(0, rect.h - 1.5));
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(141, 255, 176, 0.9)';
    const cs = 3;
    for (const [cx, cy] of [
      [rect.x, rect.y],
      [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h],
      [rect.x + rect.w, rect.y + rect.h],
    ] as const) {
      ctx.fillRect(cx - cs, cy - cs, cs * 2, cs * 2);
    }
  }

  private drawMarkers(markers: WorldMarker[]): void {
    const { ctx } = this;
    ctx.textBaseline = 'alphabetic';
    for (const m of markers) {
      const t = Math.min(1, m.age / m.duration);
      if (m.kind === 'move') {
        const k = Math.sin(Math.min(1, t) * Math.PI);
        const r = 10 + t * 16;
        const fade = 1 - t;
        ctx.strokeStyle = `rgba(141, 255, 176, ${fade})`;
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(t * 0.9);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a + 0.45) * r * 0.32, Math.sin(a + 0.45) * r * 0.32);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.rotate(-t * 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, 3 + k * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(141, 255, 176, ${fade * 0.9})`;
        ctx.fill();
        ctx.restore();
      } else if (m.kind === 'hit') {
        const r = 4 + t * 10;
        ctx.strokeStyle = `rgba(255, 255, 255, ${1 - t})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (m.kind === 'damage') {
        const dmg = Number(m.text ?? '0');
        ctx.fillStyle =
          dmg >= 20 ? 'rgba(255, 70, 85, 1)' : dmg >= 12 ? 'rgba(255, 209, 102, 1)' : 'rgba(230, 237, 243, 0.9)';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(m.text ?? '', m.x, m.y - 8 - t * 18);
        ctx.fillText(m.text ?? '', m.x, m.y - 8 - t * 18);
      } else if (m.kind === 'death') {
        const r = 5 + t * 12;
        ctx.strokeStyle = `rgba(255, 143, 163, ${0.9 - t})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 143, 163, ${0.18 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.kind === 'denied') {
        ctx.fillStyle = `rgba(255, 70, 85, ${1 - t})`;
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(m.text ?? '!', m.x, m.y - 10 - t * 16);
        ctx.fillText(m.text ?? '!', m.x, m.y - 10 - t * 16);
      } else {
        ctx.fillStyle = `rgba(255, 209, 102, ${1 - t})`;
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(m.text ?? '+1', m.x, m.y - 10 - t * 16);
        ctx.fillText(m.text ?? '+1', m.x, m.y - 10 - t * 16);
      }
    }
  }

  private drawOverlay(o: RenderOverlay): void {
    const { ctx } = this;
    const p = Math.max(0, Math.min(1, o.progress));
    const inT = easeOut(Math.min(1, p / 0.4));
    ctx.fillStyle = `rgba(0, 0, 0, ${o.alpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = o.alpha * 0.35;
    ctx.fillStyle = o.tint;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;

    const t = performance.now() / 1000;
    for (let i = 0; i < 12; i++) {
      const px = (i * 137.5 + t * 16) % this.width;
      const py = ((i * 89.3 + t * 12 + Math.sin(t * 0.9 + i) * 30) % this.height + this.height) % this.height;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 * o.alpha})`;
      ctx.fillRect(px, py, 2, 2);
    }

    const scale = 0.9 + 0.1 * inT;
    const textAlpha = Math.min(1, o.alpha * 1.4) * (0.35 + 0.65 * inT);
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2 - 20);
    ctx.scale(scale, scale);
    ctx.globalAlpha = textAlpha;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e6edf3';
    ctx.font = '800 40px "Segoe UI", sans-serif';
    ctx.fillText(`${o.icon} ${o.title}`, 0, 0);
    ctx.fillStyle = `rgba(56, 182, 255, ${textAlpha})`;
    ctx.font = '600 20px "Segoe UI", sans-serif';
    ctx.fillText(o.subtitle, 0, 46);
    ctx.restore();
  }
}

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