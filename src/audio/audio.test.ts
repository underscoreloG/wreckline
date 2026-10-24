import { describe, expect, it } from 'vitest';
import { engineFrequency } from './engine';
import { distanceFalloff, MAX_VOICES, panFor, VoicePool, type Voice } from './voices';

describe('engineFrequency', () => {
  it('stays in 55-200 Hz over the whole rpm range', () => {
    for (let i = 0; i <= 1000; i++) {
      const f = engineFrequency(i / 1000);
      expect(f).toBeGreaterThanOrEqual(55);
      expect(f).toBeLessThanOrEqual(200);
    }
    expect(engineFrequency(-1)).toBe(engineFrequency(0));
    expect(engineFrequency(2)).toBe(engineFrequency(1));
  });
  it('is continuous and rising within each gear, drops at the shifts', () => {
    const step = 1e-4;
    for (let gear = 0; gear < 3; gear++) {
      const lo = gear / 3;
      const hi = (gear + 1) / 3;
      let prev = engineFrequency(lo);
      for (let r = lo + step; r < hi - step; r += step) {
        const f = engineFrequency(r);
        expect(f).toBeGreaterThan(prev);
        expect(f - prev).toBeLessThan(0.1); // no jump inside a gear
        prev = f;
      }
    }
    // Upshift: pitch falls back.
    expect(engineFrequency(1 / 3 + 1e-9)).toBeLessThan(engineFrequency(1 / 3 - 1e-9));
    expect(engineFrequency(2 / 3 + 1e-9)).toBeLessThan(engineFrequency(2 / 3 - 1e-9));
  });
  it('matches the recipe endpoints', () => {
    expect(engineFrequency(0)).toBeCloseTo(83.5, 10);
    expect(engineFrequency(1)).toBeCloseTo(174, 10);
  });
});

describe('distance falloff and pan', () => {
  it('1 / (1 + d / 25), silent beyond 120 m', () => {
    expect(distanceFalloff(0)).toBe(1);
    expect(distanceFalloff(25)).toBeCloseTo(0.5, 10);
    expect(distanceFalloff(100)).toBeCloseTo(0.2, 10);
    expect(distanceFalloff(120)).toBeCloseTo(1 / (1 + 120 / 25), 10);
    expect(distanceFalloff(120.01)).toBe(0);
    for (let d = 1; d < 120; d++) expect(distanceFalloff(d)).toBeLessThan(distanceFalloff(d - 1));
  });
  it('pan = clamp(dx / 60, -1, 1)', () => {
    expect(panFor(0)).toBe(0);
    expect(panFor(30)).toBeCloseTo(0.5, 10);
    expect(panFor(-90)).toBe(-1);
    expect(panFor(500)).toBe(1);
  });
});

describe('VoicePool', () => {
  const fake = (end: number, stopped: Set<number>, id: number): Voice => ({ end, stop: () => stopped.add(id) });

  it('keeps <= 48 live voices and stops the oldest first', () => {
    const stopped = new Set<number>();
    const pool = new VoicePool(MAX_VOICES);
    for (let i = 0; i < 200; i++) {
      pool.add(fake(10, stopped, i), 0);
      expect(pool.count(0)).toBeLessThanOrEqual(MAX_VOICES);
    }
    expect(pool.count(0)).toBe(MAX_VOICES);
    expect(stopped.size).toBe(200 - MAX_VOICES);
    for (let i = 0; i < 200 - MAX_VOICES; i++) expect(stopped.has(i)).toBe(true);
  });
  it('ended voices free their slot without being stopped', () => {
    const stopped = new Set<number>();
    const pool = new VoicePool(4);
    for (let i = 0; i < 4; i++) pool.add(fake(1, stopped, i), 0);
    pool.add(fake(5, stopped, 9), 2);
    expect(pool.count(2)).toBe(1);
    expect(stopped.size).toBe(0);
  });
  it('a lower cap (persistent engine/skid voices) shrinks the room for one-shots', () => {
    const stopped = new Set<number>();
    const pool = new VoicePool(MAX_VOICES);
    pool.setCap(MAX_VOICES - 16);
    for (let i = 0; i < 100; i++) pool.add(fake(10, stopped, i), 0);
    expect(pool.count(0) + 16).toBe(MAX_VOICES);
    pool.remove({ end: 10, stop: () => {} }); // unknown voice: no-op
    expect(pool.count(0)).toBe(MAX_VOICES - 16);
  });
});
