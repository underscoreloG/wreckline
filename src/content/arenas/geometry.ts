import type { Vec2 } from '../../shared/contracts';

// WP41: polygon helpers for arena validation (here), the arena AI (src/sim/arenaAi.ts) and the arena mesh. Loops are
// closed: the last point joins the first.

/** Shoelace area; > 0 = clockwise on screen (+y down). */
export function signedArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Area centroid of a simple polygon. */
export function centroid(pts: readonly Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const c = p.x * q.y - q.x * p.y;
    a += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Every turn the same way (collinear points allowed), and no zero-length edge. */
export function isConvex(pts: readonly Vec2[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const c = pts[(i + 2) % n];
    if (a.x === b.x && a.y === b.y) return false;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

export function pointInPolygon(p: Vec2, pts: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const ex = bx - ax;
  const ey = by - ay;
  const e2 = ex * ex + ey * ey;
  let t = e2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / e2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
}

/** Distance from p to the loop's edges (not to its inside). */
export function distToLoop(p: Vec2, pts: readonly Vec2[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    d = Math.min(d, distToSegment(p.x, p.y, a.x, a.y, b.x, b.y));
  }
  return d;
}

/** True when segments ab and cd cross or touch. */
function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2): number => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/** Two non-adjacent edges of the loop cross. */
export function selfIntersects(pts: readonly Vec2[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
    }
  }
  return false;
}

/** Smallest gap between two loops' edges, 0 when they cross or one holds the other's points. */
export function loopGap(a: readonly Vec2[], b: readonly Vec2[]): number {
  if (a.some((p) => pointInPolygon(p, b)) || b.some((p) => pointInPolygon(p, a))) return 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsCross(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return 0;
    }
  }
  return Math.min(...a.map((p) => distToLoop(p, b)), ...b.map((p) => distToLoop(p, a)));
}

/** Every edge of every loop as flat [ax, ay, bx, by] quads, for allocation-free ray and line tests. */
export function loopSegments(loops: readonly (readonly Vec2[])[]): Float64Array {
  const n = loops.reduce((s, l) => s + l.length, 0);
  const out = new Float64Array(n * 4);
  let o = 0;
  for (const l of loops) {
    for (let i = 0; i < l.length; i++) {
      const a = l[i];
      const b = l[(i + 1) % l.length];
      out[o++] = a.x;
      out[o++] = a.y;
      out[o++] = b.x;
      out[o++] = b.y;
    }
  }
  return out;
}

/** Distance along the unit (dx, dy) from (ox, oy) to the first segment hit, `max` when none is closer. */
export function rayDistance(segs: Float64Array, ox: number, oy: number, dx: number, dy: number, max: number): number {
  let best = max;
  for (let i = 0; i < segs.length; i += 4) {
    const ax = segs[i];
    const ay = segs[i + 1];
    const ex = segs[i + 2] - ax;
    const ey = segs[i + 3] - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const wx = ax - ox;
    const wy = ay - oy;
    const t = (wx * ey - wy * ex) / den; // along the ray
    const u = (wx * dy - wy * dx) / den; // along the segment
    if (t >= 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

/** True when the segment from (ax, ay) to (bx, by) crosses any of the segments. */
export function lineBlocked(segs: Float64Array, ax: number, ay: number, bx: number, by: number): boolean {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 1e-9) return false;
  return rayDistance(segs, ax, ay, (bx - ax) / len, (by - ay) / len, len) < len;
}
