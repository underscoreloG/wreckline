/**
 * Rain District (city theme, WP23b): a chicane chain through narrow streets and one 200 m boulevard that
 * ends in a hairpin turnaround. Clockwise, width 14, 4 m of sidewalk (shoulder). Built with roundedLoop
 * from a corner polygon. The start sits on the boulevard right after the last corner (WP11/WP22: start on
 * a straight after a corner); of five soaked starts this one gave the fewest wrecks with the most clean laps.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-207      the boulevard east (207 m), billboards both sides
 * - T1           s 207-278: hairpin turnaround at the end of the boulevard, R 178 deg, r 18
 * - s 278-345    back street west
 * - T2           s 345-392: L 88, r 23, into the narrow streets
 * - T3-T8        s 401-629: the chicane chain, three S-bends L/R, R/L, L/R, 33 deg each, r 23-25
 * - T9           s 645-691: R 87, r 18
 * - s 691-759    south street west
 * - T10-T11      s 759-826: jog R 48 / L 46, r 31 / 26
 * - T12          s 831-875: R 86, r 20, onto the west street
 * - T13-T14      s 952-1020: chicane R 34 / L 33, r 31 / 23
 * - s 1020-1124  west street north
 * - T15          s 1124-1165: R 86, r 21, onto the boulevard
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const RAIN_DISTRICT_CORNERS: readonly Corner[] = [
  { x: 25, y: 0, r: 24 },
  { x: 280, y: 0, r: 20 },
  { x: 280, y: 40, r: 20 },
  { x: 160, y: 40, r: 26 },
  { x: 160, y: 90, r: 35 },
  { x: 185, y: 125, r: 35 },
  { x: 185, y: 165, r: 35 },
  { x: 160, y: 200, r: 35 },
  { x: 160, y: 240, r: 35 },
  { x: 185, y: 275, r: 35 },
  { x: 185, y: 330, r: 26 },
  { x: 70, y: 330, r: 35 },
  { x: 45, y: 300, r: 35 },
  { x: 0, y: 300, r: 26 },
  { x: 0, y: 180, r: 35 },
  { x: 25, y: 145, r: 35 },
];

const BASE: TrackDef = {
  id: 'rainDistrict',
  name: 'Rain District',
  theme: 'city',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 31.5,
  centerline: roundedLoop(RAIN_DISTRICT_CORNERS, { x: 60, y: 0 }),
  pickups: [
    { kind: 'cash', s: 36, lateral: -3 },
    { kind: 'mines', s: 125, lateral: 3 },
    { kind: 'cash', s: 215, lateral: 0 },
    { kind: 'repair', s: 305, lateral: -3 },
    { kind: 'turbo', s: 394, lateral: 2 },
    { kind: 'cash', s: 484, lateral: 0 },
    { kind: 'mines', s: 574, lateral: 3 },
    { kind: 'repair', s: 663, lateral: -2 },
    { kind: 'turbo', s: 753, lateral: -3 },
    { kind: 'cash', s: 842, lateral: 3 },
    { kind: 'mines', s: 932, lateral: 0 },
    { kind: 'turbo', s: 1022, lateral: -3 },
    { kind: 'cash', s: 1111, lateral: 2 },
  ],
  props: [],
};

// More lamp pools than Neon Mile for the wet look, billboards on the boulevard and the west street
// (outside the walls), then building fronts fill the gaps.
export const RAIN_DISTRICT_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 22, side: 'alternate', offset: 2, kind: 'lightPole', scale: 1 },
  { sFrom: 20, sTo: 195, every: 45, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 1030, sTo: 1115, every: 40, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
  { sFrom: 0, sTo: 'length', every: 13, side: 'both', offset: 3, kind: 'building', scale: 1 },
];

export const RAIN_DISTRICT_SCATTER: readonly ScatterRule[] = [
  { kind: 'building', count: 16 },
  { kind: 'crate', count: 6 },
];

export const RAIN_DISTRICT: TrackDef = { ...BASE, props: placeProps(BASE, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER) };
