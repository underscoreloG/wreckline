import { describe, expect, it } from 'vitest';
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

  it('a raw v1 save (live players) under wreckline.save.v1 loads as v2 and round-trips', () => {
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
      version: 2,
      upgrades: { engine: 2, tires: 1, armor: 0, gun: 3, fuel: 0, spikes: 0 },
      bestRank: rankOf(loaded!),
      wrecks: 0,
      cashEarned: 0,
      sabotage: null,
    });
    expect(loaded!.bestRank).toBeLessThan(20);
    expect(writeSave(store, loaded!)).toBe(true);
    expect(loadSave(store)).toEqual(loaded);
    // A pending sabotage round-trips too.
    const pending = { ...loaded!, sabotage: { offerId: '8-medium', pct: 31, price: 360 } };
    writeSave(store, pending);
    expect(loadSave(store)).toEqual(pending);
  });

  it('corrupt JSON, wrong version and missing or bad fields give null', () => {
    const store = memoryStore();
    const good = JSON.parse(JSON.stringify(newCareer(1))) as Record<string, unknown>;
    const bad: unknown[] = [
      { ...good, version: 3 },
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
