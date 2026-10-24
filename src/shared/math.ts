import type { Vec2 } from './contracts';

const TAU = Math.PI * 2;

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** z of the 3D cross product; > 0 when b is clockwise of a on screen (+y down). */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const len = (a: Vec2): number => Math.sqrt(a.x * a.x + a.y * a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Unit vector, or (0, 0) for a zero vector. */
export function norm(a: Vec2): Vec2 {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

/** Rotates by `angle` radians (positive = clockwise on screen, like heading). */
export function rotate(a: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

export const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Wraps to (-PI, PI]. */
export function angleWrap(a: number): number {
  let r = a % TAU;
  if (r <= -Math.PI) r += TAU;
  else if (r > Math.PI) r -= TAU;
  return r;
}

/** Interpolates along the shortest arc. */
export const lerpAngle = (a: number, b: number, t: number): number => a + angleWrap(b - a) * t;

/** Forward unit vector of a heading (contracts header). */
export const fwd = (h: number): Vec2 => ({ x: Math.cos(h), y: Math.sin(h) });
/** Right-hand unit vector of a heading (contracts header). */
export const right = (h: number): Vec2 => ({ x: -Math.sin(h), y: Math.cos(h) });

/** Intersection of segments p1-p2 and q1-q2: t along p in [0, 1], or null (parallel or no hit). */
export function segmentIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): number | null {
  const rx = p2.x - p1.x;
  const ry = p2.y - p1.y;
  const sx = q2.x - q1.x;
  const sy = q2.y - q1.y;
  const denom = rx * sy - ry * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const qpx = q1.x - p1.x;
  const qpy = q1.y - p1.y;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * ry - qpy * rx) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// Mutating variants for hot loops: write into `out` (which may alias an input) and return it.

export function set(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function addTo(out: Vec2, a: Vec2, b: Vec2): Vec2 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function scaleTo(out: Vec2, a: Vec2, k: number): Vec2 {
  out.x = a.x * k;
  out.y = a.y * k;
  return out;
}
