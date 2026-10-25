import type {
  Checkpoint,
  GridSlot,
  PropKind,
  TrackDef,
  TrackGeometry,
  TrackProjection,
  TrackSample,
  TrackValidation,
  Vec2,
} from './contracts';

/** Dense spline sub-steps per centerline segment, before arc-length reparametrization. */
const SUBSTEPS = 200;
/** Samples on each side used for the circumradius curvature estimate. */
const CURVATURE_WINDOW = 3;
/** projectInto with a hint only searches this far along s. */
const HINT_SEARCH = 40;
const GRID_SLOTS = 8;

/** Circle approximation of each prop kind (radius in m at scale 1), shared by validation, placement and colliders. */
export const PROP_RADIUS: Readonly<Record<PropKind, number>> = {
  crate: 0.8,
  tireStack: 0.7,
  barrel: 0.5,
  container: 3.2,
  wreck: 2.4,
  lightPole: 0.3,
  cone: 0.3,
  rock: 1.5,
  cactus: 0.6,
  building: 6,
  // CCR-6 kinds (WP22): pine = lowest cone, snowbank = mound half-length, billboard = half the panel width,
  // crane = the base's half-diagonal (its jib over the road is not part of the footprint).
  pine: 1.6,
  snowbank: 1.6,
  billboard: 4.2,
  crane: 3.5,
};

export const propRadius = (kind: PropKind): number => PROP_RADIUS[kind];

export function createTrackSample(): TrackSample {
  return { s: 0, pos: { x: 0, y: 0 }, tangent: { x: 1, y: 0 }, right: { x: 0, y: 1 }, curvature: 0 };
}

export function createTrackProjection(): TrackProjection {
  return { s: 0, lateral: 0, sample: createTrackSample() };
}

/** Closed centripetal Catmull-Rom (alpha 0.5, Barry-Goldman form), flattened xy pairs. */
function denseSpline(pts: readonly Vec2[]): Float64Array {
  const n = pts.length;
  const out = new Float64Array(n * SUBSTEPS * 2);
  let o = 0;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const t0 = 0;
    const t1 = t0 + Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y));
    const t2 = t1 + Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y));
    const t3 = t2 + Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y));
    for (let k = 0; k < SUBSTEPS; k++) {
      const t = t1 + ((t2 - t1) * k) / SUBSTEPS;
      const a1x = ((t1 - t) * p0.x + (t - t0) * p1.x) / (t1 - t0);
      const a1y = ((t1 - t) * p0.y + (t - t0) * p1.y) / (t1 - t0);
      const a2x = ((t2 - t) * p1.x + (t - t1) * p2.x) / (t2 - t1);
      const a2y = ((t2 - t) * p1.y + (t - t1) * p2.y) / (t2 - t1);
      const a3x = ((t3 - t) * p2.x + (t - t2) * p3.x) / (t3 - t2);
      const a3y = ((t3 - t) * p2.y + (t - t2) * p3.y) / (t3 - t2);
      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) / (t2 - t0);
      const b1y = ((t2 - t) * a1y + (t - t0) * a2y) / (t2 - t0);
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) / (t3 - t1);
      const b2y = ((t3 - t) * a2y + (t - t1) * a3y) / (t3 - t1);
      out[o++] = ((t2 - t) * b1x + (t - t1) * b2x) / (t2 - t1);
      out[o++] = ((t2 - t) * b1y + (t - t1) * b2y) / (t2 - t1);
    }
  }
  return out;
}

/** Signed curvature from the circumradius of a-b-c, + = turning right (clockwise on screen). */
function curvature3(a: Vec2, b: Vec2, c: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const denom = Math.hypot(abx, aby) * Math.hypot(bcx, bcy) * Math.hypot(c.x - a.x, c.y - a.y);
  return denom > 1e-12 ? (2 * (abx * bcy - aby * bcx)) / denom : 0;
}

export function buildTrackGeometry(def: TrackDef): TrackGeometry {
  if (def.centerline.length < 4) throw new Error(`track ${def.id}: needs at least 4 centerline points`);
  const dense = denseSpline(def.centerline);
  const m = dense.length / 2;
  const cum = new Float64Array(m + 1);
  for (let j = 1; j <= m; j++) {
    const a = (j - 1) * 2;
    const b = (j % m) * 2;
    cum[j] = cum[j - 1] + Math.hypot(dense[b] - dense[a], dense[b + 1] - dense[a + 1]);
  }
  const length = cum[m];
  const n = Math.round(length);
  const ds = length / n;

  const pos: Vec2[] = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = i * ds;
    while (seg < m - 1 && cum[seg + 1] <= s) seg++;
    const segLen = cum[seg + 1] - cum[seg];
    const t = segLen > 0 ? (s - cum[seg]) / segLen : 0;
    const a = seg * 2;
    const b = ((seg + 1) % m) * 2;
    pos.push({
      x: dense[a] + (dense[b] - dense[a]) * t,
      y: dense[a + 1] + (dense[b + 1] - dense[a + 1]) * t,
    });
  }

  const at = (i: number): Vec2 => pos[((i % n) + n) % n];
  const samples: TrackSample[] = [];
  const leftEdge: Vec2[] = [];
  const rightEdge: Vec2[] = [];
  const leftWall: Vec2[] = [];
  const rightWall: Vec2[] = [];
  const halfW = def.width / 2;
  const wallOff = halfW + def.shoulder;
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const prev = at(i - 1);
    const next = at(i + 1);
    const tl = Math.hypot(next.x - prev.x, next.y - prev.y);
    const tangent = { x: (next.x - prev.x) / tl, y: (next.y - prev.y) / tl };
    const r = { x: -tangent.y, y: tangent.x };
    samples.push({
      s: i * ds,
      pos: p,
      tangent,
      right: r,
      curvature: curvature3(at(i - CURVATURE_WINDOW), p, at(i + CURVATURE_WINDOW)),
    });
    leftEdge.push({ x: p.x - r.x * halfW, y: p.y - r.y * halfW });
    rightEdge.push({ x: p.x + r.x * halfW, y: p.y + r.y * halfW });
    leftWall.push({ x: p.x - r.x * wallOff, y: p.y - r.y * wallOff });
    rightWall.push({ x: p.x + r.x * wallOff, y: p.y + r.y * wallOff });
  }

  const wrapS = (s: number): number => {
    const u = s % length;
    return u < 0 ? u + length : u;
  };

  const sampleAtInto = (out: TrackSample, s: number): TrackSample => {
    const u = wrapS(s);
    const f = u / ds;
    let i = Math.floor(f);
    if (i >= n) i = n - 1;
    const t = f - i;
    const a = samples[i];
    const b = samples[(i + 1) % n];
    out.s = u;
    out.pos.x = a.pos.x + (b.pos.x - a.pos.x) * t;
    out.pos.y = a.pos.y + (b.pos.y - a.pos.y) * t;
    let tx = a.tangent.x + (b.tangent.x - a.tangent.x) * t;
    let ty = a.tangent.y + (b.tangent.y - a.tangent.y) * t;
    const tl = Math.hypot(tx, ty);
    tx /= tl;
    ty /= tl;
    out.tangent.x = tx;
    out.tangent.y = ty;
    out.right.x = -ty;
    out.right.y = tx;
    out.curvature = a.curvature + (b.curvature - a.curvature) * t;
    return out;
  };

  const projectInto = (out: TrackProjection, p: Vec2, hintS?: number): TrackProjection => {
    let best = 0;
    let bestD = Infinity;
    const check = (i: number): void => {
      const q = samples[i].pos;
      const d = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (hintS === undefined) {
      for (let i = 0; i < n; i++) check(i);
    } else {
      const c = Math.round(wrapS(hintS) / ds);
      const w = Math.ceil(HINT_SEARCH / ds);
      for (let k = -w; k <= w; k++) check((((c + k) % n) + n) % n);
    }
    // Refine on the two sample segments around the best sample.
    let bestS = best * ds;
    let refD = Infinity;
    for (let k = -1; k <= 0; k++) {
      const i0 = (((best + k) % n) + n) % n;
      const a = samples[i0].pos;
      const b = samples[(i0 + 1) % n].pos;
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const e2 = ex * ex + ey * ey;
      let t = e2 > 0 ? ((p.x - a.x) * ex + (p.y - a.y) * ey) / e2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = p.x - (a.x + ex * t);
      const dy = p.y - (a.y + ey * t);
      const d = dx * dx + dy * dy;
      if (d < refD) {
        refD = d;
        bestS = (i0 + t) * ds;
      }
    }
    const smp = sampleAtInto(out.sample, bestS);
    out.s = smp.s;
    out.lateral = (p.x - smp.pos.x) * smp.right.x + (p.y - smp.pos.y) * smp.right.y;
    return out;
  };

  const sampleAt = (s: number): TrackSample => sampleAtInto(createTrackSample(), s);
  const project = (p: Vec2, hintS?: number): TrackProjection => projectInto(createTrackProjection(), p, hintS);

  const count = Math.max(8, Math.round(length / def.checkpointSpacing));
  const checkpoints: Checkpoint[] = [];
  for (let i = 0; i < count; i++) {
    const smp = sampleAt((i * length) / count);
    checkpoints.push({
      index: i,
      s: smp.s,
      a: { x: smp.pos.x - smp.right.x * wallOff, y: smp.pos.y - smp.right.y * wallOff },
      b: { x: smp.pos.x + smp.right.x * wallOff, y: smp.pos.y + smp.right.y * wallOff },
    });
  }

  const grid: GridSlot[] = [];
  for (let k = 0; k < GRID_SLOTS; k++) {
    const row = Math.floor(k / 2);
    const column = k % 2;
    const smp = sampleAt(length - 8 - row * 8 - column * 4);
    const lateral = column === 0 ? -3 : 3;
    grid.push({
      pos: { x: smp.pos.x + smp.right.x * lateral, y: smp.pos.y + smp.right.y * lateral },
      heading: Math.atan2(smp.tangent.y, smp.tangent.x),
    });
  }

  return { def, length, samples, leftEdge, rightEdge, leftWall, rightWall, checkpoints, grid, sampleAt, sampleAtInto, project, projectInto };
}

export function validateTrack(def: TrackDef): TrackValidation {
  const g = buildTrackGeometry(def);
  const errors: string[] = [];
  const n = g.samples.length;
  const ds = g.length / n;

  if (g.length < 600 || g.length > 2000) errors.push(`length ${g.length.toFixed(1)} m is outside 600-2000 m`);

  let maxK = 0;
  let maxKAt = 0;
  for (const smp of g.samples) {
    if (Math.abs(smp.curvature) > maxK) {
      maxK = Math.abs(smp.curvature);
      maxKAt = smp.s;
    }
  }
  const minRadius = maxK > 0 ? 1 / maxK : Infinity;
  if (minRadius < def.width) errors.push(`min radius ${minRadius.toFixed(1)} m at s ${maxKAt.toFixed(0)} is below the road width ${def.width} m`);

  // Clearance between parts of the loop that are far apart along s (the track passing near itself).
  const minSep = 4 * def.width;
  let minClearance = Infinity;
  let clearAt: [number, number] = [0, 0];
  for (let i = 0; i < n; i++) {
    const a = g.samples[i].pos;
    for (let j = i + 1; j < n; j++) {
      const sep = Math.min(j - i, n - (j - i)) * ds;
      if (sep <= minSep) continue;
      const b = g.samples[j].pos;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < minClearance) {
        minClearance = d;
        clearAt = [i * ds, j * ds];
      }
    }
  }
  const needClear = def.width + 2 * def.shoulder + 8;
  if (minClearance < needClear) {
    errors.push(`min clearance ${minClearance.toFixed(1)} m between s ${clearAt[0].toFixed(0)} and ${clearAt[1].toFixed(0)} is below ${needClear} m`);
  }

  def.pickups.forEach((pk, i) => {
    if (Math.abs(pk.lateral) > def.width / 2 - 1.5) errors.push(`pickup ${i} (${pk.kind}) lateral ${pk.lateral} is beyond width/2 - 1.5`);
    if (pk.s < 0 || pk.s >= g.length) errors.push(`pickup ${i} (${pk.kind}) s ${pk.s} is outside [0, ${g.length.toFixed(1)})`);
  });

  const proj = createTrackProjection();
  def.props.forEach((pr, i) => {
    g.projectInto(proj, pr.pos);
    const d = Math.hypot(pr.pos.x - proj.sample.pos.x, pr.pos.y - proj.sample.pos.y);
    const need = def.width / 2 + def.shoulder + 1 + propRadius(pr.kind) * pr.scale;
    if (d < need) errors.push(`prop ${i} (${pr.kind}) is ${d.toFixed(1)} m from the centerline, needs ${need.toFixed(1)} m`);
  });
  for (let i = 0; i < def.props.length; i++) {
    const a = def.props[i];
    for (let j = i + 1; j < def.props.length; j++) {
      const b = def.props[j];
      const d = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
      if (d < propRadius(a.kind) * a.scale + propRadius(b.kind) * b.scale) errors.push(`props ${i} (${a.kind}) and ${j} (${b.kind}) overlap`);
    }
  }

  return { ok: errors.length === 0, errors, length: g.length, minRadius, minClearance };
}
