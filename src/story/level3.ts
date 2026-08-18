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
    at: 5,
    from: 'n',
    groups: [{ type: 'knight', count: 5 }],
    msg: 'Corpo a corpo ao norte! Seus arqueiros atacam de longe.',
    spawned: false,
  },
  {
    at: 13,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 1 },
    ],
    msg: 'Ao sul há alvos resistentes. Proteja seus arqueiros atrás da linha de frente.',
    spawned: false,
  },
  {
    at: 22,
    from: 'e',
    groups: [
      { type: 'knight', count: 3 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Arqueiros inimigos pelo leste! Se seus arqueiros ficarem expostos, eles são vulneráveis.',
    spawned: false,
  },
  {
    at: 32,
    from: 'w',
    groups: [
      { type: 'tank', count: 2 },
      { type: 'knight', count: 4 },
    ],
    msg: 'Tanques ao oeste avançando. Cavaleiros na frente, arqueiros atrás.',
    spawned: false,
  },
  {
    at: 44,
    from: 'n',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'archer', count: 3 },
      { type: 'tank', count: 2 },
    ],
    msg: 'Último ataque! Mantenha a linha de frente e proteja seus arqueiros.',
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
    { label: 'Arqueiros restantes', value: `${s.aliveArchers}/5` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level3: LevelDef = {
  number: 3,
  id: 'level3',
  name: 'Flechas na Névoa',
  description:
    'A névoa esconde os inimigos. Posicione os cavaleiros na linha de frente e os arqueiros na retaguarda para atacar com segurança.',
  objective: 'Derrote todos os ataques protegendo seus arqueiros.',
  biome: 'snow',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.aliveArchers >= 3,
  star3: (s) => s.aliveArchers >= 4 && s.castlePct >= 70,
  summary: statsOf,

  setup(ctx) {
    level3.result = 'running';
    ctxRef = ctx;
    base = ctx.createBase();
    ctx.createDefense();
    elapsed = 0;
    tutorialStep = 1;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeRing(ctx, 'knight', 10, 95);
    placeRing(ctx, 'archer', 5, 150);
    ctx.showMessage(`${level3.description} ${level3.objective}`);
  },

  update(ctx, dt) {
    if (level3.result !== 'running') return;
    if (!base || !base.alive || base.hp <= 0) {
      level3.result = 'lost';
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
      level3.result = 'won';
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

function placeRing(ctx: LevelContext, type: 'knight' | 'archer', count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.createPlayerUnit(type, center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius);
  }
}