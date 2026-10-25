import type { TrackGeometry } from '../shared/contracts';

export interface RacingLine {
  /** Lateral offset per track sample, + = right. */
  offsets: Float32Array;
  /** Target speed per track sample, m/s. */
  speeds: Float32Array;
}

/**
 * Grip-limited lateral acceleration of the WP01 model per unit of grip (m/s^2). The spec started at 22;
 * measured in ai.test.ts at constant radius (17 m and 22 m circles): a raven (grip 0.78) holds the line
 * within ~2 m up to ~50 m/s^2, so 50 / 0.78 = 64. The WP01 model is turn-rate limited, not grip limited.
 */
export const LAT_ACCEL_PER_GRIP = 64;
/** Iterations of the neighbour-midpoint relaxation (WP07 spec). */
const SMOOTH_ITERATIONS = 300;
/** Sample strides of the coarse-to-fine relaxation passes (1 = the spec's full-resolution pass). */
const STRIDES = [8, 1];
/** Margin between the line and the road edge, m. */
const EDGE_MARGIN = 1.6;
/** Samples on each side for the 3-point circumradius curvature. */
const CURVATURE_WINDOW = 4;
/** Braking the line plans with, as a fraction of the car's brake. */
const BRAKE_USE = 0.85;
const MIN_CURVATURE = 1e-4;

/** Extra per-line data the AI needs, kept off the frozen RacingLine shape. */
interface LineExtra {
  /** Signed curvature of the racing line per sample, 1/m, + = right. */
  curvature: Float32Array;
}

const cache = new Map<string, RacingLine>();
const extras = new WeakMap<RacingLine, LineExtra>();

/** Half the drivable band the line may use (also the clamp for AI target laterals). */
export const lineLimit = (track: TrackGeometry): number => track.def.width / 2 - EDGE_MARGIN;

/** Curvature of the racing line per track sample (same indexing as offsets). */
export function lineCurvature(line: RacingLine): Float32Array {
  const e = extras.get(line);
  if (!e) throw new Error('lineCurvature: not a buildRacingLine result');
  return e.curvature;
}

/** WP07 "Racing line": smoothed apex-cutting offsets, then a grip and braking limited speed profile. Cached. */
export function buildRacingLine(track: TrackGeometry, grip: number, brake: number): RacingLine {
  const key = `${track.def.id}|${grip}|${brake}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const smp = track.samples;
  const n = smp.length;
  const lim = lineLimit(track);
  const wrap = (i: number): number => (i + n) % n;

  // 1. relaxation toward the neighbour midpoint, projected back on each sample's right vector. Coarse strides
  // first: at 1 m spacing 300 iterations only smooth ~15 m of road (measured 1.5% less curvature on Scrapyard),
  // so each stride relaxes the line over a longer reach, then the 1 m pass of the spec removes the kinks.
  const o = new Float64Array(n);
  const tmp = new Float64Array(n);
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  for (const stride of STRIDES) relax(track, o, tmp, px, py, stride, lim);
  for (let i = 0; i < n; i++) {
    px[i] = smp[i].pos.x + smp[i].right.x * o[i];
    py[i] = smp[i].pos.y + smp[i].right.y * o[i];
  }

  // 2. curvature of the resulting path
  const curvature = new Float32Array(n);
  for (let i = 0; i < n; i++) curvature[i] = pathCurvature(px, py, wrap(i - CURVATURE_WINDOW), i, wrap(i + CURVATURE_WINDOW));

  // 3. corner speed, then two backward braking passes around the loop
  const latAccel = grip * LAT_ACCEL_PER_GRIP;
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.sqrt(latAccel / Math.max(Math.abs(curvature[i]), MIN_CURVATURE));
  const decel2 = 2 * brake * BRAKE_USE;
  for (let k = 2 * n - 1; k >= 0; k--) {
    const i = k % n;
    const j = wrap(i + 1);
    const ds = Math.hypot(px[j] - px[i], py[j] - py[i]);
    v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + decel2 * ds));
  }

  const line: RacingLine = { offsets: Float32Array.from(o), speeds: Float32Array.from(v) };
  extras.set(line, { curvature });
  cache.set(key, line);
  return line;
}

/**
 * SMOOTH_ITERATIONS of the midpoint relaxation on every `stride`-th sample (wrapping), then linear
 * interpolation of the offsets in between. Writes `o` in place; tmp/px/py are scratch.
 */
function relax(track: TrackGeometry, o: Float64Array, tmp: Float64Array, px: Float64Array, py: Float64Array, stride: number, lim: number): void {
  const smp = track.samples;
  const n = smp.length;
  const m = Math.max(4, Math.round(n / stride));
  const idx = (j: number): number => Math.round((((j % m) + m) % m) * (n / m)) % n;
  for (let j = 0; j < m; j++) tmp[j] = o[idx(j)];
  for (let it = 0; it < SMOOTH_ITERATIONS; it++) {
    for (let j = 0; j < m; j++) {
      const s = smp[idx(j)];
      px[j] = s.pos.x + s.right.x * tmp[j];
      py[j] = s.pos.y + s.right.y * tmp[j];
    }
    for (let j = 0; j < m; j++) {
      const a = (j + m - 1) % m;
      const b = (j + 1) % m;
      const mx = px[j] + ((px[a] + px[b]) / 2 - px[j]) / 2;
      const my = py[j] + ((py[a] + py[b]) / 2 - py[j]) / 2;
      const s = smp[idx(j)];
      const lat = (mx - s.pos.x) * s.right.x + (my - s.pos.y) * s.right.y;
      tmp[j] = lat < -lim ? -lim : lat > lim ? lim : lat;
    }
  }
  for (let j = 0; j < m; j++) {
    const i0 = idx(j);
    const i1 = j + 1 === m ? n : idx(j + 1);
    const a = tmp[j];
    const b = tmp[(j + 1) % m];
    for (let i = i0; i < i1; i++) o[i] = a + ((b - a) * (i - i0)) / (i1 - i0);
  }
}

/** Signed circumradius curvature through points a, b, c of the path, + = turning right. */
function pathCurvature(px: Float64Array, py: Float64Array, a: number, b: number, c: number): number {
  const abx = px[b] - px[a];
  const aby = py[b] - py[a];
  const bcx = px[c] - px[b];
  const bcy = py[c] - py[b];
  const denom = Math.hypot(abx, aby) * Math.hypot(bcx, bcy) * Math.hypot(px[c] - px[a], py[c] - py[a]);
  return denom > 1e-12 ? (2 * (abx * bcy - aby * bcx)) / denom : 0;
}
