/**
 * Neon Mile (city theme, WP22; redrawn in WP32 as a Death Rally tight track, content.md section 12 "Track
 * shape"): quick right-angle corners round city blocks, a staircase down the east side, the hairpin U-turn
 * round the last block, a staircase back up the west side, billboards outside the walls. Clockwise, width 14,
 * 4 m of sidewalk (shoulder). Built with roundedLoop from a corner polygon on a 50 m block grid.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 853-906    start straight (53 m, the grid on it), heading east; the line sits at T1's turn-in
 * - T1-T5        s 0-199: the east staircase, R 84 / L 80 / R 84 / L 82 / R 85, r 24-26, 2-5 m links
 * - T6-T7        s 216-294: R 83 / L 80, r 24-26
 * - T8           s 300-383: R 90 / R 86 round the corner block, r 24, a 6 m link between
 * - T9           s 399-476: the U-turn round the last block, hairpin L 178 deg, r 23
 * - T10-T11      s 492-579: R 88 / R 84, r 24, onto the west side
 * - T12-T15      s 585-761: the west staircase, L 81 / R 83 / R 83 / L 84, r 24-26
 * - T16          s 804-853: R 88, r 28, onto the start straight
 *
 * Pickups alternate on and off the racing line: lateral 5.5 sits outside the AI's 5.4 m line band, as on
 * Scrapyard. The mines at s 485 sit at +5.5: at -5.5 the line ran over them (2.7 AI refills per race).
 * Every number here moves with any edit: the soak is chaotic, so re-run neonMile.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const NEON_MILE_CORNERS: readonly Corner[] = [
  { x: 0, y: 0, r: 28 },
  { x: 110, y: 0, r: 26 },
  { x: 110, y: 50, r: 24 },
  { x: 160, y: 50, r: 24 },
  { x: 160, y: 100, r: 24 },
  { x: 210, y: 100, r: 24 },
  { x: 210, y: 170, r: 26 },
  { x: 160, y: 170, r: 24 },
  { x: 160, y: 220, r: 24 },
  { x: 106, y: 220, r: 24 },
  { x: 106, y: 152, r: 23 },
  { x: 60, y: 152, r: 23 },
  { x: 60, y: 220, r: 24 },
  { x: 0, y: 220, r: 24 },
  { x: 0, y: 170, r: 24 },
  { x: -50, y: 170, r: 26 },
  { x: -50, y: 100, r: 26 },
  { x: 0, y: 100, r: 24 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'neonMile',
  name: 'Neon Mile',
  theme: 'city',
  shape: 'tight',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 26, // WP32: 0.55 AI median clean lap 25.95 s over the 16 soak seeds (old layout 38.5)
  centerline: roundedLoop(NEON_MILE_CORNERS, { x: 84, y: 0 }),
  pickups: [
    { kind: 'mines', s: 35, lateral: -5.5 },
    { kind: 'cash', s: 110, lateral: -2 },
    { kind: 'turbo', s: 185, lateral: 3.5 },
    { kind: 'mines', s: 260, lateral: -5.5 },
    { kind: 'repair', s: 335, lateral: -5.5 },
    { kind: 'cash', s: 410, lateral: 5.5 },
    { kind: 'mines', s: 485, lateral: 5.5 },
    { kind: 'repair', s: 560, lateral: 5 },
    { kind: 'cash', s: 635, lateral: 2 },
    { kind: 'cash', s: 710, lateral: 5.5 },
    { kind: 'turbo', s: 785, lateral: -2 },
    { kind: 'turbo', s: 860, lateral: -5.5 },
  ],
  props: [],
};

// Poles, then billboards on the longer streets, then building fronts fill the gaps.
export const NEON_MILE_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 30, side: 'alternate', offset: 2, kind: 'lightPole', scale: 1 },
  { sFrom: 215, sTo: 260, every: 45, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 405, sTo: 520, every: 55, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 680, sTo: 720, every: 45, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 780, sTo: 900, every: 50, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 0, sTo: 'length', every: 13, side: 'both', offset: 3, kind: 'building', scale: 1 },
];

export const NEON_MILE_SCATTER: readonly ScatterRule[] = [
  { kind: 'building', count: 12 },
  { kind: 'crate', count: 6 },
];

export const NEON_MILE: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER) };
