import { describe, expect, it } from 'vitest';
import type { RaceResult, SaveGame } from '../shared/contracts';
import { TRACKS_AT_START } from '../content/economy';
import { TRACKS } from '../content/tracks';
import { applyRaceResult, generateOffers, newCareer, newlyUnlocked, rankOf, unlockedTrackIds } from './career';

const IDS = Array.from({ length: 10 }, (_, i) => `t${i}`);
const at = (bestRank: number, patch: Partial<SaveGame> = {}): SaveGame => ({ ...newCareer(2), bestRank, ...patch });

describe('track unlocks (content.md section 11)', () => {
  it('all 10 from the first race at every rank (user decision 2026-10-26), in list order', () => {
    expect(TRACKS_AT_START).toBe(10);
    const count = (r: number) => unlockedTrackIds(at(r), IDS).length;
    expect([20, 19, 18, 12, 6, 1].map(count)).toEqual([10, 10, 10, 10, 10, 10]);
    expect(unlockedTrackIds(at(20), IDS)).toEqual(IDS);
    // Default: the registry, whatever its size (up to the 10-track cap).
    expect(unlockedTrackIds(newCareer(1))).toEqual(Object.keys(TRACKS).slice(0, 10));
  });

  it('a new career gets offers on more than 3 different tracks over its first rounds', () => {
    const save = newCareer(3);
    const seen = new Set<string>();
    for (let racesRun = 0; racesRun < 4; racesRun++) for (const o of generateOffers({ ...save, racesRun }).offers) seen.add(o.trackId);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('offers only use unlocked ids and rotate over them', () => {
    for (const bestRank of [20, 18, 12, 6, 1]) {
      const unlocked = unlockedTrackIds(at(bestRank), IDS);
      for (let racesRun = 0; racesRun < 12; racesRun++) {
        const { offers } = generateOffers(at(bestRank, { racesRun, points: 23 }), IDS);
        expect(offers.map((o) => o.trackId)).toEqual([0, 1, 2].map((t) => unlocked[(racesRun + t) % unlocked.length]));
      }
    }
  });

  it('newlyUnlocked: nothing is ever added, so no "New track" message fires', () => {
    expect(newlyUnlocked(at(19), at(18), IDS)).toEqual([]);
    expect(newlyUnlocked(at(20), at(1), IDS)).toEqual([]);
  });

  it('bestRank follows the rank after every race and never gets worse', () => {
    const row = (driverId: string, car: number, position: number) => ({
      car,
      driverId,
      name: driverId,
      position,
      finished: true,
      wrecked: false,
      totalTime: 1,
      bestLap: 1,
      wrecksCaused: car === 0 ? 2 : 0,
      cashPicked: 0,
      hpLeft: 50,
      minesLeft: 0,
      turboLeft: 0,
    });
    const play = (save: SaveGame, playerPos: number) => {
      const g = generateOffers(save);
      const offer = g.offers[1];
      const order = [...offer.rivals];
      order.splice(playerPos - 1, 0, 'player');
      const result: RaceResult = { trackId: offer.trackId, laps: offer.laps, rows: order.map((d, i) => row(d, d === 'player' ? 0 : i + 1, i + 1)) };
      return applyRaceResult(g.save, offer, result).save;
    };
    const won = play({ ...newCareer(5), points: 23 }, 1);
    expect(won.bestRank).toBe(Math.min(20, rankOf(won)));
    expect(won.bestRank).toBeLessThan(20);
    expect(won.wrecks).toBe(2);
    const slump = play({ ...newCareer(5), bestRank: 2 }, 4);
    expect(rankOf(slump)).toBeGreaterThan(2);
    expect(slump.bestRank).toBe(2);
  });
});
