export type BiomeId = 'field' | 'desert' | 'snow' | 'volcanic' | 'ruins' | 'cosmic';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  background: string;
  grid: string;
  seed: number;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  field: {
    id: 'field',
    name: 'Campo',
    background: '#1c3d2b',
    grid: 'rgba(255, 255, 255, 0.05)',
    seed: 101,
  },
  desert: {
    id: 'desert',
    name: 'Deserto',
    background: '#c9a05a',
    grid: 'rgba(90, 60, 20, 0.14)',
    seed: 202,
  },
  snow: {
    id: 'snow',
    name: 'Neve',
    background: '#dfe9f2',
    grid: 'rgba(110, 140, 170, 0.2)',
    seed: 303,
  },
  volcanic: {
    id: 'volcanic',
    name: 'Vulcânico',
    background: '#2a1a14',
    grid: 'rgba(255, 120, 40, 0.08)',
    seed: 404,
  },
  ruins: {
    id: 'ruins',
    name: 'Ruínas',
    background: '#3a3a40',
    grid: 'rgba(255, 255, 255, 0.06)',
    seed: 505,
  },
  cosmic: {
    id: 'cosmic',
    name: 'Vazio Cósmico',
    background: '#12101f',
    grid: 'rgba(140, 120, 255, 0.09)',
    seed: 606,
  },
};

interface BiomeThreshold {
  startWave: number;
  biome: BiomeId;
}

const BIOME_THRESHOLDS: BiomeThreshold[] = [
  { startWave: 1, biome: 'field' },
  { startWave: 6, biome: 'desert' },
  { startWave: 11, biome: 'snow' },
  { startWave: 16, biome: 'volcanic' },
  { startWave: 21, biome: 'ruins' },
  { startWave: 26, biome: 'cosmic' },
];

export function getBiomeForWave(wave: number): BiomeId {
  let biome: BiomeId = 'field';
  for (const threshold of BIOME_THRESHOLDS) {
    if (wave >= threshold.startWave) biome = threshold.biome;
  }
  return biome;
}