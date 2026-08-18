import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { anyEnemyAlive, attackPoint, placeArmy, spawnGroup } from './helpers';
import type { Direction, GroupSpec } from './helpers';
import { formatTime } from './story';
import type { LevelDef, LevelStats } from './story';

const center = CONFIG.positions.base;
const DIST = 470;

interface Attack {
  at: number;
  center: { x: number; y: number };
  from: Direction;
  point?: { x: number; y: number };
  groups: GroupSpec[];
  msg: string;
  spawned: boolean;
}

const ATTACKS: Attack[] = [
  {
    at: 5,
    center,
    from: 'n',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    msg: 'O cerco começa! O inimigo avança pelo portão norte.',
    spawned: false,
  },
  {
    at: 13,
    center,
    from: 's',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Portão sul sob pressão!',
    spawned: false,
  },
  {
    at: 23,
    center,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Dois portões ao mesmo tempo! Divida a defesa.',
    spawned: false,
  },
  {
    at: 23,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 33,
    center,
    from: 'n',
    point: { x: center.x - 350, y: center.y - 500 },
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Inimigos tentam romper as muralhas a noroeste!',
    spawned: false,
  },
  {
    at: 43,
    center,
    from: 's',
    point: { x: center.x + 500, y: center.y + 550 },
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Ruptura iminente a sudeste!',
    spawned: false,
  },
  {
    at: 53,
    center,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: 'A pressão aumenta em todos os lados!',
    spawned: false,
  },
  {
    at: 53,
    center,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 63,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Cerco final! Muralhas, torres e tropas devem resistir até o fim.',
    spawned: false,
  },
  {
    at: 63,
    center,
    from: 'w',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 63,
    center,
    from: 'n',
    point: { x: center.x + 350, y: center.y - 500 },
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 63,
    center,
    from: 's',
    point: { x: center.x - 500, y: center.y + 550 },
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
];

let base: Structure | null = null;
let elapsed = 0;
let won = false;

function statsOf(s: LevelStats): { label: string; value: string }[] {
  return [
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Muralhas', value: `${Math.round(s.wallsPct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level8: LevelDef = {
  number: 8,
  id: 'level8',
  name: 'O Cerco',
  description:
    'O castelo está cercado. Muralhas, portões, torres e minas precisam segurar o grande ataque — tropas e formações decidem o resultado.',
  objective: 'Sobreviva ao cerco mantendo o castelo preservado.',
  biome: 'desert',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.castlePct >= 60,
  star3: (s) => s.castlePct >= 80 && s.wallsPct >= 40,
  summary: statsOf,

  setup(ctx) {
    level8.result = 'running';
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeArmy(ctx, center, { knight: 12, archer: 6, tank: 3, champion: 1 });
    ctx.showMessage(`${level8.description} Objetivo: ${level8.objective}`);
  },

  update(ctx, dt) {
    if (level8.result !== 'running') return;
    if (!base || !base.alive) {
      level8.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = a.point ?? attackPoint(a.center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
        if (a.msg) ctx.showMessage(a.msg);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level8.result = 'won';
      ctx.hideTutorial();
    }
  },
};