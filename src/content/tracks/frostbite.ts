/**
 * Frostbite Pass (snow theme, WP22): narrow switchbacks between snowbanks and pines. Clockwise, width 13,
 * 4 m of packed-snow shoulder (WP11: a wide shoulder calms the lap-1 wall hits). Built with roundedLoop:
 * three 180-degree switchbacks stacked down the east side, joined by two long straights.
 * The start sits on the bottom leg right after the last switchback (WP11: start on a straight after a
 * corner; on the long top straight the right-hand grid column was squeezed into the wall).
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-252      bottom leg west (250 m) out of the last switchback
 * - T1           s 252-305: R 88, r 27
 * - s 305-369    short climb north
 * - T2           s 369-422: R 88, r 27, onto the top straight
 * - s 422-719    top straight east (297 m): the top speed run, turbo bait
 * - T3           s 719-805: switchback 1, R 178 deg, r 21, the big brake test
 * - s 805-953    leg west
 * - T4           s 953-1024: switchback 2 (hairpin), L 178 deg, r 18
 * - s 1024-1146  leg east
 * - T5           s 1146-1217: switchback 3 (hairpin), R 178 deg, r 18
 * - s 1217-end   onto the bottom leg
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const FROSTBITE_CORNERS: readonly Corner[] = [
  { x: 330, y: 0, r: 26 },
  { x: 330, y: 50, r: 24 },
  { x: 130, y: 50, r: 20 },
  { x: 130, y: 90, r: 20 },
  { x: 300, y: 90, r: 20 },
  { x: 300, y: 130, r: 20 },
  { x: -30, y: 130, r: 30 },
  { x: -30, y: 0, r: 30 },
];

const BASE: TrackDef = {
  id: 'frostbite',
  name: 'Frostbite Pass',
  theme: 'snow',
  width: 13,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 33,
  centerline: roundedLoop(FROSTBITE_CORNERS, { x: 250, y: 130 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: -3 },
    { kind: 'turbo', s: 120, lateral: 3 },
    { kind: 'mines', s: 210, lateral: 0 },
    { kind: 'repair', s: 340, lateral: 0 },
    { kind: 'cash', s: 450, lateral: -3 },
    { kind: 'turbo', s: 540, lateral: 0 },
    { kind: 'cash', s: 640, lateral: 3 },
    { kind: 'mines', s: 690, lateral: -3 },
    { kind: 'cash', s: 840, lateral: 3 },
    { kind: 'repair', s: 900, lateral: -2 },
    { kind: 'mines', s: 1040, lateral: 2 },
    { kind: 'turbo', s: 1070, lateral: 0 },
    { kind: 'cash', s: 1110, lateral: -3 },
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

export const FROSTBITE: TrackDef = { ...BASE, props: placeProps(BASE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER) };
