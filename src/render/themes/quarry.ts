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
  dressing: {
    barrier: 'rails',
    barrierColors: ['#8A8478', '#C8961E'],
    ground: [
      { cell: 'soft', color: '#6E3E26', alpha: 0.5, size: [8, 24], weight: 3 },
      { cell: 'soft', color: '#C08A5E', alpha: 0.4, size: [6, 18], weight: 2 },
      { cell: 'speckle', color: '#5E4A3A', alpha: 0.7, size: [3, 7], weight: 3 },
      { cell: 'drift', color: '#C89A70', alpha: 0.45, size: [6, 14], weight: 1 },
      { cell: 'scrub', color: '#6A6038', alpha: 0.7, size: [1.5, 3], weight: 1 },
    ],
    shoulder: [
      { cell: 'speckle', color: '#7E5A3E', alpha: 0.6, size: [1.2, 2], weight: 2 },
      { cell: 'drift', color: '#C89A70', alpha: 0.45, size: [1.5, 2], weight: 1 },
    ],
    // Quarry dust on the road.
    roadStain: { cell: 'drift', color: '#8E6A4E', alpha: 0.3, size: [2, 4], weight: 1 },
    roadDark: '#2A2522',
    roadPatch: '#433E3B',
    crowd: ['#8A7A64', '#5E6A78', '#9A5E3E', '#6E7A5E', '#A0906E'],
    banner: ['#C8961E', '#E8D8B8'],
    vent: null,
    neon: null,
    clutter: { shape: 'rocks', colors: ['#7A4A30', '#8E5E3E', '#6A4E3E'], density: 0.45 },
  },
};
