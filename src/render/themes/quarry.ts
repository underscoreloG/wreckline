import type { ThemeDef } from './index';

/**
 * Redrock Quarry and Blast Pit: hot late afternoon (design.md section 1, WP22 values). A strong warm
 * low sun for high contrast, ochre and red rock ground, a dusty grey haul road, yellow machinery
 * (containers, kerb stripes) and a light dusty fog.
 */
export const QUARRY: ThemeDef = {
  ground: '#9C5E3A',
  groundNoise: '#83472C',
  asphalt: '#4A4542',
  asphaltLine: '#E8D8B8',
  kerbA: '#E8DCC8',
  kerbB: '#C8961E',
  dirt: '#B07E56',
  wall: '#988674',
  tireWall: '#1C1C1E',
  propRust: ['#8A5530', '#B8892A'],
  sodiumLight: '#FFD9A0',
  skyFog: '#B89A7A',
  water: null,
  hemisphere: { sky: '#F2D0A6', ground: '#74452C', intensity: 0.65 },
  key: { color: '#FFC890', intensity: 2.2, direction: { x: 0.7, y: -0.75, z: -0.4 } },
  fog: { color: '#B89A7A', density: 0.004 },
};
