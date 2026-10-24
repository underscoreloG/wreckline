import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { InputFrame, RaceSetup, SimEvent } from '../shared/contracts';
import { NEUTRAL_INPUT } from '../shared/contracts';
import type { AiDriver } from './internal';
import { createSim, createSimWithWorld, initPhysics } from './index';

beforeAll(async () => {
  await initPhysics();
});

const scripted = (seed: number): RaceSetup => {
  const s = buildQuickRaceSetup({ seed, aiCount: 3 });
  return { ...s, entrants: s.entrants.map((e) => ({ ...e, ai: null })) };
};

/** Deterministic scripted inputs for every car. */
function inputsAt(tick: number): Map<number, InputFrame> {
  const m = new Map<number, InputFrame>();
  for (let i = 0; i < 4; i++) {
    m.set(i, { ...NEUTRAL_INPUT, throttle: 1, steer: Math.sin(tick * 0.03 + i) * 0.6, fire: tick % 50 < 10 });
  }
  return m;
}

describe('createSim', () => {
  it('initPhysics is idempotent', async () => {
    const a = initPhysics();
    expect(initPhysics()).toBe(a);
    await a;
  });

  it('determinism: same setup and inputs for 600 ticks give the same stateHash', () => {
    const run = (seed: number) => {
      const sim = createSim(scripted(seed));
      for (let t = 0; t < 600; t++) sim.step(inputsAt(t));
      const h = sim.stateHash();
      sim.dispose();
      return h;
    };
    const a = run(7);
    expect(run(7)).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('determinism holds with the stub AI drivers too', () => {
    const run = () => {
      const sim = createSim(buildQuickRaceSetup({ seed: 11 }));
      for (let t = 0; t < 600; t++) sim.step(new Map());
      const h = sim.stateHash();
      sim.dispose();
      return h;
    };
    expect(run()).toBe(run());
  });

  it('countdown: 3, 2, 1, raceStart after 3 s with cars frozen', () => {
    const { sim, world } = createSimWithWorld(scripted(1));
    const start = world.cars.map((c) => ({ ...c.body.translation() }));
    const seen: { tick: number; e: SimEvent }[] = [];
    for (let t = 0; t < 200; t++) {
      for (const e of sim.step(inputsAt(t))) seen.push({ tick: t, e });
      if (t < 179) {
        world.cars.forEach((c, i) => {
          expect(c.body.translation().x).toBeCloseTo(start[i].x, 6);
          expect(c.body.translation().y).toBeCloseTo(start[i].y, 6);
        });
        expect(sim.snapshot().phase).toBe('countdown');
      }
    }
    expect(seen.map((s) => [s.tick, s.e.type, 'value' in s.e ? s.e.value : null])).toEqual([
      [0, 'countdown', 3],
      [60, 'countdown', 2],
      [120, 'countdown', 1],
      [180, 'raceStart', null],
    ]);
    expect(sim.snapshot().phase).toBe('racing');
    expect(sim.snapshot().time).toBeCloseTo(20 / 60, 9);
    sim.dispose();
  });

  it('inputs are copied field by field into car.input / prevInput', () => {
    const { sim, world } = createSimWithWorld(scripted(1));
    const frame: InputFrame = { ...NEUTRAL_INPUT, throttle: 0.5 };
    const m = new Map([[0, frame]]);
    sim.step(m);
    expect(world.cars[0].input).not.toBe(frame);
    expect(world.cars[0].input.throttle).toBe(0.5);
    frame.throttle = 0.9;
    expect(world.cars[0].input.throttle).toBe(0.5);
    sim.step(m);
    expect(world.cars[0].prevInput.throttle).toBe(0.5);
    expect(world.cars[0].input.throttle).toBe(0.9);
    expect(world.cars[1].input).toEqual(NEUTRAL_INPUT);
    sim.dispose();
  });

  it('reaction delay: decide() switching at tick T reaches car.input at exactly T + reactionTicks', () => {
    const base = scripted(1);
    const setup = { ...base, entrants: base.entrants.map((e, i) => (i === 1 ? buildQuickRaceSetup({ seed: 1 }).entrants[1] : e)) };
    const { sim, world } = createSimWithWorld(setup);
    const R = setup.entrants[1].ai?.reactionTicks ?? 0;
    expect(R).toBeGreaterThan(0);
    const T = 30;
    const reused: InputFrame = { ...NEUTRAL_INPUT };
    const driver: AiDriver = {
      car: 1,
      profile: setup.entrants[1].ai!,
      decide: (w) => {
        reused.throttle = w.tick >= T ? 1 : 0;
        return reused;
      },
    };
    world.ai[1] = driver;
    let firstTick = -1;
    for (let t = 0; t < T + R + 10; t++) {
      sim.step(new Map());
      if (firstTick < 0 && world.cars[1].input.throttle === 1) firstTick = t;
    }
    expect(firstTick).toBe(T + R);
    sim.dispose();
  });

  it('snapshot is detached and mirrors the world', () => {
    const { sim, world } = createSimWithWorld(scripted(1));
    const a = sim.snapshot();
    expect(a.cars).toHaveLength(4);
    expect(a.pickups).toHaveLength(world.pickups.length);
    a.cars[0].pos.x += 1000;
    a.pickups[0].pos.x += 1000;
    expect(sim.snapshot().cars[0].pos.x).not.toBe(a.cars[0].pos.x);
    expect(sim.snapshot().pickups[0].pos.x).toBe(world.pickups[0].pos.x);
    expect(a.cars[0].hp).toBe(world.cars[0].hp);
    expect(a.laps).toBe(3);
    sim.dispose();
  });

  it('debugFinishRace: phase finished, 4-row result, raceFinished on the next step, then no-op', () => {
    const sim = createSim(scripted(1));
    for (let t = 0; t < 240; t++) sim.step(inputsAt(t));
    expect(sim.result()).toBeNull();
    sim.debugFinishRace();
    expect(sim.snapshot().phase).toBe('finished');
    const r = sim.result();
    expect(r?.rows).toHaveLength(4);
    expect(r?.rows.map((x) => x.position)).toEqual([1, 2, 3, 4]);
    expect(r?.rows.every((x) => !x.finished && x.totalTime === null)).toBe(true);
    expect(sim.step(new Map()).map((e) => e.type)).toEqual(['raceFinished']);
    sim.debugFinishRace();
    expect(sim.step(new Map())).toEqual([]);
    expect(sim.result()).toBe(r);
    sim.dispose();
    sim.dispose();
  });

  it('result ranking: finished by time, then progress, wrecked last (later wreck higher)', () => {
    const { sim, world } = createSimWithWorld(scripted(1));
    const [a, b, c, d] = world.cars;
    a.progress = 10;
    b.finished = true;
    b.finishTime = 50;
    c.wrecked = true;
    c.wreckedAt = 5;
    d.wrecked = true;
    d.wreckedAt = 9;
    sim.debugFinishRace();
    expect(sim.result()?.rows.map((r) => r.car)).toEqual([1, 0, 3, 2]);
    expect(sim.result()?.rows[0].totalTime).toBe(50);
    sim.dispose();
  });
});
