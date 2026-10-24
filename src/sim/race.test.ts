import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import { END_AFTER_PLAYER_FINISH, END_AFTER_PLAYER_WRECK, WRONG_WAY_SECONDS } from '../content/race';
import type { InputFrame, RaceSetup, Sim, SimEvent, TrackDef, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT, SIM_HZ } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import type { SimWorld } from './internal';
import { createSimWithWorld, initPhysics } from './index';

beforeAll(async () => {
  await initPhysics();
});

/** 'straight': an oval with two 400 m straights (start mid-straight); 'circle': r = 80. Both 14 m wide, clockwise on screen. */
function makeTestTrack(kind: 'straight' | 'circle'): TrackDef {
  const pts: Vec2[] = [];
  if (kind === 'circle') {
    for (let d = 0; d < 360; d += 15) pts.push({ x: 80 * Math.cos((d * Math.PI) / 180), y: 80 * Math.sin((d * Math.PI) / 180) });
  } else {
    const r = 60;
    for (let x = 200; x < 400; x += 25) pts.push({ x, y: 0 });
    for (let d = -90; d < 90; d += 15) pts.push({ x: 400 + r * Math.cos((d * Math.PI) / 180), y: r + r * Math.sin((d * Math.PI) / 180) });
    for (let x = 400; x > 0; x -= 25) pts.push({ x, y: 2 * r });
    for (let d = 90; d < 270; d += 15) pts.push({ x: r * Math.cos((d * Math.PI) / 180), y: r + r * Math.sin((d * Math.PI) / 180) });
    for (let x = 0; x < 200; x += 25) pts.push({ x, y: 0 });
  }
  return { id: `test-${kind}`, name: kind, theme: 'scrapyard', centerline: pts, width: 14, shoulder: 4, checkpointSpacing: 40, pickups: [], props: [], referenceLapTime: 40 };
}

function setupOn(kind: 'straight' | 'circle', cars: number, laps: number, seed = 5): RaceSetup {
  const s = buildQuickRaceSetup({ seed, aiCount: cars - 1 });
  return { ...s, track: makeTestTrack(kind), laps, entrants: s.entrants.map((e) => ({ ...e, ai: null })) };
}

function racing(cars: number, laps: number) {
  const { sim, world } = createSimWithWorld(setupOn('straight', cars, laps));
  while (world.phase !== 'racing') sim.step(new Map());
  return { sim, world };
}

function place(world: SimWorld, id: number, s: number, lateral: number, speed = 0, headingOffset = 0): void {
  const car = world.cars[id];
  const smp = world.track.sampleAt(s);
  const p = { x: smp.pos.x + smp.right.x * lateral, y: smp.pos.y + smp.right.y * lateral };
  const h = Math.atan2(smp.tangent.y, smp.tangent.x) + headingOffset;
  car.body.setTranslation(p, true);
  car.body.setRotation(h, true);
  car.body.setLinvel({ x: Math.cos(h) * speed, y: Math.sin(h) * speed }, true);
  car.body.setAngvel(0, true);
  car.prevPos.x = p.x;
  car.prevPos.y = p.y;
  car.trackS = smp.s;
  car.lateral = lateral;
}

/** Test-only path follower: steers toward the centerline `ahead` m along the track (negative = behind). */
function follow(world: SimWorld, id: number, throttle: number, ahead = 12): InputFrame {
  const car = world.cars[id];
  const smp = world.track.sampleAt(car.trackS + ahead);
  const p = car.body.translation();
  const want = Math.atan2(smp.pos.y - p.y, smp.pos.x - p.x);
  return { ...NEUTRAL_INPUT, throttle, steer: clamp(angleWrap(want - car.body.rotation()) * 2, -1, 1) };
}

/** Steps with every listed car following the centerline; returns all events with their race time. */
function run(sim: Sim, world: SimWorld, ticks: number, drivers: Record<number, number>, until?: (e: SimEvent) => boolean) {
  const seen: { time: number; e: SimEvent }[] = [];
  for (let t = 0; t < ticks; t++) {
    const m = new Map<number, InputFrame>();
    for (const [id, throttle] of Object.entries(drivers)) m.set(Number(id), follow(world, Number(id), throttle));
    const time = world.time;
    const evs = sim.step(m);
    for (const e of evs) seen.push({ time, e });
    if (until && evs.some(until)) break;
  }
  return seen;
}

describe('race rules', () => {
  it('countdown and green light keep the WP00 timing (3, 2, 1 on ticks 0, 60, 120, raceStart on 180)', () => {
    const { sim } = createSimWithWorld(setupOn('straight', 2, 1));
    const seen: [number, string][] = [];
    for (let t = 0; t < 200; t++) for (const e of sim.step(new Map())) seen.push([t, e.type === 'countdown' ? `${e.value}` : e.type]);
    expect(seen).toEqual([
      [0, '3'],
      [60, '2'],
      [120, '1'],
      [180, 'raceStart'],
    ]);
    sim.dispose();
  });

  it('6. lap counting: the path follower completes 3 laps, events once each, lap times within 10%', () => {
    const { sim, world } = racing(2, 3);
    const seen = run(sim, world, 200 * SIM_HZ, { 0: 0.7 }, (e) => e.type === 'carFinished');
    const laps = seen.filter((s) => s.e.type === 'lapCompleted').map((s) => s.e);
    expect(laps).toHaveLength(3);
    expect(laps.map((e) => (e.type === 'lapCompleted' ? e.lap : -1))).toEqual([1, 2, 3]);
    expect(seen.filter((s) => s.e.type === 'finalLap')).toHaveLength(1);
    const fin = seen.filter((s) => s.e.type === 'carFinished');
    expect(fin).toHaveLength(1);
    expect(fin[0].e).toMatchObject({ car: 0, position: 1 });
    const times = laps.map((e) => (e.type === 'lapCompleted' ? e.lapTime : 0));
    expect(Math.max(...times) / Math.min(...times)).toBeLessThanOrEqual(1.1);
    const c = world.cars[0];
    expect(c.finished).toBe(true);
    expect(c.lap).toBe(3);
    expect(c.bestLapTime).toBe(Math.min(...times));
    expect(c.position).toBe(1);
    expect(world.cars[1].position).toBe(2);
    // No more events for the finished car.
    expect(run(sim, world, 2 * SIM_HZ, {}).filter((s) => s.e.type !== 'raceFinished')).toEqual([]);
    sim.dispose();
  });

  it('7. no cutting: teleporting across the infield to the start line counts no lap', () => {
    const { sim, world } = racing(2, 3);
    const L = world.track.length;
    let t = 0;
    while (world.cars[0].trackS < L / 2 - 50 || world.cars[0].trackS > L / 2) {
      run(sim, world, 1, { 0: 0.7 });
      if (++t > 60 * SIM_HZ) throw new Error('follower never reached the far straight');
    }
    const car = world.cars[0];
    const next = car.nextCheckpoint;
    expect(car.crossedStart).toBe(true);
    expect(next).toBeGreaterThan(1);
    place(world, 0, L - 20, 0, 20);
    const seen = run(sim, world, 4 * SIM_HZ, { 0: 0.7 });
    expect(seen.filter((s) => s.e.type === 'lapCompleted')).toEqual([]);
    expect(car.lap).toBe(0);
    expect(car.nextCheckpoint).toBe(next);
    expect(car.progress).toBeLessThanOrEqual(world.track.checkpoints[next].s + 20 + 1e-9);
    sim.dispose();
  });

  it('8. wrong way: driving backwards around the track sets wrongWay within 1.5 s, no lap counted', () => {
    const { sim, world } = racing(2, 3);
    const L = world.track.length;
    place(world, 0, L - 30, 0, 15, Math.PI);
    let firstWrong = -1;
    const seen: SimEvent[] = [];
    for (let t = 0; t < 12 * SIM_HZ; t++) {
      seen.push(...sim.step(new Map([[0, follow(world, 0, 0.7, -12)]])));
      if (firstWrong < 0 && world.cars[0].wrongWay) firstWrong = t;
    }
    const elapsed = (firstWrong + 1) * SIM_DT; // ticks are 0-based
    expect(firstWrong).toBeGreaterThan(0);
    expect(elapsed).toBeGreaterThanOrEqual(WRONG_WAY_SECONDS - 1e-9);
    expect(elapsed).toBeLessThanOrEqual(1.5);
    expect(world.cars[0].wrongWay).toBe(true);
    expect(seen.filter((e) => e.type === 'lapCompleted')).toEqual([]);
    expect(world.cars[0].lap).toBe(0);
    // Turning around clears it.
    place(world, 0, world.cars[0].trackS, 0, 15);
    for (let t = 0; t < 5; t++) sim.step(new Map([[0, follow(world, 0, 0.7)]]));
    expect(world.cars[0].wrongWay).toBe(false);
    sim.dispose();
  });

  it('wrong way survives reversing back over the start line (no wrap artefact)', () => {
    const { sim, world } = racing(2, 3);
    place(world, 0, 10, 0, 15, Math.PI); // just past the line, but never crossed it: still on the grid lap
    for (let t = 0; t < 3 * SIM_HZ; t++) sim.step(new Map([[0, follow(world, 0, 0.7, -12)]]));
    expect(world.cars[0].wrongWay).toBe(true);
    expect(world.cars[0].crossedStart).toBe(false);
    sim.dispose();
  });

  it('11. race end: 2 cars, car 1 never moves; the race ends 15 s after the player finishes', () => {
    const { sim, world } = racing(2, 1);
    const seen = run(sim, world, 60 * SIM_HZ, { 0: 0.7 }, (e) => e.type === 'carFinished');
    const fin = seen.find((s) => s.e.type === 'carFinished');
    expect(fin?.e).toMatchObject({ car: 0, position: 1 });
    expect(world.playerFinishedAt).toBe(fin?.time);
    let endTime = -1;
    for (let t = 0; t < 20 * SIM_HZ && endTime < 0; t++) {
      const time = world.time;
      if (sim.step(new Map()).some((e) => e.type === 'raceFinished')) endTime = time;
    }
    expect(endTime - (fin?.time ?? 0)).toBeCloseTo(END_AFTER_PLAYER_FINISH, 6);
    expect(sim.snapshot().phase).toBe('finished');
    const rows = sim.result()?.rows ?? [];
    expect(rows.map((r) => [r.car, r.position, r.finished])).toEqual([
      [0, 1, true],
      [1, 2, false],
    ]);
    expect(rows[0].totalTime).toBe(fin?.time);
    expect(rows[0].bestLap).not.toBeNull();
    sim.dispose();
  });

  it('race end: all non-wrecked cars finished ends the race on the next tick', () => {
    const { sim, world } = racing(2, 1);
    world.cars[1].wrecked = true;
    const seen = run(sim, world, 60 * SIM_HZ, { 0: 0.7 }, (e) => e.type === 'raceFinished');
    expect(seen.map((s) => s.e.type).slice(-2)).toEqual(['carFinished', 'raceFinished']);
    expect(sim.result()?.rows.map((r) => r.car)).toEqual([0, 1]);
    sim.dispose();
  });

  it('12. player wrecked: the race ends 2 s later, player row wrecked and last', () => {
    const { sim, world } = racing(2, 3);
    run(sim, world, SIM_HZ, { 0: 0.7, 1: 0.5 });
    world.cars[0].hp = 0;
    world.cars[0].wrecked = true;
    let endTime = -1;
    for (let t = 0; t < 5 * SIM_HZ && endTime < 0; t++) {
      const time = world.time;
      if (sim.step(new Map([[0, { ...NEUTRAL_INPUT, throttle: 1 }]])).some((e) => e.type === 'raceFinished')) endTime = time;
    }
    expect(world.playerWreckedAt).not.toBeNull();
    expect(world.cars[0].wreckedAt).toBe(world.playerWreckedAt);
    expect(endTime - (world.playerWreckedAt ?? 0)).toBeCloseTo(END_AFTER_PLAYER_WRECK, 6);
    const rows = sim.result()?.rows ?? [];
    expect(rows.map((r) => [r.car, r.position, r.wrecked, r.finished])).toEqual([
      [1, 1, false, false],
      [0, 2, true, false],
    ]);
    expect(rows[1].hpLeft).toBe(0);
    sim.dispose();
  });

  it('live positions follow progress, wrecked last', () => {
    const { sim, world } = racing(4, 3);
    // Car 1 drives off; the others stay on the grid, ranked by their grid progress (car 0 front row).
    run(sim, world, 4 * SIM_HZ, { 1: 1 });
    const [a, b, c, d] = world.cars;
    expect(b.progress).toBeGreaterThan(0);
    expect(a.progress).toBeGreaterThan(c.progress);
    expect(c.progress).toBeGreaterThan(d.progress);
    expect([b.position, a.position, c.position, d.position]).toEqual([1, 2, 3, 4]);
    b.wrecked = true;
    run(sim, world, 1, {});
    expect([a.position, c.position, d.position, b.position]).toEqual([1, 2, 3, 4]);
    expect(b.wreckedAt).not.toBeNull();
    sim.dispose();
  });

  it('13. determinism: same seed and inputs for 3600 ticks give the same stateHash', () => {
    const go = (throttle: number) => {
      const { sim, world } = createSimWithWorld(setupOn('straight', 4, 3, 9));
      run(sim, world, 3600, { 0: throttle, 1: 0.8, 2: 0.6, 3: 0.9 });
      const h = sim.stateHash();
      sim.dispose();
      return h;
    };
    const a = go(0.7);
    expect(go(0.7)).toBe(a);
    expect(go(0.75)).not.toBe(a);
  });

  it('14. perf: 4 cars, 3600 ticks with the test controller in < 1.8 s', () => {
    const { sim, world } = createSimWithWorld(setupOn('straight', 4, 3));
    const t0 = performance.now();
    run(sim, world, 3600, { 0: 0.7, 1: 0.8, 2: 0.6, 3: 0.9 });
    const ms = performance.now() - t0;
    expect(world.cars.every((c) => c.lap >= 1)).toBe(true);
    expect(ms).toBeLessThan(1800);
    sim.dispose();
  });
});
