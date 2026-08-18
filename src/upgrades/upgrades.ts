import { CONFIG } from '../config';

export type UpgradeCategory = 'offensive' | 'defensive' | 'mobility' | 'economy';

export type UpgradeId =
  | 'damage'
  | 'health'
  | 'speed'
  | 'attackSpeed'
  | 'range'
  | 'defense'
  | 'baseMaxHp'
  | 'baseRepair'
  | 'mineIncome'
  | 'waveBonus';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  description: string;
  icon: string;
  category: UpgradeCategory;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'damage',
    name: 'Força',
    description: `+${pct(CONFIG.upgrades.damage)} dano das tropas`,
    icon: '⚔️',
    category: 'offensive',
  },
  {
    id: 'attackSpeed',
    name: 'Fúria',
    description: `+${pct(CONFIG.upgrades.attackSpeed)} velocidade de ataque`,
    icon: '💥',
    category: 'offensive',
  },
  {
    id: 'range',
    name: 'Precisão',
    description: `+${pct(CONFIG.upgrades.range)} alcance de ataque`,
    icon: '🎯',
    category: 'offensive',
  },
  {
    id: 'health',
    name: 'Resistência',
    description: `+${pct(CONFIG.upgrades.health)} vida das tropas`,
    icon: '❤️',
    category: 'defensive',
  },
  {
    id: 'defense',
    name: 'Armadura',
    description: `+${pct(CONFIG.upgrades.defense)} redução de dano`,
    icon: '🛡️',
    category: 'defensive',
  },
  {
    id: 'baseMaxHp',
    name: 'Fortaleza',
    description: `+${CONFIG.upgrades.baseMaxHp} vida máxima da base`,
    icon: '🏰',
    category: 'defensive',
  },
  {
    id: 'baseRepair',
    name: 'Reparos',
    description: `Recupera ${CONFIG.upgrades.baseRepair} de vida da base`,
    icon: '🔧',
    category: 'defensive',
  },
  {
    id: 'speed',
    name: 'Agilidade',
    description: `+${pct(CONFIG.upgrades.speed)} velocidade das tropas`,
    icon: '💨',
    category: 'mobility',
  },
  {
    id: 'mineIncome',
    name: 'Mineração',
    description: `+${pct(CONFIG.upgrades.mineIncome)} renda das minas`,
    icon: '⛏️',
    category: 'economy',
  },
  {
    id: 'waveBonus',
    name: 'Saques',
    description: `+${CONFIG.upgrades.waveBonus} ouro por wave limpa`,
    icon: '💰',
    category: 'economy',
  },
];

export function rollUpgrades(count: number, recent: UpgradeId[] = []): UpgradeDef[] {
  let pool = UPGRADES.filter((u) => !recent.includes(u.id));
  if (pool.length < count) pool = [...UPGRADES];
  const result: UpgradeDef[] = [];
  while (result.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return result;
}