import { describe, expect, it } from 'vitest';
import { createRng, hashString } from './rng';

describe('rng', () => {
  it('same seed gives the same 1000 numbers', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('different seeds differ', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next stays in [0, 1) with mean near 0.5', () => {
    const r = createRng(42);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(Math.abs(sum / 10000 - 0.5)).toBeLessThan(0.02);
  });

  it('int covers both bounds and nothing outside', () => {
    const r = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-2, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort((x, y) => x - y)).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it('range, chance, pick', () => {
    const r = createRng(9);
    for (let i = 0; i < 500; i++) {
      const v = r.range(5, 6);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(6);
    }
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
    const arr = ['a', 'b', 'c'] as const;
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(r.pick(arr));
    expect(picked.size).toBe(3);
    expect(() => r.pick([])).toThrow();
  });

  it('state() resumes the sequence', () => {
    const a = createRng(99);
    for (let i = 0; i < 10; i++) a.next();
    const b = createRng(a.state());
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a.next());
  });

  it('hashString is FNV-1a 32-bit', () => {
    expect(hashString('')).toBe(0x811c9dc5);
    expect(hashString('a')).toBe(0xe40c292c);
    expect(hashString('foobar')).toBe(0xbf9cf968);
    expect(hashString('scrapyard')).toBe(hashString('scrapyard'));
  });
});
