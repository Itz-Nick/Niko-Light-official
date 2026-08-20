export type TerritoryState = 'unknown' | 'revealed';

export interface Territory {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state: TerritoryState;
}

export const TERRITORY_COLS = 4;
export const TERRITORY_ROWS = 3;

const TERRITORY_NAMES = [
  'Vales de Eldoria',
  'Cordilheira do Norte',
  'Planícies de Ferro',
  'Floresta das Sombras',
  'Terras do Crepúsculo',
  'Lago da Névoa',
  'Colinas do Falcão',
  'Ruínas de Karveth',
  'Pântanos de Zelin',
  'Caminho do Rei',
  'Deserto das Brasas',
  'Fronteira Vermelha',
];

export function buildTerritories(worldW: number, worldH: number): Territory[] {
  const cellW = worldW / TERRITORY_COLS;
  const cellH = worldH / TERRITORY_ROWS;
  const territories: Territory[] = [];
  for (let row = 0; row < TERRITORY_ROWS; row++) {
    for (let col = 0; col < TERRITORY_COLS; col++) {
      const id = row * TERRITORY_COLS + col;
      territories.push({
        id,
        name: TERRITORY_NAMES[id] ?? `Território ${id + 1}`,
        x: col * cellW,
        y: row * cellH,
        w: cellW,
        h: cellH,
        state: 'unknown',
      });
    }
  }
  return territories;
}