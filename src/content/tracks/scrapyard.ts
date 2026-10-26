/**
 * Scrapyard (scrapyard theme, M1; redrawn in WP31 as the first Death Rally tight track, content.md section 12
 * "Track shape"): no real straight but the start, a chain of 15-25 m bends left and right with short links,
 * one hairpin at the end of a tongue into the infield. Clockwise, width 14, 4 m of dirt shoulder (WP31 probe:
 * 4.7-6.8 wall hits per race with a 2-3 m shoulder, 2.3-3.2 with 4 m). Built with roundedLoop from a corner polygon.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-39       start straight (69 m with the grid behind the line), heading east
 * - T1-T3        s 39-169: the step down, R 81 / L 82 / R 82, r 15-21
 * - T4-T8        s 179-298: the wiggles, L 21 / R 44 / L 45 / R 45 / L 19, r 21: nearly flat on the line
 * - T9-T10       s 309-382: R 85 / R 81, r 16-17, into the tongue
 * - T11          s 402-472: the hairpin, L 173 deg, r 16 (a 23 m semicircle on the polygon)
 * - T12-T13      s 491-585: R 82 out of the tongue, a 30 m link, R 80 north, r 15-19
 * - T14-T16      s 600-719: the elbow, L 52 / R 111 / L 52, r 15-16
 * - T17-T19      s 728-817: the jog, R 37 / L 82 / R 43, r 16-17
 * - T20          s 821-854: R 82 onto the start straight, r 17
 *
 * Pickups alternate on and off the racing line: lateral 5.5 sits outside the AI's 5.4 m line band
 * (racingLine lineLimit), so those are only for a driver who goes for them. Two of the mines and one repair
 * are off the line: fewer AI refills keep mine hits and wrecks inside the WP12 targets.
 * Every number here moves with any edit: the soak is chaotic, so re-run scrapyard.test.ts and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { type Corner, roundedLoop } from './roundedLoop';

export const SCRAPYARD_CORNERS: readonly Corner[] = [
  { x: 58, y: 0, r: 24 },
  { x: 58, y: 58, r: 22 },
  { x: 116, y: 58, r: 22 },
  { x: 116, y: 94, r: 28 },
  { x: 127, y: 117, r: 28 },
  { x: 113, y: 146, r: 28 },
  { x: 127, y: 175, r: 28 },
  { x: 116, y: 198, r: 28 },
  { x: 116, y: 234, r: 22 },
  { x: 65, y: 234, r: 22 },
  { x: 65, y: 172, r: 23 },
  { x: 19, y: 172, r: 23 },
  { x: 19, y: 234, r: 22 },
  { x: -53, y: 234, r: 22 },
  { x: -53, y: 188, r: 22 },
  { x: -115, y: 152, r: 22 },
  { x: -62, y: 122, r: 22 },
  { x: -62, y: 95, r: 22 },
  { x: -33, y: 66, r: 22 },
  { x: -62, y: 37, r: 24 },
  { x: -62, y: 0, r: 22 },
];

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'scrapyard',
  name: 'Scrapyard',
  theme: 'scrapyard',
  shape: 'tight',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 26, // WP31: 0.55 AI median clean lap 26.09 s over the 16 soak seeds (old layout 27.5)
  centerline: roundedLoop(SCRAPYARD_CORNERS, { x: 11, y: 0 }),
  pickups: [
    { kind: 'mines', s: 35, lateral: -5.5 },
    { kind: 'cash', s: 110, lateral: -2 },
    { kind: 'turbo', s: 180, lateral: 3.5 },
    { kind: 'mines', s: 255, lateral: -5.5 },
    { kind: 'repair', s: 330, lateral: -5.5 },
    { kind: 'cash', s: 400, lateral: 5.5 },
    { kind: 'mines', s: 475, lateral: -5.5 },
    { kind: 'repair', s: 550, lateral: 5 },
    { kind: 'cash', s: 620, lateral: 2 },
    { kind: 'cash', s: 695, lateral: 5.5 },
    { kind: 'turbo', s: 770, lateral: -2 },
    { kind: 'turbo', s: 835, lateral: -5.5 },
  ],
  props: [],
};

export const SCRAPYARD_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 60, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 20, sTo: 120, every: 12, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 135, sTo: 220, every: 18, side: 'right', offset: 3, kind: 'container', scale: 1 },
  { sFrom: 250, sTo: 350, every: 10, side: 'left', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 380, sTo: 470, every: 25, side: 'right', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 500, sTo: 590, every: 8, side: 'both', offset: 1.5, kind: 'barrel', scale: 1 },
  { sFrom: 605, sTo: 755, every: 22, side: 'left', offset: 3.5, kind: 'container', scale: 1 },
  { sFrom: 755, sTo: 880, every: 14, side: 'right', offset: 2, kind: 'tireStack', scale: 1 },
];

export const SCRAPYARD_SCATTER: readonly ScatterRule[] = [
  { kind: 'wreck', count: 6 },
  { kind: 'crate', count: 10 },
];

export const SCRAPYARD: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER) };
