import { buildArenaSetup } from '../content/arenas/setup';
import type { CarId, SimEvent } from '../shared/contracts';
import { SIM_HZ } from '../shared/contracts';
import { arenaTargets } from './arenaAi';
import { createSimWithWorld } from './index';

// WP41: the arena soak, an all-AI fight (the player slot on autoplay) like runSoak for races.

/** A car counts as stuck when |speed| stays below this for longer than STUCK_SECONDS (as runSoak). */
const STUCK_SPEED = 1.5; // m/s
const STUCK_SECONDS = 4;
const SAMPLE_TICKS = 6;
/** Give up after this long (the rules end every fight by ARENA_TIME_LIMIT). */
const TIMEOUT_SECONDS = 330;

export type WreckCause = 'gun' | 'mine' | 'ram' | 'blast' | 'wall' | 'suddenDeath';

export interface ArenaSoakStats {
  arenaId: string;
  seed: number;
  /** Fight time when the last-car-standing rule (or the time limit) ended it, null on timeout. */
  fightTime: number | null;
  winner: CarId | null;
  wrecks: Record<WreckCause, number>;
  /** Episodes of |speed| < 1.5 m/s for > 4 s while alive, per car. */
  stuck: number[];
  /** Most AIs on one car at once, over the whole fight. */
  maxHunters: number;
  /** Seconds each car spent as somebody's target, summed over its hunters. */
  huntedSeconds: number[];
  /** Seconds each car was alive and not wrecked during the fight. */
  aliveSeconds: number[];
  damageDealt: number[];
  /** hp taken by every car per source (a collision with no culprit is a wreck explosion), sudden death drain excluded. */
  damage: Record<Exclude<WreckCause, 'suddenDeath'>, number>;
  /** Fight time of each wreck, in order. */
  wreckTimes: number[];
}

/**
 * The wreck's cause from the events of its tick: the last damage that car took. A collision with no culprit is a
 * wreck explosion; wall damage with no wall impact that tick is the sudden death drain.
 */
export function wreckCause(events: readonly SimEvent[], index: number): WreckCause {
  const w = events[index];
  if (!w || w.type !== 'carWrecked') throw new Error('wreckCause: not a carWrecked event');
  for (let i = index - 1; i >= 0; i--) {
    const e = events[i];
    if (e?.type !== 'carDamaged' || e.car !== w.car) continue;
    if (e.source === 'gun') return 'gun';
    if (e.source === 'mine') return 'mine';
    if (e.source === 'collision') return e.by === null ? 'blast' : 'ram';
    return events.some((x) => x.type === 'impact' && x.a === w.car && x.b === 'wall') ? 'wall' : 'suddenDeath';
  }
  return 'wall';
}

export function runArenaSoak(opts: { arenaId: string; seed: number }): ArenaSoakStats {
  const setup = buildArenaSetup({ seed: opts.seed, arenaId: opts.arenaId, autoplay: true });
  const { sim, world } = createSimWithWorld(setup);
  const n = setup.entrants.length;
  const noInputs = new Map<CarId, never>();
  const wrecks: Record<WreckCause, number> = { gun: 0, mine: 0, ram: 0, blast: 0, wall: 0, suddenDeath: 0 };
  const stuckTicks = new Array<number>(n).fill(0);
  const stuck = new Array<number>(n).fill(0);
  const hunted = new Array<number>(n).fill(0);
  const alive = new Array<number>(n).fill(0);
  let maxHunters = 0;
  let ticks = 0;
  const maxTicks = Math.ceil((setup.countdownSeconds + TIMEOUT_SECONDS) * SIM_HZ);
  const count = new Array<number>(n).fill(0);
  const damage: ArenaSoakStats['damage'] = { gun: 0, mine: 0, ram: 0, blast: 0, wall: 0 };
  const wreckTimes: number[] = [];

  while (sim.result() === null && ticks < maxTicks) {
    const events = sim.step(noInputs);
    ticks++;
    events.forEach((e, i) => {
      if (e.type === 'carWrecked') {
        wrecks[wreckCause(events, i)]++;
        wreckTimes.push(world.time);
      } else if (e.type === 'carDamaged') {
        damage[e.source === 'collision' ? (e.by === null ? 'blast' : 'ram') : e.source] += e.amount;
      }
    });
    if (world.phase !== 'racing') continue;
    count.fill(0);
    for (const t of arenaTargets(world)) if (t >= 0) count[t] = (count[t] ?? 0) + 1;
    for (let c = 0; c < n; c++) {
      maxHunters = Math.max(maxHunters, count[c] ?? 0);
      hunted[c] = (hunted[c] ?? 0) + (count[c] ?? 0) / SIM_HZ;
      if (!world.cars[c]?.wrecked) alive[c] = (alive[c] ?? 0) + 1 / SIM_HZ;
    }
    if (ticks % SAMPLE_TICKS === 0) {
      for (const c of sim.snapshot().cars) {
        if (c.wrecked || Math.abs(c.speed) >= STUCK_SPEED) {
          stuckTicks[c.id] = 0;
          continue;
        }
        const before = stuckTicks[c.id] ?? 0;
        stuckTicks[c.id] = before + SAMPLE_TICKS;
        if (before <= STUCK_SECONDS * SIM_HZ && before + SAMPLE_TICKS > STUCK_SECONDS * SIM_HZ) stuck[c.id] = (stuck[c.id] ?? 0) + 1;
      }
    }
  }

  const result = sim.result();
  const fightTime = result ? world.time : null;
  sim.dispose();
  return {
    arenaId: opts.arenaId,
    seed: opts.seed,
    fightTime,
    winner: result?.rows[0]?.car ?? null,
    wrecks,
    stuck,
    maxHunters,
    huntedSeconds: hunted,
    aliveSeconds: alive,
    damageDealt: result?.rows.slice().sort((a, b) => a.car - b.car).map((r) => r.damageDealt ?? 0) ?? [],
    damage,
    wreckTimes,
  };
}

