import { HANDBRAKE_MODS, OFFROAD_DRAG, OFFROAD_MODS, TURBO_MODS, WRECKED_ANGULAR_DAMPING, WRECKED_LINEAR_DAMPING } from '../content/vehicle';
import type { Vec2 } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { clamp } from '../shared/math';
import { cruiseInput } from './ai';
import type { SimSystem } from './internal';

const ACCEL_TAPER_START = 0.75; // fraction of maxSpeed where full accel starts fading to 0 at maxSpeed
const COAST_DECEL = 3; // m/s^2 with no throttle/brake
const REVERSE_MAX = 0.3; // fraction of maxSpeed
const REVERSE_ACCEL = 0.5; // fraction of accel
const GRIP_RATE = 18; // 1/s, lateral damping = grip * GRIP_RATE
const STEER_FULL_SPEED = 8; // m/s, steering authority ramps 0 -> 1 from 0 to this speed
const HIGH_SPEED_STEER_LOSS = 0.35; // steering lost at maxSpeed
const ANGVEL_RESPONSE = 12; // 1/s, how fast angVel tracks its target
const DRIFT_THRESHOLD = 3.5; // m/s lateral speed
const HANDBRAKE_SCRUB = 0.5; // fraction of brake decel the handbrake applies
const DRIVE_DEADBAND = 0.5; // m/s, below this throttle drives and brake reverses
const BRAKE_LIGHT_INPUT = 0.1;
const BRAKE_LIGHT_SPEED = 1; // m/s

const STEER_BLEND = 1 - Math.exp(-ANGVEL_RESPONSE * SIM_DT);
const scratchVel: Vec2 = { x: 0, y: 0 };

/** Moves v toward 0 by at most `dv`, never past it. */
const towardZero = (v: number, dv: number): number => (v > dv ? v - dv : v < -dv ? v + dv : 0);

/** WP01 section 1: arcade grip/drift model on top of Rapier, run before physics.step. */
export const applyDynamics: SimSystem = (world) => {
  const halfWidth = world.setup.track.width / 2;
  const dt = SIM_DT;
  for (const car of world.cars) {
    const body = car.body;
    if (car.wrecked) {
      if (body.linearDamping() !== WRECKED_LINEAR_DAMPING) {
        body.setLinearDamping(WRECKED_LINEAR_DAMPING);
        body.setAngularDamping(WRECKED_ANGULAR_DAMPING);
      }
      car.drifting = false;
      car.braking = false;
      continue;
    }
    // Finished cars (and every car once the race is over) cruise the racing line, their own input ignored.
    const input = car.finished || world.phase === 'finished' ? cruiseInput(world, car) : car.input;
    const { throttle, brake, steer, handbrake } = input;

    // 1. effective stats (offroad from last tick's projection)
    const base = car.base;
    const eff = car.eff;
    const offroad = Math.abs(car.lateral) > halfWidth;
    car.offroad = offroad;
    eff.maxSpeed = base.maxSpeed * (car.turboActive ? TURBO_MODS.maxSpeed : 1) * (offroad ? OFFROAD_MODS.maxSpeed : 1);
    eff.accel = base.accel * (car.turboActive ? TURBO_MODS.accel : 1) * (offroad ? OFFROAD_MODS.accel : 1);
    eff.grip = base.grip * (offroad ? OFFROAD_MODS.grip : 1);
    eff.brake = base.brake;
    eff.turnRate = base.turnRate;

    // 2. body frame
    const h = body.rotation();
    const fx = Math.cos(h);
    const fy = Math.sin(h);
    const v = body.linvel();
    let vF = v.x * fx + v.y * fy;
    let vR = -v.x * fy + v.y * fx;

    // 3. longitudinal
    let a: number;
    if (handbrake) {
      a = -Math.sign(vF) * Math.min(Math.abs(vF) / dt, eff.brake * HANDBRAKE_SCRUB);
    } else if (throttle > 0 && vF >= -DRIVE_DEADBAND) {
      const taper = clamp((eff.maxSpeed - vF) / ((1 - ACCEL_TAPER_START) * eff.maxSpeed), 0, 1);
      a = eff.accel * throttle * taper;
    } else if (throttle > 0) {
      a = eff.brake * throttle; // rolling backwards: throttle brakes first
    } else if (brake > 0) {
      if (vF > DRIVE_DEADBAND) a = -eff.brake * brake;
      else a = vF > -REVERSE_MAX * eff.maxSpeed ? -eff.accel * REVERSE_ACCEL * brake : 0;
    } else {
      a = -Math.sign(vF) * Math.min(Math.abs(vF) / dt, COAST_DECEL);
    }
    vF += a * dt;
    // Applied as a clamped step so a car stopped on the dirt does not jitter around 0.
    if (offroad) vF = towardZero(vF, OFFROAD_DRAG * dt);

    // 4. lateral grip
    const grip = eff.grip * (handbrake ? HANDBRAKE_MODS.grip : 1);
    vR *= Math.exp(-grip * GRIP_RATE * dt);

    // 5.
    scratchVel.x = fx * vF - fy * vR;
    scratchVel.y = fy * vF + fx * vR;
    body.setLinvel(scratchVel, true);

    // 6. steering
    const authority = clamp(Math.abs(vF) / STEER_FULL_SPEED, 0, 1) * (vF >= 0 ? 1 : -1);
    const rate =
      eff.turnRate * (1 - HIGH_SPEED_STEER_LOSS * clamp(Math.abs(vF) / eff.maxSpeed, 0, 1)) * (handbrake ? HANDBRAKE_MODS.turnRate : 1);
    const target = steer * authority * rate;
    const w = body.angvel();
    body.setAngvel(w + (target - w) * STEER_BLEND, true);

    // 7. flags
    car.drifting = Math.abs(vR) > DRIFT_THRESHOLD;
    car.braking = brake > BRAKE_LIGHT_INPUT && vF > BRAKE_LIGHT_SPEED;
  }
};
