import type { CarDef, SaveGame, UpgradeKind } from '../shared/contracts';
import { CARS, carsForSale, getCar } from '../content/cars';
import {
  computeStats,
  MAX_UPGRADE_LEVEL,
  MINE_PRICE,
  repairCost,
  SHOP_MINES_CAP,
  SHOP_TURBO_CAP,
  TRADE_IN_FRACTION,
  TURBO_PRICE_PER_SECOND,
  upgradeCost,
} from '../content/economy';

export type ShopFail = 'cash' | 'max' | 'owned' | 'invalid';
export type ShopResult = { ok: true; save: SaveGame } | { ok: false; reason: ShopFail };

const fail = (reason: ShopFail): ShopResult => ({ ok: false, reason });
/** A fresh save (no shared nested objects with the input) with `patch` applied. */
const done = (save: SaveGame, patch: Partial<SaveGame>): ShopResult => ({
  ok: true,
  save: { ...save, upgrades: { ...save.upgrades }, rivals: save.rivals.map((r) => ({ ...r })), ...patch },
});
const UPGRADE_KINDS: readonly UpgradeKind[] = ['engine', 'tires', 'armor', 'gun'];

/** `forSale` cars other than the one owned, in table order. */
export function shopCars(save: SaveGame): CarDef[] {
  return carsForSale().filter((c) => c.id !== save.carDefId);
}

export const canAfford = (save: SaveGame, cost: number): boolean => save.cash >= cost;

/** Cost of the next level on this line, or null when maxed. */
export function nextUpgradeCost(save: SaveGame, kind: UpgradeKind): number | null {
  const level = save.upgrades[kind];
  return level >= MAX_UPGRADE_LEVEL ? null : upgradeCost(getCar(save.carDefId), kind, level + 1);
}

export function buyUpgrade(save: SaveGame, kind: UpgradeKind): ShopResult {
  if (!UPGRADE_KINDS.includes(kind)) return fail('invalid');
  const cost = nextUpgradeCost(save, kind);
  if (cost === null) return fail('max');
  if (!canAfford(save, cost)) return fail('cash');
  return done(save, { cash: save.cash - cost, upgrades: { ...save.upgrades, [kind]: save.upgrades[kind] + 1 } });
}

export const tradeInValue = (save: SaveGame): number => Math.round(getCar(save.carDefId).price * TRADE_IN_FRACTION);

/** Trades in the current car (50% of its price), loses the upgrades, starts at full hp. */
export function buyCar(save: SaveGame, carDefId: string): ShopResult {
  const car = Object.hasOwn(CARS, carDefId) ? CARS[carDefId] : undefined;
  if (!car || !car.forSale) return fail('invalid');
  if (car.id === save.carDefId) return fail('owned');
  const cash = save.cash + tradeInValue(save) - car.price;
  if (cash < 0) return fail('cash');
  const upgrades = { engine: 0, tires: 0, armor: 0, gun: 0 };
  return done(save, { cash, carDefId: car.id, upgrades, hp: computeStats(car, upgrades).maxHp });
}

/** Repairs up to `amount` hp, clamped to maxHp (pass Infinity for a full repair). */
export function repair(save: SaveGame, amount: number): ShopResult {
  if (Number.isNaN(amount) || amount <= 0) return fail('invalid');
  const car = getCar(save.carDefId);
  const missing = computeStats(car, save.upgrades).maxHp - save.hp;
  if (missing <= 0) return fail('max');
  const hp = Math.min(amount, missing);
  const cost = repairCost(car, hp);
  if (!canAfford(save, cost)) return fail('cash');
  return done(save, { cash: save.cash - cost, hp: save.hp + hp });
}

/** A stuck player (0 hp, cannot pay a repair to this share of maxHp) is towed back to it for free (content.md section 3). */
export const TOW_HP_FRACTION = 0.3;
/** The garage's partial repair step, as a share of maxHp. */
export const PARTIAL_REPAIR_FRACTION = 0.25;

const missingHp = (save: SaveGame): number => Math.max(0, computeStats(getCar(save.carDefId), save.upgrades).maxHp - save.hp);

/** Free tow: hp 0 and too little cash for a repair to ceil(TOW_HP_FRACTION * maxHp) -> hp set to that, cash unchanged. */
export function freeTowIfStuck(save: SaveGame): { save: SaveGame; towed: boolean } {
  if (save.hp > 0) return { save, towed: false };
  const car = getCar(save.carDefId);
  const towHp = Math.ceil(TOW_HP_FRACTION * computeStats(car, save.upgrades).maxHp);
  if (canAfford(save, repairCost(car, towHp))) return { save, towed: false };
  return { save: { ...save, upgrades: { ...save.upgrades }, rivals: save.rivals.map((r) => ({ ...r })), hp: towHp }, towed: true };
}

/** Hp a +25% repair adds: ceil(PARTIAL_REPAIR_FRACTION * maxHp), clamped to the missing hp. */
export function partialRepairHp(save: SaveGame): number {
  const maxHp = computeStats(getCar(save.carDefId), save.upgrades).maxHp;
  return Math.min(Math.ceil(PARTIAL_REPAIR_FRACTION * maxHp), missingHp(save));
}

/** Most hp the current cash pays for, clamped to the missing hp (whole hp unless it covers a full repair). */
export function affordableRepairHp(save: SaveGame): number {
  const car = getCar(save.carDefId);
  const missing = missingHp(save);
  if (canAfford(save, repairCost(car, missing))) return missing;
  let hp = Math.floor(missing);
  while (hp > 0 && !canAfford(save, repairCost(car, hp))) hp--;
  return hp;
}

/** Buys up to n mines, clamped to the carry cap. */
export function buyMines(save: SaveGame, n: number): ShopResult {
  if (!Number.isInteger(n) || n <= 0) return fail('invalid');
  const count = Math.min(n, SHOP_MINES_CAP - save.mines);
  if (count <= 0) return fail('max');
  const cost = count * MINE_PRICE;
  if (!canAfford(save, cost)) return fail('cash');
  return done(save, { cash: save.cash - cost, mines: save.mines + count });
}

/** Buys up to `seconds` of turbo, clamped to the carry cap; a fractional top-up rounds the price up. */
export function buyTurbo(save: SaveGame, seconds: number): ShopResult {
  if (Number.isNaN(seconds) || seconds <= 0) return fail('invalid');
  const secs = Math.min(seconds, SHOP_TURBO_CAP - save.turbo);
  if (secs <= 0) return fail('max');
  const cost = Math.ceil(secs * TURBO_PRICE_PER_SECOND);
  if (!canAfford(save, cost)) return fail('cash');
  return done(save, { cash: save.cash - cost, turbo: save.turbo + secs });
}
