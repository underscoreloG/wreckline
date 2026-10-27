import { getCar } from '../content/cars';
import { BEATEN_DISCOUNT } from '../content/economy';
import { PICKUP_CASH_UNITS } from '../content/pickups';
import { getTrack } from '../content/tracks';
import { applyRaceResult, buildCareerRaceSetup, generateOffers, newCareer, newlyBeaten, newlyUnlocked, sabotageTarget } from '../meta/career';
import { loadSave, writeSave, type KeyValueStore } from '../meta/save';
import { buyCar, buyMines, buySabotage, buyTurbo, buyUpgrade, freeTowIfStuck, LOCKED_TEXT, repair, type ShopFail, type ShopResult } from '../meta/shop';
import { endingScene, storySceneFor, withSceneSeen } from '../meta/story';
import type { GameCommand, Payout, RaceOffer, RaceResult, RaceResultRow, RaceSetup, RaceSnapshot, SaveGame, SimEvent, StoryScene } from '../shared/contracts';
import { PLAYER_CAR_ID } from '../shared/contracts';

export type ShopCommand = Extract<GameCommand, { type: 'buyUpgrade' | 'buyCar' | 'repair' | 'buyMines' | 'buyTurbo' }>;
export type CareerOutcome = { ok: true } | { ok: false; error: string };

export const REPAIR_FIRST = 'Repair your car first';
export const TOWED = 'Towed: free repair to 30%';

const FAIL_TEXT: Record<ShopFail, string> = {
  cash: 'Not enough cash',
  max: 'Maxed out',
  owned: 'Already owned',
  invalid: 'Not available',
  pending: 'Sabotage already bought for another race',
  locked: LOCKED_TEXT,
};

/**
 * Holds the career save, calls the WP09 functions and persists after every change.
 * After a race result, a shop action and on career load a stuck player gets the free tow (WP18):
 * the towed save is persisted and `notify(TOWED)` is called for the info toast.
 */
export interface CareerSession {
  /** The current career, or the stored one before it is continued (title CONTINUE). */
  readonly save: SaveGame | null;
  /** This round's offers, kept until a race is run. */
  readonly offers: RaceOffer[] | null;
  readonly selected: RaceOffer | null;
  /** false when the last write was refused (quota, private mode). */
  readonly lastWriteOk: boolean;
  newCareer(seed: number): void;
  /** Reloads the stored save; false when there is none (or it is corrupt). */
  continueCareer(): boolean;
  /** Generates the round's offers once, then returns the same ones until a race is run. */
  ensureOffers(): RaceOffer[];
  selectOffer(offerId: string, seed: number): { ok: true; setup: RaceSetup } | { ok: false; error: string };
  shop(cmd: ShopCommand): CareerOutcome;
  /** Buys a sabotage for the selected offer and persists; the caller rebuilds the race setup (selectOffer) so it applies. */
  buySabotage(): { ok: true; target: string; pct: number } | { ok: false; error: string };
  /**
   * Applies the selected offer's result; `champion` is true when this race just won the title,
   * `unlocked` lists the track ids this race unlocked (for the one-time "New track" message),
   * `beaten` the car types it beat for the first time, minus the starter and the player's own (one hub message each, CCR-10).
   */
  finishRace(result: RaceResult): { payout: Payout; champion: boolean; unlocked: string[]; beaten: string[] };
  /** The story scene before the selected offer's race (CCR-12), stored as seen and persisted as it is shown. */
  playStory(): StoryScene;
  /** The ending scene after the title win, stored as seen and persisted; null when there is none to play. */
  playEnding(): StoryScene | null;
}

export function createCareerSession(storage: KeyValueStore, notify: (text: string) => void = () => {}): CareerSession {
  let save = loadSave(storage);
  let offers: RaceOffer[] | null = null;
  let selected: RaceOffer | null = null;
  let lastWriteOk = true;

  const persist = (next: SaveGame): void => {
    save = next;
    lastWriteOk = writeSave(storage, next);
  };
  /** Persists `next`, or its towed version when the player is stuck. */
  const persistChecked = (next: SaveGame): void => {
    const t = freeTowIfStuck(next);
    persist(t.save);
    if (t.towed) notify(TOWED);
  };
  const shopFn = (s: SaveGame, cmd: ShopCommand): ShopResult => {
    switch (cmd.type) {
      case 'buyUpgrade':
        return buyUpgrade(s, cmd.kind);
      case 'buyCar':
        return buyCar(s, cmd.carDefId);
      case 'repair':
        return repair(s, cmd.amount === 'full' ? Infinity : cmd.amount);
      case 'buyMines':
        return buyMines(s, cmd.count);
      case 'buyTurbo':
        return buyTurbo(s, cmd.seconds);
    }
  };

  return {
    get save() {
      return save;
    },
    get offers() {
      return offers;
    },
    get selected() {
      return selected;
    },
    get lastWriteOk() {
      return lastWriteOk;
    },
    newCareer(seed) {
      offers = null;
      selected = null;
      persist(newCareer(seed));
    },
    continueCareer() {
      const s = loadSave(storage);
      if (!s) return false;
      save = s;
      offers = null;
      selected = null;
      lastWriteOk = true;
      if (freeTowIfStuck(s).towed) persistChecked(s);
      return true;
    },
    ensureOffers() {
      if (!save) throw new Error('no career in progress');
      if (!offers) {
        const g = generateOffers(save);
        offers = g.offers;
        persist(g.save);
      }
      return offers;
    },
    selectOffer(offerId, seed) {
      const offer = offers?.find((o) => o.id === offerId);
      if (!save || !offer) return { ok: false, error: 'Offer not available' };
      if (save.hp <= 0) return { ok: false, error: REPAIR_FIRST };
      selected = offer;
      return { ok: true, setup: buildCareerRaceSetup(save, offer, seed) };
    },
    shop(cmd) {
      if (!save) return { ok: false, error: 'No career in progress' };
      const r = shopFn(save, cmd);
      if (!r.ok) return { ok: false, error: cmd.type === 'repair' && r.reason === 'max' ? 'Car already repaired' : FAIL_TEXT[r.reason] };
      persistChecked(r.save);
      return { ok: true };
    },
    buySabotage() {
      if (!save || !selected) return { ok: false, error: 'Offer not available' };
      const r = buySabotage(save, selected);
      if (!r.ok) return { ok: false, error: FAIL_TEXT[r.reason] };
      persist(r.save);
      return { ok: true, target: sabotageTarget(r.save, selected).name, pct: r.save.sabotage?.pct ?? 0 };
    },
    finishRace(result) {
      if (!save || !selected) throw new Error('no career race in progress');
      const before = save;
      const r = applyRaceResult(save, selected, result);
      offers = null;
      selected = null;
      persistChecked(r.save);
      return { payout: r.payout, champion: !before.championWon && r.save.championWon, unlocked: newlyUnlocked(before, r.save), beaten: newlyBeaten(before, r.save) };
    },
    playStory() {
      if (!save || !selected) throw new Error('no career race selected');
      const scene = storySceneFor(save, selected);
      const next = withSceneSeen(save, scene.id);
      if (next !== save) persist(next);
      return scene;
    },
    playEnding() {
      const scene = save && endingScene(save);
      if (!save || !scene) return null;
      persist(withSceneSeen(save, scene.id));
      return scene;
    },
  };
}

/** "New track: Dust Bowl", or "New tracks: A, B" for several (career hub, once). */
export function unlockText(trackIds: readonly string[]): string {
  const names = trackIds.map((id) => getTrack(id).name);
  return `New track${names.length > 1 ? 's' : ''}: ${names.join(', ')}`;
}

/** Hub message for a newly beaten car type (CCR-10): a locked car is now listed, a forSale one is discounted. */
export function beatenText(carDefId: string): string {
  const car = getCar(carDefId);
  const name = car.name.toUpperCase();
  return car.forSale ? `${name} now ${Math.round(BEATEN_DISCOUNT * 100)}% off in the shop` : `Unlocked in shop: ${name}`;
}

/** Per-car wreck credits and cash pickups seen in the event stream, for a race quit before the sim built a result. */
export interface RaceTally {
  wrecksCaused: number[];
  cashPicked: number[];
}

export function createTally(cars: number): RaceTally {
  return { wrecksCaused: new Array<number>(cars).fill(0), cashPicked: new Array<number>(cars).fill(0) };
}

/** Same credit rules as the sim: carWrecked.by gets the wreck, a cash pickup adds PICKUP_CASH_UNITS. */
export function tallyEvent(t: RaceTally, e: SimEvent): void {
  if (e.type === 'carWrecked' && e.by !== null) t.wrecksCaused[e.by] = (t.wrecksCaused[e.by] ?? 0) + 1;
  else if (e.type === 'pickupCollected' && e.kind === 'cash') t.cashPicked[e.car] = (t.cashPicked[e.car] ?? 0) + PICKUP_CASH_UNITS;
}

/**
 * Quitting a career race counts as a DNF (WP10): the sim's own result when it has one, else the live
 * order from the snapshot, with the player row forced to finished: false (prize 0, no points).
 */
export function dnfResult(setup: RaceSetup, snap: RaceSnapshot, tally: RaceTally, simResult: RaceResult | null): RaceResult {
  const rows: RaceResultRow[] =
    simResult?.rows ??
    [...snap.cars]
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        car: c.id,
        driverId: setup.entrants[c.id]?.driverId ?? '',
        name: setup.entrants[c.id]?.name ?? '',
        position: c.position,
        finished: c.finished,
        wrecked: c.wrecked,
        totalTime: c.finished ? c.finishTime : null,
        bestLap: c.bestLapTime,
        wrecksCaused: tally.wrecksCaused[c.id] ?? 0,
        cashPicked: tally.cashPicked[c.id] ?? 0,
        hpLeft: Math.max(0, c.hp),
        minesLeft: c.mines,
        turboLeft: c.turbo,
      }));
  return {
    trackId: setup.track.id,
    laps: setup.laps,
    rows: rows.map((r) => (r.car === PLAYER_CAR_ID ? { ...r, finished: false, totalTime: null } : r)),
  };
}
