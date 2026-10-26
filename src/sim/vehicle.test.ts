import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import { SCRAPYARD_FIXTURE } from '../content/tracks/fixtures';
import { getCar } from '../content/cars';
import { computeStats } from '../content/economy';
import { OFFROAD_MODS } from '../content/vehicle';
import type { InputFrame, RaceSetup, TrackDef, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT, SIM_HZ } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import type { SimWorld } from './internal';
import { createSimWithWorld, initPhysics } from './index';

beforeAll(async () => {
  await initPhysics();
});

// Mirrors of the WP01 physics constants (module-private in vehicle.ts) that the pass conditions use.
const REVERSE_MAX = 0.3;
const RAVEN = buildQuickRaceSetup({ seed: 1 }).entrants[0].stats;

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

function setupOn(kind: 'straight' | 'circle', cars = 2, laps = 3): RaceSetup {
  const s = buildQuickRaceSetup({ seed: 5, aiCount: cars - 1 });
  return { ...s, track: makeTestTrack(kind), laps, entrants: s.entrants.map((e) => ({ ...e, ai: null })) };
}

function racing(kind: 'straight' | 'circle') {
  const { sim, world } = createSimWithWorld(setupOn(kind));
  while (world.phase !== 'racing') sim.step(new Map());
  return { sim, world };
}

/** Puts car `id` at track position s/lateral, facing along the track (+ headingOffset), moving forward at `speed`. */
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

function placeAt(world: SimWorld, id: number, p: Vec2, h: number, speed: number): void {
  const car = world.cars[id];
  car.body.setTranslation(p, true);
  car.body.setRotation(h, true);
  car.body.setLinvel({ x: Math.cos(h) * speed, y: Math.sin(h) * speed }, true);
  car.body.setAngvel(0, true);
  car.prevPos.x = p.x;
  car.prevPos.y = p.y;
}

const forwardSpeed = (world: SimWorld, id: number): number => {
  const b = world.cars[id].body;
  const v = b.linvel();
  const h = b.rotation();
  return v.x * Math.cos(h) + v.y * Math.sin(h);
};
const lateralSpeed = (world: SimWorld, id: number): number => {
  const b = world.cars[id].body;
  const v = b.linvel();
  const h = b.rotation();
  return -v.x * Math.sin(h) + v.y * Math.cos(h);
};

/** Test-only path follower: steers toward the point `ahead` m along the centerline at `lateral`. */
function follow(world: SimWorld, id: number, throttle: number, lateral = 0, ahead = 12): InputFrame {
  const car = world.cars[id];
  const smp = world.track.sampleAt(car.trackS + ahead);
  const p = car.body.translation();
  const want = Math.atan2(smp.pos.y + smp.right.y * lateral - p.y, smp.pos.x + smp.right.x * lateral - p.x);
  return { ...NEUTRAL_INPUT, throttle, steer: clamp(angleWrap(want - car.body.rotation()) * 2, -1, 1) };
}

const drive = (input: InputFrame) => new Map([[0, input]]);

// Straight-line tests start here: the bottom straight runs from s = L - 200 to s = 200 with the line at s = 0.
const STRAIGHT_START = (world: SimWorld): number => world.track.length - 190;

describe('applyDynamics', () => {
  it('1. top speed: 8 s of full throttle settles within maxSpeed * [0.97, 1.0]', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), -3);
    let peak = 0;
    for (let t = 0; t < 8 * SIM_HZ; t++) {
      sim.step(drive({ ...NEUTRAL_INPUT, throttle: 1 }));
      peak = Math.max(peak, forwardSpeed(world, 0));
    }
    const v = forwardSpeed(world, 0);
    expect(v).toBeGreaterThanOrEqual(RAVEN.maxSpeed * 0.97);
    expect(peak).toBeLessThanOrEqual(RAVEN.maxSpeed * 1.0 + 1e-6);
    sim.dispose();
  });

  it('1b. rocket fuel 5: turbo top speed is 1.50 / 1.30 of the fuel-0 turbo top speed (+-2%)', () => {
    const turboTop = (fuel: number): number => {
      const s = setupOn('straight');
      const stats = computeStats(getCar('raven'), { engine: 0, tires: 0, armor: 0, gun: 0, fuel, spikes: 0 });
      const { sim, world } = createSimWithWorld({ ...s, entrants: s.entrants.map((e, i) => (i === 0 ? { ...e, stats, turbo: 10 } : e)) });
      while (world.phase !== 'racing') sim.step(new Map());
      place(world, 0, STRAIGHT_START(world), -3, RAVEN.maxSpeed * 1.25);
      let peak = 0;
      for (let t = 0; t < 4 * SIM_HZ; t++) {
        sim.step(drive({ ...follow(world, 0, 1, -3, 30), turbo: true }));
        if (world.cars[0].turboActive) peak = Math.max(peak, forwardSpeed(world, 0));
      }
      sim.dispose();
      return peak;
    };
    const ratio = turboTop(5) / turboTop(0);
    expect(ratio).toBeGreaterThan((1.5 / 1.3) * 0.98);
    expect(ratio).toBeLessThan((1.5 / 1.3) * 1.02);
  });

  it('2. 0-100 km/h in 1.6-2.7 s', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), -3);
    let ticks = 0;
    while (forwardSpeed(world, 0) < 27.8 && ticks < 10 * SIM_HZ) {
      sim.step(drive({ ...NEUTRAL_INPUT, throttle: 1 }));
      ticks++;
    }
    const t = ticks * SIM_DT;
    expect(t).toBeGreaterThanOrEqual(1.6); // tuning pass 1 (accel x1.2): ~1.78 s, was 2.0-3.2 at ~2.17 s
    expect(t).toBeLessThanOrEqual(2.7);
    sim.dispose();
  });

  it('3. braking from top speed stops within v^2/(2*brake) * [0.98, 1.25]', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), -3);
    for (let t = 0; t < 8 * SIM_HZ; t++) sim.step(drive({ ...NEUTRAL_INPUT, throttle: 1 }));
    const v0 = forwardSpeed(world, 0);
    const p0 = { ...world.cars[0].body.translation() };
    let ticks = 0;
    while (forwardSpeed(world, 0) > 0 && ticks < 5 * SIM_HZ) {
      sim.step(drive({ ...NEUTRAL_INPUT, brake: 1 }));
      ticks++;
    }
    const p1 = world.cars[0].body.translation();
    const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const ideal = (v0 * v0) / (2 * RAVEN.brake);
    expect(v0).toBeGreaterThan(RAVEN.maxSpeed * 0.97);
    expect(d / ideal).toBeGreaterThanOrEqual(0.98);
    expect(d / ideal).toBeLessThanOrEqual(1.25);
    sim.dispose();
  });

  it('4. reverse: holding brake from rest reaches -REVERSE_MAX * maxSpeed +-5%, never more', () => {
    const { sim, world } = racing('straight');
    place(world, 0, 150, -3);
    let min = 0;
    for (let t = 0; t < 4 * SIM_HZ; t++) {
      sim.step(drive({ ...NEUTRAL_INPUT, brake: 1 }));
      min = Math.min(min, forwardSpeed(world, 0));
    }
    const cap = REVERSE_MAX * RAVEN.maxSpeed;
    expect(Math.abs(forwardSpeed(world, 0) + cap)).toBeLessThanOrEqual(cap * 0.05);
    expect(-min).toBeLessThanOrEqual(cap * 1.05);
    sim.dispose();
  });

  it('5. turning: at 15 m/s full steer circles right with radius 6-14 m; steer -1 turns left', () => {
    for (const steer of [1, -1]) {
      // The circle track's infield is open ground (no colliders inside the inner wall). It projects as dirt,
      // so lateral is pinned to 0 before each tick to measure the car's asphalt grip.
      const { sim, world } = racing('circle');
      placeAt(world, 0, { x: 0, y: 0 }, 0, 15);
      let turned = 0;
      let h = world.cars[0].body.rotation();
      const pts: Vec2[] = [];
      for (let t = 0; t < 8 * SIM_HZ && Math.abs(turned) < 4 * Math.PI; t++) {
        const v = forwardSpeed(world, 0);
        world.cars[0].lateral = 0;
        sim.step(drive({ ...NEUTRAL_INPUT, throttle: v < 15 ? 1 : 0, steer }));
        expect(world.cars[0].offroad).toBe(false);
        const h2 = world.cars[0].body.rotation();
        turned += angleWrap(h2 - h);
        h = h2;
        // Second full turn only: the first includes the steering ramp.
        if (Math.abs(turned) > 2 * Math.PI) pts.push({ ...world.cars[0].body.translation() });
      }
      expect(Math.sign(turned)).toBe(steer);
      expect(Math.abs(turned)).toBeGreaterThanOrEqual(4 * Math.PI);
      const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
      const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
      const r = pts.reduce((a, p) => a + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length;
      expect(r).toBeGreaterThanOrEqual(6);
      expect(r).toBeLessThanOrEqual(14);
      sim.dispose();
    }
  });

  it('9. drift: handbrake + full steer at 25 m/s slides, releasing grips again within 1.5 s', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), 0, 25);
    for (let t = 0; t < 0.5 * SIM_HZ; t++) sim.step(drive({ ...NEUTRAL_INPUT, steer: 1, handbrake: true }));
    expect(sim.snapshot().cars[0].drifting).toBe(true);
    expect(Math.abs(lateralSpeed(world, 0))).toBeGreaterThan(5);
    let ticks = 0;
    while (sim.snapshot().cars[0].drifting && ticks < 3 * SIM_HZ) {
      sim.step(drive(NEUTRAL_INPUT));
      ticks++;
    }
    expect(ticks * SIM_DT).toBeLessThanOrEqual(1.5);
    sim.dispose();
  });

  it('9b. feel: plain full steer at 60% of top speed grips (no drift)', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), -3, RAVEN.maxSpeed * 0.6); // tuning pass 1: DRIFT_THRESHOLD is absolute, full steer flags a drift from ~25 m/s (64% of 39.1); was 65% of 34
    let drifted = false;
    for (let t = 0; t < 0.4 * SIM_HZ; t++) {
      sim.step(drive({ ...NEUTRAL_INPUT, throttle: 1, steer: 1 }));
      drifted ||= world.cars[0].drifting;
    }
    expect(drifted).toBe(false);
    sim.dispose();
  });

  it('10. offroad: holding lateral > width/2 caps speed between 0.6 and 0.7 * maxSpeed', () => {
    const { sim, world } = racing('straight');
    const lat = 9; // road edge at 7, wall at 11
    place(world, 0, STRAIGHT_START(world), lat);
    let peak = 0;
    let offroadTicks = 0;
    const N = 15 * SIM_HZ;
    for (let t = 0; t < N; t++) {
      sim.step(drive(follow(world, 0, 1, lat)));
      peak = Math.max(peak, forwardSpeed(world, 0));
      if (world.cars[0].offroad) offroadTicks++;
    }
    expect(offroadTicks).toBeGreaterThan(N - 5);
    const v = forwardSpeed(world, 0);
    expect(v).toBeGreaterThanOrEqual(RAVEN.maxSpeed * 0.6);
    expect(peak).toBeLessThanOrEqual(RAVEN.maxSpeed * OFFROAD_MODS.maxSpeed);
    sim.dispose();
  });

  it('wrecked cars ignore input and get wreck damping; neutral input coasts without zeroing speed', () => {
    const { sim, world } = racing('straight');
    place(world, 0, STRAIGHT_START(world), -3, 20);
    sim.step(drive(NEUTRAL_INPUT));
    const v = forwardSpeed(world, 0);
    expect(v).toBeGreaterThan(19.9);
    expect(v).toBeLessThan(20);
    world.cars[0].wrecked = true;
    for (let t = 0; t < SIM_HZ; t++) sim.step(drive({ ...NEUTRAL_INPUT, throttle: 1 }));
    expect(world.cars[0].body.linearDamping()).toBe(2.5);
    expect(forwardSpeed(world, 0)).toBeLessThan(v * 0.15);
    sim.dispose();
  });
});

describe('finished cars (WP07, content.md section 7)', () => {
  /** Scrapyard (frozen pre-WP31 fixture), both entrants scripted, green light on, car 1 parked far off the track. */
  function scrapyard() {
    const s = buildQuickRaceSetup({ seed: 5, aiCount: 1 });
    const { sim, world } = createSimWithWorld({ ...s, track: SCRAPYARD_FIXTURE, entrants: s.entrants.map((e) => ({ ...e, ai: null })) });
    world.phase = 'racing';
    world.countdown = 0;
    placeAt(world, 1, { x: 5000, y: 5000 }, 0, 0);
    return { sim, world };
  }

  /** Steps `ticks` with car 0 holding `input`; returns the distance car 0 covered along s, worst |lateral| and wall impacts. */
  function cruise(sim: ReturnType<typeof scrapyard>['sim'], world: SimWorld, ticks: number, input: InputFrame) {
    const len = world.track.length;
    let travelled = 0;
    let worstLateral = 0;
    let wallHits = 0;
    let lastS = world.cars[0].trackS;
    for (let t = 0; t < ticks; t++) {
      const ev = sim.step(drive(input));
      const car = world.cars[0];
      let ds = car.trackS - lastS;
      if (ds < -len / 2) ds += len;
      if (ds > len / 2) ds -= len;
      travelled += ds;
      lastS = car.trackS;
      worstLateral = Math.max(worstLateral, Math.abs(car.lateral));
      wallHits += ev.filter((e) => e.type === 'impact' && e.a === 0 && e.b === 'wall' && e.speed > 4).length;
    }
    return { travelled, worstLateral, wallHits };
  }

  it('a finished car cruises the racing line: on the road, > 0.7 lap in 60 s, no wall hit, its input ignored', () => {
    const { sim, world } = scrapyard();
    place(world, 0, 100, 0, 20);
    world.cars[0].finished = true;
    world.cars[0].finishTime = 0;
    // Full throttle and steer are ignored: the cruise drives.
    const r = cruise(sim, world, 60 * SIM_HZ, { ...NEUTRAL_INPUT, throttle: 1, steer: 1 });
    expect(r.worstLateral).toBeLessThan(world.track.def.width / 2);
    expect(r.travelled).toBeGreaterThan(0.7 * world.track.length);
    expect(r.wallHits).toBe(0);
    expect(world.cars[0].wrecked).toBe(false);
    sim.dispose();
  });

  it('once the race is over every car cruises, unfinished ones included', () => {
    const { sim, world } = scrapyard();
    place(world, 0, 300, 0, 0);
    sim.debugFinishRace();
    const r = cruise(sim, world, 15 * SIM_HZ, NEUTRAL_INPUT);
    expect(world.phase).toBe('finished');
    expect(world.cars[0].finished).toBe(false);
    expect(r.travelled).toBeGreaterThan(150);
    expect(r.worstLateral).toBeLessThan(world.track.def.width / 2);
    sim.dispose();
  });
});
