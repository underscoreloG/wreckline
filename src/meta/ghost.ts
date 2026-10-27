import { baseTrackId, isReversedId } from '../content/tracks';
import type { GhostPose } from '../shared/contracts';
import { SIM_HZ } from '../shared/contracts';
import type { KeyValueStore } from './save';

// WP40 (CCR-15): the time trial best lap of each track, direction and car, with its ghost.

export const GHOST_HZ = 20;
/** Sim ticks between two ghost poses. */
export const GHOST_TICKS = SIM_HZ / GHOST_HZ;
/** Quantisation: 2 cm and 1/2048 turn (0.18 deg), so a round trip is within 1 cm and 0.09 deg. */
export const GHOST_POS_UNIT = 0.02; // m
export const GHOST_TURN_UNITS = 2048;
/** A new layout of the entry gets a new prefix; entries under an old one are never read. */
export const GHOST_KEY_PREFIX = 'wreckline.ghost.v1';
const ENTRY_VERSION = 1;
const MAX_LAP_SECONDS = 600; // a stored time beyond this is corrupt

export interface GhostLap {
  time: number; // s, the lap time
  poses: GhostPose[]; // the player's pose every 1/GHOST_HZ s of lap time from the line, poses[0] on the line
}

/** One entry per track, direction and car: 'wreckline.ghost.v1.scrapyard.rev.raven'. `trackId` may be '<id>~r' (CCR-14). */
export const ghostKey = (trackId: string, carId: string): string =>
  `${GHOST_KEY_PREFIX}.${baseTrackId(trackId)}.${isReversedId(trackId) ? 'rev' : 'fwd'}.${carId}`;

const TAU = Math.PI * 2;
const HALF_TURN = GHOST_TURN_UNITS / 2;
const wrapUnits = (d: number): number => ((((d + HALF_TURN) % GHOST_TURN_UNITS) + GHOST_TURN_UNITS) % GHOST_TURN_UNITS) - HALF_TURN;

/**
 * Poses as integer channels (x, y in GHOST_POS_UNIT, heading unwrapped in turn units), each sent as its residual from a
 * constant-velocity prediction (q[k] - 2 q[k-1] + q[k-2]): a car's motion is smooth, so most residuals fit one byte as
 * zigzag varints. Integers all the way, so there is no drift. Base64 for the string store.
 */
export function encodePoses(poses: readonly GhostPose[]): string {
  const bytes: number[] = [];
  const hist = [
    [0, 0],
    [0, 0],
    [0, 0],
  ]; // per channel: q[k-1], q[k-2]
  let heading = 0;
  poses.forEach((p, k) => {
    const raw = Math.round((p.heading / TAU) * GHOST_TURN_UNITS);
    heading = k === 0 ? raw : heading + wrapUnits(raw - heading);
    const q = [Math.round(p.x / GHOST_POS_UNIT), Math.round(p.y / GHOST_POS_UNIT), heading];
    for (let c = 0; c < 3; c++) {
      const [q1, q2] = hist[c];
      const pred = k === 0 ? 0 : k === 1 ? q1 : 2 * q1 - q2;
      let z = q[c] - pred;
      z = z < 0 ? -2 * z - 1 : 2 * z; // zigzag, arithmetic so values past 2^31 stay exact
      while (z >= 0x80) {
        bytes.push((z % 0x80) | 0x80);
        z = Math.floor(z / 0x80);
      }
      bytes.push(z);
      hist[c] = [q[c], q1];
    }
  });
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** encodePoses inverted; null for anything that does not decode to whole poses. */
export function decodePoses(text: string): GhostPose[] | null {
  let bin: string;
  try {
    bin = atob(text);
  } catch {
    return null;
  }
  const values: number[] = [];
  let z = 0;
  let scale = 1;
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    z += (b & 0x7f) * scale;
    if (b & 0x80) {
      scale *= 0x80;
      if (scale > 2 ** 35) return null;
      continue;
    }
    values.push(z % 2 === 1 ? -(z + 1) / 2 : z / 2);
    z = 0;
    scale = 1;
  }
  if (scale !== 1 || values.length === 0 || values.length % 3 !== 0) return null;
  const poses: GhostPose[] = [];
  const hist = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];
  for (let k = 0; k < values.length / 3; k++) {
    const q = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const [q1, q2] = hist[c];
      q[c] = values[k * 3 + c] + (k === 0 ? 0 : k === 1 ? q1 : 2 * q1 - q2);
      hist[c] = [q[c], q1];
    }
    poses.push({ x: q[0] * GHOST_POS_UNIT, y: q[1] * GHOST_POS_UNIT, heading: (q[2] / GHOST_TURN_UNITS) * TAU });
  }
  return poses;
}

/** The stored entry: `{"v":1,"t":<lap s>,"p":"<poses>"}`. */
export const serializeGhost = (lap: GhostLap): string => JSON.stringify({ v: ENTRY_VERSION, t: lap.time, p: encodePoses(lap.poses) });

/** null for a missing, corrupt, older or inconsistent entry (the pose count must fit the lap time). */
export function parseGhost(text: string | null): GhostLap | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== ENTRY_VERSION || typeof r.t !== 'number' || !Number.isFinite(r.t) || r.t <= 0 || r.t > MAX_LAP_SECONDS || typeof r.p !== 'string') return null;
  const poses = decodePoses(r.p);
  if (!poses || poses.length < 2 || poses.length > Math.ceil(r.t * GHOST_HZ) + 1) return null;
  return { time: r.t, poses };
}

export function loadGhost(store: KeyValueStore, key: string): GhostLap | null {
  try {
    return parseGhost(store.get(key));
  } catch {
    return null;
  }
}

/**
 * Stores `lap` when it beats the stored best (or there is none) and returns true. A slower or equal lap, or a refused
 * write (quota, private mode), returns false and leaves the entry as it was.
 */
export function offerGhost(store: KeyValueStore, key: string, lap: GhostLap): boolean {
  const best = loadGhost(store, key);
  if (best && lap.time >= best.time) return false;
  try {
    store.set(key, serializeGhost(lap));
    return true;
  } catch {
    return false;
  }
}
