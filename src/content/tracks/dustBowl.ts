/**
 * Dust Bowl (desert theme, M2; redrawn in WP32 as a Death Rally tight track, content.md section 12 "Track shape"):
 * the most open of the tight tracks, a chain of wide sweepers (r 26-34) with a few 22-24 m bends, one hairpin at
 * the end of a tongue into the infield. Clockwise, width 15, 4 m of sand shoulder. Built with roundedLoop.
 *
 * Corners in race order (s in m, r = arc radius on the polygon, "R"/"L" = right/left):
 * - s 0-33       start straight (68 m with the grid behind the line), heading east
 * - T1-T2        s 33-89: the S out of the start, R 45 / L 45, r 24
 * - T3           s 89-140: R 86 south, r 32
 * - T4-T9        s 149-354: the sweeper chain down the east side, L 43 / R 88 / L 46 / L 41 / R 45 / R 88, r 22-30
 * - s 354-394    bottom straight west
 * - T10          s 394-440: R 87 into the tongue, r 26
 * - T11          s 450-529: the hairpin, L 179 deg, r 23 (two back-to-back 90s), tire wall on the outside
 * - T12-T13      s 539-629: R 92 / R 88 out of the tongue and up the west side, r 26
 * - T14-T16      s 630-734: the west bump, L 39 / R 85 / L 41, r 30
 * - T17          s 740-818: a flat S, R 14 / L 28 / R 14, r 45
 * - T18          s 818-865: R 89 onto the start straight, r 26, tire stacks on the outside
 *
 * Pickups alternate on and off the racing line: lateral 6 sits outside the AI's 5.9 m line band and on the far
 * side of the line, so the AI only takes the ones on its line. All three mines are off it (WP32 probe on a draft:
 * 4.1 mine hits per race with two of them on the line, 3.6 with none). Every number here moves with any edit:
 * re-run dustBowl.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { type Corner, roundedLoop } from './roundedLoop';

export const DUST_BOWL_CORNERS: readonly Corner[] = [
  { x: -70, y: 0, r: 26 },
  { x: 38, y: 0, r: 24 },
  { x: 60, y: 23, r: 24 },
  { x: 106, y: 23, r: 32 },
  { x: 106, y: 78, r: 28 },
  { x: 136, y: 108, r: 22 },
  { x: 106, y: 138, r: 30 },
  { x: 106, y: 166, r: 30 },
  { x: 129, y: 190, r: 30 },
  { x: 129, y: 232, r: 26 },
  { x: 32, y: 232, r: 26 },
  { x: 32, y: 167, r: 23 },
  { x: -14, y: 167, r: 23 },
  { x: -14, y: 232, r: 26 },
  { x: -70, y: 232, r: 26 },
  { x: -70, y: 190, r: 30 },
  { x: -103, y: 157, r: 30 },
  { x: -70, y: 124, r: 30 },
  { x: -70, y: 98, r: 45 },
  { x: -57, y: 70, r: 45 },
  { x: -70, y: 41, r: 45 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'dustBowl',
  name: 'Dust Bowl',
  theme: 'desert',
  shape: 'tight',
  width: 15,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 23.5, // WP37: 0.55 AI median clean lap 23.42 s over the 16 soak seeds (WP32: 25)
  centerline: roundedLoop(DUST_BOWL_CORNERS, { x: 8, y: 0 }),
  pickups: [
    { kind: 'mines', s: 35, lateral: -6 },
    { kind: 'cash', s: 110, lateral: 4 },
    { kind: 'turbo', s: 185, lateral: 3.5 },
    { kind: 'mines', s: 260, lateral: 6 },
    { kind: 'repair', s: 335, lateral: -6 },
    { kind: 'cash', s: 410, lateral: 5 },
    { kind: 'mines', s: 485, lateral: 6 },
    { kind: 'repair', s: 560, lateral: 5 },
    { kind: 'cash', s: 645, lateral: 0 },
    { kind: 'cash', s: 715, lateral: 6 },
    { kind: 'turbo', s: 790, lateral: -3 },
    { kind: 'turbo', s: 860, lateral: -6 },
  ],
  props: [],
};

export const DUST_BOWL_PROP_RULES: readonly PropRule[] = [
  { sFrom: 865, sTo: 'length', every: 18, side: 'both', offset: 4, kind: 'rock', scale: [0.8, 1.4] },
  { sFrom: 450, sTo: 535, every: 4, side: 'right', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 356, sTo: 440, every: 15, side: 'both', offset: 3, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 33, sTo: 356, every: 35, side: 'left', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 40, sTo: 356, every: 22, side: 'right', offset: 3, kind: 'rock', scale: [1, 1.6] },
  { sFrom: 540, sTo: 745, every: 18, side: 'both', offset: 2.5, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 745, sTo: 823, every: 25, side: 'left', offset: 3, kind: 'rock', scale: [1, 1.6] },
  { sFrom: 745, sTo: 823, every: 20, side: 'right', offset: 3, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 823, sTo: 870, every: 5, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
];

export const DUST_BOWL_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 14 },
  { kind: 'cactus', count: 18 },
  { kind: 'wreck', count: 4 },
];

export const DUST_BOWL: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER) };
