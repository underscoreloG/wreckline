import type { TrackTheme, Vec2 } from '../../shared/contracts';

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
};

/** WP11 registers desert and docks here. */
export const THEMES: Partial<Record<TrackTheme, ThemeDef>> = { scrapyard: SCRAPYARD };

export function themeFor(theme: TrackTheme): ThemeDef {
  const def = THEMES[theme];
  if (def) return def;
  console.warn(`render: no theme '${theme}', falling back to scrapyard`);
  return SCRAPYARD;
}
