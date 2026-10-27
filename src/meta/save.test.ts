import { describe, expect, it } from 'vitest';
import type { SaveGame } from '../shared/contracts';
import { newCareer, rankOf } from './career';
import { clearSave, type KeyValueStore, loadSave, SAVE_KEY, writeSave } from './save';

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
}

describe('save (test 6)', () => {
  it('round-trips under the v1 key', () => {
    const store = memoryStore();
    const save = { ...newCareer(9), cash: 1234, hp: 61.5, upgrades: { engine: 2, tires: 0, armor: 5, gun: 1, fuel: 0, spikes: 0 } };
    expect(writeSave(store, save)).toBe(true);
    expect([...store.map.keys()]).toEqual([SAVE_KEY]);
    expect(loadSave(store)).toEqual(save);
    clearSave(store);
    expect(loadSave(store)).toBeNull();
  });

  it('a raw v1 save (live players) under wreckline.save.v1 loads as v4 and round-trips', () => {
    const store = memoryStore();
    const rivals = newCareer(3).rivals.map((r, i) => ({ ...r, points: r.points + (i % 3) * 4 }));
    // Exactly what v0.3.1 wrote: version 1, four upgrade lines, no bestRank / wrecks / cashEarned / sabotage.
    const v1 = {
      version: 1,
      cash: 2450,
      carDefId: 'scorch',
      upgrades: { engine: 2, tires: 1, armor: 0, gun: 3 },
      hp: 97.5,
      mines: 3,
      turbo: 4,
      points: 24,
      racesRun: 8,
      wins: 3,
      rivals,
      championWon: false,
      rngState: 123456789,
    };
    store.set('wreckline.save.v1', JSON.stringify(v1));
    const loaded = loadSave(store);
    expect(loaded).not.toBeNull();
    const { version: _v, upgrades: _u, ...rest } = v1;
    expect(loaded).toEqual({
      ...rest,
      version: 4,
      upgrades: { engine: 2, tires: 1, armor: 0, gun: 3, fuel: 0, spikes: 0 },
      bestRank: rankOf(loaded!),
      wrecks: 0,
      cashEarned: 0,
      sabotage: null,
      beatenCars: [],
      // Rank 11 after 8 races: the intro and VEX's beat are behind it (CCR-12).
      storySeen: ['beat-intro', 'beat-vex'],
      bossLosses: 0,
    });
    expect(loaded!.bestRank).toBe(11);
    expect(writeSave(store, loaded!)).toBe(true);
    expect(loadSave(store)).toEqual(loaded);
    // A pending sabotage round-trips too.
    const pending = { ...loaded!, sabotage: { offerId: '8-medium', pct: 31, price: 360 } };
    writeSave(store, pending);
    expect(loadSave(store)).toEqual(pending);
  });

  it('a v2 save migrates to v4 with beatenCars [] and the passed beats, and keeps everything else (CCR-10, CCR-12)', () => {
    const store = memoryStore();
    const { beatenCars: _b, storySeen: _s, bossLosses: _l, ...v2 } = {
      ...newCareer(4),
      cash: 777,
      racesRun: 14,
      bestRank: 9,
      wrecks: 3,
      cashEarned: 4100,
      sabotage: { offerId: '5-hard', pct: 30, price: 1125 },
    };
    store.set(SAVE_KEY, JSON.stringify({ ...v2, version: 2 }));
    expect(loadSave(store)).toEqual({ ...v2, version: 4, beatenCars: [], storySeen: ['beat-intro', 'beat-vex', 'beat-razor'], bossLosses: 0 });
    // A v2 save carrying a stray beatenCars field still migrates to [] (v2 never wrote one).
    store.set(SAVE_KEY, JSON.stringify({ ...v2, version: 2, beatenCars: ['blaze'] }));
    expect(loadSave(store)!.beatenCars).toEqual([]);
  });

  it('a v3 save migrates to v4: beats up to its best rank once it has raced, the ending once champion (CCR-12)', () => {
    const store = memoryStore();
    const v3 = (patch: Partial<SaveGame>): unknown => {
      const { storySeen: _s, bossLosses: _l, ...rest } = { ...newCareer(2), beatenCars: ['outlaw'], ...patch };
      return { ...rest, version: 3 };
    };
    const migrate = (patch: Partial<SaveGame>): SaveGame | null => {
      store.set(SAVE_KEY, JSON.stringify(v3(patch)));
      return loadSave(store);
    };
    const all = ['beat-intro', 'beat-vex', 'beat-razor', 'beat-duchess', 'beat-warden'];
    // A career that has not raced yet still gets its intro.
    expect(migrate({})).toMatchObject({ version: 4, beatenCars: ['outlaw'], storySeen: [], bossLosses: 0 });
    expect(migrate({ racesRun: 2 })!.storySeen).toEqual(['beat-intro']);
    expect(migrate({ racesRun: 20, bestRank: 15 })!.storySeen).toEqual(all.slice(0, 2));
    expect(migrate({ racesRun: 30, bestRank: 5 })!.storySeen).toEqual(all.slice(0, 4));
    expect(migrate({ racesRun: 40, bestRank: 1 })!.storySeen).toEqual(all);
    expect(migrate({ racesRun: 41, bestRank: 1, championWon: true })!.storySeen).toEqual([...all, 'beat-ending']);
  });

  it('v4 storySeen and bossLosses round-trip; duplicate scene ids are dropped (CCR-12)', () => {
    const store = memoryStore();
    const save = { ...newCareer(9), racesRun: 3, storySeen: ['beat-intro', 'boss-lost-1'], bossLosses: 1 };
    writeSave(store, save);
    expect(loadSave(store)).toEqual(save);
    store.set(SAVE_KEY, JSON.stringify({ ...save, storySeen: ['beat-intro', 'beat-intro', 'beat-vex'] }));
    expect(loadSave(store)!.storySeen).toEqual(['beat-intro', 'beat-vex']);
  });

  it('v3 beatenCars round-trips; duplicates are dropped', () => {
    const store = memoryStore();
    const save = { ...newCareer(9), beatenCars: ['wraith', 'outlaw'] };
    writeSave(store, save);
    expect(loadSave(store)).toEqual(save);
    store.set(SAVE_KEY, JSON.stringify({ ...save, beatenCars: ['outlaw', 'outlaw', 'scorch'] }));
    expect(loadSave(store)!.beatenCars).toEqual(['outlaw', 'scorch']);
  });

  it('corrupt JSON, wrong version and missing or bad fields give null', () => {
    const store = memoryStore();
    const good = JSON.parse(JSON.stringify(newCareer(1))) as Record<string, unknown>;
    const bad: unknown[] = [
      { ...good, version: 5 },
      { ...good, storySeen: undefined },
      { ...good, storySeen: 'beat-intro' },
      { ...good, storySeen: [1] },
      { ...good, bossLosses: undefined },
      { ...good, bossLosses: '1' },
      { ...good, beatenCars: undefined },
      { ...good, beatenCars: 'blaze' },
      { ...good, beatenCars: ['blaze', 'nope'] },
      { ...good, beatenCars: [1] },
      { ...good, bestRank: undefined },
      { ...good, wrecks: 'x' },
      { ...good, cashEarned: undefined },
      { ...good, sabotage: undefined },
      { ...good, sabotage: { offerId: 1, pct: 30, price: 360 } },
      { ...good, upgrades: { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0 } },
      { ...good, upgrades: { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 4 } },
      { ...good, cash: undefined },
      { ...good, cash: '600' },
      { ...good, carDefId: 'nope' },
      { ...good, upgrades: { engine: 0, tires: 0, armor: 0 } },
      { ...good, upgrades: { engine: 6, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 } },
      { ...good, rivals: 'x' },
      { ...good, rivals: [{ driverId: 'r01' }] },
      { ...good, championWon: 0 },
      [],
      null,
      42,
    ];
    for (const v of bad) {
      store.set(SAVE_KEY, JSON.stringify(v));
      expect(loadSave(store)).toBeNull();
    }
    store.set(SAVE_KEY, '{"version":1,');
    expect(loadSave(store)).toBeNull();
    store.set(SAVE_KEY, JSON.stringify(good));
    expect(loadSave(store)).toEqual(good);
  });

  it('never throws, even when the store does', () => {
    const broken: KeyValueStore = {
      get: () => {
        throw new Error('denied');
      },
      set: () => {
        throw new Error('quota');
      },
      remove: () => {},
    };
    expect(loadSave(broken)).toBeNull();
    expect(writeSave(broken, newCareer(1))).toBe(false);
  });
});
