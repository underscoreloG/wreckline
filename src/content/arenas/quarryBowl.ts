/**
 * Quarry Bowl (quarry theme, WP41): a round pit 168 x 152 m. A rock island in the middle and three smaller piles at 120
 * degrees halfway out: no wall to back into for long, and every chase bends round the island. Repairs north and south
 * of the island, mines east and west, rocket fuel between the north piles.
 */
import type { ArenaDef } from '../../shared/contracts';
import { ngon, spawnRing, wallProps } from './build';

const WALL = ngon(0, 0, 84, 76, 20);
const DEG = Math.PI / 180;

export const QUARRY_BOWL: ArenaDef = {
  id: 'quarryBowl',
  name: 'Quarry Bowl',
  theme: 'quarry',
  wall: WALL,
  blocks: [
    { style: 'rocks', points: ngon(0, 0, 13, 13, 8, 0, [1, 0.92]) },
    { style: 'rocks', points: ngon(Math.cos(30 * DEG) * 50, Math.sin(30 * DEG) * 50, 6, 6, 6, 0.3) },
    { style: 'rocks', points: ngon(Math.cos(150 * DEG) * 50, Math.sin(150 * DEG) * 50, 6, 6, 6, 0.1) },
    { style: 'rocks', points: ngon(0, -50, 6.5, 6.5, 6, 0.5) },
  ],
  spawns: spawnRing(0, 0, 66, 59, Math.PI / 8),
  pickups: [
    { kind: 'repair', pos: { x: 0, y: 30 } },
    { kind: 'repair', pos: { x: 0, y: -30 } },
    { kind: 'mines', pos: { x: -60, y: -10 } },
    { kind: 'mines', pos: { x: 60, y: -10 } },
    { kind: 'turbo', pos: { x: -30, y: -40 } },
    { kind: 'turbo', pos: { x: 30, y: -40 } },
  ],
  props: wallProps('quarryBowl', WALL, [
    { kind: 'rock', every: 11, offset: 1.5, scale: [0.8, 1.6], start: 3 },
    { kind: 'lightPole', every: 42, offset: 3, scale: 1, start: 14 },
    { kind: 'cone', every: 23, offset: 1.2, scale: 1, start: 9 },
    { kind: 'crane', every: 170, offset: 10, scale: 1, start: 60 },
  ]),
};
