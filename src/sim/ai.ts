import type { AiProfile, CarId, InputFrame } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_HZ } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import { createTrackSample } from '../shared/trackGeometry';
import type { AiDriver, SimWorld } from './internal';

const STUB_THROTTLE = 0.4;
const STUB_LOOKAHEAD = 12; // m along the centerline
const STUB_STEER_GAIN = 2; // steer per radian of heading error
const STUB_FIRE_RANGE = 30; // m, any car ahead within this range
const STUB_MINE_PERIOD = 5; // s

/**
 * STUB (WP00), WP07 replaces the body and keeps the signature.
 * Crude on purpose: follows the centerline at low throttle, fires at cars ahead and pulses dropMine,
 * so AI cars move, shoot and drop mines in the debug view. Sim tests never depend on it.
 */
export function createAiDriver(_world: SimWorld, car: CarId, profile: AiProfile): AiDriver {
  const frame: InputFrame = { ...NEUTRAL_INPUT };
  const target = createTrackSample();
  return {
    car,
    profile,
    decide(world: SimWorld): InputFrame {
      const me = world.cars[car];
      if (!me) return frame;
      const p = me.body.translation();
      const h = me.body.rotation();
      world.track.sampleAtInto(target, me.trackS + STUB_LOOKAHEAD);
      const want = Math.atan2(target.pos.y - p.y, target.pos.x - p.x);
      frame.throttle = STUB_THROTTLE;
      frame.steer = clamp(angleWrap(want - h) * STUB_STEER_GAIN, -1, 1);
      const fx = Math.cos(h);
      const fy = Math.sin(h);
      frame.fire = false;
      for (const other of world.cars) {
        if (other.id === car || other.wrecked) continue;
        const q = other.body.translation();
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        if (dx * fx + dy * fy > 0 && dx * dx + dy * dy < STUB_FIRE_RANGE * STUB_FIRE_RANGE) {
          frame.fire = true;
          break;
        }
      }
      frame.dropMine = world.tick % (STUB_MINE_PERIOD * SIM_HZ) === 0;
      return frame;
    },
  };
}
