import { describe, expect, it } from 'vitest';
import { benchMix, BENCH_RPMS, BENCH_SLOTS, parseBenchFile, sweepAt } from './bench';
import { fundamentalHz, spectralCentroid } from './measure';

// Fake buffers: a slot is loaded when it holds one. Every subset of the slots, 0 to all files.
const subsets = (): (object | null)[][] =>
  Array.from({ length: 2 ** BENCH_SLOTS.length }, (_, m) => BENCH_SLOTS.map((_s, i) => (m & (1 << i) ? { duration: 2 } : null)));
const lo = BENCH_RPMS[0];
const hi = BENCH_RPMS[BENCH_RPMS.length - 1]!;

describe('recorded bench: file names', () => {
  it('reads rpm from the Chippy569 naming, load when the name says it', () => {
    expect(parseBenchFile('19_2500_D6.wav')).toEqual({ rpm: 2500, load: null });
    expect(parseBenchFile('7_500_D6_full.wav')).toEqual({ rpm: 500, load: 'full' });
    expect(parseBenchFile('112_6500_SM57 zero load.wav')).toEqual({ rpm: 6500, load: 'zero' });
    expect(parseBenchFile('3_6500_noload.WAV')).toEqual({ rpm: 6500, load: 'zero' });
    expect(parseBenchFile('ambience.wav')).toBeNull();
    expect(parseBenchFile('25000_x.wav')).toBeNull();
  });
});

describe('recorded bench: crossfade', () => {
  it('handles 0 to all files: equal power, only loaded slots sound, rates follow rpm', () => {
    for (const buffers of subsets()) {
      const loaded = buffers.map((b) => b !== null);
      const any = loaded.some(Boolean);
      for (let rpm = lo - 200; rpm <= hi + 200; rpm += 50)
        for (const throttle of [0, 0.3, 0.5, 1]) {
          const mix = benchMix(rpm, throttle, loaded);
          expect(mix).toHaveLength(BENCH_SLOTS.length);
          const power = mix.reduce((s, m) => s + m.gain ** 2, 0);
          expect(power).toBeCloseTo(any ? 1 : 0, 9);
          mix.forEach((m, i) => {
            if (!loaded[i]) expect(m.gain).toBe(0);
            expect(m.gain).toBeGreaterThanOrEqual(0);
            expect(m.rate).toBeCloseTo(rpm / BENCH_SLOTS[i]!.rpm, 12);
          });
        }
    }
  });

  it('crossfades between neighbouring rpm steps and by throttle between loads', () => {
    const all = BENCH_SLOTS.map(() => true);
    const at = (rpm: number, throttle: number) => benchMix(rpm, throttle, all).map((m) => m.gain);
    const idx = (rpm: number, load: 'full' | 'zero') => BENCH_SLOTS.findIndex((s) => s.rpm === rpm && s.load === load);
    // Exactly on a step, full throttle: that step's full-load loop alone.
    expect(at(BENCH_RPMS[1], 1)[idx(BENCH_RPMS[1], 'full')]).toBeCloseTo(1, 12);
    // Halfway between two steps, off throttle: the two zero-load loops at -3 dB each.
    const mid = (BENCH_RPMS[0] + BENCH_RPMS[1]) / 2;
    const g = at(mid, 0);
    expect(g[idx(BENCH_RPMS[0], 'zero')]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(g[idx(BENCH_RPMS[1], 'zero')]).toBeCloseTo(Math.SQRT1_2, 12);
    // Gains move continuously with rpm.
    for (let rpm = lo; rpm < hi; rpm += 10) {
      const a = at(rpm, 0.5);
      const b = at(rpm + 10, 0.5);
      for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(0.02);
    }
  });

  it('a missing middle step: the outer steps crossfade across the gap', () => {
    const loaded = BENCH_SLOTS.map((s) => s.rpm !== BENCH_RPMS[1]);
    const mix = benchMix(BENCH_RPMS[1], 1, loaded);
    const sounding = BENCH_SLOTS.filter((_s, i) => mix[i]!.gain > 1e-9);
    expect(sounding.map((s) => s.rpm).sort((a, b) => a - b)).toEqual([BENCH_RPMS[0], hi]);
    expect(sounding.every((s) => s.load === 'full')).toBe(true);
  });
});

describe('rev sweep', () => {
  it('idle -> max on throttle, back to idle off throttle, in 4 s', () => {
    expect(sweepAt(0)).toEqual({ rpm01: 0, throttle: 1 });
    expect(sweepAt(1).rpm01).toBeCloseTo(0.5, 12);
    expect(sweepAt(3)).toEqual({ rpm01: 0.5, throttle: 0 });
    expect(sweepAt(4).rpm01).toBe(0);
    expect(sweepAt(9).rpm01).toBe(0);
  });
});

describe('measure', () => {
  const RATE = 48000;
  const tone = (parts: [hz: number, amp: number][]): Float32Array =>
    Float32Array.from({ length: 8192 }, (_, i) => parts.reduce((s, [hz, a]) => s + a * Math.sin((2 * Math.PI * hz * i) / RATE), 0));
  it('fundamental of a tone with harmonics, and of a weak fundamental under a strong octave', () => {
    expect(fundamentalHz(tone([[110, 1], [220, 0.5], [330, 0.3]]), RATE)).toBeCloseTo(110, 0);
    expect(fundamentalHz(tone([[60, 0.3], [120, 1]]), RATE)).toBeCloseTo(60, 0);
    expect(fundamentalHz(new Float32Array(8192), RATE)).toBe(0);
  });
  it('centroid of one sine is its frequency; adding a high partial raises it', () => {
    expect(spectralCentroid(tone([[1000, 1]]), RATE)).toBeCloseTo(1000, -1);
    const two = spectralCentroid(tone([[1000, 1], [3000, 1]]), RATE);
    expect(two).toBeGreaterThan(1900);
    expect(two).toBeLessThan(2100);
  });
});
