import { buildQuickRaceSetup } from '../content/quickRace';
import type { CarId, RaceSetup } from '../shared/contracts';
import { SIM_HZ } from '../shared/contracts';
import { createSim } from './index';

/** A car counts as stuck when |speed| stays below this... */
const STUCK_SPEED = 1.5; // m/s
/** ...for longer than this (WP07 acceptance test 2). */
const STUCK_SECONDS = 4;
/** Snapshot stride for the stuck check (snapshot() allocates, the race itself does not need it). */
const SAMPLE_TICKS = 6;
/** Give up (endReason 'timeout') after this many reference laps per lap. */
const TIMEOUT_LAPS_FACTOR = 3;
/** Skill whose clean laps calibrate referenceLapTime (the medium AI, also the autoplay driver). */
const MEDIUM_SKILL = 0.55;

export type SoakEndReason = 'allFinished' | 'playerFinished15s' | 'playerWrecked' | 'timeout';

export interface SoakCarStats {
  id: CarId;
  skill: number;
  position: number;
  finished: boolean;
  wrecked: boolean;
  /** Episodes of |speed| < 1.5 m/s for > 4 s while racing (not finished, not wrecked). */
  stuckCount: number;
  /** Lap times of laps 2+ with no damage and no impact event for this car during the lap. */
  cleanLaps: number[];
  lap: number;
}

export interface SoakStats {
  trackId: string;
  seed: number;
  endReason: SoakEndReason;
  cars: SoakCarStats[];
  /** carDamaged events with source 'gun'. */
  gunDamageEvents: number;
  minesDropped: number;
  wrecks: number;
  /** Median of the 0.55-skill cars' clean laps (null if none). */
  medianCleanLap: number | null;
  raceTime: number;
  ticks: number;
}

export interface SoakOptions {
  trackId: string;
  seed: number;
  laps?: number;
}

/** The soak race: quick-race grid (AI 0.35/0.55/0.75) with the player slot on autoplay 0.55. */
export function soakSetup(opts: SoakOptions): RaceSetup {
  return buildQuickRaceSetup({ seed: opts.seed, laps: opts.laps ?? 3, aiCount: 3, trackId: opts.trackId, autoplay: true });
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] ?? null) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

/** One headless 4-AI race through the public Sim API (WP07 soak; WP11/WP12 reuse it). Call initPhysics() first. */
export function runSoak(opts: SoakOptions): SoakStats {
  const setup = soakSetup(opts);
  const sim = createSim(setup);
  const n = setup.entrants.length;
  const noInputs = new Map<CarId, never>();
  const stuckTicks = new Array<number>(n).fill(0);
  const stuckCount = new Array<number>(n).fill(0);
  const dirty = new Array<boolean>(n).fill(false);
  const cleanLaps: number[][] = setup.entrants.map(() => []);
  let gunDamageEvents = 0;
  let minesDropped = 0;
  let wrecks = 0;
  const maxTicks = Math.ceil((setup.countdownSeconds + setup.laps * setup.track.referenceLapTime * TIMEOUT_LAPS_FACTOR) * SIM_HZ);
  let ticks = 0;
  let timedOut = false;

  while (sim.result() === null) {
    if (ticks >= maxTicks) {
      timedOut = true;
      sim.debugFinishRace();
    }
    const events = sim.step(noInputs);
    ticks++;
    for (const e of events) {
      if (e.type === 'carDamaged') {
        dirty[e.car] = true;
        if (e.source === 'gun') gunDamageEvents++;
      } else if (e.type === 'impact') {
        dirty[e.a] = true;
        if (e.b !== 'wall') dirty[e.b] = true;
      } else if (e.type === 'mineDropped') minesDropped++;
      else if (e.type === 'carWrecked') wrecks++;
      else if (e.type === 'lapCompleted') {
        // Lap 1 starts from the grid, so only flying laps calibrate the reference.
        if (e.lap > 1 && !dirty[e.car]) cleanLaps[e.car]?.push(e.lapTime);
        dirty[e.car] = false;
      }
    }
    if (ticks % SAMPLE_TICKS === 0) {
      const snap = sim.snapshot();
      if (snap.phase !== 'racing') continue;
      for (const c of snap.cars) {
        if (c.finished || c.wrecked || Math.abs(c.speed) >= STUCK_SPEED) {
          stuckTicks[c.id] = 0;
          continue;
        }
        const before = stuckTicks[c.id] ?? 0;
        stuckTicks[c.id] = before + SAMPLE_TICKS;
        if (before <= STUCK_SECONDS * SIM_HZ && before + SAMPLE_TICKS > STUCK_SECONDS * SIM_HZ) stuckCount[c.id] = (stuckCount[c.id] ?? 0) + 1;
      }
    }
  }

  const result = sim.result();
  const snap = sim.snapshot();
  sim.dispose();
  if (!result) throw new Error('runSoak: no result');
  const player = result.rows.find((r) => r.car === 0);
  const allDone = result.rows.every((r) => r.finished || r.wrecked);
  const endReason: SoakEndReason = timedOut ? 'timeout' : allDone ? 'allFinished' : player?.wrecked ? 'playerWrecked' : 'playerFinished15s';
  const cars: SoakCarStats[] = setup.entrants.map((e, id) => {
    const row = result.rows.find((r) => r.car === id);
    return {
      id,
      skill: e.ai?.skill ?? 0,
      position: row?.position ?? n,
      finished: row?.finished ?? false,
      wrecked: row?.wrecked ?? false,
      stuckCount: stuckCount[id] ?? 0,
      cleanLaps: cleanLaps[id] ?? [],
      lap: snap.cars[id]?.lap ?? 0,
    };
  });
  const mediumLaps = cars.filter((c) => Math.abs(c.skill - MEDIUM_SKILL) < 1e-9).flatMap((c) => c.cleanLaps);
  return {
    trackId: opts.trackId,
    seed: opts.seed,
    endReason,
    cars,
    gunDamageEvents,
    minesDropped,
    wrecks,
    medianCleanLap: median(mediumLaps),
    raceTime: snap.time,
    ticks,
  };
}
