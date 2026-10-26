/**
 * Dockside (docks theme, M2): technical, 90-degree corners between container stacks, a chicane, and the
 * fast straight along the quay with the sea beyond its outer wall (docks theme `water`). Clockwise.
 * Built from a corner polygon (roundedLoop) so the 90-degree corners keep a constant radius.
 * The start sits after the hairpin, not on the water straight: there the racing line hugs the inside
 * wall and the grid squeezed the back row into it (2-3 wall hits per race in the first 3 s).
 * Width 13 with a 4 m concrete apron (shoulder): with 2 m the lap-1 pack scraped the walls ~6 times
 * per race in the soak, with 4 m about 3 (Scrapyard: 2.94).
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-56     start straight, heading south out of the hairpin
 * - T1-T2      s 59-135: quay gate kink, L then R, 40 deg each, r 35 / 27: spreads the pack after the start
 * - T3         s 170-209: R 90, r 23, onto the quay
 * - s 214-403  water-edge straight (189 m), turbo and mines bait
 * - T4         s 408-463: R 90, r 34, the big stop at the end of the straight (wider radius so the
 *              turn-rate-limited cars do not overshoot into the wall)
 * - T5-T6      s 528-596: chicane, R then L, 40 deg each, r 36 / 29
 * - T7-T10     s 664-901: the container city, R 90 / R 90 / L 90 / L 90, r 20-21, 20-30 m apart:
 *              short bursts between walls of containers
 * - T11        s 976-1045: hairpin R 174 deg, r 20
 * - s 1050-end finish straight
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { type Corner, roundedLoop } from './roundedLoop';

export const DOCKSIDE_CORNERS: readonly Corner[] = [
  { x: 300, y: 310, r: 26 },
  { x: 40, y: 310, r: 38 },
  { x: 40, y: 195, r: 40 },
  { x: 70, y: 165, r: 40 },
  { x: 70, y: 60, r: 24 },
  { x: 150, y: 60, r: 22 },
  { x: 150, y: 140, r: 22 },
  { x: 220, y: 140, r: 22 },
  { x: 220, y: 20, r: 22 },
  { x: 264, y: 20, r: 22 },
  { x: 264, y: 200, r: 40 },
  { x: 300, y: 235, r: 40 },
];

const BASE: TrackDef = {
  id: 'dockside',
  name: 'Dockside',
  theme: 'docks',
  width: 13,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 31,
  centerline: roundedLoop(DOCKSIDE_CORNERS, { x: 264, y: 135 }),
  pickups: [
    { kind: 'cash', s: 30, lateral: -3 },
    { kind: 'cash', s: 155, lateral: 0 },
    { kind: 'mines', s: 240, lateral: 3 },
    { kind: 'turbo', s: 320, lateral: -3 },
    { kind: 'repair', s: 485, lateral: 0 },
    { kind: 'cash', s: 610, lateral: -3 },
    { kind: 'mines', s: 640, lateral: 3 },
    { kind: 'turbo', s: 715, lateral: 0 },
    { kind: 'cash', s: 785, lateral: -2 },
    { kind: 'repair', s: 905, lateral: 2 },
    { kind: 'mines', s: 950, lateral: -3 },
    { kind: 'turbo', s: 1060, lateral: -2 },
    { kind: 'cash', s: 1100, lateral: 3 },
  ],
  props: [],
};

// 'left' is the outside of this clockwise loop. From T3 to T4 (s 160-470) the left side is the quay edge:
// the water starts 1.5 m beyond the wall (render/themes/docks.ts), so no prop stands there.
export const DOCKSIDE_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 160, every: 40, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 180, sTo: 470, every: 40, side: 'right', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 480, sTo: 'length', every: 40, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 0, sTo: 160, every: 9, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 55, sTo: 140, every: 6, side: 'both', offset: 1.5, kind: 'cone', scale: 1 },
  { sFrom: 220, sTo: 400, every: 12, side: 'right', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 230, sTo: 390, every: 20, side: 'right', offset: 6, kind: 'container', scale: 1 },
  { sFrom: 520, sTo: 600, every: 5, side: 'both', offset: 1.5, kind: 'cone', scale: 1 },
  { sFrom: 600, sTo: 970, every: 8, side: 'both', offset: 1.5, kind: 'container', scale: 1 },
  { sFrom: 974, sTo: 1045, every: 8, side: 'left', offset: 1.5, kind: 'container', scale: 1 },
  { sFrom: 1050, sTo: 1125, every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const DOCKSIDE_SCATTER: readonly ScatterRule[] = [
  { kind: 'container', count: 10 },
  { kind: 'crate', count: 12 },
  { kind: 'barrel', count: 8 },
];

export const DOCKSIDE: TrackDef = { ...BASE, props: placeProps(BASE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER) };
