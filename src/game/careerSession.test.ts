import { describe, expect, it } from 'vitest';
import { getCar } from '../content/cars';
import { computeStats, repairCost, upgradeCost } from '../content/economy';
import { loadSave, SAVE_KEY, type KeyValueStore } from '../meta/save';
import type { RaceResult, RaceSetup, SaveGame } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';
import { createFakeSim } from '../sim';
import { affordableRepairHp, partialRepairHp } from '../meta/shop';
import { createCareerSession, createTally, dnfResult, REPAIR_FIRST, tallyEvent, TOWED, unlockText } from './careerSession';
import { TRACKS_AT_START } from '../content/economy';
import { getTrack, TRACKS } from '../content/tracks';
import { sabotageTarget, unlockedTrackIds } from '../meta/career';

function memoryStorage(failWrites = false): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      if (failWrites) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    remove: (k) => void map.delete(k),
  };
}

/** Writes `patch` over a fresh career straight into storage, then continues it. */
function careerWith(patch: Partial<SaveGame>) {
  const storage = memoryStorage();
  const seed = createCareerSession(storage);
  seed.newCareer(42);
  storage.set(SAVE_KEY, JSON.stringify({ ...seed.save, ...patch }));
  const notices: string[] = [];
  const career = createCareerSession(storage, (text) => notices.push(text));
  expect(career.continueCareer()).toBe(true);
  return { career, storage, notices };
}

/** Every entrant finished, in entrant order unless the player is moved to `playerPos`. */
function resultFor(setup: RaceSetup, playerPos: number): RaceResult {
  const order = setup.entrants.map((e) => e.id).filter((id) => id !== PLAYER_CAR_ID);
  order.splice(playerPos - 1, 0, PLAYER_CAR_ID);
  return {
    trackId: setup.track.id,
    laps: setup.laps,
    rows: order.map((id, i) => {
      const e = setup.entrants[id]!;
      return { car: id, driverId: e.driverId, name: e.name, position: i + 1, finished: true, wrecked: false, totalTime: 100 + i, bestLap: 30, wrecksCaused: 0, cashPicked: 0, hpLeft: e.hp, minesLeft: e.mines, turboLeft: e.turbo };
    }),
  };
}

describe('career session', () => {
  it('starts a career, persists it, and a new session continues it', () => {
    const storage = memoryStorage();
    const a = createCareerSession(storage);
    expect(a.save).toBeNull();
    expect(a.continueCareer()).toBe(false);
    a.newCareer(7);
    expect(a.lastWriteOk).toBe(true);
    const b = createCareerSession(storage);
    expect(b.save).toEqual(a.save);
    expect(b.continueCareer()).toBe(true);
  });

  it('buy flow: cash drops by the upgrade cost, the save persists, failures change nothing', () => {
    const { career, storage } = careerWith({});
    const before = career.save!;
    const cost = upgradeCost(getCar(before.carDefId), 'engine', 1);
    expect(career.shop({ type: 'buyUpgrade', kind: 'engine' })).toEqual({ ok: true });
    expect(career.save!.cash).toBe(before.cash - cost);
    expect(loadSave(storage)!.upgrades.engine).toBe(1);
    expect(loadSave(storage)!.cash).toBe(before.cash - cost);

    const broke = careerWith({ cash: 0 });
    const stored = broke.storage.get(SAVE_KEY);
    expect(broke.career.shop({ type: 'buyUpgrade', kind: 'gun' })).toEqual({ ok: false, error: 'Not enough cash' });
    expect(broke.storage.get(SAVE_KEY)).toBe(stored);

    const maxed = careerWith({ cash: 1e6, upgrades: { engine: 5, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 } });
    expect(maxed.career.shop({ type: 'buyUpgrade', kind: 'engine' })).toEqual({ ok: false, error: 'Maxed out' });
    expect(maxed.career.shop({ type: 'buyMines', count: 1 })).toEqual({ ok: true });
    expect(maxed.career.shop({ type: 'buyTurbo', seconds: 1 })).toEqual({ ok: true });
  });

  it('reports a refused write without throwing', () => {
    const career = createCareerSession(memoryStorage(true));
    career.newCareer(1);
    expect(career.lastWriteOk).toBe(false);
    expect(career.save).not.toBeNull();
  });

  it('repair gating: a wrecked car cannot race until repaired', () => {
    const { career } = careerWith({ hp: 0, cash: 5000 });
    const offers = career.ensureOffers();
    expect(career.selectOffer(offers[0]!.id, 1)).toEqual({ ok: false, error: REPAIR_FIRST });

    const car = getCar(career.save!.carDefId);
    const maxHp = computeStats(car, career.save!.upgrades).maxHp;
    expect(career.shop({ type: 'repair', amount: 'full' })).toEqual({ ok: true });
    expect(career.save!.hp).toBe(maxHp);
    expect(career.save!.cash).toBe(5000 - repairCost(car, maxHp));
    expect(career.shop({ type: 'repair', amount: 'full' })).toEqual({ ok: false, error: 'Car already repaired' });

    const r = career.selectOffer(offers[0]!.id, 1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.setup.entrants[PLAYER_CAR_ID]!.hp).toBe(maxHp);
  });

  it('keeps the round offers until a race is run, then rolls new ones', () => {
    const { career } = careerWith({});
    const offers = career.ensureOffers();
    expect(career.ensureOffers()).toBe(offers);
    const r = career.selectOffer(offers[1]!.id, 3);
    if (!r.ok) throw new Error(r.error);
    const { payout, champion } = career.finishRace(resultFor(r.setup, 1));
    expect(payout.prize).toBe(offers[1]!.prizes[0]);
    expect(champion).toBe(false);
    expect(career.offers).toBeNull();
    expect(career.ensureOffers()).not.toBe(offers);
  });

  it('quit = DNF: no prize, no points, the race still counts and is saved', () => {
    const { career, storage } = careerWith({});
    const before = career.save!;
    const offer = career.ensureOffers()[0]!;
    const r = career.selectOffer(offer.id, 9);
    if (!r.ok) throw new Error(r.error);
    const sim = createFakeSim(r.setup);
    const tally = createTally(r.setup.entrants.length);
    for (let i = 0; i < 1200; i++) for (const e of sim.step(new Map())) tallyEvent(tally, e);
    expect(sim.result()).toBeNull();

    const dnf = dnfResult(r.setup, sim.snapshot(), tally, null);
    const player = dnf.rows.find((x) => x.car === PLAYER_CAR_ID)!;
    expect(player.finished).toBe(false);
    expect(dnf.rows.map((x) => x.position)).toEqual(dnf.rows.map((_, i) => i + 1));

    const { payout } = career.finishRace(dnf);
    expect(payout.prize).toBe(0);
    expect(payout.pointsGained).toBe(0);
    const saved = loadSave(storage)!;
    expect(saved.racesRun).toBe(before.racesRun + 1);
    expect(saved.points).toBe(before.points);
    expect(saved.cash).toBe(before.cash + payout.total);
  });

  it('a DNF ignores a finished sim result for the player row', () => {
    const { career } = careerWith({});
    const offer = career.ensureOffers()[0]!;
    const r = career.selectOffer(offer.id, 9);
    if (!r.ok) throw new Error(r.error);
    const won = resultFor(r.setup, 1);
    const dnf = dnfResult(r.setup, createFakeSim(r.setup).snapshot(), createTally(4), won);
    expect(career.finishRace(dnf).payout.prize).toBe(0);
  });

  it('winning the boss race reports the title once', () => {
    const { career } = careerWith({ points: 10_000 });
    const boss = career.ensureOffers().find((o) => o.tier === 'boss');
    expect(boss).toBeDefined();
    const r = career.selectOffer(boss!.id, 5);
    if (!r.ok) throw new Error(r.error);
    expect(career.finishRace(resultFor(r.setup, 1)).champion).toBe(true);
    expect(career.save!.championWon).toBe(true);

    const again = career.ensureOffers().find((o) => o.tier === 'boss')!;
    const r2 = career.selectOffer(again.id, 6);
    if (!r2.ok) throw new Error(r2.error);
    expect(career.finishRace(resultFor(r2.setup, 1)).champion).toBe(false);
  });

  it('free tow: a wrecked player with no cash is towed on load and can race again', () => {
    const { career, storage, notices } = careerWith({ hp: 0, cash: 0 });
    expect(notices).toEqual([TOWED]);
    expect(career.save).toMatchObject({ hp: 30, cash: 0 });
    expect(loadSave(storage)!.hp).toBe(30);

    const offer = career.ensureOffers()[0]!;
    const r = career.selectOffer(offer.id, 1);
    if (!r.ok) throw new Error(r.error);
    expect(r.setup.entrants[PLAYER_CAR_ID]!.hp).toBe(30);

    // Wrecked again, last place, nothing earned: towed right after the race result.
    const res = resultFor(r.setup, 4);
    const lost = { ...res, rows: res.rows.map((x) => (x.car === PLAYER_CAR_ID ? { ...x, finished: false, wrecked: true, totalTime: null, hpLeft: 0 } : x)) };
    expect(career.finishRace(lost).payout.total).toBe(0);
    expect(career.save).toMatchObject({ hp: 30, cash: 0 });
    expect(loadSave(storage)!.hp).toBe(30);
    expect(notices).toEqual([TOWED, TOWED]);
  });

  it('free tow after a shop action that leaves a wrecked car unrepairable; no tow while 30% is affordable', () => {
    const { career, notices } = careerWith({ hp: 0, cash: 130 });
    expect(notices).toEqual([]);
    expect(career.save!.hp).toBe(0);
    expect(career.shop({ type: 'buyMines', count: 1 })).toEqual({ ok: true });
    expect(career.save).toMatchObject({ hp: 30, cash: 70 });
    expect(notices).toEqual([TOWED]);
  });

  it('partial repairs: +25% and MAX charge the right amounts', () => {
    const { career, storage } = careerWith({ hp: 64, cash: 90 });
    const quarter = partialRepairHp(career.save!);
    expect(quarter).toBe(25);
    expect(career.shop({ type: 'repair', amount: quarter })).toEqual({ ok: false, error: 'Not enough cash' });
    const max = affordableRepairHp(career.save!);
    expect(max).toBe(22);
    expect(career.shop({ type: 'repair', amount: max })).toEqual({ ok: true });
    expect(career.save).toMatchObject({ hp: 86, cash: 2 });
    expect(loadSave(storage)).toMatchObject({ hp: 86, cash: 2 });

    const rich = careerWith({ hp: 64, cash: 1000 }).career;
    expect(rich.shop({ type: 'repair', amount: partialRepairHp(rich.save!) })).toEqual({ ok: true });
    expect(rich.save).toMatchObject({ hp: 89, cash: 900 });
  });

  it('sabotage flow: buy for the selected offer, refused while one is pending, persisted, applied, cleared after the race', () => {
    const { career, storage } = careerWith({ cash: 5000 });
    const [a, b] = career.ensureOffers();
    if (!a || !b) throw new Error('need two offers');
    expect(career.selectOffer(a.id, 1).ok).toBe(true);

    const bought = career.buySabotage();
    if (!bought.ok) throw new Error(bought.error);
    const sab = career.save!.sabotage!;
    expect(sab).toEqual({ offerId: a.id, pct: bought.pct, price: a.sabotagePrice });
    expect(bought.pct).toBeGreaterThanOrEqual(25);
    expect(bought.pct).toBeLessThanOrEqual(49);
    expect(bought.target).toBe(sabotageTarget(career.save!, a).name);
    expect(career.save!.cash).toBe(5000 - a.sabotagePrice);
    expect(loadSave(storage)!.sabotage).toEqual(sab);

    // Refused twice: again for the same offer, then for another offer; nothing changes.
    const pending = { ok: false, error: 'Sabotage already bought for another race' };
    expect(career.buySabotage()).toEqual(pending);
    expect(career.selectOffer(b.id, 1).ok).toBe(true);
    expect(career.buySabotage()).toEqual(pending);
    expect(career.save!.cash).toBe(5000 - a.sabotagePrice);
    expect(loadSave(storage)!.sabotage).toEqual(sab);

    // The setup rebuilt after the purchase starts the target damaged.
    const r = career.selectOffer(a.id, 1);
    if (!r.ok) throw new Error(r.error);
    const target = r.setup.entrants.find((e) => e.name === bought.target)!;
    expect(target.hp).toBe(Math.round(target.stats.maxHp * (1 - sab.pct / 100)));

    career.finishRace(resultFor(r.setup, 2));
    expect(career.save!.sabotage).toBeNull();
    expect(loadSave(storage)!.sabotage).toBeNull();
  });

  it('sabotage refused without the cash or a selected offer', () => {
    const poor = careerWith({ cash: 0 }).career;
    expect(poor.buySabotage()).toEqual({ ok: false, error: 'Offer not available' });
    const offer = poor.ensureOffers()[0]!;
    expect(poor.selectOffer(offer.id, 1).ok).toBe(true);
    expect(poor.buySabotage()).toEqual({ ok: false, error: 'Not enough cash' });
    expect(poor.save!.sabotage).toBeNull();
  });

  it('finishRace reports the tracks the race unlocked (none pinned: derived from TRACKS)', () => {
    const { career } = careerWith({ points: 100000, bestRank: 20 });
    const offer = career.ensureOffers()[0]!;
    const r = career.selectOffer(offer.id, 1);
    if (!r.ok) throw new Error(r.error);
    const { unlocked } = career.finishRace(resultFor(r.setup, 1));
    expect(career.save!.bestRank).toBe(1);
    expect(unlocked).toEqual(unlockedTrackIds(career.save!).slice(TRACKS_AT_START));
  });

  it('unlock message: one track, then several', () => {
    const ids = Object.keys(TRACKS);
    expect(unlockText(ids.slice(0, 1))).toBe(`New track: ${getTrack(ids[0]!).name}`);
    expect(unlockText(ids.slice(0, 2))).toBe(`New tracks: ${getTrack(ids[0]!).name}, ${getTrack(ids[1]!).name}`);
  });
});
