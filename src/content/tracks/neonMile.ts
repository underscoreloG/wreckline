/**
 * Neon Mile (city theme, WP22): a city block grid. Four long straights between buildings, tight
 * right-angle corners, billboards outside the walls, and a hairpin U-turn round the last block. Clockwise,
 * width 14, 4 m of sidewalk (shoulder). Built with roundedLoop from a corner polygon.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-48       start on the south street, heading west
 * - T1           s 48-89: R 90, r 19
 * - s 89-132     short block north
 * - T2           s 132-170: R 90, r 18, into the inner street
 * - s 170-302    inner street east (132 m)
 * - T3           s 302-373: the U-turn round the last block, L 178 deg, r 18
 * - s 373-545    back street west (172 m)
 * - T4-T5        s 545-665: R 90 / R 90, r 18, round the west block
 * - s 665-955    north avenue east (290 m), billboards both sides
 * - T6           s 955-998: R 90, r 20
 * - s 998-1166   east avenue south (168 m)
 * - T7           s 1166-1209: R 90, r 20
 * - s 1209-end   south street west (200 m) to the line
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const NEON_MILE_CORNERS: readonly Corner[] = [
  { x: 300, y: 0, r: 22 },
  { x: 300, y: 220, r: 22 },
  { x: 0, y: 220, r: 22 },
  { x: 0, y: 130, r: 20 },
  { x: 180, y: 130, r: 20 },
  { x: 180, y: 90, r: 20 },
  { x: -40, y: 90, r: 20 },
  { x: -40, y: 0, r: 20 },
];

const BASE: TrackDef = {
  id: 'neonMile',
  name: 'Neon Mile',
  theme: 'city',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 39,
  centerline: roundedLoop(NEON_MILE_CORNERS, { x: 80, y: 220 }),
  pickups: [
    { kind: 'cash', s: 25, lateral: -3 },
    { kind: 'mines', s: 110, lateral: 0 },
    { kind: 'cash', s: 200, lateral: 3 },
    { kind: 'repair', s: 270, lateral: -3 },
    { kind: 'turbo', s: 400, lateral: 0 },
    { kind: 'cash', s: 480, lateral: -3 },
    { kind: 'mines', s: 605, lateral: 0 },
    { kind: 'turbo', s: 700, lateral: 3 },
    { kind: 'cash', s: 790, lateral: -3 },
    { kind: 'repair', s: 880, lateral: 2 },
    { kind: 'mines', s: 1050, lateral: -3 },
    { kind: 'cash', s: 1110, lateral: 3 },
    { kind: 'turbo', s: 1240, lateral: 0 },
    { kind: 'repair', s: 1300, lateral: 3 },
    { kind: 'mines', s: 1350, lateral: -3 },
  ],
  props: [],
};

// Poles, then billboards on the long streets, then building fronts fill the gaps.
export const NEON_MILE_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 30, side: 'alternate', offset: 2, kind: 'lightPole', scale: 1 },
  { sFrom: 395, sTo: 530, every: 45, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 690, sTo: 940, every: 50, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 1020, sTo: 1150, every: 45, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 1230, sTo: 1400, every: 55, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 0, sTo: 'length', every: 13, side: 'both', offset: 3, kind: 'building', scale: 1 },
];

export const NEON_MILE_SCATTER: readonly ScatterRule[] = [
  { kind: 'building', count: 20 },
  { kind: 'crate', count: 6 },
];

export const NEON_MILE: TrackDef = { ...BASE, props: placeProps(BASE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER) };
