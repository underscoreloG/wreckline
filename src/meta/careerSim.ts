import type { Difficulty, RaceOffer, RaceResult, RaceResultRow, SaveGame, UpgradeKind, UpgradeLevels } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';
import { createRng, hashString, type Rng } from '../shared/rng';
import { skillForDifficulty } from '../content/ai';
import { CARS, getCar } from '../content/cars';
import { computeStats, REPAIR_COST_PER_HP, TIER_MULT } from '../content/economy';
import { BOSS, rivalSpikesLevel, rivalUpgradeLevel } from '../content/rivals';
import { applyRaceResult, generateOffers, newCareer, PLAYER_DRIVER_ID, PLAYER_NAME, rankOf } from './career';
import { finishOrder, skillWeight } from './offSim';
import { buyCar, buyUpgrade, carOffer, repair, tradeInValue } from './shop';

export type CareerPolicy = 'greedy' | 'safe';

export interface CareerRun {
  races: number;
  champion: boolean;
  /** Cash right after each race's payout, before the next shop visit. */
  cashCurve: number[];
  /** Player rank after each race. */
  rankCurve: number[];
  /** Payout total of each race (cash earned per race). */
  payoutCurve: number[];
}

/**
 * Results model (not the physics sim). Per-race expectations come from WP17's soak after tuning pass 1:
 * 21.9 pickups/race over 4 cars and 3 laps with 4 of Scrapyard's 12 pickups cash -> ~0.6 cash per lap per car;
 * 0.25 wrecks/race over 4 cars -> ~0.06 wrecks caused per car. Damage taken is not measured yet (assumed).
 */
export interface ResultsModel {
  cashPerLap: number; // mean cash pickups per lap for the player
  wreckChance: number; // chance per race that the player wrecks one rival
  damage: readonly [number, number]; // fraction of maxHp lost, uniform in [min, max)
}

export const DEFAULT_RESULTS_MODEL: ResultsModel = { cashPerLap: 0.6, wreckChance: 0.06, damage: [0.1, 0.5] };

export interface CareerSimOptions {
  maxRaces?: number;
  model?: ResultsModel;
  /** Player driver skill (default PLAYER_DRIVER_SKILL), for sensitivity runs. */
  driverSkill?: number;
  /** CCR-13: the rivals drive at their difficulty-shifted skill (default 'normal'); their upgrades stay on their own skill. */
  difficulty?: Difficulty;
  /** Called after each race with the save after it and the offer raced (probe traces). */
  trace?: (save: SaveGame, offer: RaceOffer) => void;
}

export const CAREER_SIM_MAX_RACES = 60;
/**
 * Strength model (WP12, replaces WP09's 0.35 + 0.1 * avgUpgrade + 0.15 * tier, which ignored fuel, spikes and the rivals' own cars):
 * strength = driver value + car value + sum of level values, in skill units, for the player and every rival alike.
 * Measured with scripts/balance/calibrate.probe.mjs: one car with the variant against three stock 0.55 ravens, 4 tracks x 16 seeds
 * x 4 grid slots; its average place converted to a log-weight (Plackett-Luce) and divided by SKILL_WEIGHT_K, which matches the
 * driver-skill slope (skill 0.15 -> 1.1 spans 3.8 log units). Spikes measured 0: the AI never rams on purpose.
 */
/** Driver skill -> strength, measured at the same calibration points (the AI gains little above 0.75); linear in between, clamped at the ends. */
export const DRIVER_CURVE: readonly (readonly [number, number])[] = [
  [0.15, -0.1],
  [0.35, 0.16],
  [0.45, 0.41],
  [0.55, 0.55],
  [0.65, 0.64],
  [0.75, 0.79],
  [0.95, 0.8],
  [1.1, 0.86],
  [1.25, 0.88], // hard only (CCR-13): calibrate 2026-10-27, 0.75 at +0.246 and 1.25 at +0.334 vs the 0.55 field, added to the 0.75 point
];
export const CAR_VALUE: Readonly<Record<string, number>> = { raven: 0, outlaw: -0.12, iceberg: -0.28, scorch: 0.43, titan: 0.22, blaze: 0.89, viper: 1.08, wraith: 1.38 };
export const LEVEL_VALUE: Readonly<Record<UpgradeKind, number>> = { engine: 0.14, tires: 0.041, armor: 0.02, gun: 0.008, fuel: 0.025, spikes: 0 };
/** The human driver in AI-skill units. User 2026-10-25: finishes quick races "Mostly 1st-2nd" against 0.35/0.55/0.75, so the 0.75 AI. */
export const PLAYER_DRIVER_SKILL = 0.75;
/** A new car is bought only if this much cash is left afterwards. */
export const CAR_MARGIN = 1000;
/** Highest level bought on a car that is not the best tier for sale. */
export const SAVE_ABOVE_LEVEL = 1;
const UPGRADE_PRIORITY: readonly UpgradeKind[] = ['engine', 'armor', 'tires', 'gun', 'fuel', 'spikes'];

function driverValue(skill: number): number {
  const i = DRIVER_CURVE.findIndex(([x]) => x >= skill);
  if (i <= 0) return (DRIVER_CURVE[i < 0 ? DRIVER_CURVE.length - 1 : 0] as readonly [number, number])[1];
  const [x0, y0] = DRIVER_CURVE[i - 1] as readonly [number, number];
  const [x1, y1] = DRIVER_CURVE[i] as readonly [number, number];
  return y0 + ((y1 - y0) * (skill - x0)) / (x1 - x0);
}

export function strength(driverSkill: number, carDefId: string, levels: UpgradeLevels): number {
  const car = CAR_VALUE[carDefId];
  if (car === undefined) throw new Error(`no CAR_VALUE for '${carDefId}': calibrate it (scripts/balance/run.mjs --calibrate)`);
  return driverValue(driverSkill) + car + (Object.keys(LEVEL_VALUE) as UpgradeKind[]).reduce((s, k) => s + LEVEL_VALUE[k] * levels[k], 0);
}

export const playerSkill = (save: SaveGame, driverSkill = PLAYER_DRIVER_SKILL): number => strength(driverSkill, save.carDefId, save.upgrades);

function rivalSkill(save: SaveGame, driverId: string, difficulty: Difficulty): number {
  const def = driverId === BOSS.driverId ? BOSS : save.rivals.find((r) => r.driverId === driverId);
  if (!def) return 0;
  const level = rivalUpgradeLevel(def.skill);
  return strength(skillForDifficulty(def.skill, difficulty), def.carDefId, { engine: level, tires: level, armor: level, gun: level, fuel: level, spikes: rivalSpikesLevel(def.skill) });
}

/** Skill-vs-field model: 1 + rivals with a higher strength. */
const predictedPosition = (save: SaveGame, offer: RaceOffer, driverSkill: number, difficulty: Difficulty): number =>
  1 + offer.rivals.filter((d) => rivalSkill(save, d, difficulty) > playerSkill(save, driverSkill)).length;

export function chooseOffer(save: SaveGame, offers: RaceOffer[], policy: CareerPolicy, driverSkill = PLAYER_DRIVER_SKILL, difficulty: Difficulty = 'normal'): RaceOffer {
  const medium = offers.find((o) => o.tier === 'medium') as RaceOffer;
  if (policy === 'safe') return medium;
  // Offers come easy, medium, hard|boss: take the highest tier predicted top 2, else easy.
  return [...offers].reverse().find((o) => predictedPosition(save, o, driverSkill, difficulty) <= 2) ?? offers[0];
}

/** One shop visit, each item at most once: repair, then the next car (cheapest buyable of a higher tier) if affordable, then one level per line in priority order engine > armor > tires > gun > fuel > spikes. */
export function shopVisit(save: SaveGame): SaveGame {
  let s = save;
  const r = repair(s, Infinity);
  if (r.ok) s = r.save;
  else if (r.reason === 'cash') {
    const part = repair(s, Math.floor(s.cash / (REPAIR_COST_PER_HP * TIER_MULT[getCar(s.carDefId).tier])));
    if (part.ok) s = part.save;
  }
  // Same price rule as the shop (carOffer): locked cars are out, beaten forSale cars are discounted (CCR-10).
  const better = (save: SaveGame) =>
    Object.values(CARS)
      .filter((c) => c.tier > getCar(save.carDefId).tier && carOffer(save, c.id).listed && !carOffer(save, c.id).locked)
      .map((c) => ({ id: c.id, price: carOffer(save, c.id).price }))
      .sort((a, b) => a.price - b.price);
  const next = better(s)[0];
  if (next && s.cash + tradeInValue(s) - next.price >= CAR_MARGIN) {
    const c = buyCar(s, next.id);
    if (c.ok) s = c.save;
  }
  // While a better car is buyable, levels above SAVE_ABOVE_LEVEL are skipped so cash builds up for it (they are lost on trade-in).
  const saving = better(s).length > 0;
  for (const kind of UPGRADE_PRIORITY) {
    if (saving && s.upgrades[kind] >= SAVE_ABOVE_LEVEL) continue;
    const u = buyUpgrade(s, kind);
    if (u.ok) s = u.save;
  }
  return s;
}

function simulateResult(save: SaveGame, offer: RaceOffer, model: ResultsModel, rng: Rng, driverSkill: number, difficulty: Difficulty): RaceResult {
  const drivers = [PLAYER_DRIVER_ID, ...offer.rivals];
  const order = finishOrder(
    drivers.map((d) => skillWeight(d === PLAYER_DRIVER_ID ? playerSkill(save, driverSkill) : rivalSkill(save, d, difficulty))),
    rng,
  );
  const maxHp = computeStats(getCar(save.carDefId), save.upgrades).maxHp;
  const hpLeft = Math.max(1, save.hp - maxHp * rng.range(model.damage[0], model.damage[1]));
  // Mean-exact integer: floor of the expectation plus one more with the fractional chance.
  const cashMean = model.cashPerLap * offer.laps;
  const cashPicked = Math.floor(cashMean) + (rng.chance(cashMean - Math.floor(cashMean)) ? 1 : 0);
  const wrecksCaused = rng.chance(model.wreckChance) ? 1 : 0;
  const rows: RaceResultRow[] = order.map((idx, i) => {
    const isPlayer = idx === PLAYER_CAR_ID;
    return {
      car: idx,
      driverId: drivers[idx],
      name: isPlayer ? PLAYER_NAME : drivers[idx],
      position: i + 1,
      finished: true,
      wrecked: false,
      totalTime: null,
      bestLap: null,
      wrecksCaused: isPlayer ? wrecksCaused : 0,
      cashPicked: isPlayer ? cashPicked : 0,
      hpLeft: isPlayer ? hpLeft : 0,
      minesLeft: isPlayer ? save.mines : 0,
      turboLeft: isPlayer ? save.turbo : 0,
    };
  });
  return { trackId: offer.trackId, laps: offer.laps, rows };
}

/** Headless career for balance (WP12). Deterministic per (seed, policy, options). */
export function simulateCareer(seed: number, policy: CareerPolicy, options: CareerSimOptions = {}): CareerRun {
  const maxRaces = options.maxRaces ?? CAREER_SIM_MAX_RACES;
  const model = options.model ?? DEFAULT_RESULTS_MODEL;
  const driverSkill = options.driverSkill ?? PLAYER_DRIVER_SKILL;
  const difficulty = options.difficulty ?? 'normal';
  // Own stream for race outcomes so the save's offer RNG stays exactly what the game would draw.
  const rng = createRng(hashString(`careerSim:${seed >>> 0}`));
  let save = newCareer(seed);
  const run: CareerRun = { races: 0, champion: false, cashCurve: [], rankCurve: [], payoutCurve: [] };
  while (run.races < maxRaces && !save.championWon) {
    save = shopVisit(save);
    const gen = generateOffers(save);
    const offer = chooseOffer(gen.save, gen.offers, policy, driverSkill, difficulty);
    const { save: after, payout } = applyRaceResult(gen.save, offer, simulateResult(gen.save, offer, model, rng, driverSkill, difficulty));
    save = after;
    options.trace?.(save, offer);
    run.races++;
    run.cashCurve.push(save.cash);
    run.rankCurve.push(rankOf(save));
    run.payoutCurve.push(payout.total);
  }
  run.champion = save.championWon;
  return run;
}
