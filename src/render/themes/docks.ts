import type { ThemeDef } from './index';

/**
 * Dockside: night, cold blue moonlight and ambient, orange sodium lamps (design.md section 1 token
 * table, WP11 values). The shoulder token is the grey concrete apron of the quay.
 * Water: the sea lies south of Dockside's water-edge straight (centerline y = 310, outer wall at
 * y = 320.5), so the half-plane starts 1.5 m beyond that wall (close enough to stay in the race
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
  water: { color: '#0E2230', point: { x: 170, y: 322 }, normal: { x: 0, y: 1 } },
  hemisphere: { sky: '#3A5A8A', ground: '#1A2028', intensity: 0.65 },
  key: { color: '#9FB4FF', intensity: 0.8, direction: { x: 0.4, y: -1, z: -0.5 } },
  fog: { color: '#0C1220', density: 0.006 },
};
