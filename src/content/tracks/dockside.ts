/**
 * Dockside (docks theme, M2; redrawn in WP32 as a Death Rally tight track, content.md section 12 "Track shape"):
 * square 90-degree corners stepping round container stacks, a chicane, a quay with the sea beyond its outer wall
 * (docks theme `water`), a hairpin at the end of a tongue into the infield. Clockwise, width 13, 4 m of concrete
 * apron (shoulder). Built with roundedLoop: every 90 is r 22, the chicane r 24.
 *
 * Corners in race order (s in m, r = arc radius on the polygon, "R"/"L" = right/left):
 * - s 0-33       start straight (69 m with the grid behind the line), heading east
 * - T1-T5        s 33-237: the east steps, R 87 / L 87 / R 87 / L 87 / R 88, 6 m between them, containers both sides
 * - T6-T8        s 237-322: the chicane, L 42 / R 83 / L 40, r 24
 * - T9           s 339-380: R 87 onto the quay
 * - s 380-439    the quay heading west (61 m), the water 1.5 m beyond the outer wall; no prop on the water side
 * - T10-T14      s 439-644: off the quay and the west steps, R 87 / L 87 / R 87 / L 87 / R 90
 * - T15          s 642-683: R 88 into the tongue
 * - T16          s 683-759: the hairpin, L 178 deg (two back-to-back 90s), containers on the outside
 * - T17-T18      s 766-848: R 91 / R 91 round onto the start straight
 *
 * Pickups alternate on and off the racing line: lateral 5 sits outside the AI's 4.9 m line band and on the far
 * side of the line, so the AI only takes the ones on its line; all three mines are off it. Every number here
 * moves with any edit: re-run dockside.test.ts, themes.test.ts (the water) and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { type Corner, roundedLoop } from './roundedLoop';

export const DOCKSIDE_CORNERS: readonly Corner[] = [
  { x: 0, y: 0, r: 22 },
  { x: 118, y: 0, r: 22 },
  { x: 118, y: 50, r: 22 },
  { x: 168, y: 50, r: 22 },
  { x: 168, y: 100, r: 22 },
  { x: 218, y: 100, r: 22 },
  { x: 218, y: 138, r: 24 },
  { x: 243, y: 163, r: 24 },
  { x: 218, y: 189, r: 24 },
  { x: 218, y: 244, r: 22 },
  { x: 108, y: 244, r: 22 },
  { x: 108, y: 194, r: 22 },
  { x: 58, y: 194, r: 22 },
  { x: 58, y: 144, r: 22 },
  { x: 8, y: 144, r: 22 },
  { x: 8, y: 94, r: 22 },
  { x: 58, y: 94, r: 22 },
  { x: 58, y: 50, r: 22 },
  { x: 0, y: 50, r: 22 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'dockside',
  name: 'Dockside',
  theme: 'docks',
  shape: 'tight',
  width: 13,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 24.5, // WP37: 0.55 AI median clean lap 24.35 s over the 16 soak seeds (WP32: 26.5)
  centerline: roundedLoop(DOCKSIDE_CORNERS, { x: 50, y: 0 }),
  pickups: [
    { kind: 'cash', s: 35, lateral: 4 },
    { kind: 'mines', s: 100, lateral: 5 },
    { kind: 'turbo', s: 185, lateral: -4 },
    { kind: 'repair', s: 280, lateral: -5 },
    { kind: 'cash', s: 335, lateral: 1 },
    { kind: 'mines', s: 410, lateral: -5 },
    { kind: 'turbo', s: 485, lateral: -2 },
    { kind: 'cash', s: 545, lateral: -5 },
    { kind: 'mines', s: 635, lateral: -5 },
    { kind: 'repair', s: 710, lateral: -4 },
    { kind: 'cash', s: 790, lateral: -5 },
    { kind: 'turbo', s: 855, lateral: 4 },
  ],
  props: [],
};

// 'left' is the outside of this clockwise loop. From T9 to T10 (s 335-485) the left side is the quay edge:
// the water starts 1.5 m beyond the wall (render/themes/docks.ts), so no prop stands there.
export const DOCKSIDE_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 335, every: 36, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 335, sTo: 485, every: 36, side: 'right', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 485, sTo: 'length', every: 36, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 0, sTo: 30, every: 9, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 75, sTo: 116, every: 6, side: 'right', offset: 1.5, kind: 'cone', scale: 1 },
  { sFrom: 380, sTo: 439, every: 12, side: 'right', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 380, sTo: 439, every: 20, side: 'right', offset: 6, kind: 'container', scale: 1 },
  { sFrom: 237, sTo: 322, every: 5, side: 'both', offset: 1.5, kind: 'cone', scale: 1 },
  { sFrom: 115, sTo: 237, every: 8, side: 'both', offset: 1.5, kind: 'container', scale: 1 },
  { sFrom: 480, sTo: 644, every: 8, side: 'both', offset: 1.5, kind: 'container', scale: 1 },
  { sFrom: 683, sTo: 759, every: 8, side: 'right', offset: 1.5, kind: 'container', scale: 1 },
  { sFrom: 808, sTo: 842, every: 10, side: 'both', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const DOCKSIDE_SCATTER: readonly ScatterRule[] = [
  { kind: 'container', count: 10 },
  { kind: 'crate', count: 12 },
  { kind: 'barrel', count: 8 },
];

export const DOCKSIDE: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER) };
