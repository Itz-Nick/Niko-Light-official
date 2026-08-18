import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { formatTime } from './story';
import type { LevelContext, LevelDef, LevelStats } from './story';

const route = [
  { x: 700, y: 1500 },
  { x: 2300, y: 1500 },
];

let cart: Structure | null = null;
let ctxRef: LevelContext | null = null;
let traveled = 0;
let totalDistance = 0;
let elapsed = 0;
let tutorialStep = 1;
let northSpawned = false;
let southSpawned = false;
let doubleSpawned = false;
let finalSpawned = false;

function statsOf(s: LevelStats): { label: string; value: string }[] {
  return [
    { label: 'Carroça', value: `${Math.round(s.cartPct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level1: LevelDef = {
  number: 1,
  id: 'level1',
  name: 'Escolta Real',
  description:
    'Você comanda 10 cavaleiros escoltando uma carroça carregada de ouro. Selecione um grupo (clique ou arraste) e envie-o com o botão direito para acompanhar a carroça.',
  objective: 'Proteja a carroça de ouro até o destino.',
  biome: 'field',
  hasCart: true,
  hasCastle: false,
  route,
  result: 'running',

  star2: (s) => s.cartPct >= 65,
  star3: (s) => s.cartPct >= 85 && s.losses <= 2,
  summary: statsOf,

  setup(ctx) {
    level1.result = 'running';
    ctxRef = ctx;
    cart = ctx.createCart(route[0].x, route[0].y);
    traveled = 0;
    elapsed = 0;
    totalDistance = routeLength(route);
    tutorialStep = 1;
    northSpawned = false;
    southSpawned = false;
    doubleSpawned = false;
    finalSpawned = false;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.createPlayerUnit('knight', cart.x + Math.cos(a) * 80, cart.y + Math.sin(a) * 80);
    }
    ctx.showMessage(`${level1.description} Objetivo: ${level1.objective}`);
  },

  update(ctx, dt) {
    if (level1.result !== 'running') return;
    if (!cart || !cart.alive) {
      level1.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    const cartSpeed = CONFIG.story.cart.speed;
    const next = pointAlongRoute(route, traveled + cartSpeed * dt);
    traveled += cartSpeed * dt;
    cart.x = next.x;
    cart.y = next.y;
    if (traveled >= totalDistance) {
      level1.result = 'won';
      ctx.hideTutorial();
      return;
    }

    if (elapsed >= 3 && !northSpawned) {
      northSpawned = true;
      spawnBand(ctx, 4, -900);
      if (tutorialStep === 2) {
        ctx.showMessage('⚠️ Ataque pelo norte! Envie tropas para interceptar os invasores.');
        tutorialStep = 3;
      }
    }
    if (elapsed >= 10 && !southSpawned) {
      southSpawned = true;
      spawnBand(ctx, 4, 900);
      if (tutorialStep === 3) {
        ctx.showMessage('Mais inimigos pelo sul! Divida suas tropas para proteger a carroça dos dois lados.');
        tutorialStep = 4;
      }
    }
    if (elapsed >= 18 && !doubleSpawned) {
      doubleSpawned = true;
      spawnBand(ctx, 3, -900);
      spawnBand(ctx, 3, 900);
      if (tutorialStep === 4) {
        ctx.showMessage('Inimigos dos dois lados! Reposicione seus grupos rapidamente.');
        tutorialStep = 5;
      }
    }
    if (elapsed >= 25 && !finalSpawned) {
      finalSpawned = true;
      spawnBand(ctx, 3, -900);
      spawnBand(ctx, 3, 900);
      ctx.hideTutorial();
    }
  },

  onMoveCommand() {
    if (tutorialStep === 1) tutorialStep = 2;
    ctxRef?.hideTutorial();
  },

  onFormation() {
    ctxRef?.hideTutorial();
  },
};

function spawnBand(ctx: LevelContext, count: number, dy: number): void {
  if (!cart) return;
  for (let i = 0; i < count; i++) {
    const x = cart.x + (Math.random() - 0.5) * 500;
    const y = cart.y + dy + (Math.random() - 0.5) * 120;
    ctx.spawnEnemy('knight', x, y);
  }
}

function routeLength(routePts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < routePts.length; i++) {
    len += Math.hypot(routePts[i].x - routePts[i - 1].x, routePts[i].y - routePts[i - 1].y);
  }
  return len;
}

function pointAlongRoute(routePts: { x: number; y: number }[], dist: number): { x: number; y: number } {
  if (dist <= 0) return { x: routePts[0].x, y: routePts[0].y };
  let acc = 0;
  for (let i = 1; i < routePts.length; i++) {
    const dx = routePts[i].x - routePts[i - 1].x;
    const dy = routePts[i].y - routePts[i - 1].y;
    const seg = Math.hypot(dx, dy);
    if (acc + seg >= dist) {
      const t = seg === 0 ? 0 : (dist - acc) / seg;
      return { x: routePts[i - 1].x + dx * t, y: routePts[i - 1].y + dy * t };
    }
    acc += seg;
  }
  return { x: routePts[routePts.length - 1].x, y: routePts[routePts.length - 1].y };
}