import type { AiProfile } from '../shared/contracts';

// content.md section 8. profileForSkill interpolates linearly between these rows.
export const AI_ANCHORS: readonly AiProfile[] = [
  { skill: 0.0, cornerSpeedFactor: 0.78, lineNoise: 1.6, reactionTicks: 14, aggression: 0.15, mineUse: 0.15, turboUse: 0.3, rubberBand: 0.06 },
  { skill: 0.5, cornerSpeedFactor: 0.88, lineNoise: 0.9, reactionTicks: 9, aggression: 0.4, mineUse: 0.4, turboUse: 0.6, rubberBand: 0.04 },
  { skill: 1.0, cornerSpeedFactor: 0.97, lineNoise: 0.3, reactionTicks: 5, aggression: 0.75, mineUse: 0.7, turboUse: 0.9, rubberBand: 0.0 },
  { skill: 1.1, cornerSpeedFactor: 1.0, lineNoise: 0.2, reactionTicks: 4, aggression: 0.9, mineUse: 0.85, turboUse: 1.0, rubberBand: 0.0 },
];

export const AI_SKILL_MIN = 0;
export const AI_SKILL_MAX = 1.1;

/** The boss gets this maxSpeed multiplier on top of its car stats. */
export const BOSS_MAX_SPEED_MULT = 1;

/** M1 quick race AI skills and names, in entrant order (extra AIs use 0.55). */
export const QUICK_RACE_AI_SKILLS: readonly number[] = [0.35, 0.55, 0.75];
export const QUICK_RACE_EXTRA_AI_SKILL = 0.55;
export const QUICK_RACE_AI_NAMES: readonly string[] = ['VEX', 'RAZOR', 'MOTH'];
/** Skill of the medium AI that drives the player car with ?autoplay=1. */
export const AUTOPLAY_SKILL = 0.55;

export function profileForSkill(skill: number): AiProfile {
  const s = Math.min(AI_SKILL_MAX, Math.max(AI_SKILL_MIN, skill));
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
