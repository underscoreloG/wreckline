import { describe, expect, it } from 'vitest';
import { MAX_PITCH_UP, setRpm, stepMix, sweepAt, type EngineLoad, type EngineStep } from './bench';
import { fundamentalHz, spectralCentroid } from './measure';

// Fixture step lists (never the shipped manifest): 1 to 6 rpm steps, one load or on + off.
function lcg(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function fixtures(): EngineStep[][] {
  const rnd = lcg(7);
  const out: EngineStep[][] = [];
  for (const loads of [['any'], ['on'], ['on', 'off']] as EngineLoad[][])
    for (let n = 1; n <= 6; n++)
      for (let k = 0; k < 4; k++)
        out.push(
          loads.flatMap((load) => {
            // Distinct rpms per load, shuffled so the mix must not rely on the order.
            const rpms = Array.from({ length: n }, (_, i) => 400 + i * 900 + Math.round(rnd() * 800));
            return rpms.sort(() => rnd() - 0.5).map((rpm) => ({ rpm, load }));
          }),
        );
  return out;
}

describe('recorded engine: crossfade (any step count, one or two loads)', () => {
  it('equal power, gains only on the two steps around rpm in each load, rates follow rpm', () => {
    for (const steps of fixtures()) {
      const lo = Math.min(...steps.map((s) => s.rpm));
      const hi = Math.max(...steps.map((s) => s.rpm));
      const twoLoads = steps.some((s) => s.load === 'off');
      for (let rpm = lo - 300; rpm <= hi * 1.6; rpm += 37)
        for (const throttle of [0, 0.3, 0.5, 1]) {
          const mix = stepMix(steps, rpm, throttle);
          expect(mix).toHaveLength(steps.length);
          expect(mix.reduce((s, m) => s + m.gain ** 2, 0)).toBeCloseTo(1, 9);
          mix.forEach((m, i) => {
            expect(m.gain).toBeGreaterThanOrEqual(0);
            expect(m.rate).toBeCloseTo(rpm / steps[i]!.rpm, 12);
          });
          for (const load of new Set(steps.map((s) => s.load))) {
            const inLoad = steps.flatMap((s, i) => (s.load === load ? [{ rpm: s.rpm, gain: mix[i]!.gain }] : []));
            const power = inLoad.reduce((s, m) => s + m.gain ** 2, 0);
            const want = !twoLoads ? 1 : load === 'on' ? Math.sin((throttle * Math.PI) / 2) ** 2 : Math.cos((throttle * Math.PI) / 2) ** 2;
            expect(power).toBeCloseTo(want, 9);
            // The sounding steps are the nearest one below and the nearest one above rpm (one alone outside the range).
            const below = Math.max(...inLoad.filter((s) => s.rpm <= rpm).map((s) => s.rpm));
            const above = Math.min(...inLoad.filter((s) => s.rpm >= rpm).map((s) => s.rpm));
            for (const s of inLoad) if (s.gain > 1e-12) expect([below, above]).toContain(s.rpm);
          }
        }
    }
  });

  it('a step alone on its rpm, -3 dB each halfway, continuous in rpm and throttle', () => {
    const steps: EngineStep[] = [
      { rpm: 6000, load: 'on' },
      { rpm: 800, load: 'off' },
      { rpm: 800, load: 'on' },
      { rpm: 3000, load: 'off' },
      { rpm: 3000, load: 'on' },
      { rpm: 6000, load: 'off' },
    ];
    expect(stepMix(steps, 3000, 1).map((m) => m.gain)).toEqual([0, 0, 0, 0, 1, 0].map((g) => expect.closeTo(g, 12)));
    const g = stepMix(steps, 1900, 0).map((m) => m.gain);
    expect(g[1]).toBeCloseTo(Math.SQRT1_2, 12);
    expect(g[3]).toBeCloseTo(Math.SQRT1_2, 12);
    for (let rpm = 800; rpm < 6000; rpm += 10)
      for (const t of [0, 0.5, 1]) {
        const a = stepMix(steps, rpm, t);
        const b = stepMix(steps, rpm + 10, t + 0.01);
        a.forEach((m, i) => expect(Math.abs(m.gain - b[i]!.gain)).toBeLessThan(0.03));
      }
  });
});

describe('recorded engine: rpm01 to the set range', () => {
  it('idle step at 0, top step at 1, then pitched up to at most x1.5 of the top step', () => {
    for (const steps of fixtures()) {
      const lo = Math.min(...steps.map((s) => s.rpm));
      const hi = Math.max(...steps.map((s) => s.rpm));
      expect(setRpm(steps, 0)).toBe(lo);
      expect(setRpm(steps, -1)).toBe(lo);
      expect(setRpm(steps, 1)).toBeCloseTo(hi, 9);
      expect(setRpm(steps, 0.5)).toBeCloseTo((lo + hi) / 2, 9);
      let prev = lo;
      for (let r = 0; r <= 5; r += 0.01) {
        const rpm = setRpm(steps, r);
        expect(rpm).toBeGreaterThanOrEqual(prev);
        prev = rpm;
        // The top step is the loop that plays above the range: its rate never passes the cap.
        const top = steps.findIndex((s) => s.rpm === hi);
        expect(stepMix(steps, rpm, 1)[top]!.rate).toBeLessThanOrEqual(MAX_PITCH_UP + 1e-12);
      }
      // A one-step set has no range to map: it keeps its own pitch.
      expect(setRpm(steps, 1e3)).toBeCloseTo(hi > lo ? hi * MAX_PITCH_UP : hi, 9);
    }
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
