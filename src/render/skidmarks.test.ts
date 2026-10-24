import { describe, expect, it } from 'vitest';
import { SkidRing, skidFade } from './skidmarks';

describe('render: skid mark ring buffer', () => {
  it('wraps after size pushes and overwrites the oldest slot', () => {
    const r = new SkidRing(4);
    expect([r.push(), r.push(), r.push(), r.push()]).toEqual([0, 1, 2, 3]);
    expect(r.written).toBe(4);
    expect(r.push()).toBe(0);
    expect(r.written).toBe(4);
    expect(r.age(0)).toBe(0); // newest
    expect(r.age(1)).toBe(3); // oldest
  });

  it('fades only the oldest 25% of the buffer', () => {
    expect(skidFade(0, 4000)).toBe(1);
    expect(skidFade(2999, 4000)).toBe(1);
    expect(skidFade(3500, 4000)).toBeCloseTo(0.5);
    expect(skidFade(3999, 4000)).toBeCloseTo(0.001);
  });
});
