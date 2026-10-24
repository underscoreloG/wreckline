import type { InputFrame } from '../shared/contracts';

// Keyboard steering is digital but smoothed (WP05): toward full lock at 8/s, back to centre at 12/s.
export const STEER_RAMP_UP = 8;
export const STEER_RAMP_DOWN = 12;

/** Digital keyboard state for driving, already resolved from key codes. */
export interface KeyDrive {
  throttle: boolean;
  brake: boolean;
  steer: -1 | 0 | 1; // target, before smoothing
  handbrake: boolean;
  fire: boolean;
  dropMine: boolean;
  turbo: boolean;
}

/** Analog gamepad state for driving, after deadzones and curves. */
export interface PadDrive {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  fire: boolean;
  dropMine: boolean;
  turbo: boolean;
}

const moveToward = (v: number, target: number, maxDelta: number): number =>
  v < target ? Math.min(target, v + maxDelta) : Math.max(target, v - maxDelta);

/** One smoothing step of the keyboard steer value toward `target` over `dt` seconds. */
export function stepSteer(current: number, target: number, dt: number): number {
  // Releasing or reversing goes back through the centre at the faster return rate.
  const next =
    target === 0 || current * target < 0 ? moveToward(current, 0, STEER_RAMP_DOWN * dt) : moveToward(current, target, STEER_RAMP_UP * dt);
  // Float residue (1 - 5 * 0.2) must not leave the car steering by 1e-16.
  return Math.abs(next) < 1e-9 ? 0 : next;
}

const larger = (a: number, b: number): number => (Math.abs(b) > Math.abs(a) ? b : a);

/**
 * Merges keyboard and gamepad into `out`: per field the larger magnitude wins, booleans OR.
 * Steer: when both sources are non-zero, the one that moved last wins (`steerFromPad`).
 */
export function mergeFrame(out: InputFrame, kb: KeyDrive, kbSteer: number, pad: PadDrive | null, steerFromPad: boolean): InputFrame {
  out.throttle = kb.throttle ? 1 : 0;
  out.brake = kb.brake ? 1 : 0;
  out.steer = kbSteer;
  out.handbrake = kb.handbrake;
  out.fire = kb.fire;
  out.dropMine = kb.dropMine;
  out.turbo = kb.turbo;
  if (!pad) return out;
  out.throttle = larger(out.throttle, pad.throttle);
  out.brake = larger(out.brake, pad.brake);
  if (kbSteer === 0) out.steer = pad.steer;
  else if (pad.steer !== 0) out.steer = steerFromPad ? pad.steer : kbSteer;
  out.handbrake ||= pad.handbrake;
  out.fire ||= pad.fire;
  out.dropMine ||= pad.dropMine;
  out.turbo ||= pad.turbo;
  return out;
}
