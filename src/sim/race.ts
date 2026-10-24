import { END_AFTER_PLAYER_FINISH, END_AFTER_PLAYER_WRECK, WRONG_WAY_MIN_SPEED, WRONG_WAY_SECONDS } from '../content/race';
import type { Vec2 } from '../shared/contracts';
import { PLAYER_CAR_ID, SIM_DT, SIM_HZ } from '../shared/contracts';
import { segmentIntersect } from '../shared/math';
import { createTrackProjection } from '../shared/trackGeometry';
import type { SimCar, SimSystem, SimWorld } from './internal';
import { buildResult, compareRank } from './world';

/** Anti-cut: progress may run at most this far past the next gate a car has not crossed. */
const ANTI_CUT_SLACK = 20; // m
/** A projection this far beyond the walls means the hinted search lost the car (teleport, reset): search the whole track. */
const REPROJECT_MARGIN = 2; // m
/** Race time accumulates 1/60 steps, so end-rule comparisons allow for float drift. */
const TIME_EPS = 1e-6;

const scratch = createTrackProjection();
/** Reused by every sim for the position sort (single-threaded, filled and consumed inside one call). */
const order: SimCar[] = [];
let finishedThisTick = 0;

function raceOver(world: SimWorld): boolean {
  const t = world.time;
  if (world.playerFinishedAt !== null && t - world.playerFinishedAt >= END_AFTER_PLAYER_FINISH - TIME_EPS) return true;
  if (world.playerWreckedAt !== null && t - world.playerWreckedAt >= END_AFTER_PLAYER_WRECK - TIME_EPS) return true;
  for (const car of world.cars) if (!car.wrecked && !car.finished) return false;
  return true;
}

/** Countdown events and the green light, then the race-end rules (content.md section 7). */
export const updateCountdown: SimSystem = (world) => {
  if (world.phase === 'racing') {
    if (!raceOver(world)) return;
    world.phase = 'finished';
    world.result = buildResult(world);
    world.out.push({ type: 'raceFinished' });
    return;
  }
  if (world.phase !== 'countdown') return;
  // Counted in whole ticks rather than `countdown -= SIM_DT` so the boundaries land on exact ticks.
  const left = Math.round(world.setup.countdownSeconds * SIM_HZ) - world.tick; // ticks left before this one
  if (left <= 0) {
    world.phase = 'racing';
    world.countdown = 0;
    world.time = 0;
    for (const car of world.cars) car.currentLapStart = 0;
    world.out.push({ type: 'raceStart' });
    return;
  }
  const value = left / SIM_HZ;
  if (value === 3 || value === 2 || value === 1) world.out.push({ type: 'countdown', value });
  world.countdown = (left - 1) / SIM_HZ;
};

/** Only gate `nextCheckpoint` can be passed, so a lap needs every gate in order. */
function passGate(world: SimWorld, car: SimCar, pos: Vec2): void {
  const cps = world.track.checkpoints;
  const gate = cps[car.nextCheckpoint];
  const p = car.prevPos;
  // Forward crossings only (gate a -> b points right, so its forward normal is (ab.y, -ab.x)):
  // reversing over the line on the grid must not count as the start.
  if ((pos.x - p.x) * (gate.b.y - gate.a.y) - (pos.y - p.y) * (gate.b.x - gate.a.x) <= 0) return;
  if (segmentIntersect(p, pos, gate.a, gate.b) === null) return;
  const time = world.time;
  if (gate.index === 0) {
    if (!car.crossedStart) {
      car.crossedStart = true;
      car.currentLapStart = time;
    } else {
      car.lap++;
      const lapTime = time - car.currentLapStart;
      car.lastLapTime = lapTime;
      if (car.bestLapTime === null || lapTime < car.bestLapTime) car.bestLapTime = lapTime;
      car.currentLapStart = time;
      world.out.push({ type: 'lapCompleted', car: car.id, lap: car.lap, lapTime });
      const laps = world.setup.laps;
      if (car.lap === laps - 1) world.out.push({ type: 'finalLap', car: car.id });
      if (car.lap === laps) {
        car.finished = true;
        car.finishTime = time;
        if (car.id === PLAYER_CAR_ID) world.playerFinishedAt = time;
        finishedThisTick++;
      }
    }
  }
  car.nextCheckpoint = (car.nextCheckpoint + 1) % cps.length;
}

function computeProgress(world: SimWorld, car: SimCar): number {
  const length = world.track.length;
  if (!car.crossedStart) return car.trackS - length;
  const cps = world.track.checkpoints;
  const n = cps.length;
  const next = car.nextCheckpoint;
  const nextS = next === 0 ? length : cps[next].s;
  const prevS = cps[(next + n - 1) % n].s;
  // Pick the lap-relative s nearest the stretch between the last and next gate, so a projection that wrapped
  // past the line either way (gate not crossed yet, or reversing back over it) stays continuous.
  const mid = (prevS + nextS) / 2;
  let s = car.trackS;
  if (s - mid > length / 2) s -= length;
  else if (mid - s > length / 2) s += length;
  const lapBase = car.lap * length;
  return Math.min(lapBase + s, lapBase + nextS + ANTI_CUT_SLACK);
}

/** Projection, checkpoints, laps, wrong way, live positions and finish (WP01 section 2). Runs after physics and combat. */
export const updateProgress: SimSystem = (world) => {
  const track = world.track;
  const lost = track.def.width / 2 + track.def.shoulder + REPROJECT_MARGIN;
  const racing = world.phase === 'racing';
  const halfLap = track.length / 2;
  finishedThisTick = 0;
  for (const car of world.cars) {
    const t = car.body.translation();
    track.projectInto(scratch, t, car.trackS);
    if (Math.abs(scratch.lateral) > lost) track.projectInto(scratch, t);
    car.trackS = scratch.s;
    car.lateral = scratch.lateral;
    if (!racing) continue;

    if (car.wrecked && car.wreckedAt === null) car.wreckedAt = world.time;
    if (car.id === PLAYER_CAR_ID && car.wrecked && world.playerWreckedAt === null) world.playerWreckedAt = world.time;
    if (car.finished || car.wrecked) {
      car.wrongWay = false;
      car.wrongWayTimer = 0;
      continue;
    }

    passGate(world, car, t);
    const progress = computeProgress(world, car);
    const h = car.body.rotation();
    const v = car.body.linvel();
    const speed = v.x * Math.cos(h) + v.y * Math.sin(h);
    const delta = progress - car.progress;
    // A jump of half a lap is the loop wrapping (a car moves < 1 m per tick): no information, keep the timer.
    if (Math.abs(delta) <= halfLap) {
      if (delta < 0 && Math.abs(speed) > WRONG_WAY_MIN_SPEED) car.wrongWayTimer += SIM_DT;
      else car.wrongWayTimer = 0;
    }
    car.wrongWay = car.wrongWayTimer > WRONG_WAY_SECONDS;
    car.progress = progress;
  }
  if (!racing) return;

  // Insertion sort: 2-8 cars, allocation-free, stable.
  order.length = 0;
  for (const car of world.cars) {
    let i = order.length;
    order.push(car);
    while (i > 0 && compareRank(order[i - 1], car) > 0) {
      order[i] = order[i - 1];
      i--;
    }
    order[i] = car;
  }
  for (let i = 0; i < order.length; i++) order[i].position = i + 1;

  // carFinished goes out after the sort so `position` is the live rank including other cars finishing this tick.
  if (finishedThisTick > 0) {
    for (const car of world.cars) {
      if (car.finished && car.finishTime === world.time) {
        world.out.push({ type: 'carFinished', car: car.id, position: car.position, time: world.time });
      }
    }
  }
};
