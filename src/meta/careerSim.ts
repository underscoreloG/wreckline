import type { RaceOffer, RaceResult, RaceResultRow, SaveGame, UpgradeKind } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';
import { createRng, hashString, type Rng } from '../shared/rng';
import { carsForSale, getCar } from '../content/cars';
import { computeStats, REPAIR_COST_PER_HP, TIER_MULT } from '../content/economy';
import { BOSS } from '../content/rivals';
import { applyRaceResult, generateOffers, newCareer, PLAYER_DRIVER_ID, PLAYER_NAME, rankOf } from './career';
import { finishOrder, skillWeight } from './offSim';
import { buyCar, buyUpgrade, repair, tradeInValue } from './shop';

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
}

export const CAREER_SIM_MAX_RACES = 60;
/** Effective player skill = base + perUpgrade * avgUpgradeLevel + perTier * carTier (WP09). */
export const PLAYER_SKILL_MODEL = { base: 0.35, perUpgrade: 0.1, perTier: 0.15 } as const;
/** A new car is bought only if this much cash is left afterwards. */
export const CAR_MARGIN = 1000;
const UPGRADE_PRIORITY: readonly UpgradeKind[] = ['engine', 'armor', 'tires', 'gun'];

export function playerSkill(save: SaveGame): number {
  const u = save.upgrades;
  const avg = (u.engine + u.tires + u.armor + u.gun) / 4;
  return PLAYER_SKILL_MODEL.base + PLAYER_SKILL_MODEL.perUpgrade * avg + PLAYER_SKILL_MODEL.perTier * getCar(save.carDefId).tier;
}

const rivalSkill = (save: SaveGame, driverId: string): number =>
  driverId === BOSS.driverId ? BOSS.skill : (save.rivals.find((r) => r.driverId === driverId)?.skill ?? 0);

/** Skill-vs-field model: 1 + rivals with a higher skill. */
const predictedPosition = (save: SaveGame, offer: RaceOffer): number => 1 + offer.rivals.filter((d) => rivalSkill(save, d) > playerSkill(save)).length;

export function chooseOffer(save: SaveGame, offers: RaceOffer[], policy: CareerPolicy): RaceOffer {
  const medium = offers.find((o) => o.tier === 'medium') as RaceOffer;
  if (policy === 'safe') return medium;
  // Offers come easy, medium, hard|boss: take the highest tier predicted top 2, else easy.
  return [...offers].reverse().find((o) => predictedPosition(save, o) <= 2) ?? offers[0];
}

/** One shop visit, each item at most once, in priority order: repair > engine > armor > tires > gun > next car. */
export function shopVisit(save: SaveGame): SaveGame {
  let s = save;
  const r = repair(s, Infinity);
  if (r.ok) s = r.save;
  else if (r.reason === 'cash') {
    const part = repair(s, Math.floor(s.cash / (REPAIR_COST_PER_HP * TIER_MULT[getCar(s.carDefId).tier])));
    if (part.ok) s = part.save;
  }
  for (const kind of UPGRADE_PRIORITY) {
    const u = buyUpgrade(s, kind);
    if (u.ok) s = u.save;
  }
  const tier = getCar(s.carDefId).tier;
  const next = carsForSale()
    .filter((c) => c.tier > tier)
    .sort((a, b) => a.price - b.price)[0];
  if (next && s.cash + tradeInValue(s) - next.price >= CAR_MARGIN) {
    const c = buyCar(s, next.id);
    if (c.ok) s = c.save;
  }
  return s;
}

function simulateResult(save: SaveGame, offer: RaceOffer, model: ResultsModel, rng: Rng): RaceResult {
  const drivers = [PLAYER_DRIVER_ID, ...offer.rivals];
  const order = finishOrder(
    drivers.map((d) => skillWeight(d === PLAYER_DRIVER_ID ? playerSkill(save) : rivalSkill(save, d))),
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
  // Own stream for race outcomes so the save's offer RNG stays exactly what the game would draw.
  const rng = createRng(hashString(`careerSim:${seed >>> 0}`));
  let save = newCareer(seed);
  const run: CareerRun = { races: 0, champion: false, cashCurve: [], rankCurve: [], payoutCurve: [] };
  while (run.races < maxRaces && !save.championWon) {
    save = shopVisit(save);
    const gen = generateOffers(save);
    const offer = chooseOffer(gen.save, gen.offers, policy);
    const { save: after, payout } = applyRaceResult(gen.save, offer, simulateResult(gen.save, offer, model, rng));
    save = after;
    run.races++;
    run.cashCurve.push(save.cash);
    run.rankCurve.push(rankOf(save));
    run.payoutCurve.push(payout.total);
  }
  run.champion = save.championWon;
  return run;
}
