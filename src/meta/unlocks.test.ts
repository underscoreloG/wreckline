import { describe, expect, it } from 'vitest';
import type { RaceResult, SaveGame } from '../shared/contracts';
import { TRACKS } from '../content/tracks';
import { applyRaceResult, generateOffers, newCareer, newlyUnlocked, rankOf, unlockedTrackIds } from './career';

const IDS = Array.from({ length: 10 }, (_, i) => `t${i}`);
const at = (bestRank: number, patch: Partial<SaveGame> = {}): SaveGame => ({ ...newCareer(2), bestRank, ...patch });

describe('track unlocks (content.md section 11)', () => {
  it('3 at the start, one more every 2 ranks, all 10 by rank 6, in list order', () => {
    const count = (r: number) => unlockedTrackIds(at(r), IDS).length;
    expect([20, 19, 18, 17, 16, 6, 5, 1].map(count)).toEqual([3, 3, 4, 4, 5, 10, 10, 10]);
    expect(unlockedTrackIds(at(18), IDS)).toEqual(['t0', 't1', 't2', 't3']);
    // Default: the registry, whatever its size.
    expect(unlockedTrackIds(newCareer(1))).toEqual(Object.keys(TRACKS).slice(0, 3));
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

  it('newlyUnlocked lists what the second save adds', () => {
    expect(newlyUnlocked(at(19), at(18), IDS)).toEqual(['t3']);
    expect(newlyUnlocked(at(18), at(14), IDS)).toEqual(['t4', 't5']);
    expect(newlyUnlocked(at(18), at(18), IDS)).toEqual([]);
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
