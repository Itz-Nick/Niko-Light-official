import { CONFIG } from '../config';
import type { Structure } from '../entities/structures';
import { attackPoint, placeArmy, spawnGroup } from './helpers';
import type { Direction, GroupSpec } from './helpers';
import { formatTime } from './story';
import type { LevelContext, LevelDef, LevelStats } from './story';

const center = CONFIG.positions.base;
const DIST = 470;
const BOSS_AT = 45;

interface Attack {
  at: number;
  from: Direction;
  groups: GroupSpec[];
  spawned: boolean;
}

const PREP_ATTACKS: Attack[] = [
  {
    at: 3,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 11,
    from: 's',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 20,
    from: 'e',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'archer', count: 1 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 29,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
];

const REINFORCEMENTS: Attack[] = [
  {
    at: 55,
    from: 'n',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 70,
    from: 's',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 85,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
  {
    at: 85,
    from: 'w',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'tank', count: 1 },
    ],
    spawned: false,
  },
];

let base: Structure | null = null;
let elapsed = 0;
let won = false;
let bossSpawned = false;

function bossAlive(ctx: LevelContext): boolean {
  for (const u of ctx.units) {
    if (u.alive && u.troopType === 'boss') return true;
  }
  return false;
}

function statsOf(s: LevelStats): { label: string; value: string }[] {
  return [
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level10: LevelDef = {
  number: 10,
  id: 'level10',
  name: 'Senhor da Ruína',
  description:
    'A batalha final. Repila o ataque inicial, prepare a defesa e enfrente o comandante inimigo.',
  objective: 'Derrote o Senhor da Ruína.',
  biome: 'volcanic',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.castlePct >= 55,
  star3: (s) => s.castlePct >= 75 && s.losses <= 6,
  summary: statsOf,

  setup(ctx) {
    level10.result = 'running';
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    won = false;
    bossSpawned = false;
    for (const a of PREP_ATTACKS) a.spawned = false;
    for (const a of REINFORCEMENTS) a.spawned = false;
    placeArmy(ctx, center, { knight: 12, archer: 6, tank: 4, champion: 1 });
    ctx.showMessage(`${level10.description} ${level10.objective}`);
  },

  update(ctx, dt) {
    if (level10.result !== 'running') return;
    if (!base || !base.alive) {
      level10.result = 'lost';
      ctx.hideTutorial();
      return;
    }

    elapsed += dt;

    for (const a of PREP_ATTACKS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = attackPoint(center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
      }
    }

    if (!bossSpawned && elapsed >= BOSS_AT) {
      bossSpawned = true;
      ctx.spawnEnemy('boss', center.x, center.y - 1150);
      ctx.showMessage('👹 SENHOR DA RUÍNA — O comandante finalmente apareceu.');
    }

    for (const a of REINFORCEMENTS) {
      if (!a.spawned && elapsed >= a.at) {
        a.spawned = true;
        const p = attackPoint(center, a.from, DIST);
        spawnGroup(ctx, p.x, p.y, a.groups, 150);
      }
    }

    if (bossSpawned && !won && !bossAlive(ctx)) {
      won = true;
      level10.result = 'won';
      ctx.hideTutorial();
    }
  },
};