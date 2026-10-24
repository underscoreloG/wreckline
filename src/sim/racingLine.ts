import type { TrackGeometry } from '../shared/contracts';

export interface RacingLine {
  /** Lateral offset per track sample, + = right. */
  offsets: Float32Array;
  /** Target speed per track sample, m/s. */
  speeds: Float32Array;
}

/** STUB (WP00), WP07 replaces the body and keeps the signature. Returns all zeros (the centerline). */
export function buildRacingLine(track: TrackGeometry, _grip: number, _brake: number): RacingLine {
  return { offsets: new Float32Array(track.samples.length), speeds: new Float32Array(track.samples.length) };
}
