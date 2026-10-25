/**
 * Redrock Quarry (quarry theme, WP22): wide fast curves round the pit, and one pinch point: a spur into
 * the quarry floor ending in a hairpin under a tower crane. The crane stands outside the wall at the
 * hairpin's apex and swings its jib over the road (only its base collides). Clockwise, width 16, 4 m of
 * dirt shoulder. Built with roundedLoop from a corner polygon.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-195      start straight east (195 m)
 * - T1           s 195-332: R 87, r 79, fast
 * - s 332-417    east side south
 * - T2           s 417-554: R 87, r 79, fast
 * - T3           s 594-646: R 87, r 27, into the spur
 * - s 646-707    spur north
 * - T4           s 707-784: the pinch, hairpin L 178 deg, r 20, crane jib overhead
 * - s 784-845    spur south (44 m from the way in)
 * - T5           s 845-898: R 88, r 27, out of the spur
 * - T6           s 973-1110: R 87, r 79, fast
 * - s 1110-1195  west side north
 * - T7           s 1195-1332: R 87, r 79, onto the start straight
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const REDROCK_CORNERS: readonly Corner[] = [
  { x: 280, y: 0, r: 90 },
  { x: 280, y: 260, r: 90 },
  { x: 120, y: 260, r: 30 },
  { x: 120, y: 140, r: 22 },
  { x: 76, y: 140, r: 22 },
  { x: 76, y: 260, r: 30 },
  { x: -120, y: 260, r: 90 },
  { x: -120, y: 0, r: 90 },
];

/** s of the hairpin apex: the crane stands on its outside (right of a left turn). */
export const REDROCK_CRANE_S = 745;

const BASE: TrackDef = {
  id: 'redrock',
  name: 'Redrock Quarry',
  theme: 'quarry',
  width: 16,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 35,
  centerline: roundedLoop(REDROCK_CORNERS, { x: 0, y: 0 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: -3 },
    { kind: 'turbo', s: 120, lateral: 3 },
    { kind: 'mines', s: 260, lateral: 0 },
    { kind: 'cash', s: 370, lateral: 3 },
    { kind: 'repair', s: 480, lateral: -4 },
    { kind: 'cash', s: 570, lateral: 0 },
    { kind: 'mines', s: 675, lateral: 3 },
    { kind: 'turbo', s: 815, lateral: -3 },
    { kind: 'cash', s: 930, lateral: 0 },
    { kind: 'repair', s: 1040, lateral: 4 },
    { kind: 'mines', s: 1150, lateral: -3 },
    { kind: 'cash', s: 1250, lateral: 3 },
    { kind: 'turbo', s: 1300, lateral: 0 },
  ],
  props: [],
};

// 'left' is the outside of the fast right-hand curves; the crane goes first so nothing crowds its base.
export const REDROCK_PROP_RULES: readonly PropRule[] = [
  { sFrom: REDROCK_CRANE_S, sTo: REDROCK_CRANE_S + 1, every: 10, side: 'right', offset: 3, kind: 'crane', scale: 1 },
  { sFrom: 700, sTo: 790, every: 4, side: 'right', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 195, sTo: 554, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 973, sTo: 1332, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 0, sTo: 'length', every: 30, side: 'both', offset: 5, kind: 'rock', scale: [1, 1.8] },
  { sFrom: 600, sTo: 900, every: 22, side: 'left', offset: 2, kind: 'container', scale: 1 },
  { sFrom: 20, sTo: 180, every: 12, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 1340, sTo: 'length', every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const REDROCK_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 24 },
  { kind: 'container', count: 4 },
  { kind: 'barrel', count: 6 },
];

export const REDROCK: TrackDef = { ...BASE, props: placeProps(BASE, REDROCK_PROP_RULES, REDROCK_SCATTER) };
