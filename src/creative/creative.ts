import { CONFIG } from '../config';
import type { Structure, StructureKind } from '../entities/structures';
import { createUnit } from '../entities/unit';
import type { Unit } from '../entities/unit';
import type { TroopType } from '../types';

export type CreativeTeam = 'blue' | 'red';
export type CreativeEntityKind = 'unit' | 'structure';
export type CreativeEntityType = TroopType | StructureKind;
export type CreativePhase = 'prep' | 'countdown' | 'battle';

export interface CreativePick {
  kind: CreativeEntityKind;
  type: CreativeEntityType;
}

export interface CreativeEntity {
  id: number;
  team: CreativeTeam;
  kind: CreativeEntityKind;
  type: CreativeEntityType;
  x: number;
  y: number;
  rot: number;
}

export interface CreativeScenario {
  width: number;
  height: number;
  entities: CreativeEntity[];
}

export const CREATIVE_TROOPS: TroopType[] = ['knight', 'archer', 'tank', 'champion', 'boss'];
export const CREATIVE_STRUCTURES: StructureKind[] = ['base', 'house', 'market', 'tower', 'wall', 'mine'];

const TROOP_ICONS: Record<TroopType, string> = {
  knight: '🪖',
  archer: '🏹',
  tank: '🛡️',
  champion: '⭐',
  boss: '👑',
};

const STRUCTURE_ICONS: Record<StructureKind, string> = {
  base: '🏰',
  house: '🏠',
  market: '🏪',
  tower: '🗼',
  wall: '⛩️',
  mine: '⛏️',
  cart: '🛒',
};

const TROOP_LABELS: Record<TroopType, string> = {
  knight: 'Cavaleiro',
  archer: 'Arqueiro',
  tank: 'Tanque',
  champion: 'Campeão',
  boss: 'Boss',
};

const STRUCTURE_LABELS: Record<StructureKind, string> = {
  base: 'Base',
  house: 'Casa',
  market: 'Mercado',
  tower: 'Torre',
  wall: 'Muralha',
  mine: 'Mina',
  cart: 'Carroça',
};

let nextCreativeId = 1;

export function createCreativeScenario(width: number, height: number): CreativeScenario {
  return { width, height, entities: [] };
}

export function addCreativeEntity(
  scenario: CreativeScenario,
  team: CreativeTeam,
  kind: CreativeEntityKind,
  type: CreativeEntityType,
  x: number,
  y: number,
  rot = 0,
): CreativeEntity {
  const entity: CreativeEntity = { id: nextCreativeId++, team, kind, type, x, y, rot };
  scenario.entities.push(entity);
  return entity;
}

export function removeCreativeEntity(scenario: CreativeScenario, id: number): void {
  const index = scenario.entities.findIndex((e) => e.id === id);
  if (index >= 0) scenario.entities.splice(index, 1);
}

export function moveCreativeEntity(scenario: CreativeScenario, id: number, x: number, y: number): void {
  const entity = scenario.entities.find((e) => e.id === id);
  if (entity) {
    entity.x = x;
    entity.y = y;
  }
}

export function creativeTeamOf(team: CreativeTeam): 'player' | 'enemy' {
  return team === 'blue' ? 'player' : 'enemy';
}

export function creativePickLabel(pick: CreativePick): string {
  if (pick.kind === 'unit') return `${TROOP_ICONS[pick.type as TroopType]} ${TROOP_LABELS[pick.type as TroopType]}`;
  return `${STRUCTURE_ICONS[pick.type as StructureKind]} ${STRUCTURE_LABELS[pick.type as StructureKind]}`;
}

function unitStats(team: CreativeTeam, type: TroopType) {
  return CONFIG.units[creativeTeamOf(team)][type];
}

function structureRadius(kind: StructureKind): number {
  switch (kind) {
    case 'base':
      return CONFIG.base.radius;
    case 'house':
      return CONFIG.progression.buildings.house.radius;
    case 'market':
      return CONFIG.progression.buildings.market.radius;
    case 'tower':
      return CONFIG.progression.buildings.tower.radius;
    case 'wall':
      return 45;
    case 'mine':
      return CONFIG.mine.radius;
    case 'cart':
      return CONFIG.story.cart.radius;
  }
}

export function creativeEntityRadius(entity: CreativeEntity): number {
  if (entity.kind === 'unit') return unitStats(entity.team, entity.type as TroopType).radius;
  return structureRadius(entity.type as StructureKind);
}

export function creativePickRadius(pick: CreativePick, team: CreativeTeam): number {
  if (pick.kind === 'unit') return unitStats(team, pick.type as TroopType).radius;
  return structureRadius(pick.type as StructureKind);
}

export function creativePickDims(pick: CreativePick, team: CreativeTeam, rot: number): { w: number; h: number } {
  if (pick.kind === 'structure' && pick.type === 'wall') {
    const vertical = rot % 180 !== 0;
    return { w: vertical ? CONFIG.castle.wallThickness : 120, h: vertical ? 120 : CONFIG.castle.wallThickness };
  }
  const r = creativePickRadius(pick, team);
  return { w: r * 2, h: r * 2 };
}

const TEAM_COLORS: Record<TroopType, { player: string; enemy: string }> = {
  knight:  { player: '#38b6ff', enemy: '#ff4655' },
  archer:  { player: '#4ec2ff', enemy: '#ff8fa3' },
  tank:    { player: '#2ea8ff', enemy: '#e0563f' },
  champion: { player: '#ffd166', enemy: '#ffb04d' },
  boss:    { player: '#c0392b', enemy: '#c0392b' },
};

export function createCreativeUnit(entity: CreativeEntity): Unit {
  const unit = createUnit('player', entity.type as TroopType, entity.x, entity.y);
  const foe = entity.team === 'red';
  unit.team = foe ? 'enemy' : 'player';
  unit.color = TEAM_COLORS[unit.troopType][foe ? 'enemy' : 'player'];
  return unit;
}

function baseCreativeStructure(
  kind: StructureKind,
  team: CreativeTeam,
  x: number,
  y: number,
  radius: number,
  hp: number,
  color: string,
  w?: number,
  h?: number,
): Structure {
  return {
    kind,
    team: creativeTeamOf(team),
    x,
    y,
    hp,
    maxHp: hp,
    radius,
    color,
    alive: true,
    w: w ?? radius * 2,
    h: h ?? radius * 2,
    damage: 0,
    attackRange: 0,
    attackCooldown: 0,
    attackTimer: 0,
    attackTarget: null,
    flashTimer: 0,
  };
}

export function createCreativeStructure(entity: CreativeEntity): Structure {
  const kind = entity.type as StructureKind;
  const x = entity.x;
  const y = entity.y;
  const team = entity.team;
  switch (kind) {
    case 'base':
      return baseCreativeStructure('base', team, x, y, CONFIG.base.radius, CONFIG.base.hp, team === 'blue' ? '#38b6ff' : '#ff4655');
    case 'house': {
      const c = CONFIG.progression.buildings.house;
      return baseCreativeStructure('house', team, x, y, c.radius, c.hp, team === 'blue' ? '#3d9be9' : '#e0563f');
    }
    case 'market': {
      const c = CONFIG.progression.buildings.market;
      return baseCreativeStructure('market', team, x, y, c.radius, c.hp, team === 'blue' ? '#38a3d8' : '#ff8fa3');
    }
    case 'tower': {
      const c = CONFIG.progression.buildings.tower;
      const s = baseCreativeStructure('tower', team, x, y, c.radius, c.hp, team === 'blue' ? '#7fa8ff' : '#ff7a8a');
      s.damage = c.damage;
      s.attackRange = c.range;
      s.attackCooldown = CONFIG.castle.towerCooldown;
      return s;
    }
    case 'wall': {
      const vertical = entity.rot % 180 !== 0;
      return baseCreativeStructure(
        'wall',
        team,
        x,
        y,
        CONFIG.castle.wallThickness / 2,
        CONFIG.castle.wallHp,
        '#7b8591',
        vertical ? CONFIG.castle.wallThickness : 120,
        vertical ? 120 : CONFIG.castle.wallThickness,
      );
    }
    case 'mine': {
      const s = baseCreativeStructure('mine', team, x, y, CONFIG.mine.radius, CONFIG.mine.hp, CONFIG.mine.color);
      s.owner = team === 'blue' ? 'player' : 'enemy';
      s.captureProgress = 0;
      return s;
    }
    case 'cart':
      return baseCreativeStructure('cart', team, x, y, CONFIG.story.cart.radius, CONFIG.story.cart.hp, CONFIG.story.cart.color);
  }
}
