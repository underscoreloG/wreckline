/**
 * Junkyard Sprint (scrapyard theme, WP23a): short and violent. A paperclip with a hairpin at each end, a
 * long straight into the east hairpin and an S-bend bulge round a junk pile on the way back, so the pack
 * stays bunched and every hairpin is a ramming chance. Clockwise, width 14, 4 m of dirt shoulder (WP11:
 * a wide shoulder calms the lap-1 wall hits). Built with roundedLoop from a corner polygon.
 * The start sits on the bottom leg right after the east hairpin (WP11/WP22: start on a straight after a
 * corner).
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-63       bottom leg west out of the east hairpin
 * - T1-T4        s 63-282: the bulge round the junk pile, L / R / R / L, 43 deg each, r 27
 * - s 282-332    short run to the west hairpin
 * - T5           s 332-403: west hairpin, R 178 deg, r 18
 * - s 403-735    top straight east (332 m): top speed run, turbo bait
 * - T6           s 735-806: east hairpin, R 178 deg, r 18, the big brake test
 * - s 806-end    onto the bottom leg
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const JUNKYARD_SPRINT_CORNERS: readonly Corner[] = [
  { x: 380, y: 0, r: 20 },
  { x: 380, y: 40, r: 20 },
  { x: 250, y: 40, r: 30 },
  { x: 210, y: 80, r: 30 },
  { x: 130, y: 80, r: 30 },
  { x: 90, y: 40, r: 30 },
  { x: 0, y: 40, r: 20 },
  { x: 0, y: 0, r: 20 },
];

const BASE: TrackDef = {
  id: 'junkyardSprint',
  name: 'Junkyard Sprint',
  theme: 'scrapyard',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 23,
  centerline: roundedLoop(JUNKYARD_SPRINT_CORNERS, { x: 330, y: 40 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: -3 },
    { kind: 'mines', s: 145, lateral: 0 },
    { kind: 'repair', s: 180, lateral: -2 },
    { kind: 'turbo', s: 240, lateral: 3 },
    { kind: 'cash', s: 300, lateral: 3 },
    { kind: 'repair', s: 430, lateral: -3 },
    { kind: 'cash', s: 500, lateral: 0 },
    { kind: 'turbo', s: 560, lateral: -3 },
    { kind: 'mines', s: 650, lateral: 3 },
    { kind: 'cash', s: 700, lateral: -3 },
  ],
  props: [],
};

// 'left' is the outside of this clockwise loop: tire walls on the outside of both hairpins.
export const JUNKYARD_SPRINT_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 50, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 325, sTo: 410, every: 4, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 728, sTo: 812, every: 4, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 0, sTo: 60, every: 8, side: 'both', offset: 1.5, kind: 'barrel', scale: 1 },
  { sFrom: 60, sTo: 290, every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 420, sTo: 720, every: 30, side: 'left', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 430, sTo: 720, every: 18, side: 'right', offset: 3, kind: 'container', scale: 1 },
];

export const JUNKYARD_SPRINT_SCATTER: readonly ScatterRule[] = [
  { kind: 'wreck', count: 6 },
  { kind: 'crate', count: 10 },
];

export const JUNKYARD_SPRINT: TrackDef = { ...BASE, props: placeProps(BASE, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER) };
