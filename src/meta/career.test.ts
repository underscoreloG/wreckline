import { describe, expect, it } from 'vitest';
import type { RaceOffer, RaceResult, RaceResultRow, SaveGame } from '../shared/contracts';
import { profileForSkill } from '../content/ai';
import { getCar } from '../content/cars';
import { computeStats, OFFER_TRACK_STEP } from '../content/economy';
import { RIVALS } from '../content/rivals';
import { TRACKS } from '../content/tracks';
import { applyRaceResult, buildCareerRaceSetup, generateOffers, ladder, newCareer, newlyBeaten, rankOf } from './career';

const withPoints = (points: number, rngState = 1): SaveGame => ({ ...newCareer(rngState), points });

/** Ladder rank of every driver id (player included). */
const ranks = (save: SaveGame): Map<string, number> => new Map(ladder(save).map((r, i) => [r.driverId, i + 1]));

function row(car: number, driverId: string, position: number, extra: Partial<RaceResultRow> = {}): RaceResultRow {
  return {
    car,
    driverId,
    name: driverId,
    position,
    finished: true,
    wrecked: false,
    totalTime: 100,
    bestLap: 25,
    wrecksCaused: 0,
    cashPicked: 0,
    hpLeft: 50,
    minesLeft: 1,
    turboLeft: 1.5,
    ...extra,
  };
}

const offerOf = (save: SaveGame, tier: RaceOffer['tier']): RaceOffer => {
  const o = generateOffers(save).offers.find((x) => x.tier === tier);
  if (!o) throw new Error(`no ${tier} offer`);
  return o;
};

describe('newCareer (test 1)', () => {
  it('matches content.md', () => {
    const s = newCareer(1);
    expect(s).toMatchObject({ version: 4, cash: 600, carDefId: 'raven', hp: 100, mines: 2, turbo: 3, points: 0, racesRun: 0, wins: 0, championWon: false });
    expect(s).toMatchObject({ bestRank: 20, wrecks: 0, cashEarned: 0, sabotage: null, beatenCars: [], storySeen: [], bossLosses: 0 });
    expect(s.upgrades).toEqual({ engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 });
    expect(s.rivals).toHaveLength(19);
    for (const [i, r] of s.rivals.entries()) expect(r.points).toBe(Math.round(RIVALS[i].skill * 40));
    expect(rankOf(s)).toBe(20);
    expect(ladder(s)[19]).toMatchObject({ driverId: 'player', isPlayer: true, points: 0 });
  });

  it('ties: the player ranks below a rival with equal points', () => {
    const s = withPoints(38); // BANSHEE has 38
    expect(rankOf(s)).toBe(2);
    expect(ladder(s).slice(0, 2).map((r) => r.driverId)).toEqual(['r19', 'player']);
  });
});

describe('offers (test 2)', () => {
  // Points that put the player at ranks 20, 15, 10, 5, 2 and 1.
  const pointsByRank: [number, number][] = [
    [20, 0],
    [15, 13],
    [10, 23],
    [5, 33],
    [2, 38],
    [1, 100],
  ];

  it('easy below the player, medium within +-5, hard in the top 6, boss only at rank 1', () => {
    for (const [rank, points] of pointsByRank) {
      for (let seed = 1; seed <= 20; seed++) {
        const save = withPoints(points, seed);
        expect(rankOf(save)).toBe(rank);
        const rk = ranks(save);
        const { offers } = generateOffers(save);
        expect(offers.map((o) => o.tier)).toEqual(rank === 1 ? ['easy', 'medium', 'boss'] : ['easy', 'medium', 'hard']);
        const [easy, medium, top] = offers;
        for (const o of offers) {
          expect(o.rivals).toHaveLength(3);
          expect(new Set(o.rivals).size).toBe(3);
        }
        // With fewer than 3 rivals below (rank 20), the bottom 6 are the pool.
        for (const d of easy.rivals) expect(rk.get(d)!).toBeGreaterThan(rank === 20 ? 13 : rank);
        for (const d of medium.rivals) expect(Math.abs(rk.get(d)! - rank)).toBeLessThanOrEqual(5);
        if (rank === 1) {
          expect(top.rivals[0]).toBe('boss');
          for (const d of top.rivals.slice(1)) expect(rk.get(d)!).toBeLessThanOrEqual(3);
        } else {
          for (const d of top.rivals) expect(rk.get(d)!).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it('easy takes the lowest-skill rivals below the player', () => {
    expect(generateOffers(withPoints(23)).offers[0].rivals).toEqual(['r01', 'r02', 'r03']);
  });

  it('rotates three different tracks, none offered the round before, and advances the rng', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    let prev: string[] = [];
    for (let racesRun = 0; racesRun < 12; racesRun++) {
      const save = { ...newCareer(3), racesRun };
      const { offers, save: next } = generateOffers(save, ids);
      const tracks = offers.map((o) => o.trackId);
      expect(tracks).toEqual([0, 1, 2].map((t) => ids[(racesRun * OFFER_TRACK_STEP + t) % ids.length]));
      expect(tracks.filter((t) => prev.includes(t))).toEqual([]);
      expect(next.rngState).not.toBe(save.rngState);
      prev = tracks;
    }
    const real = Object.keys(TRACKS);
    expect(generateOffers(newCareer(3)).offers.map((o) => o.trackId)).toEqual([0, 1, 2].map((t) => real[t % real.length]));
  });

  it('offer tables match content.md section 11', () => {
    const [easy, medium, hard] = generateOffers(newCareer(1)).offers;
    expect([easy.laps, medium.laps, hard.laps]).toEqual([3, 4, 5]);
    expect(medium.prizes).toEqual([1800, 1050, 450, 0]);
    expect(hard.points).toEqual([10, 6, 3, 1]);
  });
});

describe('payout (test 3)', () => {
  const save = withPoints(23, 5);
  const medium = offerOf(save, 'medium');
  const result: RaceResult = {
    trackId: medium.trackId,
    laps: medium.laps,
    rows: [
      row(1, medium.rivals[0], 1),
      row(0, 'player', 2, { wrecksCaused: 1, cashPicked: 2, hpLeft: 61.5, minesLeft: 0, turboLeft: 0.5 }),
      row(2, medium.rivals[1], 3),
      row(3, medium.rivals[2], 4, { finished: false, wrecked: true }),
    ],
  };

  it('2nd in medium, 1 wreck, 2 cash = 1050 + 375 + 400 = 1825 and 4 points', () => {
    const { payout, save: after } = applyRaceResult(save, medium, result);
    expect(payout).toEqual({ prize: 1050, wreckBonus: 375, pickups: 400, total: 1825, pointsGained: 4 });
    expect(after).toMatchObject({ cash: save.cash + 1825, points: 27, racesRun: 1, wins: 0, hp: 61.5, mines: 0, turbo: 0.5 });
    expect(after.rngState).not.toBe(save.rngState);
  });

  it('rivals in the race score by their own rows (DNF scores 0)', () => {
    const { save: after } = applyRaceResult(save, medium, result);
    const pts = (s: SaveGame, d: string): number => s.rivals.find((r) => r.driverId === d)!.points;
    expect(pts(after, medium.rivals[0]) - pts(save, medium.rivals[0])).toBe(6);
    expect(pts(after, medium.rivals[1]) - pts(save, medium.rivals[1])).toBe(2);
    expect(pts(after, medium.rivals[2])).toBe(pts(save, medium.rivals[2]));
  });

  it('a DNF pays no prize or points; a wrecked player ends at hp 0 and cannot race', () => {
    const dnf: RaceResult = { ...result, rows: [row(0, 'player', 4, { finished: false, wrecked: true, hpLeft: -3, cashPicked: 1 })] };
    const { payout, save: after } = applyRaceResult(save, medium, dnf);
    expect(payout).toEqual({ prize: 0, wreckBonus: 0, pickups: 200, total: 200, pointsGained: 0 });
    expect(after.hp).toBe(0);
    expect(() => buildCareerRaceSetup(after, offerOf(after, 'easy'), 1)).toThrow();
  });

  it('a win counts, and winning the boss race makes the player champion', () => {
    const top = withPoints(100);
    const boss = offerOf(top, 'boss');
    const win: RaceResult = { trackId: boss.trackId, laps: 5, rows: [row(0, 'player', 1), row(1, 'boss', 2)] };
    const { save: after, payout } = applyRaceResult(top, boss, win);
    expect(payout.prize).toBe(10000);
    expect(after).toMatchObject({ championWon: true, wins: 1 });
    const lose: RaceResult = { ...win, rows: [row(1, 'boss', 1), row(0, 'player', 2)] };
    expect(applyRaceResult(top, boss, lose).save).toMatchObject({ championWon: false, wins: 0, cash: top.cash });
  });

  it('a boss race not won counts in bossLosses, nothing else does (CCR-12)', () => {
    const top = withPoints(100);
    const boss = offerOf(top, 'boss');
    const race = (position: number, extra: Partial<RaceResultRow> = {}): RaceResult => ({ trackId: boss.trackId, laps: 5, rows: [row(0, 'player', position, extra)] });
    expect(applyRaceResult(top, boss, race(1)).save.bossLosses).toBe(0);
    expect(applyRaceResult(top, boss, race(2)).save.bossLosses).toBe(1);
    expect(applyRaceResult(top, boss, race(1, { finished: false, wrecked: true })).save.bossLosses).toBe(1);
    const twice = applyRaceResult(applyRaceResult(top, boss, race(3)).save, boss, race(4)).save;
    expect(twice.bossLosses).toBe(2);
    // A lost hard race is not a boss loss.
    const mid = withPoints(23, 5);
    expect(applyRaceResult(mid, offerOf(mid, 'hard'), race(4)).save.bossLosses).toBe(0);
  });

  it('off-screen rivals gain their tier points: never more than a tier 1st place', () => {
    const { save: after } = applyRaceResult(save, medium, result);
    for (const [i, r] of after.rivals.entries()) {
      if (medium.rivals.includes(r.driverId)) continue;
      const gained = r.points - save.rivals[i].points;
      const max = r.skill < 0.4 ? 3 : r.skill < 0.75 ? 6 : 10;
      expect(gained).toBeGreaterThanOrEqual(0);
      expect(gained).toBeLessThanOrEqual(max);
    }
  });
});

describe('race setup', () => {
  it('player from the save, rivals with skill upgrades, full hp and the rival loadout', () => {
    const save: SaveGame = { ...withPoints(23), upgrades: { engine: 2, tires: 1, armor: 3, gun: 0, fuel: 0, spikes: 0 }, hp: 80, mines: 4, turbo: 6 };
    const offer = offerOf(save, 'medium');
    const setup = buildCareerRaceSetup(save, offer, 42);
    expect(setup).toMatchObject({ seed: 42, laps: 4, countdownSeconds: 3 });
    expect(setup.track.id).toBe(offer.trackId);
    expect(setup.entrants.map((e) => e.id)).toEqual([0, 1, 2, 3]);
    const [p, ...ais] = setup.entrants;
    expect(p).toMatchObject({ driverId: 'player', ai: null, hp: 80, mines: 4, turbo: 6, color: '#FF5A1F' });
    expect(p.stats).toEqual(computeStats(getCar('raven'), save.upgrades));
    for (const e of ais) {
      const r = save.rivals.find((x) => x.driverId === e.driverId)!;
      const lv = Math.min(5, Math.floor(r.skill * 2));
      const spikes = Math.min(3, Math.floor(r.skill * 3));
      expect(e.stats).toEqual(computeStats(getCar(r.carDefId), { engine: lv, tires: lv, armor: lv, gun: lv, fuel: lv, spikes }));
      expect(e.mesh.spikes).toBe(spikes);
      expect(e).toMatchObject({ carDefId: r.carDefId, color: r.color, hp: e.stats.maxHp, mines: 2, turbo: 3 });
    }
  });

  it('the boss drives wraith with no extra maxSpeed', () => {
    const save = withPoints(100);
    const boss = buildCareerRaceSetup(save, offerOf(save, 'boss'), 1).entrants.find((e) => e.driverId === 'boss')!;
    const base = computeStats(getCar('wraith'), { engine: 2, tires: 2, armor: 2, gun: 2, fuel: 0, spikes: 0 });
    expect(boss).toMatchObject({ name: 'THE WARDEN', carDefId: 'wraith' });
    expect(boss.stats.maxSpeed).toBeCloseTo(base.maxSpeed * 1, 9);
  });
});

describe('rubber banding (test 9)', () => {
  it('hard and boss force 0, easy and medium keep the profile value', () => {
    const low = withPoints(23);
    const top = withPoints(100);
    const cases: [SaveGame, RaceOffer['tier']][] = [
      [low, 'easy'],
      [low, 'medium'],
      [low, 'hard'],
      [top, 'boss'],
    ];
    for (const [save, tier] of cases) {
      for (const e of buildCareerRaceSetup(save, offerOf(save, tier), 1).entrants.slice(1)) {
        const skill = e.driverId === 'boss' ? 1.1 : save.rivals.find((r) => r.driverId === e.driverId)!.skill;
        const expected = tier === 'hard' || tier === 'boss' ? 0 : profileForSkill(skill).rubberBand;
        expect(e.ai!.rubberBand).toBe(expected);
        if (tier === 'easy') expect(expected).toBeGreaterThan(0);
      }
    }
  });
});

describe('beaten car types (CCR-10)', () => {
  const carOf = (save: SaveGame, id: string): string => (id === 'boss' ? 'wraith' : save.rivals.find((r) => r.driverId === id)!.carDefId);
  /** Result for `offer` with the player at `playerPos`, the rivals in offer order around it. */
  const race = (offer: RaceOffer, playerPos: number, player: Partial<RaceResultRow> = {}): RaceResult => {
    const order = [...offer.rivals];
    order.splice(playerPos - 1, 0, 'player');
    return { trackId: offer.trackId, laps: offer.laps, rows: order.map((d, i) => (d === 'player' ? row(0, d, i + 1, player) : row(i + 1, d, i + 1))) };
  };
  const behind = (save: SaveGame, offer: RaceOffer, playerPos: number): string[] => [...new Set(offer.rivals.slice(playerPos - 1).map((d) => carOf(save, d)))];

  it('only rows placed after the player count; a win beats every car type in the race', () => {
    const save = withPoints(23, 3);
    const offer = offerOf(save, 'medium');
    for (const pos of [1, 2, 3, 4]) {
      const after = applyRaceResult(save, offer, race(offer, pos)).save;
      expect([...after.beatenCars].sort()).toEqual(behind(save, offer, pos).sort());
    }
    expect(applyRaceResult(save, offer, race(offer, 4)).save.beatenCars).toEqual([]);
    const won = applyRaceResult(save, offer, race(offer, 1)).save;
    expect([...won.beatenCars].sort()).toEqual([...new Set(offer.rivals.map((d) => carOf(save, d)))].sort());
  });

  it('a wrecked player still beats the rows behind it', () => {
    const save = withPoints(23, 3);
    const offer = offerOf(save, 'medium');
    const after = applyRaceResult(save, offer, race(offer, 2, { finished: false, wrecked: true, hpLeft: 0 })).save;
    expect([...after.beatenCars].sort()).toEqual(behind(save, offer, 2).sort());
  });

  it('a player neither finished nor wrecked (quit, race ended early) beats nothing, even in 1st', () => {
    const save = withPoints(23, 3);
    const offer = offerOf(save, 'medium');
    expect(applyRaceResult(save, offer, race(offer, 1, { finished: false, wrecked: false })).save.beatenCars).toEqual([]);
    const kept = { ...save, beatenCars: ['outlaw'] };
    expect(applyRaceResult(kept, offer, race(offer, 1, { finished: false, wrecked: false })).save.beatenCars).toEqual(['outlaw']);
  });

  it('finishing ahead of THE WARDEN beats wraith', () => {
    const top = withPoints(1000, 2);
    const boss = offerOf(top, 'boss');
    expect(boss.rivals[0]).toBe('boss');
    // Player 1st: the boss row (offer order puts it 2nd) is behind.
    expect(applyRaceResult(top, boss, race(boss, 1)).save.beatenCars).toContain('wraith');
    // Player last: nothing.
    expect(applyRaceResult(top, boss, race(boss, 4)).save.beatenCars).toEqual([]);
  });

  it('kept across races, each car type at most once; newlyBeaten skips the starter and the car the player raced', () => {
    const save: SaveGame = { ...withPoints(23, 3), beatenCars: ['outlaw'] };
    const offer = offerOf(save, 'medium');
    const after = applyRaceResult(save, offer, race(offer, 1)).save;
    expect(after.beatenCars[0]).toBe('outlaw');
    expect(new Set(after.beatenCars).size).toBe(after.beatenCars.length);
    const fresh = newlyBeaten(save, after);
    expect(fresh).toEqual(after.beatenCars.filter((c) => c !== 'outlaw' && c !== 'raven' && c !== save.carDefId));
    expect(newlyBeaten({ ...save, beatenCars: [] }, { ...after, beatenCars: ['raven', 'scorch', 'blaze'] })).toEqual(['scorch', 'blaze']);
    expect(newlyBeaten({ ...save, carDefId: 'scorch', beatenCars: [] }, { ...after, beatenCars: ['scorch', 'blaze'] })).toEqual(['blaze']);
  });
});
