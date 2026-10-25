import type { ThemeDef } from './index';

/**
 * Frostbite Pass and Pine Hollow: night in the snow (design.md section 1, WP22 values). Cold blue
 * moonlight and ambient, a pale blue-grey snow ground, dark asphalt that stays readable against it,
 * packed grey snow on the shoulders, warm sodium lamp pools for contrast and denser cold fog.
 */
export const SNOW: ThemeDef = {
  ground: '#C9D3DD',
  groundNoise: '#A3B2C3',
  asphalt: '#2B2F35',
  asphaltLine: '#C8D2DC',
  kerbA: '#E2E8EE',
  kerbB: '#B8382E',
  dirt: '#8C98A6',
  wall: '#66707C',
  tireWall: '#1A1C20',
  propRust: ['#6A4A34', '#3E5A6E'],
  sodiumLight: '#FFB35C',
  skyFog: '#1A2230',
  water: null,
  hemisphere: { sky: '#5E7298', ground: '#2E3846', intensity: 0.5 },
  key: { color: '#A8C4FF', intensity: 0.9, direction: { x: 0.5, y: -1, z: 0.4 } },
  fog: { color: '#1A2230', density: 0.008 },
  dressing: {
    barrier: 'fence',
    barrierColors: ['#7A5A40', '#9A3A30'],
    ground: [
      { cell: 'soft', color: '#8E9CAC', alpha: 0.5, size: [8, 24], weight: 3 },
      { cell: 'soft', color: '#EEF3F8', alpha: 0.5, size: [6, 18], weight: 2 },
      { cell: 'drift', color: '#F2F6FA', alpha: 0.65, size: [6, 16], weight: 3 },
      { cell: 'speckle', color: '#6E7A88', alpha: 0.55, size: [2, 5], weight: 1 },
      { cell: 'scrub', color: '#4E5A50', alpha: 0.6, size: [1.5, 3], weight: 1 },
    ],
    shoulder: [
      { cell: 'drift', color: '#E2E9EF', alpha: 0.65, size: [1.5, 2], weight: 2 },
      { cell: 'speckle', color: '#6E7A88', alpha: 0.5, size: [1.2, 2], weight: 1 },
    ],
    // Snow blown across the road.
    roadStain: { cell: 'drift', color: '#C8D2DC', alpha: 0.35, size: [2, 4], weight: 1 },
    roadDark: '#16191E',
    roadPatch: '#22262C',
    crowd: ['#6A4A3A', '#3E5A6E', '#7A3A34', '#4E5A4A', '#8A8070'],
    banner: ['#9A3A30', '#C8D2DC'],
    vent: { color: '#7A828C', fire: true },
    neon: null,
    clutter: { shape: 'mounds', colors: ['#DCE5EC', '#C9D3DD', '#E8EEF3'], density: 0.35 },
  },
};
