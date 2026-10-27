import { describe, expect, it } from 'vitest';
import { AI_ANCHORS, aiProfile, DIFFICULTY_SKILL_OFFSET, HARD_SKILL_MAX, profileForSkill, skillForDifficulty } from './ai';

describe('profileForSkill', () => {
  it('returns the anchors at the endpoints', () => {
    for (const a of AI_ANCHORS) expect(profileForSkill(a.skill)).toEqual(a);
  });

  it('interpolates midpoints linearly', () => {
    const p = profileForSkill(0.25);
    expect(p.cornerSpeedFactor).toBeCloseTo(0.95, 9);
    expect(p.lineNoise).toBeCloseTo(1.05, 9);
    expect(p.reactionTicks).toBe(10);
    expect(p.aggression).toBeCloseTo(0.275, 9);
    expect(p.rubberBand).toBeCloseTo(0.05, 9);
    const q = profileForSkill(1.05);
    expect(q.cornerSpeedFactor).toBeCloseTo(1.13, 9);
    expect(q.reactionTicks).toBe(5); // round(4.5)
    expect(q.turboUse).toBeCloseTo(0.95, 9);
    const m = profileForSkill(0.75);
    expect(m.reactionTicks).toBe(7);
    expect(m.mineUse).toBeCloseTo(0.55, 9);
  });

  it('clamps skill to [0, 1.25] (above 1.1 is hard only)', () => {
    expect(HARD_SKILL_MAX).toBe(1.25);
    expect(AI_ANCHORS[AI_ANCHORS.length - 1]?.skill).toBe(HARD_SKILL_MAX);
    expect(profileForSkill(-1)).toEqual(AI_ANCHORS[0]);
    expect(profileForSkill(5)).toEqual(AI_ANCHORS[AI_ANCHORS.length - 1]);
  });
});

describe('difficulty (CCR-13)', () => {
  it('offsets: easy -0.2, normal 0', () => {
    expect(DIFFICULTY_SKILL_OFFSET).toEqual({ easy: -0.2, normal: 0 });
  });

  it('normal is profileForSkill unchanged', () => {
    for (const skill of [0, 0.35, 0.55, 0.75, 0.83, 1, 1.1]) expect(aiProfile(skill, 'normal')).toEqual(profileForSkill(skill));
  });

  it('easy shifts and clamps to [0, 1.1]: the boss drives at 0.9, normal never goes above 1.1', () => {
    expect(skillForDifficulty(1.1, 'easy')).toBeCloseTo(0.9, 9);
    expect(skillForDifficulty(0.15, 'easy')).toBe(0);
    expect(skillForDifficulty(0.55, 'easy')).toBeCloseTo(0.35, 9);
    expect(skillForDifficulty(5, 'normal')).toBe(1.1);
    expect(skillForDifficulty(5, 'easy')).toBe(1.1);
  });

  it('hard follows HARD_SKILL_CURVE: +0.15 up to 0.55, 0.75 at 1.12, the boss at 1.15, never past it', () => {
    expect(skillForDifficulty(0, 'hard')).toBeCloseTo(0.15, 9);
    expect(skillForDifficulty(0.35, 'hard')).toBeCloseTo(0.5, 9);
    expect(skillForDifficulty(0.55, 'hard')).toBeCloseTo(0.7, 9);
    expect(skillForDifficulty(0.65, 'hard')).toBeCloseTo(0.91, 9);
    expect(skillForDifficulty(0.75, 'hard')).toBeCloseTo(1.12, 9);
    expect(skillForDifficulty(1.1, 'hard')).toBeCloseTo(1.15, 9);
    expect(skillForDifficulty(5, 'hard')).toBeCloseTo(1.15, 9);
    expect(skillForDifficulty(-1, 'hard')).toBeCloseTo(0.15, 9);
    expect(aiProfile(0.55, 'hard')).toEqual(profileForSkill(skillForDifficulty(0.55, 'hard')));
    const top = aiProfile(1.1, 'hard');
    expect(top.cornerSpeedFactor).toBeCloseTo(1.18, 9);
    expect(top.reactionTicks).toBe(4);
  });
});
