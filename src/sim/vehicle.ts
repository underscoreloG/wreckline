import type { SimSystem } from './internal';

const STUB_FORWARD_SPEED = 10; // m/s at full throttle
const STUB_REVERSE_SPEED = 5; // m/s at full brake
const STUB_TURN_RATE = 1.5; // rad/s at full steer

/**
 * STUB (WP00), WP01 replaces the body and keeps the signature.
 * Crude kinematic driving so the debug view can drive, turn and reverse. With throttle, brake and
 * steer all 0 it leaves the body alone, so tests that set velocities directly keep them.
 */
export const applyDynamics: SimSystem = (world) => {
  for (const car of world.cars) {
    const { throttle, brake, steer } = car.input;
    car.braking = brake > 0.1;
    if (throttle === 0 && brake === 0 && steer === 0) continue;
    const h = car.body.rotation();
    const v = STUB_FORWARD_SPEED * throttle - STUB_REVERSE_SPEED * brake;
    car.body.setLinvel({ x: Math.cos(h) * v, y: Math.sin(h) * v }, true);
    car.body.setAngvel(steer * STUB_TURN_RATE, true);
  }
};
