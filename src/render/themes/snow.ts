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
};
