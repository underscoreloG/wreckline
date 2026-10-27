import type { ThemeDef } from './index';

/**
 * Dockside: night, cold blue moonlight and ambient, orange sodium lamps (design.md section 1 token
 * table, WP11 values). The shoulder token is the grey concrete apron of the quay.
 * Water: the sea lies south of Dockside's quay (WP32: centerline y = 244, outer wall at
 * y = 254.5), so the half-plane starts 1.5 m beyond that wall (close enough to stay in the race
 * camera's view) and faces +y; no other part of the track or its props reaches it.
 */
export const DOCKS: ThemeDef = {
  ground: '#2A3138',
  groundNoise: '#353D45',
  asphalt: '#2B2F34',
  asphaltLine: '#B9C1C8',
  kerbA: '#D2D6DA',
  kerbB: '#C98A2B',
  dirt: '#464B51',
  wall: '#5B6169',
  tireWall: '#1A1C1E',
  propRust: ['#7A3E2A', '#2F5A6E'],
  sodiumLight: '#FFA040',
  skyFog: '#0C1220',
  water: { color: '#0E2230', point: { x: 160, y: 256 }, normal: { x: 0, y: 1 } },
  hemisphere: { sky: '#3A5A8A', ground: '#1A2028', intensity: 0.65 },
  key: { color: '#9FB4FF', intensity: 0.8, direction: { x: 0.4, y: -1, z: -0.5 } },
  fog: { color: '#0C1220', density: 0.006 },
  dressing: {
    barrier: 'tyres',
    barrierColors: ['#1A1C1E', '#C98A2B'],
    ground: [
      { cell: 'soft', color: '#1A2026', alpha: 0.65, size: [8, 24], weight: 3 },
      { cell: 'soft', color: '#4A5560', alpha: 0.5, size: [6, 16], weight: 2 },
      { cell: 'soft', color: '#0E1A24', alpha: 0.75, size: [3, 8], weight: 2 },
      { cell: 'stain', color: '#0A0C0E', alpha: 0.7, size: [1.5, 4], weight: 2 },
      { cell: 'speckle', color: '#4A525A', alpha: 0.6, size: [3, 6], weight: 1 },
    ],
    shoulder: [
      { cell: 'stain', color: '#0E1012', alpha: 0.6, size: [1, 2], weight: 1 },
      { cell: 'soft', color: '#14222E', alpha: 0.6, size: [1.2, 2], weight: 1 },
    ],
    // Puddles on the quay road.
    roadStain: { cell: 'soft', color: '#2E4458', alpha: 0.4, size: [2, 4], weight: 1 },
    roadDark: '#16191C',
    roadPatch: '#23272C',
    crowd: ['#5A6470', '#6E6A62', '#4E5A66', '#7A6A58', '#5E4E5E'],
    banner: ['#C98A2B', '#B9C1C8'],
    vent: { color: '#8A96A4', fire: false },
    neon: null,
    clutter: { shape: 'crates', colors: ['#6A5A44', '#4E5A66', '#7A3E2A'], density: 0.4 },
  },
};
