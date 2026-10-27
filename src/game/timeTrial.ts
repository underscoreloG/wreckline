import { buildQuickRaceSetup } from '../content/quickRace';
import { GHOST_HZ, GHOST_TICKS, type GhostLap } from '../meta/ghost';
import type { GhostPose, HudState, InputFrame, RaceSetup, RaceSnapshot, SimEvent, TimeTrialHud, TrackGeometry } from '../shared/contracts';
import { PLAYER_CAR_ID, SIM_DT, SIM_HZ } from '../shared/contracts';
import { clamp, lerpAngle } from '../shared/math';

// WP40 (CCR-15): time trial. The sim is the race sim untouched: the setup data makes it a solo run without end.

/** A lap count no run reaches (about 70 days of 30 s laps), so the race-end rules never fire. */
export const TIME_TRIAL_LAPS = 200_000;
/**
 * The car cannot wreck: with no repair pickups, wall hits would end every long run. Driving stats stay stock;
 * hp only feeds damage, repair and the damage tint (which stays clean at this scale).
 */
export const TIME_TRIAL_HP = 1e9;

export interface TimeTrialOptions {
  seed: number;
  trackId?: string; // a base or reversed id (CCR-14)
  carId?: string;
  autoplay?: boolean;
}

/**
 * The quick race player entrant alone (stock car, livery, `autoplay` AI), on the track without its pickups, no mines
 * or rocket fuel carried, no countdown. The clock starts at the line, 8 m ahead of the grid slot (standing start).
 */
export function buildTimeTrialSetup(opts: TimeTrialOptions): RaceSetup {
  const quick = buildQuickRaceSetup({ seed: opts.seed, aiCount: 1, trackId: opts.trackId, carId: opts.carId, autoplay: opts.autoplay });
  const me = quick.entrants[PLAYER_CAR_ID];
  if (!me) throw new Error('buildTimeTrialSetup: no player entrant');
  return {
    ...quick,
    mode: 'timeTrial',
    track: { ...quick.track, pickups: [] },
    laps: TIME_TRIAL_LAPS,
    entrants: [{ ...me, stats: { ...me.stats, maxHp: TIME_TRIAL_HP }, hp: TIME_TRIAL_HP, mines: 0, turbo: 0 }],
    countdownSeconds: 0,
  };
}

/** The gun has no carried ammo to run out of, so its input is cleared (mines and rocket fuel are 0 already). */
export function clearWeapons(frame: InputFrame): InputFrame {
  frame.fire = false;
  frame.dropMine = false;
  frame.turbo = false;
  return frame;
}

export interface TimeTrialRun {
  /** The best lap: stored at the start, replaced by every lap that beats it. */
  readonly best: GhostLap | null;
  ghostOn: boolean;
  /** Completed lap times, restarts included. */
  readonly laps: readonly number[];
  readonly newBest: boolean;
  /** A new sim on the grid: the lap in progress is dropped. */
  restart(): void;
  /** After every sim step, with that step's events: records the pose and closes laps. */
  onTick(snap: RaceSnapshot, events: readonly SimEvent[]): void;
  /** The ghost at the rendered lap time (alpha between the snapshots), null when off, absent or done with its lap. */
  ghostPose(prev: RaceSnapshot, curr: RaceSnapshot, alpha: number): GhostPose | null;
  /** HudState with the time trial readout; the lap clock reads 0 until the line. */
  decorateHud(hud: HudState, snap: RaceSnapshot): HudState;
}

export interface TimeTrialRunOptions {
  track: TrackGeometry;
  best: GhostLap | null;
  ghostOn: boolean;
  /** Every completed lap; `improved` = it is the new best (store it). */
  onLap(lap: GhostLap, improved: boolean): void;
}

/** The player's car crossed the start line once (the sim starts lap timing there). */
const started = (snap: RaceSnapshot): boolean => {
  const me = snap.cars[PLAYER_CAR_ID];
  return !!me && (me.lap > 0 || me.currentLapStart > 0);
};

/** Distance along the lap of every ghost pose, unwrapped from the line and never decreasing (for the delta lookup). */
function lapDistances(track: TrackGeometry, poses: readonly GhostPose[]): number[] {
  const L = track.length;
  const out: number[] = [];
  let prevRaw = 0;
  let s = 0;
  poses.forEach((p, k) => {
    const raw = track.project({ x: p.x, y: p.y }, k === 0 ? undefined : prevRaw).s;
    if (k === 0) s = raw > L / 2 ? raw - L : raw;
    else {
      let d = raw - prevRaw;
      if (d < -L / 2) d += L;
      else if (d > L / 2) d -= L;
      s += d;
    }
    prevRaw = raw;
    out.push(k === 0 ? s : Math.max(out[k - 1] ?? s, s));
  });
  return out;
}

export function createTimeTrialRun(opts: TimeTrialRunOptions): TimeTrialRun {
  const { track } = opts;
  let best = opts.best;
  let bestS = best ? lapDistances(track, best.poses) : [];
  const laps: number[] = [];
  let newBest = false;
  let recording: GhostPose[] | null = null;
  let recStart = NaN;
  let last: GhostPose | null = null;
  const out: GhostPose = { x: 0, y: 0, heading: 0 };

  /** Ghost lap time at lap distance s, from the poses either side. */
  const ghostTimeAt = (s: number): number => {
    let lo = 0;
    let hi = bestS.length - 1;
    if (hi < 1 || s <= bestS[0]) return 0;
    if (s >= bestS[hi]) return hi / GHOST_HZ;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (bestS[mid] <= s) lo = mid;
      else hi = mid;
    }
    const span = bestS[hi] - bestS[lo];
    return (lo + (span > 0 ? (s - bestS[lo]) / span : 0)) / GHOST_HZ;
  };

  const run: TimeTrialRun = {
    get best() {
      return best;
    },
    ghostOn: opts.ghostOn,
    laps,
    get newBest() {
      return newBest;
    },
    restart() {
      recording = null;
      recStart = NaN;
      last = null;
    },
    onTick(snap, events) {
      const me = snap.cars[PLAYER_CAR_ID];
      if (!me) return;
      // The line was crossed this tick: the previous tick's pose (sim time = the lap start) opens the new lap.
      if (started(snap) && me.currentLapStart !== recStart) {
        const done = events.find((e) => e.type === 'lapCompleted' && e.car === PLAYER_CAR_ID);
        if (done && done.type === 'lapCompleted' && recording) {
          const lap: GhostLap = { time: done.lapTime, poses: recording };
          const improved = best === null || lap.time < best.time;
          laps.push(lap.time);
          if (improved) {
            best = lap;
            bestS = lapDistances(track, lap.poses);
            newBest = true;
          }
          opts.onLap(lap, improved);
        }
        recording = last ? [last] : [];
        recStart = me.currentLapStart;
      }
      const pose = { x: me.pos.x, y: me.pos.y, heading: me.heading };
      if (recording) {
        const ticks = Math.round((snap.time - recStart) * SIM_HZ);
        if (ticks > 0 && ticks % GHOST_TICKS === 0) recording.push(pose);
      }
      last = pose;
    },
    ghostPose(_prev, curr, alpha) {
      const poses = best?.poses;
      if (!run.ghostOn || !poses || poses.length === 0) return null;
      const me = curr.cars[PLAYER_CAR_ID];
      // Before the first crossing the ghost waits on the line.
      const t = me && started(curr) ? Math.max(0, curr.time - SIM_DT * (1 - alpha) - me.currentLapStart) : 0;
      if (best && t > best.time) return null;
      const f = t * GHOST_HZ;
      const i = Math.min(poses.length - 1, Math.floor(f));
      const a = poses[i];
      const b = poses[Math.min(poses.length - 1, i + 1)];
      const k = clamp(f - i, 0, 1);
      out.x = a.x + (b.x - a.x) * k;
      out.y = a.y + (b.y - a.y) * k;
      out.heading = lerpAngle(a.heading, b.heading, k);
      return out;
    },
    decorateHud(hud, snap) {
      const me = snap.cars[PLAYER_CAR_ID];
      const on = started(snap);
      let delta: number | null = null;
      if (me && on && best) {
        const s = clamp(me.progress - me.lap * track.length, 0, track.length);
        delta = snap.time - me.currentLapStart - ghostTimeAt(s);
      }
      const timeTrial: TimeTrialHud = { best: best?.time ?? null, last: laps[laps.length - 1] ?? null, delta };
      return { ...hud, lapTime: on ? hud.lapTime : 0, bestLap: timeTrial.best, timeTrial };
    },
  };
  return run;
}
