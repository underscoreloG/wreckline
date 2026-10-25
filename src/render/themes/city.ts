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
  dressing: {
    barrier: 'blocks',
    barrierColors: ['#7A7A84', '#A89440'],
    ground: [
      { cell: 'soft', color: '#141018', alpha: 0.6, size: [8, 24], weight: 3 },
      { cell: 'soft', color: '#3A3644', alpha: 0.45, size: [6, 16], weight: 2 },
      { cell: 'soft', color: '#34446A', alpha: 0.6, size: [3, 8], weight: 3 },
      { cell: 'stain', color: '#08080A', alpha: 0.7, size: [1.5, 4], weight: 2 },
      { cell: 'speckle', color: '#4A4656', alpha: 0.5, size: [2, 5], weight: 1 },
    ],
    shoulder: [
      { cell: 'stain', color: '#0A0A0C', alpha: 0.6, size: [1, 2], weight: 1 },
      { cell: 'soft', color: '#2A3450', alpha: 0.5, size: [1.2, 2], weight: 2 },
    ],
    // Wet sheen: puddles a shade lighter and bluer than the asphalt.
    roadStain: { cell: 'soft', color: '#3A4E6E', alpha: 0.55, size: [2, 5], weight: 1 },
    roadDark: '#121418',
    roadPatch: '#1E2229',
    crowd: ['#4A4A58', '#5A4E66', '#3E5060', '#6A5A5A', '#50505A'],
    banner: ['#3E5488', '#BCC4D2'],
    vent: { color: '#7A6E90', fire: false },
    neon: ['#FF2BD6', '#25E0FF'],
    clutter: { shape: 'crates', colors: ['#3E4A3E', '#4A3E58', '#5A4A3A'], density: 0.3 },
  },
};
