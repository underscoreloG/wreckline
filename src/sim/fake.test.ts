import { describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { SimEvent } from '../shared/contracts';
import { createFakeSim } from './fake';

const ALL_TYPES: SimEvent['type'][] = [
  'countdown',
  'raceStart',
  'lapCompleted',
  'finalLap',
  'carFinished',
  'raceFinished',
  'gunShot',
  'gunOverheat',
  'carDamaged',
  'carWrecked',
  'mineDropped',
  'mineExploded',
  'pickupCollected',
  'pickupRespawned',
  'impact',
  'turboStart',
  'turboEnd',
];

const run = (sim: ReturnType<typeof createFakeSim>, n: number) => {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i++) events.push(...sim.step(new Map()));
  return events;
};

describe('createFakeSim', () => {
  it('45 s with 2 laps: every event type except carFinished/raceFinished, car 3 wrecked at 40 s', () => {
    const sim = createFakeSim(buildQuickRaceSetup({ seed: 1, laps: 2 }));
    const start = sim.snapshot();
    const events = run(sim, 60 * 45);
    const types = new Set(events.map((e) => e.type));
    expect(ALL_TYPES.filter((t) => !types.has(t))).toEqual(['carFinished', 'raceFinished']);
    const snap = sim.snapshot();
    expect(snap.time).toBeCloseTo(42, 6);
    snap.cars.forEach((c, i) => expect(c.progress).toBeGreaterThan(start.cars[i].progress + 100));
    expect(snap.cars[3].wrecked).toBe(true);
    expect(snap.cars[3].position).toBe(4);
    const wreck = events.find((e) => e.type === 'carWrecked');
    expect(wreck).toMatchObject({ car: 3, by: 2 });
    const finalLap = events.find((e) => e.type === 'finalLap');
    expect(finalLap).toMatchObject({ car: 3 });
    sim.debugFinishRace();
    expect(sim.snapshot().phase).toBe('finished');
    expect(sim.step(new Map()).map((e) => e.type)).toEqual(['raceFinished']);
    expect(sim.result()?.rows).toHaveLength(4);
    expect(sim.result()?.rows[3]).toMatchObject({ car: 3, wrecked: true, finished: false });
  });

  it('exercises every CarState flag', () => {
    const sim = createFakeSim(buildQuickRaceSetup({ seed: 1, laps: 2 }));
    const flags = ['turboActive', 'gunOverheated', 'firing', 'braking', 'drifting', 'offroad', 'wrecked', 'wrongWay'] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 45; i++) {
      sim.step(new Map());
      for (const c of sim.snapshot().cars) for (const f of flags) if (c[f]) seen.add(f);
    }
    expect([...seen].sort()).toEqual([...flags].sort());
  });

  it('finishes the race like the real sim and is deterministic', () => {
    const go = () => {
      const sim = createFakeSim(buildQuickRaceSetup({ seed: 5, laps: 1, aiCount: 2 }));
      const events = run(sim, 60 * 120);
      return { sim, events };
    };
    const a = go();
    const b = go();
    expect(a.sim.stateHash()).toBe(b.sim.stateHash());
    expect(a.events).toEqual(b.events);
    const finished = a.events.filter((e) => e.type === 'carFinished');
    expect(finished.map((e) => (e.type === 'carFinished' ? e.position : 0))).toEqual([1, 2, 3]);
    expect(a.events.filter((e) => e.type === 'raceFinished')).toHaveLength(1);
    expect(a.sim.snapshot().phase).toBe('finished');
    expect(a.sim.result()?.rows.every((r) => r.finished)).toBe(true);
  });
});
