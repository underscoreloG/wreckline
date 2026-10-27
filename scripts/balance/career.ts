import type { Difficulty } from '../../src/shared/contracts';
import { getCar } from '../../src/content/cars';
import { computeStats, repairCost, STARTING_CAREER, upgradeCost } from '../../src/content/economy';
import { CAREER_SIM_MAX_RACES, type CareerPolicy, type CareerRun, simulateCareer } from '../../src/meta/careerSim';

export const GREEDY_RACES = [18, 35] as const;
export const GREEDY_MIN_CHAMPIONS = 14;
export const SAFE_RACES = [25, 50] as const;
const RACE5 = 5;

export interface CareerSummary {
  policy: CareerPolicy;
  seeds: number;
  /** Races per seed (maxRaces when not champion). */
  races: number[];
  champions: number;
  /** Champion inside the policy's race window (greedy 18-35, safe 25-50). */
  inWindow: number;
  /** Seeds that pass the policy's rule (greedy: in window; safe: in window or never champion). */
  passing: number;
  /** Starting cash + payouts of races 1-5, lowest seed. */
  race5IncomeMin: number;
  /** Engine 1 + armor 1 + a full repair on the starter car. */
  race5Need: number;
  /** Rank after each race, per seed (for reading where careers stall). */
  rankCurves: number[][];
}

export function race5Need(): number {
  const car = getCar(STARTING_CAREER.carDefId);
  return upgradeCost(car, 'engine', 1) + upgradeCost(car, 'armor', 1) + repairCost(car, computeStats(car, STARTING_CAREER.upgrades).maxHp);
}

export function careerSummary(policy: CareerPolicy, seeds: number, driverSkill?: number, maxRaces = CAREER_SIM_MAX_RACES, difficulty?: Difficulty): CareerSummary {
  const runs: CareerRun[] = [];
  for (let seed = 1; seed <= seeds; seed++) runs.push(simulateCareer(seed, policy, { maxRaces, driverSkill, difficulty }));
  const [lo, hi] = policy === 'greedy' ? GREEDY_RACES : SAFE_RACES;
  const inWindow = runs.filter((r) => r.champion && r.races >= lo && r.races <= hi).length;
  return {
    policy,
    seeds,
    races: runs.map((r) => r.races),
    champions: runs.filter((r) => r.champion).length,
    inWindow,
    passing: policy === 'greedy' ? inWindow : runs.filter((r) => !r.champion || (r.races >= lo && r.races <= hi)).length,
    race5IncomeMin: Math.min(...runs.map((r) => STARTING_CAREER.cash + r.payoutCurve.slice(0, RACE5).reduce((s, x) => s + x, 0))),
    race5Need: race5Need(),
    rankCurves: runs.map((r) => r.rankCurve),
  };
}
