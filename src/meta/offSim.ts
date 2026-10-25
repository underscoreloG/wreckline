import type { RaceOffer, RaceTier, SaveGame } from '../shared/contracts';
import type { Rng } from '../shared/rng';
import { CAREER_TIERS } from '../content/economy';

/** WP09 off-screen model: tier by skill, 4-car race against phantoms at the tier's median skill. */
export const OFF_SIM_EASY_BELOW = 0.4;
export const OFF_SIM_MEDIUM_BELOW = 0.75;
export const OFF_SIM_MEDIAN_SKILL: Readonly<Record<Exclude<RaceTier, 'boss'>, number>> = { easy: 0.5, medium: 1.0, hard: 1.2 };
export const OFF_SIM_PHANTOMS = 3;
/** Finishing weight w = exp(SKILL_WEIGHT_K * skill). */
export const SKILL_WEIGHT_K = 4;

export const skillWeight = (skill: number): number => Math.exp(SKILL_WEIGHT_K * skill);

export function offSimTier(skill: number): Exclude<RaceTier, 'boss'> {
  if (skill < OFF_SIM_EASY_BELOW) return 'easy';
  if (skill < OFF_SIM_MEDIUM_BELOW) return 'medium';
  return 'hard';
}

/** Weighted draw without replacement: returns entrant indices from 1st to last. */
export function finishOrder(weights: readonly number[], rng: Rng): number[] {
  const left = weights.map((w, i) => ({ w, i }));
  const order: number[] = [];
  while (left.length > 0) {
    let r = rng.next() * left.reduce((s, x) => s + x.w, 0);
    let k = 0;
    while (k < left.length - 1 && r >= left[k].w) r -= left[k++].w;
    order.push(left[k].i);
    left.splice(k, 1);
  }
  return order;
}

/** Points for every rival not in the player's race. Advances `rng`; the caller writes its state back to the save. */
export function simulateOtherRivals(save: SaveGame, offer: RaceOffer, rng: Rng): SaveGame {
  const rivals = save.rivals.map((r) => {
    if (offer.rivals.includes(r.driverId)) return { ...r };
    const tier = offSimTier(r.skill);
    const phantom = skillWeight(OFF_SIM_MEDIAN_SKILL[tier]);
    const weights = [skillWeight(r.skill), ...Array.from({ length: OFF_SIM_PHANTOMS }, () => phantom)];
    const position = finishOrder(weights, rng).indexOf(0) + 1;
    return { ...r, points: r.points + CAREER_TIERS[tier].points[position - 1] };
  });
  return { ...save, upgrades: { ...save.upgrades }, rivals };
}
