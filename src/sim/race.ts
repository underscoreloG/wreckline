import { SIM_HZ } from '../shared/contracts';
import { createTrackProjection } from '../shared/trackGeometry';
import type { SimSystem } from './internal';

const scratch = createTrackProjection();

/**
 * STUB (WP00), WP01 replaces the body and keeps the signature.
 * Minimal countdown: events at 3, 2, 1, then the phase switch and raceStart. No race-end rules.
 */
export const updateCountdown: SimSystem = (world) => {
  if (world.phase !== 'countdown') return;
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

/**
 * STUB (WP00), WP01 replaces the body and keeps the signature.
 * Minimal progress: projection only (trackS, lateral). No checkpoints, laps or positions.
 */
export const updateProgress: SimSystem = (world) => {
  for (const car of world.cars) {
    world.track.projectInto(scratch, car.body.translation(), car.trackS);
    car.trackS = scratch.s;
    car.lateral = scratch.lateral;
  }
};
