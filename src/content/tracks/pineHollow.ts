/**
 * Pine Hollow (snow theme, WP23a): fast forest sweepers with one blind kink, and a hairpin at the far
 * (east) end of the forest. Clockwise, width 14, 4 m of packed-snow shoulder. Built with roundedLoop
 * from a corner polygon. The kink is blind: a wall of tall pines stands on its inside.
 * The start sits on the 120 m straight between the hairpin and the kink, 97 m after the hairpin (WP22: try
 * 4-8 starts; of 6 tried, two failed the WP07 gate in one seed each, and this one had the fewest wall hits).
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-23       west, the grid 30-45 m before the kink
 * - T1           s 23-53: the blind kink, L 43 deg, r 27, pines on the inside
 * - T2-T4        s 113-419: forest sweepers, R 29 (r 81), R 27 (r 97), R 9 (r 72)
 * - T5-T6        s 505-681: R 61 (r 61) and R 87 (r 45), round the west end onto the straight
 * - s 681-948    north straight east (267 m)
 * - T7-T8        s 948-1136: fast S, R 19 / L 19, r 73
 * - T9           s 1229-1300: hairpin at the far end of the forest, R 178 deg, r 18
 * - s 1300-end   out of the hairpin, west to the line
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const PINE_HOLLOW_CORNERS: readonly Corner[] = [
  { x: 280, y: 0, r: 80 },
  { x: 430, y: 60, r: 80 },
  { x: 560, y: 60, r: 20 },
  { x: 560, y: 100, r: 20 },
  { x: 400, y: 100, r: 30 },
  { x: 330, y: 170, r: 90 },
  { x: 190, y: 205, r: 110 },
  { x: 60, y: 170, r: 80 },
  { x: -60, y: 110, r: 70 },
  { x: -60, y: 0, r: 60 },
];

const BASE: TrackDef = {
  id: 'pineHollow',
  name: 'Pine Hollow',
  theme: 'snow',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 36.5,
  centerline: roundedLoop(PINE_HOLLOW_CORNERS, { x: 450, y: 100 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: 3 },
    { kind: 'mines', s: 130, lateral: 0 },
    { kind: 'repair', s: 230, lateral: -3 },
    { kind: 'cash', s: 330, lateral: 3 },
    { kind: 'turbo', s: 420, lateral: 0 },
    { kind: 'cash', s: 510, lateral: -3 },
    { kind: 'mines', s: 600, lateral: 2 },
    { kind: 'repair', s: 690, lateral: -2 },
    { kind: 'turbo', s: 780, lateral: 0 },
    { kind: 'cash', s: 880, lateral: 3 },
    { kind: 'mines', s: 960, lateral: -3 },
    { kind: 'turbo', s: 1080, lateral: 3 },
    { kind: 'repair', s: 1170, lateral: 0 },
    { kind: 'cash', s: 1240, lateral: -3 },
  ],
  props: [],
};

/** s range of the blind kink (T1); its inside is the left side. */
export const PINE_HOLLOW_KINK: readonly [number, number] = [10, 65];

// Light poles first, then the wall of pines inside the kink, then snowbanks and the forest rows. The
// outermost row stays on the outside ('left'): on the inside it would crowd the other leg of the hairpin.
export const PINE_HOLLOW_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 50, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: PINE_HOLLOW_KINK[0], sTo: PINE_HOLLOW_KINK[1], every: 5, side: 'left', offset: 1.5, kind: 'pine', scale: [1.2, 1.5] },
  { sFrom: 0, sTo: 'length', every: 6, side: 'both', offset: 1.5, kind: 'snowbank', scale: [0.8, 1.1] },
  { sFrom: 0, sTo: 'length', every: 8, side: 'both', offset: 4.5, kind: 'pine', scale: [0.9, 1.3] },
  { sFrom: 0, sTo: 'length', every: 10, side: 'both', offset: 10, kind: 'pine', scale: [1, 1.4] },
  { sFrom: 0, sTo: 'length', every: 12, side: 'left', offset: 16, kind: 'pine', scale: [1.1, 1.5] },
];

export const PINE_HOLLOW_SCATTER: readonly ScatterRule[] = [
  { kind: 'pine', count: 60 },
  { kind: 'snowbank', count: 8 },
];

export const PINE_HOLLOW: TrackDef = { ...BASE, props: placeProps(BASE, PINE_HOLLOW_PROP_RULES, PINE_HOLLOW_SCATTER) };
