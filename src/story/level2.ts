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
    at: 4,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Inimigos estão se aproximando pelo norte.',
    spawned: false,
  },
  {
    at: 16,
    from: 's',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Mais inimigos vêm do sul! Proteja uma das entradas.',
    spawned: false,
  },
  {
    at: 30,
    from: 'e',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'archer', count: 3 },
    ],
    msg: 'Ataque pelo leste! Reforce a entrada.',
    spawned: false,
  },
  {
    at: 44,
    from: 'w',
    groups: [
      { type: 'knight', count: 6 },
      { type: 'tank', count: 3 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Ataque maior pelo oeste! Defenda o castelo em vez de perseguir todos os inimigos.',
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
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level2: LevelDef = {
  number: 2,
  id: 'level2',
  name: 'O Primeiro Cerco',
  description:
    'O castelo está sob ataque. Posicione suas tropas perto das entradas e mova-as entre as direções conforme os inimigos avançam.',
  objective: 'Sobreviva a todos os ataques sem perder o castelo.',
  biome: 'field',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.castlePct >= 60,
  star3: (s) => s.castlePct >= 85 && s.losses <= 5,
  summary: statsOf,

  setup(ctx) {
    level2.result = 'running';
    ctxRef = ctx;
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    tutorialStep = 1;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeRing(ctx, 'knight', 10, 95);
    placeRing(ctx, 'tank', 5, 130);
    ctx.showMessage(`${level2.description} ${level2.objective}`);
  },

  update(ctx, dt) {
    if (level2.result !== 'running') return;
    if (!base || !base.alive || base.hp <= 0) {
      level2.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = attackPoint(center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
        if (tutorialStep >= 2) ctx.showMessage(a.msg);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level2.result = 'won';
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

function placeRing(ctx: LevelContext, type: 'knight' | 'tank', count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.createPlayerUnit(type, center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius);
  }
}