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
import type { TrackDef, Vec2 } from '../../shared/contracts';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export interface Corner {
  x: number;
  y: number;
  r: number; // arc radius in m
}

const ARC_STEP = 6; // m between emitted points on an arc
const LEG_STEP = 25; // m between emitted points on a straight leg

/**
 * Corner polygon -> centerline: straight legs joined by circular arcs of radius r tangent to both legs,
 * sampled densely enough that the Catmull-Rom spline keeps the arcs' radius. The loop starts at the
 * emitted point nearest to `start` (pick a point on a leg so the start line sits on a straight).
 */
export function roundedLoop(corners: readonly Corner[], start: Vec2): Vec2[] {
  const n = corners.length;
  const at = (i: number): Corner => corners[(i + n) % n];
  const unit = (a: Vec2, b: Vec2): Vec2 => {
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  // Turn angle and tangent length (vertex to arc end) of each corner.
  const turn = corners.map((v, i) => {
    const d1 = unit(at(i - 1), v);
    const d2 = unit(v, at(i + 1));
    return Math.acos(Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y)));
  });
  const tangent = corners.map((v, i) => v.r * Math.tan(turn[i] / 2));
  const legLen = (v: Corner, i: number): number => {
    const next = at(i + 1);
    return Math.hypot(next.x - v.x, next.y - v.y) - tangent[(i + n) % n] - tangent[(i + 1 + n) % n];
  };
  const legSteps = (v: Corner, i: number): number => Math.floor(legLen(v, i) / LEG_STEP);

  const pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const v = corners[i];
    const d1 = unit(at(i - 1), v);
    const d2 = unit(v, at(i + 1));
    const side = Math.sign(d1.x * d2.y - d1.y * d2.x); // +1 = right turn on screen (+y down)
    const a = { x: v.x - d1.x * tangent[i], y: v.y - d1.y * tangent[i] };
    const c = { x: a.x - d1.y * v.r * side, y: a.y + d1.x * v.r * side };
    const a0 = Math.atan2(a.y - c.y, a.x - c.x);
    const steps = Math.max(2, Math.ceil((turn[i] * v.r) / ARC_STEP));
    // Back-to-back corners (a hairpin from two 90s) share an end point; a duplicate would break the spline.
    for (let k = pts.length > 0 && legSteps(at(i - 1), i - 1) === 0 ? 1 : 0; k <= steps; k++) {
      const ang = a0 + side * turn[i] * (k / steps);
      pts.push({ x: c.x + Math.cos(ang) * v.r, y: c.y + Math.sin(ang) * v.r });
    }
    const b = { x: v.x + d2.x * tangent[i], y: v.y + d2.y * tangent[i] };
    const len = legLen(v, i);
    const steps2 = legSteps(v, i);
    for (let k = 1; k < steps2; k++) pts.push({ x: b.x + (d2.x * len * k) / steps2, y: b.y + (d2.y * len * k) / steps2 });
  }
  const dist = (p: Vec2): number => Math.hypot(p.x - start.x, p.y - start.y);
  let first = 0;
  for (let i = 1; i < pts.length; i++) if (dist(pts[i]) < dist(pts[first])) first = i;
  return [...pts.slice(first), ...pts.slice(0, first)].map((p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 }));
}

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
