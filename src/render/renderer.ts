import type { Camera } from '../camera/camera';
import { BIOMES } from '../biomes/biomes';
import type { BiomeId } from '../biomes/biomes';
import { CONFIG } from '../config';
import type { Projectile } from '../combat/projectile';
import type { Structure } from '../entities/structures';
import type { Unit } from '../entities/unit';

interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
}

const BG_SCALE = 0.2;

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgBiome: BiomeId | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
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
  ): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = BIOMES[biome].background;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    this.drawBiomeBackground(biome);
    this.drawGrid(camera, biome);
    this.drawRoad(route);
    for (const s of structures) {
      if (s.alive) this.drawStructure(s);
      else this.drawRubble(s);
    }
    this.drawCart(cart);
    this.drawUnits(camera, units, selected);
    this.drawProjectiles(projectiles);
    this.drawMarkers(markers);
    this.drawSelectionGroup(selected);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (dragRect) this.drawSelectionRect(dragRect);
    if (overlay) this.drawOverlay(overlay);
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
      const tail = 0.018;
      const tx = p.x - p.vx * tail;
      const ty = p.y - p.vy * tail;
      const color = p.team === 'enemy' ? '#ff8fa3' : '#9ecbff';
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
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 3);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.1 + 0.08 * pulse})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius + 6 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5b12';
    ctx.font = 'bold 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', s.x, s.y + 0.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.9, r * 1.3, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgb(${143 - dmgShade}, ${155 - dmgShade}, ${170 - dmgShade})`;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = `rgb(${165 - dmgShade}, ${178 - dmgShade}, ${196 - dmgShade})`;
    ctx.fillRect(x - r + 6, y - r + 6, r * 2 - 12, r * 2 - 12);

    ctx.fillStyle = `rgb(${95 - dmgShade}, ${107 - dmgShade}, ${122 - dmgShade})`;
    const cren = r * 2 / 5;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x - r + i * cren + 2, y - r - 8, cren - 4, 8);
    }

    const tw = r * 0.5;
    ctx.fillStyle = `rgb(${123 - dmgShade}, ${133 - dmgShade}, ${145 - dmgShade})`;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      ctx.fillRect(x + sx * (r - tw / 2) - tw / 2, y + sy * (r - tw / 2) - tw / 2, tw, tw);
    }

    ctx.fillStyle = '#2c3138';
    ctx.fillRect(x - r * 0.3, y + r * 0.1, r * 0.6, r * 0.9);

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
    const firing = s.flashTimer > 0;
    ctx.fillStyle = firing ? '#ffffff' : '#ffd166';
    ctx.beginPath();
    ctx.arc(s.x, s.y - r * 0.5, firing ? 5 : 3, 0, Math.PI * 2);
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
    ctx.fillStyle = u.color;
    switch (u.troopType) {
      case 'archer':
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'tank':
        ctx.fillRect(u.x - u.radius, u.y - u.radius, u.radius * 2, u.radius * 2);
        break;
      case 'champion':
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'boss':
        ctx.strokeStyle = 'rgba(255, 70, 85, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4655';
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.arc(u.x + Math.cos(a) * u.radius, u.y + Math.sin(a) * u.radius, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius * 0.28, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
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

  private drawOverlay(overlay: RenderOverlay): void {
    const { ctx } = this;
    ctx.fillStyle = `rgba(0, 0, 0, ${overlay.alpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
    const textAlpha = Math.min(1, overlay.alpha * 1.4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(230, 237, 243, ${textAlpha})`;
    ctx.font = '800 44px "Segoe UI", sans-serif';
    ctx.fillText(overlay.title, this.width / 2, this.height / 2 - 18);
    ctx.fillStyle = `rgba(56, 182, 255, ${textAlpha})`;
    ctx.font = '600 22px "Segoe UI", sans-serif';
    ctx.fillText(overlay.subtitle, this.width / 2, this.height / 2 + 24);
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