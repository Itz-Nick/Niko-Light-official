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
      { type: 'knight', count: 3 },
      { type: 'tank', count: 2 },
    ],
    msg: 'Inimigos resistentes ao norte! Posicione os tanques na frente da linha.',
    spawned: false,
  },
  {
    at: 16,
    from: 's',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 2 },
      { type: 'archer', count: 1 },
    ],
    msg: 'Avanço pelo sul. Tanques absorvem o dano enquanto os arqueiros atacam atrás.',
    spawned: false,
  },
  {
    at: 28,
    from: 'e',
    groups: [
      { type: 'tank', count: 3 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Tanques pelo leste! Os cavaleiros podem responder rapidamente a ameaças laterais.',
    spawned: false,
  },
  {
    at: 40,
    from: 'w',
    groups: [
      { type: 'knight', count: 5 },
      { type: 'tank', count: 3 },
      { type: 'archer', count: 2 },
    ],
    msg: 'Maior pressão pelo oeste. Mantenha a linha de tanques à frente.',
    spawned: false,
  },
  {
    at: 52,
    from: 'n',
    groups: [
      { type: 'knight', count: 4 },
      { type: 'tank', count: 4 },
    ],
    msg: 'Última ofensiva! Seus tanques precisam segurar a linha.',
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
    { label: 'Tanques restantes', value: `${s.aliveTanks}/5` },
    { label: 'Castelo', value: `${Math.round(s.castlePct)}% HP` },
    { label: 'Tropas perdidas', value: `${s.losses}` },
    { label: 'Tempo', value: formatTime(s.time) },
  ];
}

export const level5: LevelDef = {
  number: 5,
  id: 'level5',
  name: 'Linha de Ferro',
  description:
    'Inimigos resistentes avançam contra o castelo. Forme uma linha de tanques na frente, arqueiros na retaguarda e use os cavaleiros como apoio.',
  objective: 'Sobreviva a todos os ataques mantendo seus tanques vivos.',
  biome: 'desert',
  hasCart: false,
  hasCastle: true,
  route: [],
  result: 'running',

  star2: (s) => s.aliveTanks >= 3,
  star3: (s) => s.aliveTanks >= 4 && s.losses <= 6,
  summary: statsOf,

  setup(ctx) {
    level5.result = 'running';
    ctxRef = ctx;
    base = ctx.createBase();
    ctx.createDefense();
    ctx.createMines();
    elapsed = 0;
    tutorialStep = 1;
    won = false;
    for (const a of ATTACKS) a.spawned = false;
    placeRing(ctx, 'tank', 5, 85);
    placeRing(ctx, 'knight', 8, 115);
    placeRing(ctx, 'archer', 5, 155);
    ctx.showMessage(`${level5.description} Objetivo: ${level5.objective}`);
  },

  update(ctx, dt) {
    if (level5.result !== 'running') return;
    if (!base || !base.alive || base.hp <= 0) {
      level5.result = 'lost';
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
      level5.result = 'won';
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

function placeRing(ctx: LevelContext, type: 'knight' | 'archer' | 'tank', count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    ctx.createPlayerUnit(type, center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius);
  }
}