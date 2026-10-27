/**
 * Frostbite Pass (snow theme, WP22; redrawn in WP32 as a Death Rally tight track, content.md section 12 "Track
 * shape"): narrow switchbacks between snowbanks and pines. Clockwise, width 13, 5 m of packed-snow shoulder (WP32
 * probe: 5.0 wall impacts per race with 4 m, 2.4 with 5 m). Built with roundedLoop: three 180-degree switchbacks
 * stacked up the west side, snowbank wiggles down the east side and along the bottom.
 *
 * Corners in race order (s in m, r = arc radius on the polygon, "R"/"L" = right/left):
 * - s 0-23       start straight (75 m with the grid behind the line), heading east
 * - T1           s 23-65: R 88 south, r 22
 * - T2-T4        s 64-155: the east wiggle, L 42 / R 87 / L 44, r 24
 * - T5-T6        s 159-196: a flat S, L 24 / R 21, r 40
 * - T7           s 202-244: R 89 onto the bottom, r 22
 * - T8-T13       s 243-422: two wiggles along the bottom, L 43 / R 87 / L 44 / L 43 / R 87 / L 42, r 24
 * - T14          s 433-508: switchback 1, R 179 deg, r 22 (two back-to-back 90s)
 * - T15          s 527-604: switchback 2, L 180 deg, r 22
 * - T16          s 622-698: switchback 3, R 179 deg, r 22
 * - T17-T18      s 731-807: the step up onto the start straight, L 84 / R 84, r 22
 *
 * Pickups alternate on and off the racing line: lateral 5 sits outside the AI's 4.9 m line band and on the far
 * side of the line, so the AI only takes the ones on its line; all three mines are off it. Every number here
 * moves with any edit: re-run frostbite.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

// Listed from the step's left 90: roundedLoop's corner 0 needs a leg before it (a 0 m leg there duplicates a point).
export const FROSTBITE_CORNERS: readonly Corner[] = [
  { x: 84, y: 44, r: 22 },
  { x: 84, y: 0, r: 22 },
  { x: 208, y: 0, r: 22 },
  { x: 208, y: 38, r: 24 },
  { x: 235, y: 65, r: 24 },
  { x: 208, y: 92, r: 24 },
  { x: 208, y: 118, r: 40 },
  { x: 220, y: 139, r: 40 },
  { x: 220, y: 176, r: 22 },
  { x: 182, y: 176, r: 24 },
  { x: 155, y: 203, r: 24 },
  { x: 128, y: 176, r: 24 },
  { x: 102, y: 176, r: 24 },
  { x: 75, y: 203, r: 24 },
  { x: 49, y: 176, r: 24 },
  { x: 0, y: 176, r: 22 },
  { x: 0, y: 132, r: 22 },
  { x: 70, y: 132, r: 22 },
  { x: 70, y: 88, r: 22 },
  { x: 0, y: 88, r: 22 },
  { x: 0, y: 44, r: 22 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'frostbite',
  name: 'Frostbite Pass',
  theme: 'snow',
  shape: 'tight',
  width: 13,
  shoulder: 5,
  checkpointSpacing: 40,
  referenceLapTime: 25, // WP32: 0.55 AI median clean lap 25.09 s over the 16 soak seeds (old layout 32.5)
  centerline: roundedLoop(FROSTBITE_CORNERS, { x: 155, y: 0 }),
  pickups: [
    { kind: 'cash', s: 35, lateral: 4 },
    { kind: 'mines', s: 105, lateral: -5 },
    { kind: 'turbo', s: 175, lateral: -1 },
    { kind: 'repair', s: 230, lateral: -5 },
    { kind: 'cash', s: 320, lateral: -3 },
    { kind: 'mines', s: 390, lateral: -5 },
    { kind: 'turbo', s: 460, lateral: 4 },
    { kind: 'cash', s: 530, lateral: 5 },
    { kind: 'mines', s: 600, lateral: 5 },
    { kind: 'repair', s: 670, lateral: 4 },
    { kind: 'cash', s: 740, lateral: 5 },
    { kind: 'turbo', s: 810, lateral: -5 },
  ],
  props: [],
};

// Light poles first so the snowbanks along the walls leave room for them.
export const FROSTBITE_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 45, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 0, sTo: 'length', every: 5, side: 'both', offset: 1.5, kind: 'snowbank', scale: [0.8, 1.1] },
  { sFrom: 0, sTo: 'length', every: 9, side: 'both', offset: 4.5, kind: 'pine', scale: [0.8, 1.3] },
  { sFrom: 0, sTo: 'length', every: 11, side: 'both', offset: 10, kind: 'pine', scale: [1, 1.4] },
];

export const FROSTBITE_SCATTER: readonly ScatterRule[] = [
  { kind: 'pine', count: 40 },
  { kind: 'snowbank', count: 10 },
];

export const FROSTBITE: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER) };
