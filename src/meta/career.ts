import type { EntrantSetup, Payout, RaceOffer, RaceResult, RaceSetup, RaceTier, RivalState, SaveGame } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';
import { createRng, type Rng } from '../shared/rng';
import { BOSS_MAX_SPEED_MULT, profileForSkill } from '../content/ai';
import { getCar, STARTER_CAR_ID } from '../content/cars';
import {
  CAREER_TIERS,
  computeStats,
  RANKS_PER_UNLOCK,
  SABOTAGE_PRICE_FRACTION,
  STARTING_CAREER,
  TIER_TRACK_INDEX,
  TRACKS_AT_START,
} from '../content/economy';
import { PLAYER_LIVERY } from '../content/liveries';
import { COUNTDOWN_SECONDS } from '../content/race';
import { BOSS, initialRivalPoints, RIVALS, rivalSpikesLevel, rivalUpgradeLevel } from '../content/rivals';
import { getTrack, TRACKS } from '../content/tracks';
import { simulateOtherRivals } from './offSim';

export const PLAYER_DRIVER_ID = 'player';
export const PLAYER_NAME = 'YOU';

/** Every AI entrant in a career race starts with this loadout (WP09). */
export const RIVAL_LOADOUT = { mines: 2, turbo: 3 } as const;

/** Offer brackets, content.md section 11: ranks around the player, the top of the ladder, and the bottom fallback. */
const EASY_FALLBACK_BOTTOM = 6;
const MEDIUM_RANK_WINDOW = 5;
const HARD_TOP_RANKS = 6;
const BOSS_TOP_RANKS = 3;
const OFFER_RIVALS = 3;
/** The rank every career starts at (player + 19 rivals), and the most tracks a career can unlock (content.md section 11). */
const START_RANK = RIVALS.length + 1;
const MAX_UNLOCKED_TRACKS = 10;

export interface LadderRow {
  driverId: string;
  name: string;
  points: number;
  carDefId: string;
  isPlayer: boolean;
}

export function newCareer(seed: number): SaveGame {
  return {
    version: 3,
    cash: STARTING_CAREER.cash,
    carDefId: STARTING_CAREER.carDefId,
    upgrades: { ...STARTING_CAREER.upgrades },
    hp: STARTING_CAREER.hp,
    mines: STARTING_CAREER.mines,
    turbo: STARTING_CAREER.turbo,
    points: 0,
    racesRun: 0,
    wins: 0,
    rivals: RIVALS.map((r) => ({ driverId: r.driverId, name: r.name, color: r.color, carDefId: r.carDefId, skill: r.skill, points: initialRivalPoints(r.skill) })),
    championWon: false,
    bestRank: START_RANK,
    wrecks: 0,
    cashEarned: 0,
    sabotage: null,
    rngState: seed >>> 0,
    beatenCars: [],
  };
}

/** Rivals by points desc; equal points: higher skill first, then driverId, so the order is total. */
function rankedRivals(save: SaveGame): RivalState[] {
  return [...save.rivals].sort((a, b) => b.points - a.points || b.skill - a.skill || a.driverId.localeCompare(b.driverId));
}

/** 1-based among player + rivals; the player ranks below every rival with equal points. */
export function rankOf(save: SaveGame): number {
  return 1 + save.rivals.filter((r) => r.points >= save.points).length;
}

export function ladder(save: SaveGame): LadderRow[] {
  const rows: LadderRow[] = rankedRivals(save).map((r) => ({ driverId: r.driverId, name: r.name, points: r.points, carDefId: r.carDefId, isPlayer: false }));
  rows.splice(rankOf(save) - 1, 0, { driverId: PLAYER_DRIVER_ID, name: PLAYER_NAME, points: save.points, carDefId: save.carDefId, isPlayer: true });
  return rows;
}

interface RankedRival {
  rival: RivalState;
  rank: number;
}

/** Tops `pool` up to n with the rivals ranked nearest to `anchor`, for brackets that hold fewer than n. */
function fillNearest(pool: RankedRival[], all: RankedRival[], n: number, anchor: number): RankedRival[] {
  if (pool.length >= n) return pool;
  const rest = all.filter((x) => !pool.includes(x)).sort((a, b) => Math.abs(a.rank - anchor) - Math.abs(b.rank - anchor) || a.rank - b.rank);
  return [...pool, ...rest.slice(0, n - pool.length)];
}

function pickRandom<T>(pool: readonly T[], n: number, rng: Rng): T[] {
  const a = [...pool];
  for (let i = 0; i < n && i < a.length; i++) {
    const j = rng.int(i, a.length - 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function makeOffer(save: SaveGame, tier: RaceTier, rivals: string[], trackIds: readonly string[]): RaceOffer {
  const t = CAREER_TIERS[tier];
  return {
    id: `${save.racesRun}-${tier}`,
    tier,
    trackId: trackIds[(save.racesRun + TIER_TRACK_INDEX[tier]) % trackIds.length],
    laps: t.laps,
    rivals,
    prizes: [...t.prizes],
    sabotagePrice: Math.round(SABOTAGE_PRICE_FRACTION * t.prizes[0]),
    points: [...t.points],
  };
}

/** The first min(10, 3 + floor((20 - bestRank) / 2)) of `trackIds`, in order (content.md section 11). */
export function unlockedTrackIds(save: SaveGame, trackIds: readonly string[] = Object.keys(TRACKS)): string[] {
  const n = Math.min(MAX_UNLOCKED_TRACKS, TRACKS_AT_START + Math.floor((START_RANK - save.bestRank) / RANKS_PER_UNLOCK));
  return trackIds.slice(0, n);
}

/** Tracks unlocked in `after` but not in `before`, for the one-time "New track" message. */
export function newlyUnlocked(before: SaveGame, after: SaveGame, trackIds: readonly string[] = Object.keys(TRACKS)): string[] {
  const had = unlockedTrackIds(before, trackIds);
  return unlockedTrackIds(after, trackIds).filter((id) => !had.includes(id));
}

/** Easy, medium, then hard (boss instead at rank 1), rotating over the unlocked tracks. `trackIds` is a parameter so tests can inject any list. */
export function generateOffers(save: SaveGame, allTrackIds: readonly string[] = Object.keys(TRACKS)): { offers: RaceOffer[]; save: SaveGame } {
  const trackIds = unlockedTrackIds(save, allTrackIds);
  if (trackIds.length === 0) throw new Error('generateOffers needs at least one track');
  const rng = createRng(save.rngState);
  const player = rankOf(save);
  // Ladder ranks of the rivals, counting the player's slot.
  const all: RankedRival[] = rankedRivals(save).map((rival, i) => ({ rival, rank: i + 1 >= player ? i + 2 : i + 1 }));
  const ids = (xs: RankedRival[]): string[] => xs.map((x) => x.rival.driverId);

  const below = all.filter((x) => x.rank > player);
  const easyPool = below.length >= OFFER_RIVALS ? below : all.slice(-EASY_FALLBACK_BOTTOM);
  const easy = [...easyPool].sort((a, b) => a.rival.skill - b.rival.skill || a.rank - b.rank).slice(0, OFFER_RIVALS);

  const mediumPool = fillNearest(
    all.filter((x) => Math.abs(x.rank - player) <= MEDIUM_RANK_WINDOW),
    all,
    OFFER_RIVALS,
    player,
  );
  const medium = pickRandom(mediumPool, OFFER_RIVALS, rng);

  const offers = [makeOffer(save, 'easy', ids(easy), trackIds), makeOffer(save, 'medium', ids(medium), trackIds)];
  if (player === 1) {
    const top = fillNearest(
      all.filter((x) => x.rank <= BOSS_TOP_RANKS),
      all,
      OFFER_RIVALS - 1,
      1,
    );
    offers.push(makeOffer(save, 'boss', [BOSS.driverId, ...ids(pickRandom(top, OFFER_RIVALS - 1, rng))], trackIds));
  } else {
    const top = fillNearest(
      all.filter((x) => x.rank <= HARD_TOP_RANKS),
      all,
      OFFER_RIVALS,
      1,
    );
    offers.push(makeOffer(save, 'hard', ids(pickRandom(top, OFFER_RIVALS, rng)), trackIds));
  }
  return { offers, save: { ...copySave(save), rngState: rng.state() } };
}

/** A copy that shares no nested object with `save`. */
const copySave = (save: SaveGame): SaveGame => ({
  ...save,
  upgrades: { ...save.upgrades },
  rivals: save.rivals.map((r) => ({ ...r })),
  sabotage: save.sabotage && { ...save.sabotage },
  beatenCars: [...save.beatenCars],
});

/** Who a sabotage on this offer hits: THE WARDEN in the boss race, else the offer's rival with the most points (ties: higher skill). */
export function sabotageTarget(save: SaveGame, offer: RaceOffer): { driverId: string; name: string } {
  if (offer.tier === 'boss') return { driverId: BOSS.driverId, name: BOSS.name };
  const inRace = save.rivals.filter((r) => offer.rivals.includes(r.driverId));
  const best = inRace.sort((a, b) => b.points - a.points || b.skill - a.skill)[0];
  if (!best) throw new Error(`offer '${offer.id}' has no rival in the save`);
  return { driverId: best.driverId, name: best.name };
}

function rivalEntrant(id: number, driverId: string, save: SaveGame, tier: RaceTier): EntrantSetup {
  const def = driverId === BOSS.driverId ? BOSS : save.rivals.find((r) => r.driverId === driverId);
  if (!def) throw new Error(`offer rival '${driverId}' is not in the save`);
  const car = getCar(def.carDefId);
  const level = rivalUpgradeLevel(def.skill);
  const spikes = rivalSpikesLevel(def.skill);
  const stats = computeStats(car, { engine: level, tires: level, armor: level, gun: level, fuel: level, spikes });
  if (driverId === BOSS.driverId) stats.maxSpeed *= BOSS_MAX_SPEED_MULT;
  const profile = profileForSkill(def.skill);
  // content.md section 8: hard and boss races never rubber-band.
  if (tier === 'hard' || tier === 'boss') profile.rubberBand = 0;
  return {
    id,
    driverId,
    name: def.name,
    color: def.color,
    carDefId: car.id,
    stats,
    mesh: { ...car.mesh, spikes },
    hp: stats.maxHp,
    mines: RIVAL_LOADOUT.mines,
    turbo: RIVAL_LOADOUT.turbo,
    ai: profile,
  };
}

/** Throws when the player car is wrecked (hp <= 0): the UI must make the player repair first. */
export function buildCareerRaceSetup(save: SaveGame, offer: RaceOffer, seed: number): RaceSetup {
  if (save.hp <= 0) throw new Error('player car has no hp left: repair before racing');
  const car = getCar(save.carDefId);
  const stats = computeStats(car, save.upgrades);
  const player: EntrantSetup = {
    id: PLAYER_CAR_ID,
    driverId: PLAYER_DRIVER_ID,
    name: PLAYER_NAME,
    color: PLAYER_LIVERY,
    carDefId: car.id,
    stats,
    mesh: { ...car.mesh, spikes: save.upgrades.spikes },
    hp: Math.min(save.hp, stats.maxHp),
    mines: save.mines,
    turbo: save.turbo,
    ai: null,
  };
  const rivals = offer.rivals.map((d, i) => rivalEntrant(i + 1, d, save, offer.tier));
  // Sabotage bought for this offer: the target is re-picked here, since offers are rebuilt after a reload.
  const sab = save.sabotage;
  if (sab && sab.offerId === offer.id) {
    const target = rivals.find((e) => e.driverId === sabotageTarget(save, offer).driverId);
    if (target) target.hp = Math.round(target.stats.maxHp * (1 - sab.pct / 100));
  }
  return {
    seed: seed >>> 0,
    track: getTrack(offer.trackId),
    laps: offer.laps,
    entrants: [player, ...rivals],
    countdownSeconds: COUNTDOWN_SECONDS,
  };
}

const pointsFor = (offer: RaceOffer, finished: boolean, position: number): number => (finished ? (offer.points[position - 1] ?? 0) : 0);

/** The car a career driver races (the boss included), or null for an id the save does not know. */
function carOfDriver(save: SaveGame, driverId: string): string | null {
  if (driverId === BOSS.driverId) return BOSS.carDefId;
  return save.rivals.find((r) => r.driverId === driverId)?.carDefId ?? null;
}

/** beatenCars plus the car of every row placed after the player's (CCR-10): a win beats every car type in the race. The caller skips it for a quit race. */
export function beatenAfter(save: SaveGame, result: RaceResult, playerPosition: number): string[] {
  const beaten = [...save.beatenCars];
  for (const r of result.rows) {
    const car = r.position > playerPosition ? carOfDriver(save, r.driverId) : null;
    if (car !== null && !beaten.includes(car)) beaten.push(car);
  }
  return beaten;
}

/** Car types `after` has beaten that `before` had not, minus the starter and the car the player raced: one hub message each (CCR-10). */
export function newlyBeaten(before: SaveGame, after: SaveGame): string[] {
  return after.beatenCars.filter((id) => !before.beatenCars.includes(id) && id !== STARTER_CAR_ID && id !== before.carDefId);
}

export function applyRaceResult(save: SaveGame, offer: RaceOffer, result: RaceResult): { save: SaveGame; payout: Payout } {
  const row = result.rows.find((r) => r.car === PLAYER_CAR_ID);
  if (!row) throw new Error('race result has no player row');
  const tier = CAREER_TIERS[offer.tier];
  const prize = row.finished ? (offer.prizes[row.position - 1] ?? 0) : 0;
  const wreckBonus = row.wrecksCaused * tier.wreckBonus;
  const pickups = row.cashPicked * tier.cashPickupValue;
  const payout: Payout = { prize, wreckBonus, pickups, total: prize + wreckBonus + pickups, pointsGained: pointsFor(offer, row.finished, row.position) };

  const rivals = save.rivals.map((r) => {
    const rr = result.rows.find((x) => x.driverId === r.driverId);
    return rr ? { ...r, points: r.points + pointsFor(offer, rr.finished, rr.position) } : { ...r };
  });
  const won = row.finished && row.position === 1;
  // A sabotage bought for another offer is refunded; either way it is spent after this race.
  const refund = save.sabotage && save.sabotage.offerId !== offer.id ? save.sabotage.price : 0;
  const after: SaveGame = {
    ...copySave(save),
    cash: save.cash + payout.total + refund,
    hp: row.wrecked ? 0 : Math.max(0, row.hpLeft),
    mines: row.minesLeft,
    turbo: row.turboLeft,
    points: save.points + payout.pointsGained,
    racesRun: save.racesRun + 1,
    wins: save.wins + (won ? 1 : 0),
    rivals,
    championWon: save.championWon || (offer.tier === 'boss' && won),
    wrecks: save.wrecks + row.wrecksCaused,
    cashEarned: save.cashEarned + payout.total,
    sabotage: null,
    // A quit or unfinished race (player neither finished nor wrecked) beats nothing, so quitting while ahead unlocks nothing.
    beatenCars: row.finished || row.wrecked ? beatenAfter(save, result, row.position) : [...save.beatenCars],
  };
  const rng = createRng(save.rngState);
  const simulated = { ...simulateOtherRivals(after, offer, rng), rngState: rng.state() };
  return { save: { ...simulated, bestRank: Math.min(save.bestRank, rankOf(simulated)) }, payout };
}
