import { describe, expect, it } from 'vitest';
import { CARS, carsForSale, getCar } from './cars';
import { computeStats, GRIP_CAP, repairCost, upgradeCost } from './economy';

const zero = { engine: 0, tires: 0, armor: 0, gun: 0 };
const max = { engine: 5, tires: 5, armor: 5, gun: 5 };

describe('cars', () => {
  it('has the 8 cars with procedural meshes', () => {
    expect(Object.keys(CARS)).toEqual(['raven', 'outlaw', 'iceberg', 'scorch', 'blaze', 'titan', 'viper', 'wraith']);
    for (const c of Object.values(CARS)) expect(c.mesh.model).toBeNull();
    expect(getCar('raven').base.maxSpeed).toBe(34);
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
    expect(s.maxSpeed).toBeCloseTo(34 * 1.2762815625, 9);
    expect(s.accel).toBeCloseTo(13 * 1.3382255776, 9);
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
