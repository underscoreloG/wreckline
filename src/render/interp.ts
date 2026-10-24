import type { CarState } from '../shared/contracts';
import { lerpAngle } from '../shared/math';

export interface Pose {
  x: number; // world x = sim x
  z: number; // world z = sim y
  heading: number; // sim heading, interpolated on the shortest arc
  rotY: number; // mesh.rotation.y = -heading (contracts header)
}

/** Interpolated render pose between two snapshots of one car, written into `out`. */
export function interpolatePose(prev: CarState, curr: CarState, alpha: number, out: Pose): Pose {
  out.x = prev.pos.x + (curr.pos.x - prev.pos.x) * alpha;
  out.z = prev.pos.y + (curr.pos.y - prev.pos.y) * alpha;
  out.heading = lerpAngle(prev.heading, curr.heading, alpha);
  out.rotY = -out.heading;
  return out;
}
