/**
 * Pine Hollow (snow theme, WP23a; redrawn in WP32c as a Death Rally tight track, content.md section 12
 * "Track shape"): a forest sweeper chain with one blind kink, and a hairpin at the far (east) end of the
 * forest. Clockwise, width 14, 4 m of packed-snow shoulder. Built with roundedLoop from a corner polygon.
 * The kink is blind: a wall of tall pines stands on its inside. The start sits on the straight between the
 * hairpin and the kink, 30 m out of the hairpin.
 *
 * Corners in race order (s in m, shape metric 10 m window, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-27       start straight west (55 m with the grid behind the line)
 * - T1           s 27-58: the blind kink, L 58 deg, r 22, pines on the inside
 * - T2           s 63-97: R 58, r 20, down into the south forest
 * - T3-T8        s 106-341: south sweeper chain, L 32 / R 66 / L 66 / R 66 / L 66 / R 34, r 22-24
 * - T9-T11       s 352-470: round the west end, R 57 / R 57 / R 56, r 19-20
 * - T12-T19      s 471-797: north sweeper chain, L 31 / R 66 / L 66 / R 66 / L 66 / R 66 / L 66 / R 33, r 23-24
 * - s 797-841    the run east to the end of the forest
 * - T20          s 841-918: hairpin at the far end of the forest, R 177 deg, r 20
 *
 * Pickups alternate on and off the AI line (lateral 5.5 is outside racingLine's 5.4 m band). Every number
 * here moves with any edit: the soak is chaotic, so re-run the test file and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const PINE_HOLLOW_CORNERS: readonly Corner[] = [
  { x: 234, y: 104, r: 24 },
  { x: 214, y: 138.6, r: 28 },
  { x: 174, y: 138.6, r: 32 },
  { x: 141.2, y: 161.6, r: 32 },
  { x: 98.6, y: 131.8, r: 32 },
  { x: 56, y: 161.6, r: 32 },
  { x: 13.4, y: 131.8, r: 32 },
  { x: -19.3, y: 154.7, r: 32 },
  { x: -59.3, y: 154.7, r: 28 },
  { x: -82, y: 115.4, r: 28 },
  { x: -59.3, y: 76.1, r: 28 },
  { x: -29.3, y: 76.1, r: 32 },
  { x: 3.4, y: 53.1, r: 32 },
  { x: 46, y: 82.9, r: 32 },
  { x: 88.6, y: 53.1, r: 32 },
  { x: 131.2, y: 82.9, r: 32 },
  { x: 173.8, y: 53.1, r: 32 },
  { x: 216.4, y: 82.9, r: 32 },
  { x: 249.2, y: 60, r: 32 },
  { x: 330, y: 60, r: 22 },
  { x: 330, y: 104, r: 22 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'pineHollow',
  name: 'Pine Hollow',
  theme: 'snow',
  shape: 'tight',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 24, // WP37: 0.55 AI median clean lap 24.02 s over the 16 soak seeds (WP32: 25)
  centerline: roundedLoop(PINE_HOLLOW_CORNERS, { x: 290, y: 104 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: 3 },
    { kind: 'mines', s: 120, lateral: -2 },
    { kind: 'turbo', s: 195, lateral: 2 },
    { kind: 'cash', s: 275, lateral: 5.5 },
    { kind: 'repair', s: 355, lateral: -5.5 },
    { kind: 'mines', s: 435, lateral: 5.5 },
    { kind: 'cash', s: 510, lateral: -2 },
    { kind: 'turbo', s: 590, lateral: -5.5 },
    { kind: 'repair', s: 670, lateral: 5.5 },
    { kind: 'cash', s: 750, lateral: 5.5 },
    { kind: 'mines', s: 825, lateral: 2 },
    { kind: 'turbo', s: 905, lateral: -5.5 },
  ],
  props: [],
};

/** s range of the blind kink (T1); its inside is the left side. */
export const PINE_HOLLOW_KINK: readonly [number, number] = [8, 66];

// Light poles first, then the wall of pines inside the kink, then snowbanks and the forest rows. The
// outermost row stays on the outside ('left'): on the inside it would crowd the other leg of the hairpin.
// The 10 m row skips the kink and the run to the hairpin: there its inside props would land within the
// walls' reach of the next leg (validateTrack measures to the nearest centerline). The other forest rows stop
// at s 860, leaving a clearing outside the hairpin exit where the start grandstands fit (render dressing);
// without it the stands land inside the kink, on top of its pine wall.
export const PINE_HOLLOW_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 50, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: PINE_HOLLOW_KINK[0], sTo: PINE_HOLLOW_KINK[1], every: 5, side: 'left', offset: 1.5, kind: 'pine', scale: [1.2, 1.5] },
  { sFrom: 0, sTo: 'length', every: 6, side: 'both', offset: 1.5, kind: 'snowbank', scale: [0.8, 1.1] },
  { sFrom: 0, sTo: 860, every: 8, side: 'both', offset: 4.5, kind: 'pine', scale: [0.9, 1.3] },
  { sFrom: 100, sTo: 760, every: 10, side: 'both', offset: 10, kind: 'pine', scale: [1, 1.4] },
  { sFrom: 0, sTo: 860, every: 12, side: 'left', offset: 16, kind: 'pine', scale: [1.1, 1.5] },
];

export const PINE_HOLLOW_SCATTER: readonly ScatterRule[] = [
  { kind: 'pine', count: 60 },
  { kind: 'snowbank', count: 8 },
];

export const PINE_HOLLOW: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, PINE_HOLLOW_PROP_RULES, PINE_HOLLOW_SCATTER) };
