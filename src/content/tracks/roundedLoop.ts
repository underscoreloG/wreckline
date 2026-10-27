import type { Vec2 } from '../../shared/contracts';

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
