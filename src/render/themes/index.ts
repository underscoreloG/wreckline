import type { TrackTheme, Vec2 } from '../../shared/contracts';
import { CITY } from './city';
import { DESERT } from './desert';
import { DOCKS } from './docks';
import { QUARRY } from './quarry';
import { SNOW } from './snow';

/** Every world color and light setting of one track theme (design.md section 1). Data only: applyTheme turns it into scene settings. */
export interface ThemeDef {
  ground: string;
  groundNoise: string;
  asphalt: string;
  asphaltLine: string;
  kerbA: string;
  kerbB: string;
  dirt: string;
  wall: string;
  tireWall: string;
  propRust: readonly [string, string];
  sodiumLight: string;
  skyFog: string;
  /** Ground color on the side of the line through `point` that `normal` points to; null = no water. */
  water: { color: string; point: Vec2; normal: Vec2 } | null;
  hemisphere: { sky: string; ground: string; intensity: number };
  /** `direction` is the direction the light travels (three.js world axes). */
  key: { color: string; intensity: number; direction: { x: number; y: number; z: number } };
  fog: { color: string; density: number };
  dressing: ThemeDressing;
}

/** Decal atlas cells (textures.ts draws them white with alpha; vertex colors tint them). */
export type DecalCell = 'soft' | 'speckle' | 'scrub' | 'crack' | 'patch' | 'seam' | 'skid' | 'grid' | 'stain' | 'drift';

export interface GroundDecal {
  cell: DecalCell;
  color: string;
  alpha: number;
  size: readonly [min: number, max: number]; // m
  weight: number; // relative pick frequency
}

/** WP27 track dressing per theme: render only, generated from the track geometry. */
export interface ThemeDressing {
  /** Barrier dressing just outside the walls on the outside of corners. */
  barrier: 'tyres' | 'blocks' | 'rails' | 'fence';
  barrierColors: readonly [main: string, accent: string];
  /** Scatter on the ground beyond the walls and in the infield. */
  ground: readonly GroundDecal[];
  /** Shoulder detail between road edge and wall. */
  shoulder: readonly GroundDecal[];
  /** Road stains (oil, puddles) on top of cracks, patches and tar seams. */
  roadStain: GroundDecal | null;
  /** Tint of cracks, seams, patches and tyre marks. */
  roadDark: string;
  roadPatch: string;
  /** Spectator shirt colors (muted: cars and pickups stay the most saturated). */
  crowd: readonly string[];
  banner: readonly [string, string];
  vent: { color: string; fire: boolean } | null;
  /** Neon sign colors (HDR glow beyond the walls), null = none. */
  neon: readonly string[] | null;
  /** Low heaps beyond the walls; density = chance per 6 m per side. */
  clutter: { shape: 'scrap' | 'rocks' | 'crates' | 'mounds'; colors: readonly string[]; density: number } | null;
}

const SCRAPYARD: ThemeDef = {
  ground: '#2A2622',
  groundNoise: '#3A332C',
  asphalt: '#2F3236',
  asphaltLine: '#C9C2A8',
  kerbA: '#D8D2C4',
  kerbB: '#C2382B',
  dirt: '#4A3B2C',
  wall: '#5E5A55',
  tireWall: '#1C1C1E',
  propRust: ['#7A4A2A', '#8F5B32'],
  sodiumLight: '#FFB35C',
  skyFog: '#1B1E26',
  water: null,
  hemisphere: { sky: '#5A6A8A', ground: '#2A2622', intensity: 0.55 },
  key: { color: '#FFC48A', intensity: 1.6, direction: { x: -0.6, y: -1, z: 0.35 } },
  fog: { color: '#1B1E26', density: 0.006 },
  dressing: {
    barrier: 'tyres',
    barrierColors: ['#1C1C1E', '#B8B2A4'],
    ground: [
      { cell: 'soft', color: '#120F0C', alpha: 0.75, size: [8, 26], weight: 3 },
      { cell: 'soft', color: '#5A4C3E', alpha: 0.45, size: [6, 18], weight: 2 },
      { cell: 'speckle', color: '#5E554A', alpha: 0.7, size: [3, 7], weight: 2 },
      { cell: 'stain', color: '#0A0908', alpha: 0.75, size: [1.5, 4], weight: 2 },
      { cell: 'scrub', color: '#45472F', alpha: 0.7, size: [2, 5], weight: 1 },
    ],
    shoulder: [
      { cell: 'stain', color: '#0E0C0A', alpha: 0.6, size: [1, 2], weight: 1 },
      { cell: 'speckle', color: '#6A5C4C', alpha: 0.6, size: [1.2, 2], weight: 2 },
    ],
    roadStain: { cell: 'stain', color: '#0A0A0B', alpha: 0.55, size: [1.2, 3], weight: 1 },
    roadDark: '#141518',
    roadPatch: '#25272B',
    crowd: ['#6E6A62', '#5A6470', '#7A5A48', '#4E5A4A', '#8A7E6A', '#5E4E5E'],
    banner: ['#8A2A22', '#C9C2A8'],
    vent: { color: '#6A6460', fire: true },
    neon: null,
    clutter: { shape: 'scrap', colors: ['#6A4430', '#5A5650', '#7A5A3A', '#46484C'], density: 0.45 },
  },
};

export const THEMES: Partial<Record<TrackTheme, ThemeDef>> = { scrapyard: SCRAPYARD, desert: DESERT, docks: DOCKS, snow: SNOW, city: CITY, quarry: QUARRY };

export function themeFor(theme: TrackTheme): ThemeDef {
  const def = THEMES[theme];
  if (def) return def;
  console.warn(`render: no theme '${theme}', falling back to scrapyard`);
  return SCRAPYARD;
}
