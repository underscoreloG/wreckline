import type { TrackDef } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

const BASE: TrackDef = {
  id: 'scrapyard',
  name: 'Scrapyard',
  theme: 'scrapyard',
  width: 14,
  shoulder: 2,
  checkpointSpacing: 40,
  referenceLapTime: 38, // WP07 measures and reports; the brain updates it on main
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
    { kind: 'cash', s: 150, lateral: -3 },
    { kind: 'mines', s: 300, lateral: 3 },
    { kind: 'cash', s: 420, lateral: 4 },
    { kind: 'repair', s: 600, lateral: 0 },
    { kind: 'cash', s: 820, lateral: 0 },
    { kind: 'turbo', s: 950, lateral: -2 },
  ],
  props: [],
};

export const SCRAPYARD_PROP_RULES: readonly PropRule[] = [
  { sFrom: 0, sTo: 'length', every: 60, side: 'alternate', offset: 2.5, kind: 'lightPole', scale: 1 },
  { sFrom: 20, sTo: 140, every: 12, side: 'left', offset: 1.5, kind: 'tireStack', scale: 1 },
  { sFrom: 160, sTo: 260, every: 18, side: 'right', offset: 3, kind: 'container', scale: 1 },
  { sFrom: 300, sTo: 420, every: 10, side: 'left', offset: 2, kind: 'crate', scale: [0.8, 1.2] },
  { sFrom: 450, sTo: 560, every: 25, side: 'right', offset: 4, kind: 'wreck', scale: 1 },
  { sFrom: 600, sTo: 700, every: 8, side: 'both', offset: 1.5, kind: 'barrel', scale: 1 },
  { sFrom: 720, sTo: 900, every: 22, side: 'left', offset: 3.5, kind: 'container', scale: 1 },
  { sFrom: 900, sTo: 1040, every: 14, side: 'right', offset: 2, kind: 'tireStack', scale: 1 },
];

export const SCRAPYARD_SCATTER: readonly ScatterRule[] = [
  { kind: 'wreck', count: 6 },
  { kind: 'crate', count: 10 },
];

export const SCRAPYARD: TrackDef = { ...BASE, props: placeProps(BASE, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER) };
