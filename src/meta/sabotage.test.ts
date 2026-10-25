import { describe, expect, it } from 'vitest';
import type { RaceOffer, RaceResult, SaveGame } from '../shared/contracts';
import { SABOTAGE_PCT_MAX, SABOTAGE_PCT_MIN } from '../content/economy';
import { applyRaceResult, buildCareerRaceSetup, generateOffers, newCareer, sabotageTarget } from './career';
import { loadSave, type KeyValueStore, writeSave } from './save';
import { buySabotage } from './shop';

const memoryStore = (): KeyValueStore => {
  const map = new Map<string, string>();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
};

/** A save right after the offers were generated, as the game holds it, plus those offers. */
function round(points: number, seed = 1, patch: Partial<SaveGame> = {}): { save: SaveGame; offers: RaceOffer[] } {
  const g = generateOffers({ ...newCareer(seed), points, cash: 5000, ...patch });
  return { save: g.save, offers: g.offers };
}

const tier = (offers: RaceOffer[], t: RaceOffer['tier']): RaceOffer => offers.find((o) => o.tier === t)!;

function bought(save: SaveGame, offer: RaceOffer): SaveGame {
  const r = buySabotage(save, offer);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.save;
}

/** Player 4th, every row finished: the payout is the 4th prize. */
function resultFor(offer: RaceOffer): RaceResult {
  const drivers = [...offer.rivals, 'player'];
  return {
    trackId: offer.trackId,
    laps: offer.laps,
    rows: drivers.map((driverId, i) => ({
      car: driverId === 'player' ? 0 : i + 1,
      driverId,
      name: driverId,
      position: i + 1,
      finished: true,
      wrecked: false,
      totalTime: 100,
      bestLap: 25,
      wrecksCaused: 0,
      cashPicked: 0,
      hpLeft: 50,
      minesLeft: 1,
      turboLeft: 1,
    })),
  };
}

describe('sabotage (CCR-5)', () => {
  it('price = round(0.3 * 1st prize) per tier: easy 270, medium 540, hard 1125, boss 3000', () => {
    expect(round(23).offers.map((o) => o.sabotagePrice)).toEqual([270, 540, 1125]);
    expect(tier(round(100).offers, 'boss').sabotagePrice).toBe(3000);
  });

  it('target = the offer rival with the most points, ties to the higher skill; the boss race targets THE WARDEN', () => {
    const { save, offers } = round(23);
    const offer = { ...tier(offers, 'medium'), rivals: ['r05', 'r10', 'r12'] };
    const withPts = (pts: Record<string, number>): SaveGame => ({ ...save, rivals: save.rivals.map((r) => ({ ...r, points: pts[r.driverId] ?? r.points })) });
    expect(sabotageTarget(withPts({ r05: 10, r10: 20, r12: 60 }), offer)).toEqual({ driverId: 'r12', name: 'JINX' });
    expect(sabotageTarget(withPts({ r05: 50, r10: 50, r12: 40 }), offer)).toEqual({ driverId: 'r10', name: 'RAZOR' });
    const boss = round(100);
    expect(sabotageTarget(boss.save, tier(boss.offers, 'boss'))).toEqual({ driverId: 'boss', name: 'THE WARDEN' });
  });

  it('pct is a whole number in 25..49, deterministic per rngState; price paid and stored', () => {
    const { save, offers } = round(23);
    const offer = tier(offers, 'hard');
    const seen = new Set<number>();
    for (let rngState = 0; rngState < 2000; rngState++) {
      const s = { ...save, rngState };
      const a = bought(s, offer);
      expect(bought(s, offer)).toEqual(a);
      const pct = a.sabotage!.pct;
      expect(Number.isInteger(pct)).toBe(true);
      seen.add(pct);
      expect(a).toMatchObject({ cash: save.cash - 1125, sabotage: { offerId: offer.id, price: 1125 } });
      expect(a.rngState).not.toBe(rngState);
    }
    expect(Math.min(...seen)).toBe(SABOTAGE_PCT_MIN);
    expect(Math.max(...seen)).toBe(SABOTAGE_PCT_MAX);
    expect(seen.size).toBe(SABOTAGE_PCT_MAX - SABOTAGE_PCT_MIN + 1);
  });

  it('one pending at a time: a second purchase for the same or another offer is refused; short cash is refused', () => {
    const { save, offers } = round(23);
    const once = bought(save, offers[0]);
    expect(buySabotage(once, offers[0])).toEqual({ ok: false, reason: 'pending' });
    expect(buySabotage(once, offers[1])).toEqual({ ok: false, reason: 'pending' });
    expect(buySabotage({ ...save, cash: 539 }, offers[1])).toEqual({ ok: false, reason: 'cash' });
  });

  it('the target starts the race at round(maxHp * (1 - pct/100)); everyone else is untouched', () => {
    const { save, offers } = round(23);
    const offer = tier(offers, 'medium');
    const s = bought(save, offer);
    const plain = buildCareerRaceSetup(save, offer, 3);
    const setup = buildCareerRaceSetup(s, offer, 3);
    const target = sabotageTarget(s, offer).driverId;
    for (const [i, e] of setup.entrants.entries()) {
      const hp = e.driverId === target ? Math.round(e.stats.maxHp * (1 - s.sabotage!.pct / 100)) : plain.entrants[i].hp;
      expect(e.hp).toBe(hp);
    }
    expect(setup.entrants.find((e) => e.driverId === target)!.hp).toBeLessThan(plain.entrants.find((e) => e.driverId === target)!.hp);
    // Another offer of the round is not sabotaged.
    expect(buildCareerRaceSetup(s, offers[0], 3)).toEqual(buildCareerRaceSetup(save, offers[0], 3));
  });

  it('the boss race sabotages THE WARDEN', () => {
    const { save, offers } = round(100);
    const offer = tier(offers, 'boss');
    const s = bought(save, offer);
    const boss = buildCareerRaceSetup(s, offer, 1).entrants.find((e) => e.driverId === 'boss')!;
    expect(boss.hp).toBe(Math.round(boss.stats.maxHp * (1 - s.sabotage!.pct / 100)));
  });

  it('after a reload the offers are rebuilt (same id, other rivals) and the target is re-picked from the new rivals', () => {
    let checked = 0;
    for (let seed = 1; seed < 40; seed++) {
      const { save, offers } = round(23, seed);
      const offer = tier(offers, 'medium');
      const s = bought(save, offer);
      const store = memoryStore();
      writeSave(store, s);
      const loaded = loadSave(store)!;
      const rebuilt = tier(generateOffers(loaded).offers, 'medium');
      expect(rebuilt.id).toBe(offer.id);
      const target = sabotageTarget(loaded, rebuilt).driverId;
      if (rebuilt.rivals.join() === offer.rivals.join() || target === sabotageTarget(s, offer).driverId) continue;
      checked++;
      const setup = buildCareerRaceSetup(loaded, rebuilt, 9);
      expect(rebuilt.rivals).toContain(target);
      for (const e of setup.entrants.slice(1)) {
        expect(e.hp).toBe(e.driverId === target ? Math.round(e.stats.maxHp * (1 - s.sabotage!.pct / 100)) : e.stats.maxHp);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('racing another offer refunds the price; either way the sabotage is cleared after the race', () => {
    const { save, offers } = round(23);
    const medium = tier(offers, 'medium');
    const s = bought(save, medium);
    const other = applyRaceResult(s, offers[0], resultFor(offers[0]));
    expect(other.save.cash).toBe(s.cash + other.payout.total + 540);
    expect(other.save.cashEarned).toBe(s.cashEarned + other.payout.total);
    expect(other.save.sabotage).toBeNull();
    const same = applyRaceResult(s, medium, resultFor(medium));
    expect(same.save.cash).toBe(s.cash + same.payout.total);
    expect(same.save.sabotage).toBeNull();
  });
});

describe('rival rocket fuel and spikes (content.md section 10)', () => {
  it('rivals: fuel floor(skill * 2), spikes floor(skill * 3) on stats and mesh; the boss fuel 2, spikes 3; the player from the save', () => {
    const { save, offers } = round(100, 1, { upgrades: { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 2, spikes: 1 } });
    const setup = buildCareerRaceSetup(save, tier(offers, 'boss'), 1);
    const [player, ...ais] = setup.entrants;
    expect(player.mesh.spikes).toBe(1);
    expect(player.stats.turboSpeedMult).toBeCloseTo(1.38, 12);
    for (const e of ais) {
      const skill = e.driverId === 'boss' ? 1.1 : save.rivals.find((r) => r.driverId === e.driverId)!.skill;
      const fuel = Math.min(5, Math.floor(skill * 2));
      const spikes = Math.min(3, Math.floor(skill * 3));
      if (e.driverId === 'boss') expect([fuel, spikes]).toEqual([2, 3]);
      expect(e.mesh.spikes).toBe(spikes);
      expect(e.stats.turboSpeedMult).toBeCloseTo(1.3 + 0.04 * fuel, 12);
      expect(e.stats.turboAccelMult).toBeCloseTo(1.6 + 0.08 * fuel, 12);
      expect(e.stats.ramDealtMult).toBeCloseTo(1 + 0.5 * spikes, 12);
      expect(e.stats.ramTakenMult).toBeCloseTo(1 - 0.15 * spikes, 12);
    }
  });
});
