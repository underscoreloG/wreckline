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
  dressing: {
    barrier: 'rails',
    barrierColors: ['#9A9890', '#C8B89A'],
    ground: [
      { cell: 'soft', color: '#C9A274', alpha: 0.5, size: [8, 24], weight: 3 },
      { cell: 'soft', color: '#8E6A44', alpha: 0.45, size: [6, 18], weight: 2 },
      { cell: 'drift', color: '#D6BC92', alpha: 0.55, size: [6, 14], weight: 2 },
      { cell: 'speckle', color: '#7A5A3A', alpha: 0.7, size: [3, 7], weight: 2 },
      { cell: 'scrub', color: '#6E6A3E', alpha: 0.85, size: [1.5, 4], weight: 2 },
    ],
    shoulder: [
      { cell: 'speckle', color: '#9A7650', alpha: 0.6, size: [1.2, 2], weight: 2 },
      { cell: 'drift', color: '#D6BC92', alpha: 0.5, size: [1.5, 2], weight: 1 },
    ],
    // Sand blown onto the road instead of oil.
    roadStain: { cell: 'drift', color: '#9C7A58', alpha: 0.3, size: [2, 4], weight: 1 },
    roadDark: '#2E2A26',
    roadPatch: '#3A3632',
    crowd: ['#8A7A64', '#6A7480', '#9A6A4A', '#7A8A6A', '#A89878'],
    banner: ['#B8452A', '#E2D6B8'],
    vent: null,
    neon: null,
    clutter: { shape: 'rocks', colors: ['#8A6A4A', '#9C7A56', '#6E5A48'], density: 0.4 },
  },
};
