import type { CarDef, CarStats, RaceTier, UpgradeKind, UpgradeLevels } from '../shared/contracts';
import { MAX_MINES_CARRIED, MAX_TURBO_CARRIED } from './pickups';

export const MAX_UPGRADE_LEVEL = 5;

/** Multiplicative effect per upgrade level on the car's base stats (content.md section 2). */
export const UPGRADE_EFFECTS: Readonly<Record<UpgradeKind, Partial<Record<keyof CarStats, number>>>> = {
  engine: { maxSpeed: 1.05, accel: 1.06 },
  tires: { grip: 1.04, turnRate: 1.04 },
  armor: { maxHp: 1.15 },
  gun: { gunDps: 1.12 },
};

export const GRIP_CAP = 0.97;

/** Base cost of buying level L (index L - 1), before the tier multiplier. */
export const UPGRADE_COSTS: readonly number[] = [300, 700, 1500, 3000, 6000];

export const TIER_MULT: Readonly<Record<1 | 2 | 3, number>> = { 1: 1, 2: 1.6, 3: 2.4 };

/** Cost of buying `toLevel` (1..5) on any line: the same table for every kind. */
export function upgradeCost(car: CarDef, _kind: UpgradeKind, toLevel: number): number {
  const base = UPGRADE_COSTS[toLevel - 1];
  if (base === undefined) throw new Error(`upgrade level ${toLevel} is outside 1..${MAX_UPGRADE_LEVEL}`);
  return Math.round((base * TIER_MULT[car.tier]) / 10) * 10;
}

export function computeStats(car: CarDef, levels: UpgradeLevels): CarStats {
  const s: CarStats = { ...car.base };
  for (const kind of Object.keys(UPGRADE_EFFECTS) as UpgradeKind[]) {
    const level = levels[kind];
    for (const [stat, mult] of Object.entries(UPGRADE_EFFECTS[kind]) as [keyof CarStats, number][]) {
      s[stat] *= mult ** level;
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

/** Cost to repair `hp` points on this car, rounded up. */
export const repairCost = (car: CarDef, hp: number): number => Math.ceil(REPAIR_COST_PER_HP * hp * TIER_MULT[car.tier]);

export const STARTING_CAREER = {
  cash: 600,
  carDefId: 'raven',
  upgrades: { engine: 0, tires: 0, armor: 0, gun: 0 } as UpgradeLevels,
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
  easy: { laps: 3, prizes: [600, 350, 150, 0], points: [3, 2, 1, 0], cashPickupValue: 100, wreckBonus: 250 },
  medium: { laps: 4, prizes: [1200, 700, 300, 0], points: [6, 4, 2, 1], cashPickupValue: 200, wreckBonus: 375 },
  hard: { laps: 5, prizes: [2500, 1400, 600, 100], points: [10, 6, 3, 1], cashPickupValue: 400, wreckBonus: 625 },
  boss: { laps: 5, prizes: [10000, 0, 0, 0], points: [0, 0, 0, 0], cashPickupValue: 0, wreckBonus: 0 },
};

/** Track rotation index per tier: tracks[(racesRun + index) % 3]. */
export const TIER_TRACK_INDEX: Readonly<Record<RaceTier, number>> = { easy: 0, medium: 1, hard: 2, boss: 2 };
