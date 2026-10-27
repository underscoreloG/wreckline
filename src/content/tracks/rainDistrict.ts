/**
 * Rain District (city theme, WP23b; redrawn in WP32 as a Death Rally tight track, content.md section 12
 * "Track shape"): the boulevard is the start straight, a hairpin turnaround at its end, then a chicane chain
 * and right-angle steps through narrow streets. Clockwise, width 14, 4 m of sidewalk (shoulder). Built with
 * roundedLoop from a corner polygon. The line sits 32 m before the hairpin with the grid on the boulevard.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 870-899, 0-30  the boulevard east (61 m with the grid on it), billboards both sides
 * - T1           s 30-107: hairpin turnaround at the end of the boulevard, R 176 deg, r 23
 * - T2           s 109-147: L 86, r 24, from the back street into the narrow streets
 * - T3-T7        s 164-299: the chicane chain south, L 24 / R 50 / L 49 / R 51 / L 25, r 28-29
 * - T8-T11       s 313-484: the jog down and west, R 84 / L 82 / R 86 / R 88, r 24
 * - T12-T15      s 488-659: steps round a block, L 84 / R 86 / R 84 / L 87, r 24
 * - T16-T18      s 668-743: chicane on the west street, R 25 / L 52 / R 25, r 29-41
 * - T19-T21      s 748-869: R 84 / L 84 / R 87, r 24, the jog onto the boulevard
 *
 * Pickups alternate on and off the racing line: lateral 5.5 sits outside the AI's 5.4 m line band, as on
 * Scrapyard. Every number here moves with any edit: the soak is chaotic, so re-run rainDistrict.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const RAIN_DISTRICT_CORNERS: readonly Corner[] = [
  { x: 18, y: 0, r: 24 },
  { x: 130, y: 0, r: 23 },
  { x: 130, y: 46, r: 23 },
  { x: 80, y: 46, r: 24 },
  { x: 80, y: 96, r: 28 },
  { x: 94, y: 124, r: 28 },
  { x: 80, y: 152, r: 28 },
  { x: 94, y: 180, r: 28 },
  { x: 80, y: 208, r: 28 },
  { x: 80, y: 256, r: 24 },
  { x: 30, y: 256, r: 24 },
  { x: 30, y: 306, r: 24 },
  { x: -30, y: 306, r: 24 },
  { x: -30, y: 250, r: 24 },
  { x: -80, y: 250, r: 24 },
  { x: -80, y: 190, r: 24 },
  { x: -30, y: 190, r: 24 },
  { x: -30, y: 146, r: 28 },
  { x: -16, y: 118, r: 28 },
  { x: -30, y: 90, r: 28 },
  { x: -30, y: 50, r: 24 },
  { x: 18, y: 50, r: 24 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'rainDistrict',
  name: 'Rain District',
  theme: 'city',
  shape: 'tight',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 25.5, // WP32: 0.55 AI median clean lap 25.50 s over the 16 soak seeds (old layout 31.5)
  centerline: roundedLoop(RAIN_DISTRICT_CORNERS, { x: 74, y: 0 }),
  pickups: [
    { kind: 'cash', s: 30, lateral: -2 },
    { kind: 'mines', s: 105, lateral: -5.5 },
    { kind: 'turbo', s: 180, lateral: 3.5 },
    { kind: 'repair', s: 255, lateral: -5.5 },
    { kind: 'cash', s: 330, lateral: 5.5 },
    { kind: 'mines', s: 405, lateral: 5.5 },
    { kind: 'turbo', s: 480, lateral: -2 },
    { kind: 'cash', s: 555, lateral: 2 },
    { kind: 'mines', s: 630, lateral: -5.5 },
    { kind: 'repair', s: 705, lateral: 5 },
    { kind: 'turbo', s: 780, lateral: -5.5 },
    { kind: 'cash', s: 855, lateral: 5.5 },
  ],
  props: [],
};

// More lamp pools than Neon Mile for the wet look, billboards on the boulevard and the west street
// (outside the walls), then building fronts fill the gaps.
export const RAIN_DISTRICT_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 22, side: 'alternate', offset: 2, kind: 'lightPole', scale: 1 },
  { sFrom: 0, sTo: 15, every: 20, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 662, sTo: 690, every: 40, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 860, sTo: 'length', every: 20, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 0, sTo: 'length', every: 13, side: 'both', offset: 3, kind: 'building', scale: 1 },
];

export const RAIN_DISTRICT_SCATTER: readonly ScatterRule[] = [
  { kind: 'building', count: 12 },
  { kind: 'crate', count: 6 },
];

export const RAIN_DISTRICT: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER) };
