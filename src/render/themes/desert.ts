import type { ThemeDef } from './index';

/**
 * Dust Bowl: late golden hour, warm and bright (design.md section 1 token table, WP11 values).
 * The low sun from the west-north-west gives long shadows; albedos stay near the scrapyard's lit
 * luminance so only lights and pickups pass the bloom threshold.
 */
export const DESERT: ThemeDef = {
  ground: '#A87E54',
  groundNoise: '#94693F',
  asphalt: '#4A4540',
  asphaltLine: '#E2D6B8',
  kerbA: '#E6DCC8',
  kerbB: '#B8452A',
  dirt: '#BC9161',
  wall: '#9E8B72',
  tireWall: '#1C1C1E',
  propRust: ['#8A5530', '#A3683A'],
  sodiumLight: '#FFD9A0',
  skyFog: '#C9A27A',
  water: null,
  hemisphere: { sky: '#F0CFA0', ground: '#7A5C3E', intensity: 0.7 },
  key: { color: '#FFD9A0', intensity: 2.0, direction: { x: 0.8, y: -0.6, z: 0.3 } },
  fog: { color: '#C9A27A', density: 0.004 },
};
