import { describe, expect, it } from 'vitest';
import { AI_ANCHORS, profileForSkill } from './ai';

describe('profileForSkill', () => {
  it('returns the anchors at the endpoints', () => {
    for (const a of AI_ANCHORS) expect(profileForSkill(a.skill)).toEqual(a);
  });

  it('interpolates midpoints linearly', () => {
    const p = profileForSkill(0.25);
    expect(p.cornerSpeedFactor).toBeCloseTo(0.83, 9);
    expect(p.lineNoise).toBeCloseTo(1.25, 9);
    expect(p.reactionTicks).toBe(12); // round(11.5)
    expect(p.aggression).toBeCloseTo(0.275, 9);
    expect(p.rubberBand).toBeCloseTo(0.05, 9);
    const q = profileForSkill(1.05);
    expect(q.cornerSpeedFactor).toBeCloseTo(0.985, 9);
    expect(q.reactionTicks).toBe(5); // round(4.5)
    expect(q.turboUse).toBeCloseTo(0.95, 9);
    const m = profileForSkill(0.75);
    expect(m.reactionTicks).toBe(7);
    expect(m.mineUse).toBeCloseTo(0.55, 9);
  });

  it('clamps skill to [0, 1.1]', () => {
    expect(profileForSkill(-1)).toEqual(AI_ANCHORS[0]);
    expect(profileForSkill(5)).toEqual(AI_ANCHORS[3]);
  });
});
