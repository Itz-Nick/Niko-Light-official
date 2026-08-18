import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { attackPoint, anyEnemyAlive, spawnGroup } from './helpers';
import type { Direction, GroupSpec } from './helpers';
import { formatTime } from './story';
import type { LevelContext, LevelDef, LevelStats } from './story';

const center = CONFIG.positions.base;
const DIST = 470;

interface Attack {
  at: number;
  from: Direction;
  groups: GroupSpec[];
  msg: string;
  spawned: boolean;
}

const ATTACKS: Attack[] = [
  {
    at: 6,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Ataque pelo norte! Observe o mapa e prepare suas posições.',
    spawned: false,
  },
  {
    at: 16,
    from: 's',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Inimigos pelo sul! Reposicione suas tropas.',
    spawned: false,
  },
  {
    at: 26,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Emboscada pelo leste! Divida grupos e use formações.',
    spawned: false,
  },
  {
    at: 36,
    from: 'w',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 2 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Oeste sob ataque! Antecipe a próxima direção.',
    spawned: false,
  },
  {
    at: 48,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Ataque combinado de todas as direções! Mantenha os grupos em posição.',
    spawned: false,
  },
  {
    at: 48,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 48,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 2 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 48,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 2 },
    ],
    msg: '',
    spawned: false,
  },
];

let base: Structure | null = null;
let ctxRef: LevelContext | null = null;
let elapsed = 0;
let tutorialStep = 1;
let won = false;

function statsOf(s: LevelStats): { label: string; value: string }[] {
  return [
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Minas', value: `${Math.round(s.minesPct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level6: LevelDef = {
  number: 6,
  id: 'level6',
  name: 'Emboscada',
  description:
    'O inimigo ataca de todas as direções ao mesmo tempo. Divida grupos, reposicione e proteja o castelo e as minas.',
  objective: 'Sobreviva ao ataque combinado sem perder o castelo.',
  biome: 'ruins',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.castlePct >= 60,
  star3: (s) => s.castlePct >= 75 && s.losses <= 8 && s.minesPct >= 50,
  summary: statsOf,

  setup(ctx) {
    level6.result = 'running';
    ctxRef = ctx;
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    tutorialStep = 1;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeRing(ctx, 'tank', 5, 85);
    placeRing(ctx, 'knight', 10, 115);
    placeRing(ctx, 'archer', 5, 155);
    placeRing(ctx, 'champion', 1, 115);
    ctx.showMessage(`${level6.description} Objetivo: ${level6.objective}`);
  },

  update(ctx, dt) {
    if (level6.result !== 'running') return;
    if (!base || !base.alive || base.hp <= 0) {
      level6.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = attackPoint(center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
        if (a.msg && tutorialStep >= 2) ctx.showMessage(a.msg);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level6.result = 'won';
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

function placeRing(ctx: LevelContext, type: 'knight' | 'archer' | 'tank' | 'champion', count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (type === 'champion' ? 0.7 : 0);
    ctx.createPlayerUnit(type, center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius);
  }
}