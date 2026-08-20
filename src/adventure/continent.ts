export type ContinentRegionState = 'unknown' | 'available' | 'completed' | 'development';

export interface ContinentRegion {
  id: number;
  phase: number | null;
  name: string;
  phaseLabel: string;
  icon: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state: ContinentRegionState;
}

export const CONTINENT_DESIGN_W = 1200;
export const CONTINENT_DESIGN_H = 800;

export const CONTINENT_BACK_BUTTON = { x: 20, y: 20, w: 210, h: 46 };

export interface ContinentLayout {
  scale: number;
  ox: number;
  oy: number;
}

export function continentTransform(screenW: number, screenH: number): ContinentLayout {
  const scale = Math.min((screenW - 60) / CONTINENT_DESIGN_W, (screenH - 80) / CONTINENT_DESIGN_H);
  return {
    scale,
    ox: (screenW - CONTINENT_DESIGN_W * scale) / 2,
    oy: (screenH - CONTINENT_DESIGN_H * scale) / 2,
  };
}

export function regionScreenRect(
  r: { x: number; y: number; w: number; h: number },
  t: ContinentLayout,
): { x: number; y: number; w: number; h: number } {
  return {
    x: t.ox + r.x * t.scale,
    y: t.oy + r.y * t.scale,
    w: r.w * t.scale,
    h: r.h * t.scale,
  };
}

export interface ContinentView {
  regions: ContinentRegion[];
  discovered: number;
  total: number;
}

export function buildContinentRegions(phase1Completed: boolean): ContinentRegion[] {
  return [
    {
      id: 1,
      phase: 1,
      name: 'Vales de Eldoria',
      phaseLabel: 'FASE 1',
      icon: '🏰',
      x: 90,
      y: 420,
      w: 330,
      h: 210,
      state: phase1Completed ? 'completed' : 'available',
    },
    {
      id: 2,
      phase: 2,
      name: 'Cordilheira do Norte',
      phaseLabel: 'FASE 2',
      icon: '⛰️',
      x: 560,
      y: 120,
      w: 280,
      h: 200,
      state: phase1Completed ? 'development' : 'unknown',
    },
    {
      id: 3,
      phase: 3,
      name: 'Planícies de Ferro',
      phaseLabel: 'FASE 3',
      icon: '🌋',
      x: 720,
      y: 430,
      w: 270,
      h: 200,
      state: phase1Completed ? 'development' : 'unknown',
    },
    {
      id: 4,
      phase: null,
      name: 'Região Misteriosa',
      phaseLabel: '???',
      icon: '❓',
      x: 180,
      y: 110,
      w: 220,
      h: 170,
      state: 'unknown',
    },
    {
      id: 5,
      phase: null,
      name: 'Região Misteriosa',
      phaseLabel: '???',
      icon: '❓',
      x: 400,
      y: 590,
      w: 200,
      h: 150,
      state: 'unknown',
    },
  ];
}

export function continentDiscovered(regions: ContinentRegion[]): number {
  let n = 0;
  for (const r of regions) if (r.state !== 'unknown') n++;
  return n;
}
