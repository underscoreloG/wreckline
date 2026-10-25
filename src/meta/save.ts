import type { RivalState, SaveGame, UpgradeLevels } from '../shared/contracts';
import { CARS } from '../content/cars';
import { MAX_UPGRADE_LEVEL } from '../content/economy';

/** Storage adapter (localStorage in the game, a Map in tests): meta never touches the global. */
export interface KeyValueStore {
  get(k: string): string | null;
  set(k: string, v: string): void;
  remove(k: string): void;
}

export const SAVE_KEY = 'wreckline.save.v1';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isLevel = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_UPGRADE_LEVEL;

function parseUpgrades(v: unknown): UpgradeLevels | null {
  if (!isObj(v)) return null;
  const { engine, tires, armor, gun } = v;
  return isLevel(engine) && isLevel(tires) && isLevel(armor) && isLevel(gun) ? { engine, tires, armor, gun } : null;
}

function parseRival(v: unknown): RivalState | null {
  if (!isObj(v)) return null;
  const { driverId, name, color, carDefId, skill, points } = v;
  if (!isStr(driverId) || !isStr(name) || !isStr(color) || !isStr(carDefId) || !Object.hasOwn(CARS, carDefId) || !isNum(skill) || !isNum(points)) return null;
  return { driverId, name, color, carDefId, skill, points };
}

/** Shape and version check; returns a clean copy with only the known fields, or null. */
export function parseSave(v: unknown): SaveGame | null {
  if (!isObj(v) || v.version !== 1) return null;
  const { cash, carDefId, hp, mines, turbo, points, racesRun, wins, championWon, rngState } = v;
  if (![cash, hp, mines, turbo, points, racesRun, wins, rngState].every(isNum)) return null;
  if (!isStr(carDefId) || !Object.hasOwn(CARS, carDefId) || typeof championWon !== 'boolean') return null;
  const upgrades = parseUpgrades(v.upgrades);
  if (!upgrades || !Array.isArray(v.rivals)) return null;
  const rivals = v.rivals.map(parseRival);
  if (rivals.some((r) => r === null)) return null;
  return {
    version: 1,
    cash: cash as number,
    carDefId,
    upgrades,
    hp: hp as number,
    mines: mines as number,
    turbo: turbo as number,
    points: points as number,
    racesRun: racesRun as number,
    wins: wins as number,
    rivals: rivals as RivalState[],
    championWon,
    rngState: (rngState as number) >>> 0,
  };
}

/** Never throws: missing, corrupt or unreadable data gives null. */
export function loadSave(store: KeyValueStore): SaveGame | null {
  try {
    const raw = store.get(SAVE_KEY);
    return raw === null ? null : parseSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Returns false when the store refuses the write (quota, private mode). */
export function writeSave(store: KeyValueStore, save: SaveGame): boolean {
  try {
    store.set(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(store: KeyValueStore): void {
  store.remove(SAVE_KEY);
}
