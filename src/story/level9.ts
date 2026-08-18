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
    at: 4,
    center,
    from: 'w',
    point: { x: center.x - 900, y: center.y },
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 11,
    center,
    from: 'n',
    point: { x: center.x, y: center.y - 900 },
    groups: [{ type: 'knight', count: 3 }],
    msg: '',
    spawned: false,
  },
  {
    at: 24,
    center,
    from: 'n',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 34,
    center,
    from: 's',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 48,
    center,
    from: 'e',
    point: { x: center.x + 950, y: center.y },
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 2 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 58,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 2 },
      { type: 'tank', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 74,
    center,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 84,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 98,
    center,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 98,
    center,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 98,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 2 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 98,
    center,
    from: 'w',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 2 },
    ],
    msg: '',
    spawned: false,
  },
];

interface Announcement {
  at: number;
  msg: string;
  done: boolean;
}

const ANNOUNCEMENTS: Announcement[] = [
  { at: 1, msg: 'A marcha começa! Avance para interceptar a vanguarda inimiga.', done: false },
  { at: 22, msg: 'O castelo está sob ataque! Defenda os portões.', done: false },
  { at: 46, msg: 'Posição inimiga ao leste! Avance e destrua o acampamento.', done: false },
  { at: 72, msg: 'Nova ofensiva! Repila o ataque às muralhas.', done: false },
  { at: 96, msg: 'BATALHA FINAL! O exército inimigo ataca em força total.', done: false },
];

let base: Structure | null = null;
let elapsed = 0;
let won = false;

function statsOf(s: LevelStats): { label: string; value: string }[] {
  return [
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level9: LevelDef = {
  number: 9,
  id: 'level9',
  name: 'Marcha do Exército',
  description:
    'A marcha final. Avance, defenda, ataque e resista em etapas até a grande batalha final. Use cada classe e cada lição aprendida.',
  objective: 'Supere todas as etapas da marcha até a vitória final.',
  biome: 'ruins',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.losses <= 10,
  star3: (s) => s.losses <= 5 && s.castlePct >= 60,
  summary: statsOf,

  setup(ctx) {
    level9.result = 'running';
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    for (const an of ANNOUNCEMENTS) an.done = false;
    placeArmy(ctx, center, { knight: 12, archer: 6, tank: 4, champion: 1 });
    ctx.showMessage(`${level9.description} Objetivo: ${level9.objective}`);
  },

  update(ctx, dt) {
    if (level9.result !== 'running') return;
    if (!base || !base.alive) {
      level9.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const an of ANNOUNCEMENTS) {
      if (!an.done && elapsed >= an.at) {
        an.done = true;
        ctx.showMessage(an.msg);
      }
    }
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = a.point ?? attackPoint(a.center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level9.result = 'won';
      ctx.hideTutorial();
    }
  },
};