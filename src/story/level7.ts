import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { anyEnemyAlive, attackPoint, placeArmy, spawnGroup } from './helpers';
import type { Direction, GroupSpec } from './helpers';
import { formatTime } from './story';
import type { LevelDef, LevelStats } from './story';

const center = CONFIG.positions.base;

const MINE_POSITIONS = [
  { x: center.x, y: center.y - 310 },
  { x: center.x, y: center.y + 310 },
  { x: center.x + 310, y: center.y },
  { x: center.x - 310, y: center.y },
  { x: center.x, y: center.y - 740 },
  { x: center.x, y: center.y + 740 },
];

const DIST = 500;
const ASSAULT_SPREAD = 40;

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
    msg: 'Inimigos pelo norte! Eles estão no caminho das minas.',
    spawned: false,
  },
  {
    at: 13,
    center,
    from: 's',
    groups: [{ type: 'knight', count: 3 }],
    msg: 'O sul também está ameaçado. Proteja minas e castelo.',
    spawned: false,
  },
  {
    at: 22,
    center,
    from: 'n',
    point: { x: center.x, y: center.y - 740 },
    groups: [
      { type: 'knight', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: 'A mina ao norte está sob ataque direto!',
    spawned: false,
  },
  {
    at: 30,
    center,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Inimigos pelo leste!',
    spawned: false,
  },
  {
    at: 38,
    center,
    from: 'w',
    groups: [{ type: 'knight', count: 3 }],
    msg: '',
    spawned: false,
  },
  {
    at: 48,
    center,
    from: 's',
    point: { x: center.x, y: center.y + 740 },
    groups: [
      { type: 'knight', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: 'As minas ao sul estão sob ataque! Recursos também precisam de proteção.',
    spawned: false,
  },
  {
    at: 58,
    center,
    from: 'n',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Ataque final! Decida onde o exército é mais necessário.',
    spawned: false,
  },
  {
    at: 58,
    center,
    from: 's',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
      { type: 'archer', count: 1 },
    ],
    msg: '',
    spawned: false,
  },
  {
    at: 58,
    center,
    from: 'e',
    groups: [{ type: 'knight', count: 3 }],
    msg: '',
    spawned: false,
  },
  {
    at: 58,
    center,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
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
    { label: 'Minas', value: `${Math.round(s.minesPct)}% HP` },
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level7: LevelDef = {
  number: 7,
  id: 'level7',
  name: 'Minas Perdidas',
  description:
    'O inimigo quer tomar as minas de ouro. Recursos também precisam ser protegidos — nem sempre a posição mais importante está dentro do castelo.',
  objective: 'Proteja as minas e o castelo. Decida onde o exército é mais necessário.',
  biome: 'field',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.minesPct >= 50,
  star3: (s) => s.losses <= 6 && s.minesPct >= 90,
  summary: statsOf,

  setup(ctx) {
    level7.result = 'running';
    base = ctx.createBase();
    ctx.createDefense();
    for (const p of MINE_POSITIONS) ctx.createMineAt(p.x, p.y);
    elapsed = 0;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeArmy(ctx, center, { knight: 10, archer: 5, tank: 2, champion: 1 });
    ctx.showMessage(`${level7.description} Objetivo: ${level7.objective}`);
  },

  update(ctx, dt) {
    if (level7.result !== 'running') return;
    const baseAlive = base ? base.alive : false;
    const minesAlive = ctx.structures.some((s) => s.kind === 'mine' && s.alive);
    if (!baseAlive || !minesAlive) {
      level7.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;
    for (const a of ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = a.point ?? attackPoint(a.center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, a.point ? ASSAULT_SPREAD : 140);
        if (a.msg) ctx.showMessage(a.msg);
      }
    }

    const allSpawned = ATTACKS.every((a) => a.spawned);
    if (allSpawned && !won && !anyEnemyAlive(ctx)) {
      won = true;
      level7.result = 'won';
      ctx.hideTutorial();
    }
  },
};
