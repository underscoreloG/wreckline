import type { AiProfile, Difficulty } from '../shared/contracts';

// content.md section 8. profileForSkill interpolates linearly between these rows. cornerSpeedFactor multiplies the racing
// line's planned corner speed, which is below what the car holds (WP37: above 1 from skill 0.5 up, capped at top speed).
// Above 1.1 is hard only (CCR-13): solo ravens at factor 1.26-1.40 hit no wall and top speed caps the gain, so 1.25 is the ceiling.
export const AI_ANCHORS: readonly AiProfile[] = [
  { skill: 0.0, cornerSpeedFactor: 0.88, lineNoise: 1.2, reactionTicks: 11, aggression: 0.15, mineUse: 0.15, turboUse: 0.3, rubberBand: 0.06 },
  { skill: 0.5, cornerSpeedFactor: 1.02, lineNoise: 0.9, reactionTicks: 9, aggression: 0.4, mineUse: 0.4, turboUse: 0.6, rubberBand: 0.04 },
  { skill: 0.75, cornerSpeedFactor: 1.12, lineNoise: 0.6, reactionTicks: 7, aggression: 0.575, mineUse: 0.55, turboUse: 0.75, rubberBand: 0.02 },
  { skill: 1.0, cornerSpeedFactor: 1.12, lineNoise: 0.3, reactionTicks: 5, aggression: 0.75, mineUse: 0.7, turboUse: 0.9, rubberBand: 0.0 },
  { skill: 1.1, cornerSpeedFactor: 1.14, lineNoise: 0.2, reactionTicks: 4, aggression: 0.9, mineUse: 0.85, turboUse: 1.0, rubberBand: 0.0 },
  { skill: 1.25, cornerSpeedFactor: 1.26, lineNoise: 0.1, reactionTicks: 3, aggression: 0.9, mineUse: 0.85, turboUse: 1.0, rubberBand: 0.0 },
];

export const AI_SKILL_MIN = 0;
/** Ceiling on easy and normal (the boss). Only hard drives above it (HARD_SKILL_CURVE); HARD_SKILL_MAX is the table's top row. */
export const AI_SKILL_MAX = 1.1;
export const HARD_SKILL_MAX = 1.25;

/** CCR-13: easy and normal add this to every AI entrant's skill before profileForSkill (content.md section 8). Normal is the tuning as is. */
export const EASY_SKILL_OFFSET = -0.2;
export const DIFFICULTY_SKILL_OFFSET: Readonly<Record<Exclude<Difficulty, 'hard'>, number>> = { easy: EASY_SKILL_OFFSET, normal: 0 };
/**
 * CCR-13 hard: base skill -> driven skill, linear between points. +0.15 up to 0.55, then steeper so the 0.75 AI pulls ahead
 * into the range above 1.1 (laps about 2.5% faster than a good human) instead of the field bunching under the flat 0.75-1.0 pace
 * curve. The boss gets only +0.05: in its wraith, where top speed rarely caps, 1.25 would lap 6% faster than on normal.
 */
export const HARD_SKILL_CURVE: readonly (readonly [number, number])[] = [
  [0, 0.15],
  [0.55, 0.7],
  [0.75, 1.12],
  [AI_SKILL_MAX, 1.15],
];

/** The boss gets this maxSpeed multiplier on top of its car stats. */
export const BOSS_MAX_SPEED_MULT = 1;

/** M1 quick race AI skills and names, in entrant order (extra AIs use 0.55). */
export const QUICK_RACE_AI_SKILLS: readonly number[] = [0.35, 0.55, 0.75];
export const QUICK_RACE_EXTRA_AI_SKILL = 0.55;
export const QUICK_RACE_AI_NAMES: readonly string[] = ['VEX', 'RAZOR', 'MOTH'];
/** Skill of the medium AI that drives the player car with ?autoplay=1. */
export const AUTOPLAY_SKILL = 0.55;

export function profileForSkill(skill: number): AiProfile {
  const s = Math.min(HARD_SKILL_MAX, Math.max(AI_SKILL_MIN, skill));
  let i = 0;
  while (i < AI_ANCHORS.length - 2 && s > AI_ANCHORS[i + 1].skill) i++;
  const a = AI_ANCHORS[i];
  const b = AI_ANCHORS[i + 1];
  const t = (s - a.skill) / (b.skill - a.skill);
  // x * (1 - t) + y * t is exact at both ends, so the anchors come back unchanged.
  const mix = (x: number, y: number): number => x * (1 - t) + y * t;
  return {
    skill: s,
    cornerSpeedFactor: mix(a.cornerSpeedFactor, b.cornerSpeedFactor),
    lineNoise: mix(a.lineNoise, b.lineNoise),
    reactionTicks: Math.round(mix(a.reactionTicks, b.reactionTicks)),
    aggression: mix(a.aggression, b.aggression),
    mineUse: mix(a.mineUse, b.mineUse),
    turboUse: mix(a.turboUse, b.turboUse),
    rubberBand: mix(a.rubberBand, b.rubberBand),
  };
}

/** The skill an AI drives at on `difficulty`: easy and normal add DIFFICULTY_SKILL_OFFSET (clamped to 0..1.1), hard follows HARD_SKILL_CURVE. */
export function skillForDifficulty(skill: number, difficulty: Difficulty): number {
  if (difficulty !== 'hard') return Math.min(AI_SKILL_MAX, Math.max(AI_SKILL_MIN, skill + DIFFICULTY_SKILL_OFFSET[difficulty]));
  const s = Math.min(AI_SKILL_MAX, Math.max(AI_SKILL_MIN, skill));
  let i = 0;
  while (i < HARD_SKILL_CURVE.length - 2 && s > (HARD_SKILL_CURVE[i + 1] as readonly [number, number])[0]) i++;
  const [x0, y0] = HARD_SKILL_CURVE[i] as readonly [number, number];
  const [x1, y1] = HARD_SKILL_CURVE[i + 1] as readonly [number, number];
  return y0 + ((y1 - y0) * (s - x0)) / (x1 - x0);
}

/** Every AI entrant's profile (quick race, career, later modes): the difficulty shift, then profileForSkill. */
export const aiProfile = (skill: number, difficulty: Difficulty): AiProfile => profileForSkill(skillForDifficulty(skill, difficulty));
