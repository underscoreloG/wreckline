import { describe, expect, it } from 'vitest';
import type { SaveGame } from '../shared/contracts';
import { newCareer } from './career';
import { buyCar, buyMines, buyTurbo, buyUpgrade, canAfford, repair, shopCars } from './shop';

const career = (patch: Partial<SaveGame> = {}): SaveGame => ({ ...newCareer(1), ...patch });

function ok(r: ReturnType<typeof buyUpgrade>): SaveGame {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.save;
}

describe('upgrades (test 4)', () => {
  it('engine level 1 on raven costs 300', () => {
    const s = ok(buyUpgrade(career(), 'engine'));
    expect(s.cash).toBe(300);
    expect(s.upgrades.engine).toBe(1);
  });

  it('a tier 3 car pays the tier multiplier (300 x 2.4 = 720)', () => {
    expect(ok(buyUpgrade(career({ carDefId: 'viper', hp: 120, cash: 1000 }), 'gun')).cash).toBe(280);
  });

  it('level 6 returns max', () => {
    const s = career({ cash: 1e6, upgrades: { engine: 5, tires: 0, armor: 0, gun: 0 } });
    expect(buyUpgrade(s, 'engine')).toEqual({ ok: false, reason: 'max' });
  });

  it('insufficient cash returns cash and leaves the save unchanged', () => {
    const s = career({ cash: 299 });
    const before = structuredClone(s);
    expect(buyUpgrade(s, 'engine')).toEqual({ ok: false, reason: 'cash' });
    expect(s).toEqual(before);
    expect(canAfford(s, 299)).toBe(true);
    expect(canAfford(s, 300)).toBe(false);
  });
});

describe('repair (test 5)', () => {
  it('raven 37 hp = 148', () => {
    const s = ok(repair(career({ hp: 63, cash: 1000 }), 37));
    expect(s).toMatchObject({ hp: 100, cash: 852 });
  });

  it('viper (tier 3) 10 hp = 96', () => {
    const s = ok(repair(career({ carDefId: 'viper', hp: 100, cash: 1000 }), 10));
    expect(s).toMatchObject({ hp: 110, cash: 904 });
  });

  it('clamps to maxHp, full car returns max, bad amount invalid, short cash returns cash', () => {
    expect(ok(repair(career({ hp: 90, cash: 1000 }), Infinity))).toMatchObject({ hp: 100, cash: 960 });
    expect(repair(career(), 5)).toEqual({ ok: false, reason: 'max' });
    expect(repair(career({ hp: 50 }), 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(repair(career({ hp: 50, cash: 10 }), 50)).toEqual({ ok: false, reason: 'cash' });
  });
});

describe('supplies', () => {
  it('mines 60 each up to 8, turbo 40 per second up to 10 s', () => {
    expect(ok(buyMines(career(), 3))).toMatchObject({ mines: 5, cash: 420 });
    expect(ok(buyMines(career({ mines: 7 }), 3))).toMatchObject({ mines: 8, cash: 540 });
    expect(buyMines(career({ mines: 8 }), 1)).toEqual({ ok: false, reason: 'max' });
    expect(buyMines(career(), 1.5)).toEqual({ ok: false, reason: 'invalid' });
    expect(ok(buyTurbo(career(), 2))).toMatchObject({ turbo: 5, cash: 520 });
    expect(ok(buyTurbo(career({ turbo: 9.5 }), 5))).toMatchObject({ turbo: 10, cash: 580 });
    expect(buyTurbo(career({ turbo: 10 }), 1)).toEqual({ ok: false, reason: 'max' });
    expect(buyTurbo(career({ cash: 0 }), 1)).toEqual({ ok: false, reason: 'cash' });
  });
});

describe('car shop (test 10)', () => {
  it('lists exactly the forSale cars not owned', () => {
    expect(shopCars(career()).map((c) => c.id)).toEqual(['scorch', 'titan', 'viper']);
    expect(shopCars(career({ carDefId: 'titan', hp: 190 })).map((c) => c.id)).toEqual(['scorch', 'viper']);
  });

  it('rival-only and boss cars are invalid, the owned car is owned', () => {
    const rich = career({ cash: 1e6 });
    expect(buyCar(rich, 'wraith')).toEqual({ ok: false, reason: 'invalid' });
    expect(buyCar(rich, 'blaze')).toEqual({ ok: false, reason: 'invalid' });
    expect(buyCar(rich, 'nope')).toEqual({ ok: false, reason: 'invalid' });
    expect(buyCar(rich, 'toString')).toEqual({ ok: false, reason: 'invalid' });
    expect(buyCar(career({ carDefId: 'scorch', hp: 140 }), 'scorch')).toEqual({ ok: false, reason: 'owned' });
  });

  it('buying trades in 50% of the current car, resets upgrades and fills hp', () => {
    const fromRaven = ok(buyCar(career({ cash: 6000, upgrades: { engine: 3, tires: 2, armor: 1, gun: 0 }, hp: 20 }), 'scorch'));
    expect(fromRaven).toMatchObject({ carDefId: 'scorch', cash: 0, hp: 140, upgrades: { engine: 0, tires: 0, armor: 0, gun: 0 } });
    // Scorch trades in for 3000: 8000 + 3000 - 11000.
    expect(ok(buyCar(career({ carDefId: 'scorch', cash: 8000, hp: 140 }), 'titan'))).toMatchObject({ carDefId: 'titan', cash: 0, hp: 190 });
    expect(buyCar(career({ carDefId: 'scorch', cash: 7999, hp: 140 }), 'titan')).toEqual({ ok: false, reason: 'cash' });
  });
});
