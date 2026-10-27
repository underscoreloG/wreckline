import { beforeAll, describe, expect, it } from 'vitest';
import { GHOST_HZ, GHOST_TICKS, decodePoses, serializeGhost, type GhostLap } from '../meta/ghost';
import type { HudState, InputFrame, RaceSnapshot, SimEvent } from '../shared/contracts';
import { NEUTRAL_INPUT, PLAYER_CAR_ID, SIM_DT, SIM_HZ } from '../shared/contracts';
import { buildTrackGeometry } from '../shared/trackGeometry';
import { createSim, initPhysics } from '../sim';
import { buildTimeTrialSetup, clearWeapons, createTimeTrialRun, TIME_TRIAL_LAPS, type TimeTrialRun } from './timeTrial';

beforeAll(async () => {
  await initPhysics();
});

const HUD = {} as HudState; // decorateHud only spreads it and reads lapTime

/** Steps an autoplay time trial until `laps` laps are done, feeding the run; returns what the test reads. */
function drive(laps: number, trackId = 'scrapyard', carId = 'raven', run?: TimeTrialRun) {
  const setup = buildTimeTrialSetup({ seed: 7, trackId, carId, autoplay: true });
  const sim = createSim(setup);
  const events: SimEvent[] = [];
  const deltas: { tick: number; delta: number | null }[] = [];
  let snap: RaceSnapshot = sim.snapshot();
  const limit = Math.ceil(laps * setup.track.referenceLapTime * 2 * SIM_HZ);
  for (let i = 0; i < limit && (snap.cars[PLAYER_CAR_ID]?.lap ?? 0) < laps; i++) {
    const ev = sim.step(new Map());
    snap = sim.snapshot();
    run?.onTick(snap, ev);
    if (run) deltas.push({ tick: snap.tick, delta: run.decorateHud(HUD, snap).timeTrial?.delta ?? null });
    events.push(...ev);
  }
  return { setup, sim, snap, events, deltas };
}

describe('time trial setup (CCR-15)', () => {
  it('is the player alone, stock car, no pickups, no ammo, no countdown, laps that never end', () => {
    const s = buildTimeTrialSetup({ seed: 1, trackId: 'dockside~r', carId: 'titan' });
    expect(s.mode).toBe('timeTrial');
    expect(s.entrants).toHaveLength(1);
    expect(s.entrants[0]).toMatchObject({ id: 0, driverId: 'player', carDefId: 'titan', ai: null, mines: 0, turbo: 0 });
    expect(s.track.id).toBe('dockside~r');
    expect(s.track.pickups).toEqual([]);
    expect(s.countdownSeconds).toBe(0);
    expect(s.laps).toBe(TIME_TRIAL_LAPS);
  });

  it('spawns no pickups and keeps every weapon inert with the inputs held', () => {
    const sim = createSim(buildTimeTrialSetup({ seed: 2 }));
    expect(sim.snapshot().pickups).toEqual([]);
    const start = sim.snapshot().cars[PLAYER_CAR_ID]!.pos;
    const held: InputFrame = { ...NEUTRAL_INPUT, throttle: 1 };
    const kinds = new Set<string>();
    for (let i = 0; i < 4 * SIM_HZ; i++) {
      // The game clears the inputs every tick; dropMine toggles so an edge would fire if a mine were carried.
      const frame = clearWeapons({ ...held, fire: true, dropMine: i % 2 === 0, turbo: true });
      for (const e of sim.step(new Map([[PLAYER_CAR_ID, frame]]))) kinds.add(e.type);
    }
    const me = sim.snapshot().cars[PLAYER_CAR_ID];
    expect([...kinds].filter((k) => k === 'gunShot' || k === 'mineDropped' || k === 'turboStart' || k === 'pickupCollected')).toEqual([]);
    expect(me.gunHeat).toBe(0);
    expect(Math.hypot(me.pos.x - start.x, me.pos.y - start.y)).toBeGreaterThan(10); // it drove
    sim.dispose();
  });

  it('counts laps without end: racing after 3 laps, no finish events', () => {
    const { sim, snap, events } = drive(3);
    expect(snap.phase).toBe('racing');
    expect(snap.cars[PLAYER_CAR_ID]?.lap).toBe(3);
    expect(events.filter((e) => e.type === 'lapCompleted')).toHaveLength(3);
    expect(events.some((e) => e.type === 'carFinished' || e.type === 'raceFinished' || e.type === 'finalLap')).toBe(false);
    sim.dispose();
  }, 30000);
});

describe('time trial run', () => {
  it('records each lap at 20 Hz from the line, keeps the best, and fits the storage budget', () => {
    const got: { lap: GhostLap; improved: boolean }[] = [];
    const setup = buildTimeTrialSetup({ seed: 7, trackId: 'scrapyard', carId: 'raven', autoplay: true });
    const run = createTimeTrialRun({ track: buildTrackGeometry(setup.track), best: null, ghostOn: true, onLap: (lap, improved) => got.push({ lap, improved }) });
    const { sim, events } = drive(3, 'scrapyard', 'raven', run);
    const times = events.flatMap((e) => (e.type === 'lapCompleted' ? [e.lapTime] : []));
    expect(got.map((g) => g.lap.time)).toEqual(times);
    expect(run.laps).toEqual(times);
    for (const { lap } of got) expect(lap.poses).toHaveLength(Math.floor(Math.round(lap.time * SIM_HZ) / GHOST_TICKS) + 1);
    // Standing start: the first lap is the slow one, the flying laps improve on it.
    expect(got[0]?.improved).toBe(true);
    const fastest = Math.min(...times);
    expect(run.best?.time).toBe(fastest);
    expect(got.filter((g) => g.improved).at(-1)?.lap.time).toBe(fastest);
    expect(run.newBest).toBe(true);
    // poses[0] is on the start line, the last one just before it.
    const first = got[1]!.lap.poses[0]!;
    const line = setup.track.centerline[0]!;
    expect(Math.hypot(first.x - line.x, first.y - line.y)).toBeLessThan(setup.track.width);
    for (const { lap } of got) {
      const size = serializeGhost(lap).length;
      console.info(`[WP40] lap ${lap.time.toFixed(2)} s, ${lap.poses.length} poses, ${size} chars stored`);
      expect(size).toBeLessThan(2300);
    }
    sim.dispose();
  }, 30000);

  it('delta: the gap to the best at the same distance matches the lap time difference at the line', () => {
    const setup = buildTimeTrialSetup({ seed: 7, trackId: 'scrapyard', carId: 'raven', autoplay: true });
    const run = createTimeTrialRun({ track: buildTrackGeometry(setup.track), best: null, ghostOn: true, onLap: () => {} });
    const { sim, events, deltas } = drive(2, 'scrapyard', 'raven', run);
    const [lap1, lap2] = events.flatMap((e) => (e.type === 'lapCompleted' ? [e.lapTime] : []));
    // Lap 1 has no best: no delta. The last tick of lap 2 reads lap 2 against lap 1.
    expect(deltas.slice(0, Math.round(lap1! * SIM_HZ) - 1).every((d) => d.delta === null)).toBe(true);
    const beforeLine = deltas[deltas.length - 2]!.delta!;
    expect(Math.abs(beforeLine - (lap2! - lap1!))).toBeLessThan(0.1);
    sim.dispose();
  }, 30000);

  it('replays the best from each lap start, waits on the line before it, and hides when off or done', () => {
    const setup = buildTimeTrialSetup({ seed: 7, trackId: 'scrapyard', carId: 'raven', autoplay: true });
    const poses = Array.from({ length: 21 }, (_, k) => ({ x: k, y: 2 * k, heading: 0.1 * k }));
    const best: GhostLap = { time: 1, poses };
    const run = createTimeTrialRun({ track: buildTrackGeometry(setup.track), best, ghostOn: true, onLap: () => {} });
    const sim = createSim(setup);
    const s0 = sim.snapshot();
    expect(run.ghostPose(s0, s0, 1)).toEqual(poses[0]);
    // A fake lap in progress since race time 10: half a tick before the latest snapshot at 10.55.
    const at = (time: number): RaceSnapshot => ({ ...s0, time, cars: [{ ...s0.cars[0]!, lap: 1, currentLapStart: 10 }] });
    const t = 0.55 - SIM_DT / 2;
    const p = run.ghostPose(at(10.55 - SIM_DT), at(10.55), 0.5)!;
    expect(p.x).toBeCloseTo(t * GHOST_HZ, 6);
    expect(p.y).toBeCloseTo(2 * t * GHOST_HZ, 6);
    expect(p.heading).toBeCloseTo(0.1 * t * GHOST_HZ, 6);
    expect(run.ghostPose(at(11.1 - SIM_DT), at(11.1), 1)).toBeNull(); // past the end of its 1 s lap
    run.ghostOn = false;
    expect(run.ghostPose(at(10.55 - SIM_DT), at(10.55), 0.5)).toBeNull();
    sim.dispose();
  });

  it('the HUD reads 0 on the clock and no delta until the line, then the run best and last lap', () => {
    const setup = buildTimeTrialSetup({ seed: 7, autoplay: true });
    const run = createTimeTrialRun({ track: buildTrackGeometry(setup.track), best: null, ghostOn: true, onLap: () => {} });
    const sim = createSim(setup);
    for (let i = 0; i < 30; i++) run.onTick(sim.snapshot(), sim.step(new Map()));
    const early = run.decorateHud({ lapTime: 0.5 } as HudState, sim.snapshot());
    expect(sim.snapshot().cars[PLAYER_CAR_ID]?.currentLapStart).toBe(0);
    expect(early).toMatchObject({ lapTime: 0, bestLap: null, timeTrial: { best: null, last: null, delta: null } });
    sim.dispose();
    const { snap } = drive(1, 'scrapyard', 'raven', run);
    expect(run.decorateHud({ lapTime: 1 } as HudState, snap)).toMatchObject({ lapTime: 1, timeTrial: { best: run.laps[0], last: run.laps[0] } });
  }, 30000);

  it('restart drops the lap in progress', () => {
    const setup = buildTimeTrialSetup({ seed: 7, trackId: 'scrapyard', carId: 'raven', autoplay: true });
    const laps: number[] = [];
    const run = createTimeTrialRun({ track: buildTrackGeometry(setup.track), best: null, ghostOn: true, onLap: (lap) => laps.push(lap.time) });
    const a = drive(1, 'scrapyard', 'raven', run);
    a.sim.dispose();
    run.restart();
    // A fresh sim: its first crossing opens a lap, it does not close the dropped one.
    const b = drive(1, 'scrapyard', 'raven', run);
    expect(laps).toHaveLength(2);
    expect(run.laps).toEqual(laps);
    expect(decodePoses(serializeGhost(run.best!).match(/"p":"([^"]+)"/)![1]!)).toHaveLength(run.best!.poses.length);
    b.sim.dispose();
  }, 30000);
});
