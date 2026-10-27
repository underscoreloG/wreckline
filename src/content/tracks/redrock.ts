/**
 * Redrock Quarry (quarry theme, WP22; redrawn in WP32 as a Death Rally tight track, content.md section 12
 * "Track shape"): wide flowing quarry bends (r 28-44) round the pit, and one pinch point: a spur into the
 * quarry floor ending in a hairpin under a tower crane. The crane stands outside the wall at the hairpin's
 * apex and swings its jib over the road (only its base collides). Clockwise, width 16, 4 m of dirt shoulder.
 * Built with roundedLoop from a corner polygon.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 893-922, 0-29  start straight east (58 m with the grid on it)
 * - T1           s 29-85: R 86, r 36 (r 32 drew 1.5 wall hits per race from the pack arriving off the line)
 * - T2-T4        s 93-251: the east sweepers, L 58 / R 118 / L 58, r 31-33
 * - T5-T6        s 258-356: R 90 / R 89 round the quarry floor into the spur, r 28 / 26, a 9 m link between
 * - T7           s 376-455: the pinch, hairpin L 179 deg, r 23, crane jib overhead
 * - T8           s 475-523: R 89, r 26, out of the spur (the spur legs 46 m apart)
 * - T9-T10       s 529-611: R 43 / R 64, r 35, onto the west side
 * - T11-T12      s 619-692: a kink L 40 / L 22, r 38-44
 * - T13-T14      s 706-790: R 88 / R 41, r 32-33, onto the top
 * - T15-T17      s 796-893: the crest, L 39 / R 82 / L 40, r 28-34, onto the start straight
 *
 * Pickups alternate on and off the racing line: lateral 6.5 sits outside the AI's 6.4 m line band
 * (width / 2 - 1.6), as on Scrapyard. Every number here moves with any edit: the soak is chaotic, so
 * re-run redrock.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const REDROCK_CORNERS: readonly Corner[] = [
  { x: 66, y: 0, r: 36 },
  { x: 66, y: 60, r: 32 },
  { x: 115, y: 88, r: 30 },
  { x: 91, y: 129, r: 34 },
  { x: 60, y: 147, r: 32 },
  { x: 60, y: 204, r: 28 },
  { x: -3, y: 204, r: 26 },
  { x: -3, y: 128, r: 23 },
  { x: -49, y: 128, r: 23 },
  { x: -49, y: 204, r: 26 },
  { x: -100, y: 204, r: 34 },
  { x: -134, y: 170, r: 34 },
  { x: -116, y: 124, r: 44 },
  { x: -134, y: 78, r: 32 },
  { x: -173, y: 39, r: 32 },
  { x: -134, y: 0, r: 32 },
  { x: -104, y: 0, r: 34 },
  { x: -74, y: -30, r: 28 },
  { x: -44, y: 0, r: 34 },
];

/** s of the hairpin apex: the crane stands on its outside (right of a left turn). */
export const REDROCK_CRANE_S = 416;

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'redrock',
  name: 'Redrock Quarry',
  theme: 'quarry',
  shape: 'tight',
  width: 16,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 25, // WP32: 0.55 AI median clean lap 24.87 s over the 16 soak seeds (old layout 35)
  centerline: roundedLoop(REDROCK_CORNERS, { x: 0, y: 0 }),
  pickups: [
    { kind: 'mines', s: 35, lateral: -6.5 },
    { kind: 'cash', s: 110, lateral: -2 },
    { kind: 'turbo', s: 185, lateral: 4 },
    { kind: 'mines', s: 260, lateral: -6.5 },
    { kind: 'repair', s: 335, lateral: -6.5 },
    { kind: 'cash', s: 410, lateral: 6.5 },
    { kind: 'mines', s: 485, lateral: -6.5 },
    { kind: 'repair', s: 560, lateral: 6 },
    { kind: 'cash', s: 635, lateral: 2 },
    { kind: 'cash', s: 710, lateral: 6.5 },
    { kind: 'turbo', s: 785, lateral: -2 },
    { kind: 'turbo', s: 860, lateral: -6.5 },
  ],
  props: [],
};

// 'left' is the outside of the right-hand sweepers; the crane goes first so nothing crowds its base.
export const REDROCK_PROP_RULES: readonly PropRule[] = [
  { sFrom: REDROCK_CRANE_S, sTo: REDROCK_CRANE_S + 1, every: 10, side: 'right', offset: 3, kind: 'crane', scale: 1 },
  { sFrom: REDROCK_CRANE_S - 45, sTo: REDROCK_CRANE_S + 45, every: 4, side: 'right', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 30, sTo: 260, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 510, sTo: 790, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 0, sTo: 'length', every: 30, side: 'both', offset: 5, kind: 'rock', scale: [1, 1.8] },
  { sFrom: 320, sTo: 510, every: 22, side: 'left', offset: 2, kind: 'container', scale: 1 },
  { sFrom: 0, sTo: 25, every: 12, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 895, sTo: 'length', every: 12, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 850, sTo: 890, every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const REDROCK_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 24 },
  { kind: 'container', count: 4 },
  { kind: 'barrel', count: 6 },
];

export const REDROCK: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, REDROCK_PROP_RULES, REDROCK_SCATTER) };
