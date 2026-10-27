import type { CarId, Difficulty, RaceSetup } from '../../src/shared/contracts';
import { SIM_HZ } from '../../src/shared/contracts';
import { aiProfile } from '../../src/content/ai';
import { getCar } from '../../src/content/cars';
import { computeStats } from '../../src/content/economy';
import { rivalSpikesLevel, rivalUpgradeLevel } from '../../src/content/rivals';
import { soakSetup } from '../../src/sim/soak';
import { createSim } from '../../src/sim/index';

/** Soak grid skills in entrant order (autoplay player first, then QUICK_RACE_AI_SKILLS). Rotated over the grid per start. */
export const PROBE_SKILLS = [0.55, 0.35, 0.55, 0.75] as const;
const MEDIUM_SKILL = 0.55;
/** Same give-up rule as runSoak: 3 reference laps per lap. */
const TIMEOUT_LAPS_FACTOR = 3;
const SHOVE_AFTER = 3; // s
const SHOVE_SPEED = 0.5; // m/s: a glued AI pushes at 1-2.6 m/s (CCR-8), under WP24's 2 m/s

/** 'soak' = stock ravens, quick-race loadout; 'rival' = each AI car upgraded like a career rival of its skill (fuel and spikes included). */
export type ProbeLoadout = 'soak' | 'rival';

export interface ProbeRaceOptions {
  trackId: string;
  seed: number;
  /** Grid rotation 0..3: entrant i drives with PROBE_SKILLS[(i + start) % 4]. */
  start: number;
  laps?: number;
  loadout?: ProbeLoadout;
  /** CCR-13: every car drives at its PROBE_SKILLS skill shifted by the difficulty (default 'normal'); rival loadouts stay on the unshifted skill. */
  difficulty?: Difficulty;
}

export interface ProbeRace {
  trackId: string;
  seed: number;
  start: number;
  endReason: 'allFinished' | 'playerFinished15s' | 'playerWrecked' | 'timeout';
  wrecks: number;
  wallImpacts: number;
  mineHits: number;
  gunDamage: number;
  totalDamage: number;
  /** Finishing position per car, with its PROBE_SKILLS skill (before the difficulty shift). */
  places: { car: CarId; skill: number; position: number }[];
  /** Clean flying laps (no damage, no impact) of the 0.55 cars. */
  mediumCleanLaps: number[];
  /** Clean flying laps of every car, by PROBE_SKILLS skill. */
  cleanLaps: { skill: number; lap: number }[];
  /** Metres wrecks travelled more than SHOVE_AFTER s after wrecking (WP24's shove metric), and the longest run above SHOVE_SPEED (s). */
  shove: number;
  longestShove: number;
}

const probeSkills = (start: number): number[] => PROBE_SKILLS.map((_, i) => PROBE_SKILLS[(i + start) % PROBE_SKILLS.length] ?? MEDIUM_SKILL);

export function probeSetup(opts: ProbeRaceOptions): RaceSetup {
  const setup = soakSetup({ trackId: opts.trackId, seed: opts.seed, laps: opts.laps ?? 3 });
  const skills = probeSkills(opts.start);
  setup.entrants.forEach((e, i) => {
    const skill = skills[i] ?? MEDIUM_SKILL;
    e.ai = aiProfile(skill, opts.difficulty ?? 'normal');
    if (opts.loadout === 'rival') {
      const level = rivalUpgradeLevel(skill);
      const spikes = rivalSpikesLevel(skill);
      e.stats = computeStats(getCar(e.carDefId), { engine: level, tires: level, armor: level, gun: level, fuel: level, spikes });
      e.mesh = { ...e.mesh, spikes };
      e.hp = e.stats.maxHp;
    }
  });
  return setup;
}

export const runProbeRace = (opts: ProbeRaceOptions): ProbeRace => ({ trackId: opts.trackId, seed: opts.seed, start: opts.start, ...runRace(probeSetup(opts), probeSkills(opts.start)) });

/** One headless race with the extra counters WP12 needs (damage by source, mine hits). `skills` labels each car (default: its profile skill). Call initPhysics() first. */
export function runRace(setup: RaceSetup, skills = setup.entrants.map((e) => e.ai?.skill ?? 0)): Omit<ProbeRace, 'trackId' | 'seed' | 'start'> {
  const sim = createSim(setup);
  const noInputs = new Map<CarId, never>();
  const dirty = setup.entrants.map(() => false);
  const mediumCleanLaps: number[] = [];
  const cleanLaps: { skill: number; lap: number }[] = [];
  let wrecks = 0;
  const wreckedAt = new Map<CarId, number>();
  const lastPos = new Map<CarId, { x: number; y: number }>();
  const run = new Map<CarId, number>();
  let shove = 0;
  let longestShove = 0;
  let wallImpacts = 0;
  let mineHits = 0;
  let gunDamage = 0;
  let totalDamage = 0;
  const maxTicks = Math.ceil((setup.countdownSeconds + setup.laps * setup.track.referenceLapTime * TIMEOUT_LAPS_FACTOR) * SIM_HZ);
  let ticks = 0;
  let timedOut = false;
  while (sim.result() === null) {
    if (ticks >= maxTicks) {
      timedOut = true;
      sim.debugFinishRace();
    }
    for (const e of sim.step(noInputs)) {
      if (e.type === 'carDamaged') {
        dirty[e.car] = true;
        totalDamage += e.amount;
        if (e.source === 'gun') gunDamage += e.amount;
      } else if (e.type === 'impact') {
        dirty[e.a] = true;
        if (e.b === 'wall') wallImpacts++;
        else dirty[e.b] = true;
      } else if (e.type === 'mineExploded') mineHits += e.hitCars.length;
      else if (e.type === 'carWrecked') {
        wrecks++;
        wreckedAt.set(e.car, ticks);
      }
      else if (e.type === 'lapCompleted') {
        if (e.lap > 1 && !dirty[e.car]) {
          if (skills[e.car] === MEDIUM_SKILL) mediumCleanLaps.push(e.lapTime);
          cleanLaps.push({ skill: skills[e.car] ?? 0, lap: e.lapTime });
        }
        dirty[e.car] = false;
      }
    }
    ticks++;
    if (wreckedAt.size > 0) {
      const snap = sim.snapshot();
      for (const [id, at] of wreckedAt) {
        if (ticks - at < SHOVE_AFTER * SIM_HZ) continue;
        const car = snap.cars[id];
        if (!car) continue;
        const prev = lastPos.get(id);
        if (prev) shove += Math.hypot(car.pos.x - prev.x, car.pos.y - prev.y);
        lastPos.set(id, { x: car.pos.x, y: car.pos.y });
        const r = Math.abs(car.speed) > SHOVE_SPEED ? (run.get(id) ?? 0) + 1 / SIM_HZ : 0;
        run.set(id, r);
        longestShove = Math.max(longestShove, r);
      }
    }
  }
  const result = sim.result();
  sim.dispose();
  if (!result) throw new Error('runProbeRace: no result');
  const player = result.rows.find((r) => r.car === 0);
  const allDone = result.rows.every((r) => r.finished || r.wrecked);
  return {
    endReason: timedOut ? 'timeout' : allDone ? 'allFinished' : player?.wrecked ? 'playerWrecked' : 'playerFinished15s',
    wrecks,
    wallImpacts,
    mineHits,
    gunDamage,
    totalDamage,
    places: result.rows.map((r) => ({ car: r.car, skill: skills[r.car] ?? 0, position: r.position })),
    mediumCleanLaps,
    cleanLaps,
    shove,
    longestShove,
  };
}
