import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARS, getCar, STARTER_CAR_ID } from '../content/cars';
import type { RaceSnapshot } from '../shared/contracts';
import type { EngineParams } from './engine';
import { DEFAULT_PROFILE_ID, ENGINE_PROFILES, engineProfile, profileFrequency, type EngineProfile } from './engineProfiles';

// index.ts with its Web Audio parts replaced by recorders: which profile each car's engine gets, and what it is set to.
const made: { profile: EngineProfile; index: number; sets: EngineParams[] }[] = [];
vi.mock('./engine', () => ({
  ENGINE_GAIN_PLAYER: 0.28,
  ENGINE_GAIN_AI: 0.12,
  createEngineVoice: (_ctx: unknown, _dest: unknown, _now: number, profile: EngineProfile, index: number) => {
    const rec = { profile, index, sets: [] as EngineParams[] };
    made.push(rec);
    return { alive: true, set: (p: EngineParams) => rec.sets.push(p), kill() {}, stop() {} };
  },
}));
vi.mock('./skid', () => ({ SKID_GAIN: 0.12, createSkidVoice: () => ({ set() {}, stop() {} }) }));
vi.mock('./samples', () => ({ loadSamples: async () => {}, playSound: () => ({ end: 0, stop() {} }) }));
vi.mock('./bus', () => ({ buildBus: (ctx: unknown) => ({ ctx, master: { gain: {} }, sfx: { gain: {} }, race: {}, ui: {}, out: {} }) }));

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  async resume() {}
}

const snapshot = (speeds: number[]): RaceSnapshot =>
  ({
    tick: 10,
    cars: speeds.map((speed, id) => ({ id, pos: { x: id * 5, y: 0 }, speed, wrecked: false, turboActive: false, drifting: false })),
    mines: [],
  }) as unknown as RaceSnapshot;

afterEach(() => {
  vi.unstubAllGlobals();
  made.length = 0;
});

describe('engine profiles (WP25)', () => {
  it('every registered car has its own profile', () => {
    for (const id of Object.keys(CARS)) {
      expect(ENGINE_PROFILES[id], id).toBeDefined();
      expect(engineProfile(id)).toBe(ENGINE_PROFILES[id]);
    }
    expect(engineProfile('no-such-car')).toBe(ENGINE_PROFILES[DEFAULT_PROFILE_ID]);
  });

  it('each profile rises continuously inside every gear and falls back at each shift', () => {
    for (const [id, p] of Object.entries(ENGINE_PROFILES)) {
      expect(p.gears, id).toBeGreaterThanOrEqual(1);
      const step = 1e-4;
      for (let gear = 0; gear < p.gears; gear++) {
        let prev = profileFrequency(p, gear / p.gears);
        for (let r = gear / p.gears + step; r < (gear + 1) / p.gears - step; r += step) {
          const f = profileFrequency(p, r);
          expect(f, id).toBeGreaterThan(prev);
          expect(f - prev, id).toBeLessThan(0.2);
          prev = f;
        }
        if (gear > 0) expect(profileFrequency(p, gear / p.gears + 1e-9), id).toBeLessThan(profileFrequency(p, gear / p.gears - 1e-9));
      }
      expect(profileFrequency(p, -1)).toBe(profileFrequency(p, 0));
      expect(profileFrequency(p, 2)).toBe(profileFrequency(p, 1));
      expect(profileFrequency(p, 0), id).toBeGreaterThan(20);
    }
  });
});

describe('setRaceCars (CCR-9)', () => {
  const start = async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { createAudioEngine } = await import('./index');
    const engine = createAudioEngine();
    await engine.unlock();
    return engine;
  };

  it('a non-raven car gets its own profile and its own maxSpeed in rpm01', async () => {
    const other = Object.keys(CARS).find((id) => id !== STARTER_CAR_ID)!;
    const engine = await start();
    engine.setRaceCars([
      { carDefId: STARTER_CAR_ID, maxSpeed: 40 },
      { carDefId: other, maxSpeed: 50 },
    ]);
    engine.update(snapshot([10, 20]), [], 0);
    expect(made.map((m) => m.profile)).toEqual([engineProfile(STARTER_CAR_ID), engineProfile(other)]);
    expect(made[1]!.profile).not.toBe(made[0]!.profile);
    expect(made[0]!.sets[0]!.rpm01).toBeCloseTo(10 / 40, 12);
    expect(made[1]!.sets[0]!.rpm01).toBeCloseTo(20 / 50, 12);
  });

  it('before setRaceCars every car is a raven at the starter maxSpeed; a later call rebuilds the voices', async () => {
    const engine = await start();
    const ref = getCar(STARTER_CAR_ID).base.maxSpeed;
    engine.update(snapshot([10, 10, 10]), [], 0);
    expect(made.map((m) => m.profile)).toEqual([0, 1, 2].map(() => engineProfile(DEFAULT_PROFILE_ID)));
    expect(made.map((m) => m.sets[0]!.rpm01)).toEqual([0, 1, 2].map(() => 10 / ref));
    const ids = Object.keys(CARS);
    engine.setRaceCars(ids.slice(0, 3).map((carDefId) => ({ carDefId, maxSpeed: getCar(carDefId).base.maxSpeed })));
    made.length = 0;
    engine.update(snapshot([10, 10, 10]), [], 0);
    expect(made.map((m) => m.profile)).toEqual(ids.slice(0, 3).map((id) => engineProfile(id)));
  });
});
