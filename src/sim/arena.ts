import {
  ARENA_DECAY_PER_SECOND,
  ARENA_PICKUP_RESPAWN_SECONDS,
  ARENA_SUDDEN_DEATH_AT,
  ARENA_SUDDEN_WALL_MULT,
  ARENA_TIME_LIMIT,
} from '../content/arenas/rules';
import type { RaceResult } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { applyDamage } from './combat';
import type { SimCar, SimSystem, SimWorld } from './internal';
import { updateCountdown } from './race';
import { buildResultFrom } from './world';

// WP41 (CCR-16): last car standing. Two systems take the race rules' slots in Sim.step when setup.mode is 'arena':
// updateArenaPhase for race.updateCountdown (step 1) and updateArena for race.updateProgress (step 10).

/** Race time accumulates 1/60 steps, so time comparisons allow for float drift. */
const TIME_EPS = 1e-6;
/** Reused by every sim for the position sort (filled and consumed inside one call). */
const order: SimCar[] = [];

interface ArenaState {
  damageDealt: Float64Array; // hp each car took off the others
}

const states = new WeakMap<SimWorld, ArenaState>();

function stateOf(world: SimWorld): ArenaState {
  let st = states.get(world);
  if (!st) {
    st = { damageDealt: new Float64Array(world.cars.length) };
    states.set(world, st);
  }
  return st;
}

const inSuddenDeath = (time: number): boolean => time >= ARENA_SUDDEN_DEATH_AT - TIME_EPS;

/**
 * Elimination order: cars still running first (more hp first), then wrecked cars by wreck time, the later wreck higher;
 * a tie (same tick) goes to the car that dealt more damage, then the lower id.
 */
function compareArena(st: ArenaState, a: SimCar, b: SimCar): number {
  if (a.wrecked !== b.wrecked) return a.wrecked ? 1 : -1;
  if (!a.wrecked) return b.hp - a.hp || a.id - b.id;
  return (b.wreckedAt ?? 0) - (a.wreckedAt ?? 0) || st.damageDealt[b.id] - st.damageDealt[a.id] || a.id - b.id;
}

export function arenaResult(world: SimWorld): RaceResult {
  const st = stateOf(world);
  const ranked = [...world.cars].sort((a, b) => compareArena(st, a, b));
  const base = buildResultFrom(world.setup, ranked);
  // buildResultFrom ranks by the race rule; keep the arena order and add the CCR-16 fields.
  const rows = ranked.map((c, i) => {
    const row = base.rows.find((r) => r.car === c.id);
    if (!row) throw new Error(`arenaResult: no row for car ${c.id}`);
    return { ...row, position: i + 1, damageDealt: Math.round(st.damageDealt[c.id] * 10) / 10, eliminatedAt: c.wrecked ? c.wreckedAt : null };
  });
  return { ...base, rows, mode: 'arena' };
}

/** Damage dealt so far per car (tests, the arena soak). */
export const arenaDamageDealt = (world: SimWorld): readonly number[] => Array.from(stateOf(world).damageDealt);

/** Countdown as in a race; then the fight ends when at most one car is left, or at the time limit. */
export const updateArenaPhase: SimSystem = (world) => {
  if (world.phase !== 'racing') {
    updateCountdown(world);
    return;
  }
  let alive = 0;
  for (const car of world.cars) if (!car.wrecked) alive++;
  if (alive > 1 && world.time < ARENA_TIME_LIMIT - TIME_EPS) return;
  world.phase = 'finished';
  world.result = arenaResult(world);
  world.out.push({ type: 'raceFinished' });
};

/**
 * The arena's step 10: damage dealt, pickup respawn times, sudden death (double wall damage, hp decay, no repair
 * respawn), live positions by elimination order. Runs after combat, so this tick's events are all in world.out.
 */
export const updateArena: SimSystem = (world) => {
  if (world.phase !== 'racing') return;
  const st = stateOf(world);
  const sudden = inSuddenDeath(world.time);
  const n = world.out.length; // events added below are not rescanned
  for (let i = 0; i < n; i++) {
    const e = world.out[i];
    if (!e) continue;
    if (e.type === 'carDamaged') {
      if (e.by !== null && e.by !== e.car) st.damageDealt[e.by] += e.amount;
      const car = world.cars[e.car];
      if (sudden && e.source === 'wall' && car) applyDamage(world, car, e.amount * (ARENA_SUDDEN_WALL_MULT - 1), 'wall', null, e.pos);
    } else if (e.type === 'pickupCollected') {
      const p = world.pickups[e.pickup];
      if (p) p.respawnIn = sudden && p.kind === 'repair' ? Infinity : ARENA_PICKUP_RESPAWN_SECONDS;
    }
  }

  if (sudden) {
    for (const car of world.cars) {
      if (car.wrecked) continue;
      const amount = car.base.maxHp * ARENA_DECAY_PER_SECOND * SIM_DT;
      // A silent drain (a carDamaged event every tick would flash the HUD non-stop); the last bit goes through
      // applyDamage so the wreck, its credit and its explosion follow the combat rules.
      if (car.hp > amount) car.hp -= amount;
      else {
        const t = car.body.translation();
        applyDamage(world, car, car.hp, 'wall', null, t);
      }
    }
  }

  for (const car of world.cars) if (car.wrecked && car.wreckedAt === null) car.wreckedAt = world.time;
  if (world.cars[0]?.wrecked && world.playerWreckedAt === null) world.playerWreckedAt = world.time;
  // Insertion sort into a reused array, as race.updateProgress: 8 cars, no allocation per tick.
  order.length = 0;
  for (const car of world.cars) {
    let i = order.length;
    order.push(car);
    while (i > 0 && compareArena(st, order[i - 1] as SimCar, car) > 0) {
      order[i] = order[i - 1] as SimCar;
      i--;
    }
    order[i] = car;
  }
  for (let i = 0; i < order.length; i++) (order[i] as SimCar).position = i + 1;
};
