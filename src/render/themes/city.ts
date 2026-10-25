import type { ThemeDef } from './index';

/**
 * Neon Mile and Rain District: a wet city night without particles (design.md section 1, WP22 values).
 * Darker, slightly blue asphalt and kerbs plus many lamp pools give the wet feel; purple-black fog;
 * the shoulder is a grey sidewalk. Only billboards (outside the walls) add magenta / cyan glow.
 */
export const CITY: ThemeDef = {
  ground: '#221E28',
  groundNoise: '#2E2936',
  asphalt: '#252A33',
  asphaltLine: '#B4BECE',
  kerbA: '#BCC4D2',
  kerbB: '#3E5488',
  dirt: '#45434E',
  wall: '#55555F',
  tireWall: '#18181C',
  propRust: ['#4A3E58', '#2E4A5A'],
  sodiumLight: '#FFB070',
  skyFog: '#120A1E',
  water: null,
  hemisphere: { sky: '#4E3E80', ground: '#1A1424', intensity: 0.6 },
  key: { color: '#B8B0FF', intensity: 0.7, direction: { x: -0.4, y: -1, z: 0.5 } },
  fog: { color: '#120A1E', density: 0.006 },
};
