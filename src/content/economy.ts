import type { CarDef, CarStats, RaceTier, UpgradeKind, UpgradeLevels } from '../shared/contracts';
import { MAX_MINES_CARRIED, MAX_TURBO_CARRIED } from './pickups';

/** Highest level of the multiplicative lines and of fuel (kept for existing callers; spikes stop at MAX_LEVEL.spikes). */
export const MAX_UPGRADE_LEVEL = 5;

/** Highest level per line (content.md section 2). */
export const MAX_LEVEL: Readonly<Record<UpgradeKind, number>> = { engine: 5, tires: 5, armor: 5, gun: 5, fuel: 5, spikes: 3 };

/** Multiplicative effect per upgrade level on the car's base stats (content.md section 2). */
export const UPGRADE_EFFECTS: Readonly<Record<UpgradeKind, Partial<Record<keyof CarStats, number>>>> = {
  engine: { maxSpeed: 1.05, accel: 1.06 },
  tires: { grip: 1.04, turnRate: 1.04 },
  armor: { maxHp: 1.15 },
  gun: { gunDps: 1.12 },
  fuel: {},
  spikes: {},
};

/** Additive effect per upgrade level (content.md section 2): stat = base + step * level. */
export const UPGRADE_ADDS: Readonly<Record<UpgradeKind, Partial<Record<keyof CarStats, number>>>> = {
  engine: {},
  tires: {},
  armor: {},
  gun: {},
  fuel: { turboSpeedMult: 0.04, turboAccelMult: 0.08 },
  spikes: { ramDealtMult: 0.5, ramTakenMult: -0.15 },
};

export const GRIP_CAP = 0.97;

/** Base cost of buying level L (index L - 1), before the tier multiplier: every line except spikes. */
export const UPGRADE_COSTS: readonly number[] = [300, 700, 1500, 3000, 6000];
/** Base cost of spikes level L (index L - 1), before the tier multiplier. */
export const SPIKES_COSTS: readonly number[] = [500, 1200, 2500];

export const TIER_MULT: Readonly<Record<1 | 2 | 3, number>> = { 1: 1, 2: 1.6, 3: 2.4 };

/** Cost of buying `toLevel` (1..MAX_LEVEL[kind]) on a line, rounded to the nearest 10. */
export function upgradeCost(car: CarDef, kind: UpgradeKind, toLevel: number): number {
  const base = toLevel <= MAX_LEVEL[kind] ? (kind === 'spikes' ? SPIKES_COSTS : UPGRADE_COSTS)[toLevel - 1] : undefined;
  if (base === undefined) throw new Error(`${kind} level ${toLevel} is outside 1..${MAX_LEVEL[kind]}`);
  return Math.round((base * TIER_MULT[car.tier]) / 10) * 10;
}

export function computeStats(car: CarDef, levels: UpgradeLevels): CarStats {
  const s: CarStats = { ...car.base };
  for (const kind of Object.keys(UPGRADE_EFFECTS) as UpgradeKind[]) {
    const level = levels[kind];
    for (const [stat, mult] of Object.entries(UPGRADE_EFFECTS[kind]) as [keyof CarStats, number][]) {
      s[stat] *= mult ** level;
    }
    // base + step * level in one step: a per-level loop drifts (1.5000000000000002).
    for (const [stat, step] of Object.entries(UPGRADE_ADDS[kind]) as [keyof CarStats, number][]) {
      s[stat] = car.base[stat] + step * level;
    }
  }
  s.maxHp = Math.round(s.maxHp);
  s.grip = Math.min(GRIP_CAP, s.grip);
  return s;
}

// ---- shop (content.md section 3)

export const REPAIR_COST_PER_HP = 4;
export const MINE_PRICE = 60;
export const TURBO_PRICE_PER_SECOND = 40;
export const SHOP_MINES_CAP = MAX_MINES_CARRIED;
export const SHOP_TURBO_CAP = MAX_TURBO_CARRIED;
export const TRADE_IN_FRACTION = 0.5;

/** Sabotage (content.md section 3): price = round(fraction * offer.prizes[0]); damage a whole pct in MIN..MAX. */
export const SABOTAGE_PRICE_FRACTION = 0.3;
export const SABOTAGE_PCT_MIN = 25;
export const SABOTAGE_PCT_MAX = 49;

/** Track unlocks (content.md section 11): this many at the start, one more per this many ranks climbed. */
export const TRACKS_AT_START = 3;
export const RANKS_PER_UNLOCK = 2;

/** Cost to repair `hp` points on this car, rounded up. */
export const repairCost = (car: CarDef, hp: number): number => Math.ceil(REPAIR_COST_PER_HP * hp * TIER_MULT[car.tier]);

export const STARTING_CAREER = {
  cash: 600,
  carDefId: 'raven',
  upgrades: { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 } as UpgradeLevels,
  hp: 100,
  mines: 2,
  turbo: 3,
} as const;

/** M1 quick race loadout for every entrant (hp is always full). */
export const QUICK_RACE_LOADOUT = { mines: 3, turbo: 4 } as const;

// ---- pickup cash and career tiers (content.md sections 6 and 11)

/** Quick race shows cash pickups as units x this. */
export const QUICK_RACE_CASH_VALUE = 100;

export interface CareerTier {
  laps: number;
  prizes: readonly number[]; // index 0 = 1st
  points: readonly number[];
  cashPickupValue: number;
  wreckBonus: number;
}

export const CAREER_TIERS: Readonly<Record<RaceTier, CareerTier>> = {
  easy: { laps: 3, prizes: [900, 530, 230, 0], points: [3, 2, 1, 0], cashPickupValue: 100, wreckBonus: 250 },
  medium: { laps: 4, prizes: [1800, 1050, 450, 0], points: [6, 4, 2, 1], cashPickupValue: 200, wreckBonus: 375 },
  hard: { laps: 5, prizes: [3750, 2100, 900, 150], points: [10, 6, 3, 1], cashPickupValue: 400, wreckBonus: 625 },
  boss: { laps: 5, prizes: [10000, 0, 0, 0], points: [0, 0, 0, 0], cashPickupValue: 0, wreckBonus: 0 },
};

/** Track rotation index per tier: tracks[(racesRun + index) % 3]. */
export const TIER_TRACK_INDEX: Readonly<Record<RaceTier, number>> = { easy: 0, medium: 1, hard: 2, boss: 2 };
