/**
 * Scrap Pit (scrapyard theme, WP41): a chamfered 150 x 124 m yard. A diamond of crushed car cubes in the middle, two
 * container pairs and two cube piles on the diagonals give cover on every line between spawns; the long axis is east
 * to west. Repairs sit on the north-south axis, mines at the east and west walls, rocket fuel by the centre.
 */
import type { ArenaDef } from '../../shared/contracts';
import { chamferedRect, rect, spawnRing, wallProps } from './build';

const WALL = chamferedRect(0, 0, 75, 62, 20);

export const SCRAP_PIT: ArenaDef = {
  id: 'scrapPit',
  name: 'Scrap Pit',
  theme: 'scrapyard',
  wall: WALL,
  blocks: [
    { style: 'cubes', points: [{ x: 0, y: -9 }, { x: 9, y: 0 }, { x: 0, y: 9 }, { x: -9, y: 0 }] },
    { style: 'containers', points: rect(-36, -26, 13, 5.6) },
    { style: 'containers', points: rect(36, 26, 13, 5.6) },
    { style: 'cubes', points: rect(36, -28, 8, 8) },
    { style: 'cubes', points: rect(-36, 28, 8, 8) },
  ],
  spawns: spawnRing(0, 0, 60, 48, Math.PI / 8),
  pickups: [
    { kind: 'repair', pos: { x: 0, y: -42 } },
    { kind: 'repair', pos: { x: 0, y: 42 } },
    { kind: 'mines', pos: { x: -60, y: 0 } },
    { kind: 'mines', pos: { x: 60, y: 0 } },
    { kind: 'turbo', pos: { x: -20, y: -16 } },
    { kind: 'turbo', pos: { x: 20, y: 16 } },
  ],
  props: wallProps('scrapPit', WALL, [
    { kind: 'lightPole', every: 36, offset: 2.5, scale: 1, start: 10 },
    { kind: 'tireStack', every: 9, offset: 1.5, scale: 1, start: 4 },
    { kind: 'wreck', every: 31, offset: 5, scale: 1, start: 20 },
    { kind: 'container', every: 47, offset: 12, scale: 1, start: 30 },
    { kind: 'barrel', every: 17, offset: 4, scale: 1, start: 7 },
  ]),
};
