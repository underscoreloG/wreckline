/**
 * Junkyard Sprint (scrapyard theme, WP23a; redrawn in WP32c as a Death Rally tight track, content.md
 * section 12 "Track shape"): the shortest and most violent. A paperclip with a hairpin at each end, square
 * steps and wiggles in between, so the pack stays bunched and every hairpin is a ramming chance. Clockwise,
 * width 14, 4 m of dirt shoulder. Built with roundedLoop from a corner polygon.
 * The start sits in the middle of the bottom-left run, 30 m before the west hairpin: turn 1 is a hairpin.
 *
 * Corners in race order (s in m, shape metric 10 m window, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-26       start straight west (56 m with the grid behind the line)
 * - T1           s 26-103: west hairpin, R 178 deg, r 19
 * - T2-T3        s 102-193: the step up onto the top run, L 88 / R 89, r 16-17
 * - T4-T9        s 201-391: the top wiggles, R 41 / L 44 / L 41 / R 44 / R 41 / L 42, r 21-24
 * - T10          s 413-488: east hairpin, R 178 deg, r 14 (the spline after its 24 m entry leg), the big brake test
 * - T11-T14      s 506-687: the stepped bulge round the junk pile, L 89 / R 89 / L 89 / R 90, r 15-19
 * - T15-T16      s 692-808: R 85 (r 25) north, L 88 (r 19) onto the start straight
 *
 * Pickups alternate on and off the AI line (lateral 5.5 is outside racingLine's 5.4 m band); both mines are
 * off it. Every number here moves with any edit: the soak is chaotic, so re-run the test file and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const JUNKYARD_SPRINT_CORNERS: readonly Corner[] = [
  { x: 230, y: 48, r: 22 },
  { x: 230, y: 104, r: 22 },
  { x: 176, y: 104, r: 22 },
  { x: 176, y: 160, r: 22 },
  { x: 110, y: 160, r: 34 },
  { x: 110, y: 82, r: 28 },
  { x: 0, y: 82, r: 22 },
  { x: 0, y: 38, r: 22 },
  { x: 50, y: 38, r: 22 },
  { x: 50, y: -20, r: 24 },
  { x: 100, y: -20, r: 32 },
  { x: 124, y: 4, r: 32 },
  { x: 160, y: 4, r: 30 },
  { x: 184, y: -20, r: 30 },
  { x: 216, y: -20, r: 30 },
  { x: 240, y: 4, r: 34 },
  { x: 300, y: 4, r: 22 },
  { x: 300, y: 48, r: 22 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'junkyardSprint',
  name: 'Junkyard Sprint',
  theme: 'scrapyard',
  shape: 'tight',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 24, // WP32c: 0.55 AI median clean lap 23.90 s over the 16 soak seeds (old layout 23)
  centerline: roundedLoop(JUNKYARD_SPRINT_CORNERS, { x: 52, y: 82 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: 5.5 },
    { kind: 'mines', s: 115, lateral: -5.5 },
    { kind: 'turbo', s: 190, lateral: 2 },
    { kind: 'cash', s: 265, lateral: -2 },
    { kind: 'repair', s: 340, lateral: 5.5 },
    { kind: 'cash', s: 415, lateral: -5.5 },
    { kind: 'mines', s: 490, lateral: 5.5 },
    { kind: 'turbo', s: 565, lateral: -2 },
    { kind: 'cash', s: 640, lateral: 3 },
    { kind: 'repair', s: 715, lateral: -3 },
    { kind: 'turbo', s: 790, lateral: -5.5 },
  ],
  props: [],
};

// 'left' is the outside of this clockwise loop: tire walls on the outside of both hairpins, wrecks outside
// the top wiggles, containers on their infield side, crates round the bulge, barrels along the start.
export const JUNKYARD_SPRINT_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 50, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 20, sTo: 110, every: 4, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 405, sTo: 495, every: 4, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 790, sTo: 'length', every: 8, side: 'both', offset: 1.5, kind: 'barrel', scale: 1 },
  { sFrom: 500, sTo: 790, every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 150, sTo: 400, every: 30, side: 'left', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 160, sTo: 400, every: 18, side: 'right', offset: 3, kind: 'container', scale: 1 },
];

export const JUNKYARD_SPRINT_SCATTER: readonly ScatterRule[] = [
  { kind: 'wreck', count: 6 },
  { kind: 'crate', count: 10 },
];

export const JUNKYARD_SPRINT: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER) };
