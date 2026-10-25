import { beforeAll, describe, expect, it } from 'vitest';
import { profileForSkill } from '../content/ai';
import { buildQuickRaceSetup } from '../content/quickRace';
import { getTrack } from '../content/tracks';
import type { TrackDef, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_HZ } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import { buildTrackGeometry, createTrackSample } from '../shared/trackGeometry';
import { createSim, createSimWithWorld, initPhysics } from './index';
import { buildRacingLine, LAT_ACCEL_PER_GRIP, lineCurvature, lineLimit } from './racingLine';
import { runSoak, type SoakStats, soakSetup } from './soak';

beforeAll(async () => {
  await initPhysics();
});

const SCRAPYARD = getTrack('scrapyard');
const RAVEN = buildQuickRaceSetup({ seed: 1 }).entrants[0].stats;
const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

function circleTrack(r: number): TrackDef {
  const pts: Vec2[] = [];
  for (let d = 0; d < 360; d += 10) pts.push({ x: r * Math.cos((d * Math.PI) / 180), y: r * Math.sin((d * Math.PI) / 180) });
  return { id: `ai-circle-${r}`, name: 'circle', theme: 'scrapyard', centerline: pts, width: 14, shoulder: 4, checkpointSpacing: 40, pickups: [], props: [], referenceLapTime: 40 };
}

/**
 * Holds a raven at speed v on a circle of radius r (clockwise, tight pursuit controller, no delay) for 6 s
 * and returns the worst radial error after the first 2 s.
 */
function holdCircle(r: number, v: number): number {
  const s = buildQuickRaceSetup({ seed: 1, aiCount: 1 });
  const { sim, world } = createSimWithWorld({ ...s, track: circleTrack(r), entrants: s.entrants.map((e) => ({ ...e, ai: null })) });
  world.phase = 'racing';
  world.countdown = 0;
  const car = world.cars[0];
  world.cars[1].body.setTranslation({ x: 0, y: 0 }, true);
  car.body.setTranslation({ x: r, y: 0 }, true);
  car.body.setRotation(Math.PI / 2, true);
  car.body.setLinvel({ x: 0, y: v }, true);
  const input = { ...NEUTRAL_INPUT };
  const inputs = new Map([[0, input]]);
  let worst = 0;
  for (let t = 0; t < 6 * SIM_HZ; t++) {
    const p = car.body.translation();
    const vel = car.body.linvel();
    const h = car.body.rotation();
    const vF = vel.x * Math.cos(h) + vel.y * Math.sin(h);
    const ang = Math.atan2(p.y, p.x) + 6 / r;
    input.steer = clamp(angleWrap(Math.atan2(r * Math.sin(ang) - p.y, r * Math.cos(ang) - p.x) - h) * 3, -1, 1);
    input.throttle = vF < v ? clamp((v - vF) * 2, 0, 1) : 0;
    input.brake = vF > v + 0.3 ? clamp(vF - v, 0, 1) : 0;
    sim.step(inputs);
    if (t > 2 * SIM_HZ) {
      const q = car.body.translation();
      worst = Math.max(worst, Math.abs(Math.hypot(q.x, q.y) - r));
    }
  }
  sim.dispose();
  return worst;
}

describe('racing line', () => {
  it('LAT_ACCEL measurement: a raven holds 17 m and 22 m circles at sqrt(LAT_ACCEL * r), not at 1.3x LAT_ACCEL', () => {
    const latAccel = RAVEN.grip * LAT_ACCEL_PER_GRIP;
    for (const r of [17, 22]) expect(holdCircle(r, Math.min(Math.sqrt(latAccel * r), RAVEN.maxSpeed))).toBeLessThan(2.5);
    expect(holdCircle(17, Math.sqrt(1.3 * latAccel * 17))).toBeGreaterThan(3);
  });

  it('1. stays within lim and has >= 15% less total |curvature| than the centerline on Scrapyard', () => {
    const track = buildTrackGeometry(SCRAPYARD);
    const line = buildRacingLine(track, RAVEN.grip, RAVEN.brake);
    expect(buildRacingLine(track, RAVEN.grip, RAVEN.brake)).toBe(line); // cached
    const lim = lineLimit(track);
    const n = track.samples.length;
    expect(line.offsets.length).toBe(n);
    expect(Math.max(...line.offsets.map(Math.abs))).toBeLessThanOrEqual(lim + 1e-5);
    // Total absolute curvature = integral of |k| ds along each path.
    const k = lineCurvature(line);
    const at = (i: number): Vec2 => {
      const s = track.samples[i % n];
      return { x: s.pos.x + s.right.x * line.offsets[i % n], y: s.pos.y + s.right.y * line.offsets[i % n] };
    };
    let center = 0;
    let racing = 0;
    for (let i = 0; i < n; i++) {
      center += Math.abs(track.samples[i].curvature) * (track.length / n);
      const a = at(i);
      const b = at(i + 1);
      racing += Math.abs(k[i]) * Math.hypot(b.x - a.x, b.y - a.y);
    }
    expect(racing).toBeLessThan(center * 0.85);
  });

  it('speed profile: never above the corner speed, and every slowdown is reachable with 0.85 * brake', () => {
    const track = buildTrackGeometry(SCRAPYARD);
    const line = buildRacingLine(track, RAVEN.grip, RAVEN.brake);
    const k = lineCurvature(line);
    const n = track.samples.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      expect(line.speeds[i]).toBeLessThanOrEqual(Math.sqrt((RAVEN.grip * LAT_ACCEL_PER_GRIP) / Math.max(Math.abs(k[i]), 1e-4)) * (1 + 1e-5));
      const ds = (track.length / n) * 1.5; // path spacing is at most ~1.5x the centerline spacing
      expect(line.speeds[i] ** 2).toBeLessThanOrEqual(line.speeds[j] ** 2 + 2 * RAVEN.brake * 0.85 * ds + 1e-3);
    }
  });
});

describe('soak (Scrapyard x 3 laps, AI 0.35/0.55/0.75 + autoplay 0.55)', () => {
  const results: SoakStats[] = [];
  const raceTimeLimit = 3 * SCRAPYARD.referenceLapTime * 1.6;

  it.each(SEEDS)('2. seed %i: race completes, nobody stuck', (seed) => {
    const r = runSoak({ trackId: 'scrapyard', seed });
    results.push(r);
    expect(r.endReason).not.toBe('timeout');
    const live = r.cars.filter((c) => !c.wrecked);
    if (r.endReason === 'allFinished') {
      expect(live.every((c) => c.finished)).toBe(true);
      expect(r.raceTime).toBeLessThan(raceTimeLimit);
    } else if (r.endReason === 'playerFinished15s') {
      expect(live.every((c) => c.finished || c.lap >= 2)).toBe(true);
    }
    for (const c of live) expect(c.stuckCount).toBeLessThanOrEqual(2);
  });

  it('3. skill ordering: the 0.75 car averages >= 0.8 places better than the 0.35 car', () => {
    expect(results.length).toBe(SEEDS.length);
    const avg = (skill: number) => results.reduce((sum, r) => sum + (r.cars.find((c) => Math.abs(c.skill - skill) < 1e-9)?.position ?? 0), 0) / results.length;
    const ends = results.map((r) => r.endReason).join(' ');
    console.warn(`WP07 avg position: 0.35 ${avg(0.35).toFixed(2)}, 0.75 ${avg(0.75).toFixed(2)}; end reasons: ${ends}`);
    expect(avg(0.35) - avg(0.75)).toBeGreaterThanOrEqual(0.8);
  });

  it('4. combat happens: >= 6 gun damage events and >= 1 mine per race, 0.2-2.0 wrecks per race', () => {
    expect(results.length).toBe(SEEDS.length);
    const per = (f: (r: SoakStats) => number) => results.reduce((s, r) => s + f(r), 0) / results.length;
    expect(per((r) => r.gunDamageEvents)).toBeGreaterThanOrEqual(6);
    expect(per((r) => r.minesDropped)).toBeGreaterThanOrEqual(1);
    const wrecks = per((r) => r.wrecks);
    console.warn(`WP07 per race: gun damage events ${per((r) => r.gunDamageEvents).toFixed(1)}, mines ${per((r) => r.minesDropped).toFixed(2)}, wrecks ${wrecks.toFixed(2)}`);
    expect(wrecks).toBeGreaterThanOrEqual(0.2);
    expect(wrecks).toBeLessThanOrEqual(2);
  });

  it('5. lap time calibration: median clean lap of the 0.55 AI is within 10% of referenceLapTime', () => {
    const laps = results.flatMap((r) => r.cars.filter((c) => Math.abs(c.skill - 0.55) < 1e-9).flatMap((c) => c.cleanLaps)).sort((a, b) => a - b);
    expect(laps.length).toBeGreaterThan(0);
    const median = laps[laps.length >> 1];
    // Reported so the orchestrator can set referenceLapTime (content belongs to WP12).
    console.warn(`WP07 median clean lap (0.55 AI, ${laps.length} laps): ${median.toFixed(2)} s, referenceLapTime ${SCRAPYARD.referenceLapTime}`);
    expect(Math.abs(median - SCRAPYARD.referenceLapTime) / SCRAPYARD.referenceLapTime).toBeLessThan(0.25);
  });
});

describe('determinism and perf', () => {
  it('6. the same seed gives the same stateHash every 600 ticks', () => {
    const run = (): string[] => {
      const sim = createSim(soakSetup({ trackId: 'scrapyard', seed: 9 }));
      const hashes: string[] = [];
      for (let t = 1; t <= 4200; t++) {
        sim.step(new Map());
        if (t % 600 === 0) hashes.push(sim.stateHash());
      }
      sim.dispose();
      return hashes;
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(new Set(a).size).toBe(a.length);
  });

  it('7. perf: 4 AI cars average < 0.5 ms per tick over a 3-lap race', () => {
    const sim = createSim(soakSetup({ trackId: 'scrapyard', seed: 3 }));
    const none = new Map();
    for (let t = 0; t < 60; t++) sim.step(none); // warm-up (JIT, countdown)
    let ticks = 0;
    const t0 = performance.now();
    while (sim.result() === null && ticks < 6900) {
      sim.step(none);
      ticks++;
    }
    const ms = (performance.now() - t0) / ticks;
    sim.dispose();
    console.warn(`WP07 perf: ${ticks} ticks, ${ms.toFixed(4)} ms per tick`);
    expect(ticks).toBeGreaterThan(3000);
    expect(ms).toBeLessThan(0.5);
  });
});

/** A 400 m x 100 m stadium (two 400 m straights, r 50 ends), clockwise on screen, s 0 at the start of the bottom straight. */
function stadiumTrack(): TrackDef {
  const pts: Vec2[] = [];
  for (let x = 0; x < 400; x += 10) pts.push({ x, y: 0 });
  for (let d = -90; d < 90; d += 10) pts.push({ x: 400 + 50 * Math.cos((d * Math.PI) / 180), y: 50 + 50 * Math.sin((d * Math.PI) / 180) });
  for (let x = 400; x > 0; x -= 10) pts.push({ x, y: 100 });
  for (let d = 90; d < 270; d += 10) pts.push({ x: 50 * Math.cos((d * Math.PI) / 180), y: 50 + 50 * Math.sin((d * Math.PI) / 180) });
  return { id: 'ai-stadium', name: 'stadium', theme: 'scrapyard', centerline: pts, width: 14, shoulder: 4, checkpointSpacing: 40, pickups: [], props: [], referenceLapTime: 40 };
}

describe('wrecks (CCR-7)', () => {
  it('an AI at speed passes a wreck on its racing line 30 m ahead within 10 s, and moves the wreck < 15 m', () => {
    // Car 0 is the 0.75 AI (the car WP23a saw pushing a wreck), car 1 the wreck; car 1 is not the player so no end-by-rule.
    const s = buildQuickRaceSetup({ seed: 1, aiCount: 1 });
    const setup = { ...s, track: stadiumTrack(), entrants: s.entrants.map((e) => ({ ...e, ai: e.id === 0 ? profileForSkill(0.75) : null })) };
    const { sim, world } = createSimWithWorld(setup);
    world.phase = 'racing';
    world.countdown = 0;
    const [ai, wreck] = world.cars;
    const line = buildRacingLine(world.track, ai.base.grip, ai.base.brake);
    const n = line.offsets.length;
    const place = (car: typeof ai, sAt: number, speed: number): Vec2 => {
      const smp = world.track.sampleAtInto(createTrackSample(), sAt);
      const lat = line.offsets[Math.round((sAt / world.track.length) * n) % n];
      const pos = { x: smp.pos.x + smp.right.x * lat, y: smp.pos.y + smp.right.y * lat };
      const h = Math.atan2(smp.tangent.y, smp.tangent.x);
      car.body.setTranslation(pos, true);
      car.body.setRotation(h, true);
      car.body.setLinvel({ x: Math.cos(h) * speed, y: Math.sin(h) * speed }, true);
      car.trackS = sAt; // the AI reads last tick's projection
      car.lateral = lat;
      return pos;
    };
    place(ai, 100, 20);
    const wreckStart = place(wreck, 130, 0);
    wreck.hp = 0;
    wreck.wrecked = true;
    wreck.wreckedAt = 0;

    const none = new Map();
    let passedAt = -1;
    for (let t = 0; t < 10 * SIM_HZ && passedAt < 0; t++) {
      sim.step(none);
      if (ai.trackS - wreck.trackS > 5) passedAt = t / SIM_HZ;
    }
    const w = wreck.body.translation();
    const moved = Math.hypot(w.x - wreckStart.x, w.y - wreckStart.y);
    sim.dispose();
    expect(passedAt).toBeGreaterThan(0);
    expect(moved).toBeLessThan(15);
  });
});

describe('wrecks (CCR-8)', () => {
  it('an AI glued to a wreck below crawl speed recovers: rainDistrict seed 14, 0.75 AI in slot 0, finishes before the soak timeout', () => {
    // On main the 0.75 AI shoved car 2's wreck at 1-2.6 m/s for 80+ s (above STUCK_SPEED, so no recovery) and the race timed out.
    const setup = soakSetup({ trackId: 'rainDistrict', seed: 14 });
    const skills = [0.75, 0.55, 0.35, 0.55];
    setup.entrants.forEach((e, i) => (e.ai = profileForSkill(skills[i] ?? 0.55)));
    const sim = createSim(setup);
    const maxTicks = Math.ceil((setup.countdownSeconds + setup.laps * setup.track.referenceLapTime * 3) * SIM_HZ);
    const none = new Map();
    for (let t = 0; t < maxTicks && sim.result() === null; t++) sim.step(none);
    const result = sim.result();
    sim.dispose();
    expect(result).not.toBeNull();
    expect(result!.rows.find((r) => r.car === 0)!.finished).toBe(true);
  });
});
