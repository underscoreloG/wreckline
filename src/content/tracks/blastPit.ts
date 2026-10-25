/**
 * Blast Pit (quarry theme, WP23b): the longest track, a double loop round two pits that never crosses
 * itself. A cut runs down between the pits from the top edge and ends in a hairpin, so each pit is ringed
 * by its own loop of big sweepers. A crane stands outside the wall at the hairpin's apex and swings its
 * jib over the road (only its base collides). Clockwise, width 16, 4 m of dirt shoulder. Built with
 * roundedLoop from a corner polygon. The start sits on the east side right after the NE sweeper; of six
 * soaked starts this one gave the most clean laps with wrecks inside the WP07 gate.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 0-33       east side south
 * - T1           s 33-201: SE sweeper, R 88, r 99
 * - s 201-426    bottom straight west (225 m)
 * - T2           s 426-593: SW sweeper, R 87, r 99
 * - s 593-659    west side north
 * - T3           s 659-826: NW sweeper, R 87, r 99 (round the west pit)
 * - T4           s 886-939: R 88, r 27, into the cut between the pits
 * - s 939-1082   cut south (143 m)
 * - T5           s 1082-1153: hairpin between the pits, L 178 deg, r 18, crane jib overhead
 * - s 1153-1295  cut north (40 m from the way in)
 * - T6           s 1295-1349: R 88, r 27, out of the cut
 * - T7           s 1408-1576: NE sweeper, R 88, r 99 (round the east pit)
 * - s 1576-end   east side to the line
 */
import type { TrackDef } from '../../shared/contracts';
import { type Corner, roundedLoop } from './dockside';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const BLAST_PIT_CORNERS: readonly Corner[] = [
  { x: 0, y: 0, r: 110 },
  { x: 200, y: 0, r: 30 },
  { x: 200, y: 200, r: 20 },
  { x: 240, y: 200, r: 20 },
  { x: 240, y: 0, r: 30 },
  { x: 440, y: 0, r: 110 },
  { x: 440, y: 280, r: 110 },
  { x: 0, y: 280, r: 110 },
];

/** s of the hairpin apex: the crane stands on its outside (right of a left turn), between the pits. */
export const BLAST_PIT_CRANE_S = 1118;

const BASE: TrackDef = {
  id: 'blastPit',
  name: 'Blast Pit',
  theme: 'quarry',
  width: 16,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 41.5, // WP12: soak median 41.47 s after the AI retune
  centerline: roundedLoop(BLAST_PIT_CORNERS, { x: 440, y: 140 }),
  pickups: [
    { kind: 'cash', s: 38, lateral: -3 },
    { kind: 'turbo', s: 132, lateral: 3 },
    { kind: 'mines', s: 227, lateral: 0 },
    { kind: 'cash', s: 322, lateral: -3 },
    { kind: 'repair', s: 416, lateral: 2 },
    { kind: 'turbo', s: 511, lateral: 0 },
    { kind: 'cash', s: 605, lateral: 3 },
    { kind: 'mines', s: 700, lateral: -2 },
    { kind: 'repair', s: 795, lateral: -3 },
    { kind: 'cash', s: 889, lateral: 3 },
    { kind: 'turbo', s: 984, lateral: 0 },
    { kind: 'repair', s: 1078, lateral: -3 },
    { kind: 'cash', s: 1173, lateral: 2 },
    { kind: 'mines', s: 1268, lateral: 0 },
    { kind: 'turbo', s: 1362, lateral: 3 },
    { kind: 'cash', s: 1457, lateral: -2 },
    { kind: 'repair', s: 1551, lateral: -3 },
  ],
  props: [],
};

// 'left' is the outside of the sweepers; the crane goes first so nothing crowds its base.
export const BLAST_PIT_PROP_RULES: readonly PropRule[] = [
  { sFrom: BLAST_PIT_CRANE_S, sTo: BLAST_PIT_CRANE_S + 1, every: 10, side: 'right', offset: 3, kind: 'crane', scale: 1 },
  { sFrom: 1075, sTo: 1160, every: 4, side: 'right', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 33, sTo: 201, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 426, sTo: 826, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 1408, sTo: 1576, every: 14, side: 'left', offset: 2, kind: 'rock', scale: [0.8, 1.6] },
  { sFrom: 0, sTo: 'length', every: 30, side: 'both', offset: 5, kind: 'rock', scale: [1, 1.8] },
  { sFrom: 945, sTo: 1075, every: 22, side: 'left', offset: 2, kind: 'container', scale: 1 },
  { sFrom: 1580, sTo: 'length', every: 10, side: 'both', offset: 2, kind: 'barrel', scale: 1 },
  { sFrom: 220, sTo: 410, every: 12, side: 'right', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
];

export const BLAST_PIT_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 36 },
  { kind: 'container', count: 4 },
  { kind: 'barrel', count: 8 },
];

export const BLAST_PIT: TrackDef = { ...BASE, props: placeProps(BASE, BLAST_PIT_PROP_RULES, BLAST_PIT_SCATTER) };
