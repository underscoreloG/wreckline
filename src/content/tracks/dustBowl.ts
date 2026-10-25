/**
 * Dust Bowl (desert theme, M2): fast and open, long sweepers, one long straight with a tight hairpin
 * at its far end. Clockwise, width 15, 3 m of sand shoulder.
 *
 * Corners in race order (s in m, radius measured on the spline, "R"/"L" = right/left):
 * - s 13-231    main straight (218 m), turbo pickup early: top speed run
 * - T1          s 243-305: hairpin R 161 deg, r 17, tire wall on the outside: the big brake test
 * - T2          s 375-545: L 40 deg (r 35) flowing into a long left sweeper (r ~80, 83 deg)
 * - T3          s 609-808: chain of right sweepers (~100 deg, r 50-80), wrecks on the outside
 * - s 809-1085  back stretch with gentle right bends (r 90-150): flat out, cacti both sides
 * - s 1086-1355 long right arc (50 deg over 270 m, r > 150): fast, rocks on the outside
 * - T4          s 1366-1403: R 40 deg, r 41, onto the main straight (tire stacks on the outside)
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

const BASE: TrackDef = {
  id: 'dustBowl',
  name: 'Dust Bowl',
  theme: 'desert',
  width: 15,
  shoulder: 3,
  checkpointSpacing: 40,
  referenceLapTime: 35.75, // WP12: soak median 35.75 s sits exactly between two 0.5 s steps
  centerline: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 200, y: 0 },
    { x: 240, y: 0 },
    { x: 251, y: 2.95 },
    { x: 259.05, y: 11 },
    { x: 262, y: 22 },
    { x: 259.05, y: 33 },
    { x: 251, y: 41.05 },
    { x: 240, y: 44 },
    { x: 200, y: 46 },
    { x: 160, y: 55 },
    { x: 135, y: 85 },
    { x: 125, y: 125 },
    { x: 135, y: 170 },
    { x: 165, y: 205 },
    { x: 210, y: 235 },
    { x: 240, y: 280 },
    { x: 235, y: 330 },
    { x: 200, y: 370 },
    { x: 140, y: 385 },
    { x: 60, y: 380 },
    { x: -10, y: 360 },
    { x: -60, y: 320 },
    { x: -85, y: 260 },
    { x: -90, y: 190 },
    { x: -80, y: 120 },
    { x: -60, y: 60 },
    { x: -35, y: 15 },
  ],
  pickups: [
    { kind: 'turbo', s: 60, lateral: -3 },
    { kind: 'cash', s: 150, lateral: 3 },
    { kind: 'mines', s: 330, lateral: 0 },
    { kind: 'cash', s: 440, lateral: -4 },
    { kind: 'repair', s: 520, lateral: 2 },
    { kind: 'turbo', s: 580, lateral: -3 },
    { kind: 'cash', s: 680, lateral: 3 },
    { kind: 'mines', s: 760, lateral: -2 },
    { kind: 'cash', s: 860, lateral: 0 },
    { kind: 'repair', s: 940, lateral: 4 },
    { kind: 'turbo', s: 1040, lateral: -3 },
    { kind: 'mines', s: 1150, lateral: 3 },
    { kind: 'cash', s: 1250, lateral: -2 },
    { kind: 'repair', s: 1330, lateral: 2 },
  ],
  props: [],
};

export const DUST_BOWL_PROP_RULES: readonly PropRule[] = [
  { sFrom: 13, sTo: 231, every: 30, side: 'both', offset: 4, kind: 'rock', scale: [0.8, 1.4] },
  { sFrom: 225, sTo: 320, every: 4, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 330, sTo: 560, every: 15, side: 'both', offset: 3, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 600, sTo: 800, every: 35, side: 'left', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 610, sTo: 800, every: 22, side: 'right', offset: 3, kind: 'rock', scale: [1, 1.6] },
  { sFrom: 809, sTo: 1085, every: 18, side: 'both', offset: 2.5, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 1086, sTo: 1355, every: 25, side: 'left', offset: 3, kind: 'rock', scale: [1, 1.6] },
  { sFrom: 1086, sTo: 1355, every: 20, side: 'right', offset: 3, kind: 'cactus', scale: [0.8, 1.3] },
  { sFrom: 1360, sTo: 1410, every: 5, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
];

export const DUST_BOWL_SCATTER: readonly ScatterRule[] = [
  { kind: 'rock', count: 14 },
  { kind: 'cactus', count: 18 },
  { kind: 'wreck', count: 4 },
];

export const DUST_BOWL: TrackDef = { ...BASE, props: placeProps(BASE, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER) };
