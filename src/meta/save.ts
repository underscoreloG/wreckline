import type { RivalState, SaveGame, UpgradeKind, UpgradeLevels } from '../shared/contracts';
import { CARS } from '../content/cars';
import { MAX_LEVEL } from '../content/economy';
import { rankOf } from './career';

/** Storage adapter (localStorage in the game, a Map in tests): meta never touches the global. */
export interface KeyValueStore {
  get(k: string): string | null;
  set(k: string, v: string): void;
  remove(k: string): void;
}

/** Kept although saves are now version 2: renaming it would orphan every live career (v1 data migrates on load). */
export const SAVE_KEY = 'wreckline.save.v1';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const KINDS = Object.keys(MAX_LEVEL) as UpgradeKind[];
/** Lines a v1 save does not have; they migrate as level 0. */
const V2_KINDS: readonly UpgradeKind[] = ['fuel', 'spikes'];

function parseUpgrades(v: unknown, version: 1 | 2): UpgradeLevels | null {
  if (!isObj(v)) return null;
  const out = {} as UpgradeLevels;
  for (const kind of KINDS) {
    const level = version === 1 && V2_KINDS.includes(kind) && v[kind] === undefined ? 0 : v[kind];
    if (!Number.isInteger(level) || (level as number) < 0 || (level as number) > MAX_LEVEL[kind]) return null;
    out[kind] = level as number;
  }
  return out;
}

function parseSabotage(v: unknown): SaveGame['sabotage'] | undefined {
  if (v === null) return null;
  if (!isObj(v) || !isStr(v.offerId) || !isNum(v.pct) || !isNum(v.price)) return undefined;
  return { offerId: v.offerId, pct: v.pct, price: v.price };
}

function parseRival(v: unknown): RivalState | null {
  if (!isObj(v)) return null;
  const { driverId, name, color, carDefId, skill, points } = v;
  if (!isStr(driverId) || !isStr(name) || !isStr(color) || !isStr(carDefId) || !Object.hasOwn(CARS, carDefId) || !isNum(skill) || !isNum(points)) return null;
  return { driverId, name, color, carDefId, skill, points };
}

/** Shape and version check; returns a clean v2 copy with only the known fields, or null. v1 saves migrate (CCR-5, CCR-6). */
export function parseSave(v: unknown): SaveGame | null {
  if (!isObj(v) || (v.version !== 1 && v.version !== 2)) return null;
  const version = v.version;
  const { cash, carDefId, hp, mines, turbo, points, racesRun, wins, championWon, rngState } = v;
  if (![cash, hp, mines, turbo, points, racesRun, wins, rngState].every(isNum)) return null;
  if (!isStr(carDefId) || !Object.hasOwn(CARS, carDefId) || typeof championWon !== 'boolean') return null;
  const upgrades = parseUpgrades(v.upgrades, version);
  if (!upgrades || !Array.isArray(v.rivals)) return null;
  const rivals = v.rivals.map(parseRival);
  if (rivals.some((r) => r === null)) return null;
  const save: SaveGame = {
    version: 2,
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
    bestRank: 0,
    wrecks: 0,
    cashEarned: 0,
    sabotage: null,
    rngState: (rngState as number) >>> 0,
  };
  // v1 -> v2: no career totals yet, nothing pending, best rank = the current one.
  if (version === 1) return { ...save, bestRank: rankOf(save) };
  const { bestRank, wrecks, cashEarned } = v;
  const sabotage = parseSabotage(v.sabotage);
  if (!isNum(bestRank) || !isNum(wrecks) || !isNum(cashEarned) || sabotage === undefined) return null;
  return { ...save, bestRank, wrecks, cashEarned, sabotage };
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
