import { describe, expect, it } from 'vitest';
import type { SaveGame } from '../shared/contracts';
import { getCar } from '../content/cars';
import { computeStats } from '../content/economy';
import { generateOffers, newCareer } from './career';
import { chooseOffer, playerSkill, shopVisit, simulateCareer } from './careerSim';

const maxed = { engine: 5, tires: 5, armor: 5, gun: 5 };
const maxHp = (id: string): number => computeStats(getCar(id), maxed).maxHp;

describe('careerSim', () => {
  it('is deterministic (test 8) and its curves have one entry per race', () => {
    const a = simulateCareer(7, 'greedy');
    expect(simulateCareer(7, 'greedy')).toEqual(a);
    expect(a.races).toBeGreaterThan(0);
    for (const curve of [a.cashCurve, a.rankCurve, a.payoutCurve]) expect(curve).toHaveLength(a.races);
    expect(simulateCareer(7, 'safe', { maxRaces: 5 }).races).toBe(5);
  });

  it('player skill = 0.35 + 0.1 * avg upgrade + 0.15 * car tier', () => {
    expect(playerSkill(newCareer(1))).toBeCloseTo(0.5, 12);
    expect(playerSkill({ ...newCareer(1), carDefId: 'viper', upgrades: maxed })).toBeCloseTo(1.3, 12);
  });

  it('safe always takes medium; greedy the highest tier it is predicted top 2 in', () => {
    const fresh = generateOffers({ ...newCareer(1), points: 23 });
    expect(chooseOffer(fresh.save, fresh.offers, 'safe').tier).toBe('medium');
    // Skill 0.5 vs the top 6 (0.75+): hard is out, medium (ranks 7-13, skills 0.45-0.70) depends on the draw, easy is the floor.
    expect(['easy', 'medium']).toContain(chooseOffer(fresh.save, fresh.offers, 'greedy').tier);
    const strong: SaveGame = { ...fresh.save, carDefId: 'viper', upgrades: maxed };
    expect(chooseOffer(strong, fresh.offers, 'greedy').tier).toBe('hard');
    const top = generateOffers({ ...strong, points: 100 });
    // 1.3 beats the boss (1.1): the boss replaces hard and greedy takes it.
    expect(chooseOffer(top.save, top.offers, 'greedy').tier).toBe('boss');
    expect(chooseOffer(top.save, top.offers, 'safe').tier).toBe('medium');
  });

  it('shop priority: repair, then engine > armor > tires > gun, one level each per visit', () => {
    expect(shopVisit({ ...newCareer(1), hp: 90, cash: 640 })).toMatchObject({ hp: 100, cash: 0, upgrades: { engine: 1, tires: 0, armor: 1, gun: 0 } });
    // Partial repair when a full one is out of reach.
    expect(shopVisit({ ...newCareer(1), hp: 10, cash: 100 })).toMatchObject({ hp: 35, cash: 0 });
  });

  it('next car = cheapest forSale car of a higher tier, only with 1000 left after the trade-in', () => {
    const raven: SaveGame = { ...newCareer(1), upgrades: maxed, hp: maxHp('raven') };
    expect(shopVisit({ ...raven, cash: 7000 })).toMatchObject({ carDefId: 'scorch', cash: 1000 });
    expect(shopVisit({ ...raven, cash: 6999 }).carDefId).toBe('raven');
    // Scorch (tier 2) skips Titan (tier 2) for Viper (tier 3): 17000 + 3000 trade-in - 16000.
    const scorch: SaveGame = { ...raven, carDefId: 'scorch', hp: maxHp('scorch') };
    expect(shopVisit({ ...scorch, cash: 17000 })).toMatchObject({ carDefId: 'viper', cash: 4000 });
  });
});
