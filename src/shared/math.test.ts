import { describe, expect, it } from 'vitest';
import {
  add,
  addTo,
  angleWrap,
  clamp,
  cross,
  dist,
  dot,
  fwd,
  len,
  len2,
  lerp,
  lerpAngle,
  norm,
  right,
  rotate,
  scale,
  scaleTo,
  segmentIntersect,
  set,
  sub,
} from './math';

const near = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('math', () => {
  it('basic vector ops', () => {
    expect(add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(sub({ x: 1, y: 2 }, { x: 3, y: 5 })).toEqual({ x: -2, y: -3 });
    expect(scale({ x: 1, y: -2 }, 3)).toEqual({ x: 3, y: -6 });
    expect(dot({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11);
    expect(len2({ x: 3, y: 4 })).toBe(25);
    expect(len({ x: 3, y: 4 })).toBe(5);
    expect(dist({ x: 1, y: 1 }, { x: 4, y: 5 })).toBe(5);
    expect(lerp({ x: 0, y: 0 }, { x: 10, y: -10 }, 0.25)).toEqual({ x: 2.5, y: -2.5 });
  });

  it('cross is positive for a clockwise (right) turn on screen', () => {
    expect(cross({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(1);
    expect(cross({ x: 1, y: 0 }, { x: 0, y: -1 })).toBe(-1);
  });

  it('norm handles zero and non-zero', () => {
    expect(norm({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const n = norm({ x: 3, y: 4 });
    near(n.x, 0.6);
    near(n.y, 0.8);
  });

  it('rotate follows the heading convention', () => {
    const r = rotate({ x: 1, y: 0 }, Math.PI / 2);
    near(r.x, 0);
    near(r.y, 1);
  });

  it('fwd and right match the contracts header', () => {
    const f = fwd(0);
    const r = right(0);
    near(f.x, 1);
    near(f.y, 0);
    near(r.x, 0);
    near(r.y, 1);
    const f2 = fwd(Math.PI / 2);
    near(f2.x, 0);
    near(f2.y, 1);
    const h = 0.7;
    near(dot(fwd(h), right(h)), 0);
    expect(cross(fwd(h), right(h))).toBeGreaterThan(0);
  });

  it('clamp', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it('angleWrap lands in (-PI, PI]', () => {
    near(angleWrap(Math.PI), Math.PI);
    near(angleWrap(-Math.PI), Math.PI);
    near(angleWrap(3 * Math.PI), Math.PI);
    near(angleWrap(0.5 + 4 * Math.PI), 0.5);
    near(angleWrap(-0.5 - 6 * Math.PI), -0.5);
    for (let a = -20; a < 20; a += 0.37) {
      const w = angleWrap(a);
      expect(w).toBeGreaterThan(-Math.PI);
      expect(w).toBeLessThanOrEqual(Math.PI);
      near(Math.cos(w), Math.cos(a), 1e-9);
      near(Math.sin(w), Math.sin(a), 1e-9);
    }
  });

  it('lerpAngle takes the short way', () => {
    near(lerpAngle(3, -3, 0.5), 3 + (2 * Math.PI - 6) / 2);
    near(lerpAngle(0.2, 0.6, 0.5), 0.4);
  });

  it('segmentIntersect', () => {
    const t = segmentIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 4, y: -1 }, { x: 4, y: 1 });
    expect(t).not.toBeNull();
    near(t as number, 0.4);
    expect(segmentIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 11, y: -1 }, { x: 11, y: 1 })).toBeNull();
    expect(segmentIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 })).toBeNull();
  });

  it('mutating variants write into out and return it', () => {
    const out = { x: 0, y: 0 };
    expect(set(out, 1, 2)).toBe(out);
    expect(out).toEqual({ x: 1, y: 2 });
    expect(addTo(out, out, { x: 3, y: 4 })).toBe(out);
    expect(out).toEqual({ x: 4, y: 6 });
    expect(scaleTo(out, out, 0.5)).toBe(out);
    expect(out).toEqual({ x: 2, y: 3 });
  });
});
