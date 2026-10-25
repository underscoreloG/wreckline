import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../shared/contracts';
import { createLoop, MAX_STEPS_PER_FRAME, type Scheduler } from './loop';

const noRaf: Scheduler = { request: () => 0, cancel: () => {} };

function setup() {
  let steps = 0;
  const alphas: number[] = [];
  const loop = createLoop(
    () => steps++,
    (alpha) => alphas.push(alpha),
    noRaf,
  );
  return { loop, alphas, steps: () => steps };
}

describe('loop', () => {
  it('runs one step per SIM_DT and carries the remainder as alpha', () => {
    const t = setup();
    expect(t.loop.advance(SIM_DT * 2.5)).toBe(2);
    expect(t.alphas[0]).toBeCloseTo(0.5);
    expect(t.loop.advance(SIM_DT * 0.6)).toBe(1);
    expect(t.alphas[1]).toBeCloseTo(0.1);
  });

  it('caps a frame at 5 steps and drops the rest', () => {
    const t = setup();
    expect(t.loop.advance(1)).toBe(MAX_STEPS_PER_FRAME);
    expect(t.loop.advance(SIM_DT * 0.5)).toBe(0);
    expect(t.steps()).toBe(5);
  });

  it('keeps alpha in [0,1] for any frame length', () => {
    const t = setup();
    for (let i = 0; i < 500; i++) t.loop.advance(((i * 7919) % 97) / 1000);
    for (const a of t.alphas) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it('pause stops steps and renders; resume resets the accumulator', () => {
    const t = setup();
    t.loop.advance(SIM_DT * 0.9);
    t.loop.setPaused(true);
    expect(t.loop.advance(1)).toBe(0);
    expect(t.alphas).toHaveLength(1);
    t.loop.setPaused(false);
    // The 0.9 tick carried before the pause is gone: no catch-up.
    expect(t.loop.advance(SIM_DT * 0.5)).toBe(0);
  });

  it('stepManual steps without rendering', () => {
    const t = setup();
    t.loop.stepManual(30);
    expect(t.steps()).toBe(30);
    expect(t.alphas).toHaveLength(0);
  });
});
