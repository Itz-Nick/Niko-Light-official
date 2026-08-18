import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { attackPoint, anyEnemyAlive, spawnGroup } from './helpers';
import type { Direction, GroupSpec } from './helpers';
import { formatTime } from './story';
import type { LevelContext, LevelDef, LevelStats } from './story';

const centerA = CONFIG.positions.base;
const centerB = { x: centerA.x, y: centerA.y + 850 };
const DIST = 470;

interface Attack {
  at: number;
  center: { x: number; y: number };
  from: Direction;
  groups: GroupSpec[];
  msg: string;
  spawned: boolean;
}

const ATTACKS: Attack[] = [
  {
    at: 5,
    center: centerA,
    from: 'n',
    groups: [{ type: 'knight', count: 4 }],
    msg: 'Inimigos pelo norte! Envie um grupo para o posto norte.',
    spawned: false,
  },
  {
    at: 14,
    center: centerB,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 1 },
    ],
    msg: 'O posto sul está sob ataque! Divida seu exército para cobrir os dois lados.',
    spawned: false,
  },
  {
    at: 26,
    center: centerA,
    from: 'e',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Mais inimigos no norte! Reforce o posto norte.',
    spawned: false,
  },
  {
    at: 38,
    center: centerB,
    from: 's',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Pressão no sul! Observe o mapa e não reaja tarde demais.',
    spawned: false,
  },
  {
    at: 50,
    center: centerA,
    from: 'n',
    groups: [{ type: 'knight', count: 4 }],
    msg: 'Ataque combinado! Um grande exército precisa ser dividido.',
    spawned: false,
  },
  {
    at: 50,
    center: centerB,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
];

let baseA: Structure | null = null;
let baseB: Structure | null = null;
let ctxRef: LevelContext | null = null;
let elapsed = 0;
let tutorialStep = 1;
let won = false;

function statsOf(s: LevelStats): { label: string; value: string }[] {
  const north = s.basesPct[0] ?? 0;
  const south = s.basesPct[1] ?? 0;
  return [
    { label: 'Posto norte', value: `${Math.round(north)}% HP` },
    { label: 'Posto sul', value: `${Math.round(south)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level4: LevelDef = {
  number: 4,
  id: 'level4',
  name: 'Duas Frentes',
  description:
    'O inimigo descobriu nossas posições. Prepare seus grupos para defender mais de um ponto ao mesmo tempo.',
  objective: 'Defenda os dois postos sem deixar nenhum ser destruído.',
  biome: 'field',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.basesPct.length >= 2 && s.basesPct.every((p) => p >= 50),
  star3: (s) => s.losses <= 4 && s.basesPct.length >= 2 && s.basesPct.every((p) => p >= 70),
  summary: statsOf,

  setup(ctx) {
    level4.result = 'running';
    ctxRef = ctx;
    baseA = ctx.createBase();
    baseB = ctx.createBaseAt(centerB.x, centerB.y);
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    tutorialStep = 1;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeRing(ctx, 'knight', 10, 95);
    placeRing(ctx, 'archer', 5, 140);
    placeRing(ctx, 'champion', 1, 95);
    ctx.showMessage(`${level4.description} Objetivo: ${level4.objective}`);
  },

  update(ctx, dt) {
    if (level4.result !== 'running') return;
    if (!baseA || !baseA.alive || !baseB || !baseB.alive) {
      level4.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = attackPoint(a.center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
        if (a.msg && tutorialStep >= 2) ctx.showMessage(a.msg);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level4.result = 'won';
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

function placeRing(ctx: LevelContext, type: 'knight' | 'archer' | 'champion', count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (type === 'champion' ? 0.5 : 0);
    ctx.createPlayerUnit(type, centerA.x + Math.cos(a) * radius, centerA.y + Math.sin(a) * radius);
  }
}