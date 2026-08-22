export type EffectKind = 'spark' | 'smoke' | 'gold' | 'dust' | 'ring' | 'fade';

export interface Effect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: EffectKind;
  color: string;
  size: number;
}

const MAX_EFFECTS = 250;
const pool: Effect[] = [];

function spawn(
  kind: EffectKind,
  x: number, y: number,
  vx: number, vy: number,
  life: number, color: string, size: number,
): void {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].life <= 0) {
      Object.assign(pool[i], { x, y, vx, vy, life, maxLife: life, kind, color, size });
      return;
    }
  }
  if (pool.length < MAX_EFFECTS) {
    pool.push({ x, y, vx, vy, life, maxLife: life, kind, color, size });
  }
}

export function spawnSparks(x: number, y: number, count: number, color: string, speed = 120, life = 0.3): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    spawn('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), color, 1.5 + Math.random() * 1.5);
  }
}

export function spawnSmoke(x: number, y: number, count: number, color = 'rgba(160,160,170,0.5)', size = 3): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 15 + Math.random() * 25;
    spawn('smoke', x, y, Math.cos(a) * s, -20 - Math.random() * 30, 0.5 + Math.random() * 0.4, color, size + Math.random() * 2);
  }
}

export function spawnDust(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 10 + Math.random() * 20;
    spawn('dust', x, y, Math.cos(a) * s, Math.sin(a) * s - 10, 0.3 + Math.random() * 0.2, 'rgba(180,170,150,0.4)', 2 + Math.random() * 2);
  }
}

export function spawnRing(x: number, y: number, color: string, size = 4, life = 0.25): void {
  spawn('ring', x, y, 0, 0, life, color, size);
}

export function spawnFade(x: number, y: number, color: string, size: number, life = 0.35): void {
  spawn('fade', x, y, 0, 0, life, color, size);
}

export function spawnGoldFloat(x: number, y: number): void {
  spawn('gold', x + (Math.random() - 0.5) * 6, y, 0, -55, 0.85, '#ffd166', 10);
}

export function updateEffects(dt: number): void {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (e.life <= 0) continue;
    e.life -= dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.kind === 'smoke' || e.kind === 'dust') {
      e.vy -= 15 * dt;
      e.size += 3 * dt;
    }
  }
}

export function drawEffects(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < pool.length; i++) {
    const e = pool[i];
    if (e.life <= 0) continue;
    const a = Math.max(0, e.life / e.maxLife);
    switch (e.kind) {
      case 'spark': {
        ctx.globalAlpha = a;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * a, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'smoke': {
        ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dust': {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'gold': {
        ctx.globalAlpha = a;
        ctx.fillStyle = e.color;
        ctx.font = `bold ${Math.round(e.size)}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+🪙', e.x, e.y);
        break;
      }
      case 'ring': {
        ctx.globalAlpha = a * 0.7;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        const expand = 1 + (1 - a) * 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * expand, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'fade': {
        ctx.globalAlpha = a * 0.6;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 + (1 - a) * 0.5), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function clearEffects(): void {
  pool.length = 0;
}
