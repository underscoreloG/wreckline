import { describe, expect, it } from 'vitest';
import { CARS, carsForSale, getCar } from './cars';
import { computeStats, GRIP_CAP, MAX_LEVEL, MAX_UPGRADE_LEVEL, repairCost, upgradeCost } from './economy';

const zero = { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 };
const max = { engine: 5, tires: 5, armor: 5, gun: 5, fuel: 0, spikes: 0 };

describe('cars', () => {
  it('has the 8 cars with procedural meshes', () => {
    expect(Object.keys(CARS)).toEqual(['raven', 'outlaw', 'iceberg', 'scorch', 'blaze', 'titan', 'viper', 'wraith']);
    for (const c of Object.values(CARS)) expect(c.mesh.model).toBeNull();
    expect(getCar('raven').base.maxSpeed).toBe(39.1);
    expect(() => getCar('nope')).toThrow();
  });

  it('carsForSale lists forSale cars in table order', () => {
    expect(carsForSale().map((c) => c.id)).toEqual(['scorch', 'titan', 'viper']);
  });
});

describe('economy', () => {
  it('computeStats with all zeros returns base', () => {
    for (const c of Object.values(CARS)) expect(computeStats(c, zero)).toEqual(c.base);
  });

  it('computeStats with all 5 matches hand-computed raven values', () => {
    const s = computeStats(getCar('raven'), max);
    expect(s.maxSpeed).toBeCloseTo(39.1 * 1.2762815625, 9);
    expect(s.accel).toBeCloseTo(15.6 * 1.3382255776, 9);
    expect(s.grip).toBeCloseTo(0.78 * 1.2166529024, 9);
    expect(s.turnRate).toBeCloseTo(2.7 * 1.2166529024, 9);
    expect(s.maxHp).toBe(201);
    expect(s.gunDps).toBeCloseTo(22 * 1.7623416832, 9);
    expect(s.brake).toBe(24);
    expect(s.mass).toBe(1100);
  });

  it('grip cap holds', () => {
    const s = computeStats(getCar('viper'), max);
    expect(s.grip).toBe(GRIP_CAP);
    expect(computeStats(getCar('wraith'), { ...zero, tires: 3 }).grip).toBe(GRIP_CAP);
  });

  it('upgrade cost per tier, rounded to 10', () => {
    expect(upgradeCost(getCar('raven'), 'engine', 1)).toBe(300);
    expect(upgradeCost(getCar('raven'), 'gun', 5)).toBe(6000);
    expect(upgradeCost(getCar('scorch'), 'tires', 2)).toBe(1120);
    expect(upgradeCost(getCar('viper'), 'armor', 3)).toBe(3600);
    expect(() => upgradeCost(getCar('raven'), 'engine', 6)).toThrow();
  });

  it('repair cost rounds up', () => {
    expect(repairCost(getCar('raven'), 10)).toBe(40);
    expect(repairCost(getCar('scorch'), 1)).toBe(7);
  });
});

describe('rocket fuel and bumper spikes (WP20)', () => {
  it('level 0 is exactly the base: 1.3 / 1.6 / 1 / 1 on every car, mesh.spikes 0', () => {
    for (const c of Object.values(CARS)) {
      const s = computeStats(c, zero);
      expect([s.turboSpeedMult, s.turboAccelMult, s.ramDealtMult, s.ramTakenMult]).toEqual([1.3, 1.6, 1, 1]);
      expect(c.mesh.spikes).toBe(0);
    }
  });

  it('fuel 5 gives turbo 1.50 / 2.00, spikes 3 gives 2.5 / 0.55, other stats untouched', () => {
    const raven = getCar('raven');
    const fuel = computeStats(raven, { ...zero, fuel: 5 });
    expect(fuel.turboSpeedMult).toBeCloseTo(1.5, 12);
    expect(fuel.turboAccelMult).toBeCloseTo(2.0, 12);
    const spikes = computeStats(raven, { ...zero, spikes: 3 });
    expect(spikes.ramDealtMult).toBeCloseTo(2.5, 12);
    expect(spikes.ramTakenMult).toBeCloseTo(0.55, 12);
    expect({ ...fuel, turboSpeedMult: 1.3, turboAccelMult: 1.6 }).toEqual(raven.base);
    expect({ ...spikes, ramDealtMult: 1, ramTakenMult: 1 }).toEqual(raven.base);
  });

  it('max levels: 5 per line except spikes 3; MAX_UPGRADE_LEVEL stays 5', () => {
    expect(MAX_LEVEL).toEqual({ engine: 5, tires: 5, armor: 5, gun: 5, fuel: 5, spikes: 3 });
    expect(MAX_UPGRADE_LEVEL).toBe(5);
    expect(() => upgradeCost(getCar('raven'), 'spikes', 4)).toThrow();
    expect(() => upgradeCost(getCar('raven'), 'fuel', 6)).toThrow();
  });

  it('costs match content.md section 2 for raven and viper', () => {
    const cost = (id: string, kind: 'fuel' | 'spikes') => Array.from({ length: MAX_LEVEL[kind] }, (_, i) => upgradeCost(getCar(id), kind, i + 1));
    expect(cost('raven', 'fuel')).toEqual([300, 700, 1500, 3000, 6000]);
    expect(cost('viper', 'fuel')).toEqual([720, 1680, 3600, 7200, 14400]);
    expect(cost('raven', 'spikes')).toEqual([500, 1200, 2500]);
    expect(cost('viper', 'spikes')).toEqual([1200, 2880, 6000]);
  });
});
