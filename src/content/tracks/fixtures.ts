/**
 * Frozen test tracks (WP31), never registered in TRACKS: sim, AI and geometry tests run on these so a
 * redrawn live track never changes what they check. Copies of the live tracks as of 2026-10-26:
 * Scrapyard before its WP31 redraw, Rain District before WP32. Props come from the same rules as the
 * originals (placeProps seeds from the original id), then the id changes: the racing line is cached by
 * track id, so a fixture must never share one with a live track.
 */
import type { TrackDef } from '../../shared/contracts';
import { placeProps } from './placeProps';
import { roundedLoop } from './roundedLoop';

const SCRAPYARD_BASE: TrackDef = {
  id: 'scrapyard',
  name: 'Scrapyard',
  theme: 'scrapyard',
  width: 14,
  shoulder: 2,
  checkpointSpacing: 40,
  referenceLapTime: 27.5,
  centerline: [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 180, y: 20 },
    { x: 205, y: 70 },
    { x: 190, y: 130 },
    { x: 140, y: 150 },
    { x: 110, y: 190 },
    { x: 130, y: 240 },
    { x: 110, y: 290 },
    { x: 60, y: 300 },
    { x: 30, y: 260 },
    { x: 40, y: 200 },
    { x: 0, y: 170 },
    { x: -60, y: 180 },
    { x: -100, y: 140 },
    { x: -90, y: 70 },
    { x: -50, y: 20 },
  ],
  pickups: [
    { kind: 'mines', s: 70, lateral: -3 },
    { kind: 'cash', s: 150, lateral: -3 },
    { kind: 'turbo', s: 230, lateral: 3 },
    { kind: 'mines', s: 300, lateral: 3 },
    { kind: 'repair', s: 360, lateral: -4 },
    { kind: 'cash', s: 420, lateral: 4 },
    { kind: 'mines', s: 520, lateral: -2 },
    { kind: 'repair', s: 600, lateral: 0 },
    { kind: 'cash', s: 700, lateral: -3 },
    { kind: 'cash', s: 820, lateral: 0 },
    { kind: 'turbo', s: 880, lateral: 3 },
    { kind: 'turbo', s: 950, lateral: -2 },
  ],
  props: [],
};

/** Scrapyard as WP00-WP30 shipped it: 1049 m, 26 checkpoints, referenceLapTime 27.5. */
export const SCRAPYARD_FIXTURE: TrackDef = {
  ...SCRAPYARD_BASE,
  id: 'fixture-scrapyard',
  props: placeProps(
    SCRAPYARD_BASE,
    [
      { sFrom: 0, sTo: 'length', every: 60, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
      { sFrom: 20, sTo: 140, every: 12, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
      { sFrom: 160, sTo: 260, every: 18, side: 'right', offset: 3, kind: 'container', scale: 1 },
      { sFrom: 300, sTo: 420, every: 10, side: 'left', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
      { sFrom: 450, sTo: 560, every: 25, side: 'right', offset: 4, kind: 'wreck', scale: 1 },
      { sFrom: 600, sTo: 700, every: 8, side: 'both', offset: 1.5, kind: 'barrel', scale: 1 },
      { sFrom: 720, sTo: 900, every: 22, side: 'left', offset: 3.5, kind: 'container', scale: 1 },
      { sFrom: 900, sTo: 1040, every: 14, side: 'right', offset: 2, kind: 'tireStack', scale: 1 },
    ],
    [
      { kind: 'wreck', count: 6 },
      { kind: 'crate', count: 10 },
    ],
  ),
};

const RAIN_DISTRICT_BASE: TrackDef = {
  id: 'rainDistrict',
  name: 'Rain District',
  theme: 'city',
  width: 14,
  shoulder: 4,
  checkpointSpacing: 40,
  referenceLapTime: 31.5,
  centerline: roundedLoop(
    [
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
    ],
    { x: 60, y: 0 },
  ),
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

/** Rain District as WP23b/WP12 shipped it (the CCR-8 regression race, seed 14, runs on it). */
export const RAIN_DISTRICT_FIXTURE: TrackDef = {
  ...RAIN_DISTRICT_BASE,
  id: 'fixture-rainDistrict',
  props: placeProps(
    RAIN_DISTRICT_BASE,
    [
      { sFrom: 0, sTo: 'length', every: 22, side: 'alternate', offset: 2, kind: 'lightPole', scale: 1 },
      { sFrom: 20, sTo: 195, every: 45, side: 'both', offset: 1.5, kind: 'billboard', scale: 1 },
      { sFrom: 1030, sTo: 1115, every: 40, side: 'alternate', offset: 1.5, kind: 'billboard', scale: 1 },
      { sFrom: 0, sTo: 'length', every: 13, side: 'both', offset: 3, kind: 'building', scale: 1 },
    ],
    [
      { kind: 'building', count: 16 },
      { kind: 'crate', count: 6 },
    ],
  ),
};
