/**
 * Blast Pit (quarry theme, WP23b; redrawn in WP32c as a Death Rally tight track, content.md section 12
 * "Track shape"): the longest track, a double loop round two pits that never crosses itself. A cut runs
 * down between the pits from the top edge and ends in a hairpin, so each pit is ringed by its own loop of
 * bends. A crane stands outside the wall at the hairpin's apex and swings its jib over the road (only its
 * base collides). Clockwise, width 16, 5 m of dirt shoulder (WP32c probe: 4.1 wall hits per race with 4 m,
 * 2.7 with 5 m). Built with roundedLoop from a corner polygon. The start sits on the east side, 30 m out of
 * the NE corner.
 *
 * Corners in race order (s in m, shape metric 10 m window, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-31       start straight south (54 m with the grid behind the line)
 * - T1-T2        s 31-122: a jog out, L 24 (r 36), then R 118 back and round the SE corner, r 21
 * - T3-T8        s 121-346: the bottom chain under the west pit, L 35 / R 74 / L 73 / R 72 / L 74 / R 37, r 23
 * - T9           s 367-420: SW corner, R 84, r 22
 * - T10-T12      s 423-529: west side, L 32 / R 67 / L 33, r 21-23
 * - T13          s 536-589: NW corner, R 85, r 24
 * - T14-T16      s 591-702: the hump on the top edge, L 34 / R 77 / L 36, r 20-25
 * - T17-T19      s 704-794: R 85 into the cut, then the cut's jog L 25 / R 26, r 20-23
 * - T20          s 795-872: hairpin between the pits, L 180 deg, r 16, crane jib overhead
 * - T21-T22      s 871-963: the jog back, L 27, then R 118 out of the cut, r 21-24
 * - T23          s 975-1020: NE corner, R 86, r 18, onto the start straight
 *
 * The hairpin's two vertices sit 44.2 m apart, not 2 r: exactly 2 r rounds to a duplicate spline point here.
 * Pickups alternate on and off the AI line (lateral 6.5 is outside racingLine's 6.4 m band). Every number
 * here moves with any edit: the soak is chaotic, so re-run the test file and run.mjs.
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './roundedLoop';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const BLAST_PIT_CORNERS: readonly Corner[] = [
  { x: 0, y: 94, r: 40 },
  { x: 15, y: 120, r: 30 },
  { x: 15, y: 156, r: 26 },
  { x: -25, y: 156, r: 30 },
  { x: -55.6, y: 181.7, r: 30 },
  { x: -95.5, y: 148.3, r: 30 },
  { x: -135.3, y: 181.7, r: 30 },
  { x: -175.1, y: 148.3, r: 30 },
  { x: -205.8, y: 174, r: 30 },
  { x: -273.8, y: 174, r: 34 },
  { x: -273.8, y: 128, r: 30 },
  { x: -300.2, y: 90.3, r: 30 },
  { x: -273.8, y: 52.6, r: 30 },
  { x: -273.8, y: 0, r: 34 },
  { x: -228.8, y: 0, r: 30 },
  { x: -190.5, y: -32.1, r: 30 },
  { x: -152.2, y: 0, r: 30 },
  { x: -112.2, y: 0, r: 26 },
  { x: -112.2, y: 36, r: 30 },
  { x: -97.2, y: 62, r: 30 },
  { x: -97.2, y: 97, r: 22 },
  { x: -53, y: 97, r: 22 },
  { x: -53, y: 62, r: 30 },
  { x: -68, y: 36, r: 30 },
  { x: -68, y: 0, r: 26 },
  { x: 0, y: 0, r: 26 },
];

/** s of the hairpin apex: the crane stands on its outside (right of a left turn), between the pits. */
export const BLAST_PIT_CRANE_S = 833;

const BASE: TrackDef & { shape: 'tight' } = {
  id: 'blastPit',
  name: 'Blast Pit',
  theme: 'quarry',
  shape: 'tight',
  width: 16,
  shoulder: 5,
  checkpointSpacing: 40,
  referenceLapTime: 28.5, // WP32c: 0.55 AI median clean lap 28.42 s over the 16 soak seeds (old layout 41.5)
  centerline: roundedLoop(BLAST_PIT_CORNERS, { x: 0, y: 55 }),
  pickups: [
    { kind: 'cash', s: 40, lateral: 3 },
    { kind: 'mines', s: 120, lateral: -6.5 },
    { kind: 'turbo', s: 200, lateral: 2 },
    { kind: 'repair', s: 280, lateral: 6.5 },
    { kind: 'cash', s: 360, lateral: -2 },
    { kind: 'mines', s: 440, lateral: 6.5 },
    { kind: 'turbo', s: 520, lateral: -6.5 },
    { kind: 'cash', s: 600, lateral: 3 },
    { kind: 'repair', s: 680, lateral: -6.5 },
    { kind: 'mines', s: 760, lateral: -2 },
    { kind: 'cash', s: 840, lateral: 6.5 },
    { kind: 'turbo', s: 920, lateral: -3 },
    { kind: 'repair', s: 1000, lateral: 6.5 },
  ],
  props: [],
};

// 'left' is the outside of the loop (and the inside of the cut's tongue); the crane goes first so nothing
// crowds its base.
export const BLAST_PIT_PROP_RULES: readonly PropRule[] = [
  { sFrom: BLAST_PIT_CRANE_S, sTo: BLAST_PIT_CRANE_S + 1, every: 10, side: 'right', offset: 3, kind: 'crane', scale: 1 },
  { sFrom: 790, sTo: 875, every: 4, side: 'right', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 30, sTo: 760, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 890, sTo: 1040, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 0, sTo: 'length', every: 30, side: 'both', offset: 5, kind: 'rock', scale: [1, 1.8] },
  { sFrom: 750, sTo: 800, every: 22, side: 'left', offset: 2, kind: 'container', scale: 1 },
  { sFrom: 1010, sTo: 'length', every: 10, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 150, sTo: 340, every: 12, side: 'right', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const BLAST_PIT_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 36 },
  { kind: 'container', count: 4 },
  { kind: 'barrel', count: 8 },
];

export const BLAST_PIT: TrackDef & { shape: 'tight' } = { ...BASE, props: placeProps(BASE, BLAST_PIT_PROP_RULES, BLAST_PIT_SCATTER) };
