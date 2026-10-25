import { describe, expect, it } from 'vitest';
import { newCareer } from './career';
import { clearSave, type KeyValueStore, loadSave, SAVE_KEY, writeSave } from './save';

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
}

describe('save (test 6)', () => {
  it('round-trips under the v1 key', () => {
    const store = memoryStore();
    const save = { ...newCareer(9), cash: 1234, hp: 61.5, upgrades: { engine: 2, tires: 0, armor: 5, gun: 1 } };
    expect(writeSave(store, save)).toBe(true);
    expect([...store.map.keys()]).toEqual([SAVE_KEY]);
    expect(loadSave(store)).toEqual(save);
    clearSave(store);
    expect(loadSave(store)).toBeNull();
  });

  it('corrupt JSON, wrong version and missing or bad fields give null', () => {
    const store = memoryStore();
    const good = JSON.parse(JSON.stringify(newCareer(1))) as Record<string, unknown>;
    const bad: unknown[] = [
      { ...good, version: 2 },
      { ...good, cash: undefined },
      { ...good, cash: '600' },
      { ...good, carDefId: 'nope' },
      { ...good, upgrades: { engine: 0, tires: 0, armor: 0 } },
      { ...good, upgrades: { engine: 6, tires: 0, armor: 0, gun: 0 } },
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
