/**
 * Dock Lot (docks theme, WP41): a 160 x 120 m container yard on the quay, the sea beyond its south wall (the docks
 * theme water starts at y 256, so the lot sits at Dockside's coordinates). Four rows of three containers and a
 * concrete crane pad in the middle make lanes to chase down. Repairs north and south of the pad, mines at the east and
 * west walls, rocket fuel in the side lanes.
 */
import type { ArenaDef } from '../../shared/contracts';
import { chamferedRect, rect, spawnRing, wallProps } from './build';

const CX = 160;
const CY = 190;
const WALL = chamferedRect(CX, CY, 80, 60, 15);

export const DOCK_LOT: ArenaDef = {
  id: 'dockLot',
  name: 'Dock Lot',
  theme: 'docks',
  wall: WALL,
  blocks: [
    { style: 'island', points: rect(CX, CY, 12, 12) },
    { style: 'containers', points: rect(CX - 35, CY - 25, 19, 5.6) },
    { style: 'containers', points: rect(CX + 35, CY - 25, 19, 5.6) },
    { style: 'containers', points: rect(CX - 35, CY + 25, 19, 5.6) },
    { style: 'containers', points: rect(CX + 35, CY + 25, 19, 5.6) },
  ],
  spawns: spawnRing(CX, CY, 62, 45, Math.PI / 8),
  pickups: [
    { kind: 'repair', pos: { x: CX, y: CY - 40 } },
    { kind: 'repair', pos: { x: CX, y: CY + 40 } },
    { kind: 'mines', pos: { x: CX - 65, y: CY } },
    { kind: 'mines', pos: { x: CX + 65, y: CY } },
    { kind: 'turbo', pos: { x: CX - 35, y: CY } },
    { kind: 'turbo', pos: { x: CX + 35, y: CY } },
  ],
  props: [
    ...wallProps('dockLot', WALL, [
      { kind: 'lightPole', every: 40, offset: 2.5, scale: 1, start: 12 },
      { kind: 'barrel', every: 13, offset: 1.2, scale: 1, start: 5 },
      { kind: 'crate', every: 19, offset: 2, scale: [0.8, 1.2], start: 11 },
    ]).filter((p) => p.pos.y < CY + 60),
    // Container stacks and a crane north of the lot, away from the quay edge.
    { kind: 'container', pos: { x: 110, y: 120 }, rotation: 0, scale: 1 },
    { kind: 'container', pos: { x: 118, y: 114 }, rotation: 0, scale: 1 },
    { kind: 'container', pos: { x: 150, y: 119 }, rotation: 0.05, scale: 1 },
    { kind: 'container', pos: { x: 196, y: 120 }, rotation: 0, scale: 1 },
    { kind: 'container', pos: { x: 204, y: 113 }, rotation: -0.04, scale: 1 },
    { kind: 'crane', pos: { x: 252, y: 128 }, rotation: Math.PI / 2, scale: 1 },
    { kind: 'crane', pos: { x: 70, y: 200 }, rotation: Math.PI / 2, scale: 1 },
  ],
};
