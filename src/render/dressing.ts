import type { PropPlacement, TrackGeometry, Vec2 } from '../shared/contracts';
import { createRng, hashString, type Rng } from '../shared/rng';
import { createTrackProjection, propRadius } from '../shared/trackGeometry';
import type { DecalCell, GroundDecal, ThemeDressing } from './themes';

/**
 * WP27 track dressing layout: pure data from the track geometry and a fixed seed per track, so the
 * same track always gets the same dressing. Render only: paint lies on the road, shoulder or ground;
 * every 3D piece stands beyond the wall mesh and clear of the track's props (dressing.test.ts).
 */

export const WALL_THICK = 0.6; // trackMesh wall depth outside the wall line
const DRESSING_SEED = 0x27d2e5;
const KERB_CURVATURE = 1 / 70;
const HAIRPIN_CURVATURE = 1 / 25;
const HAIRPIN_TURN = (150 * Math.PI) / 180;
const BARRIER_CURVATURE = 1 / 40; // corners tighter than this get barrier dressing
const KERB_WIDTH = 1;
const KERB_WIDTH_HAIRPIN = 1.6;
const KERB_LEAD = 6; // m of kerb before and after each corner
const KERB_LEAD_HAIRPIN = 12;
const KERB_MIN_RUN = 4; // m: shorter wiggles get no kerb
const BARRIER_EXTRA = 8; // m of barrier past each kerb run
const SKID_MIN_RUN = 15; // m
const SKID_STEP = 2; // m between tyre mark points

/** Footprint of one barrier segment: `len` along the wall, `depth` away from it. */
export const BARRIER = {
  tyres: { len: 0.74, depth: 0.74 },
  blocks: { len: 2, depth: 0.7 },
  rails: { len: 2, depth: 0.3 },
  fence: { len: 2, depth: 0.25 },
} as const;

export const STAND = { len: 22, depth: 6, tiers: 4, gap: 3 };
export const STAND_TIER_H = 0.6;
export const BANNER_LEN = 4;
export const CLUTTER_RADIUS = 1.6; // m at scale 1
export const NEON_SIZE = 5;

export interface CornerRun {
  /** Sample indices; `to` >= `from` and may run past the sample count (wraps). */
  from: number;
  to: number;
  /** Side away from the turn's centre: -1 left, +1 right. */
  outside: -1 | 1;
  /** Turns at least 150 deg with a radius under 25 m (content.md section 12). */
  hairpin: boolean;
  /** Radius under 40 m somewhere in the corner. */
  tight: boolean;
}

/** One 3D piece. `rot` follows the heading convention; local +z points away from the road for side pieces. */
export interface Placed {
  x: number;
  y: number;
  /** Base height above the ground (crowd on stand tiers). */
  h: number;
  rot: number;
  scale: number;
  tint: number;
}

export interface Decal {
  x: number;
  y: number;
  rot: number;
  /** Across the heading. */
  w: number;
  /** Along the heading. */
  l: number;
  cell: DecalCell;
  color: string;
  alpha: number;
  layer: 'ground' | 'shoulder' | 'road';
}

/** Ribbon decal along a polyline (tyre marks). */
export interface Strip {
  points: Vec2[];
  width: number;
  color: string;
  alpha: number;
}

export interface DressingPlan {
  /** Kerb width per sample, 0 = none. */
  kerbWidth: Float32Array;
  corners: CornerRun[];
  barriers: Placed[];
  decals: Decal[];
  skids: Strip[];
  clutter: Placed[];
  stands: Placed[];
  crowd: Placed[];
  banners: Placed[];
  flags: Placed[];
  vents: Placed[];
  neon: Placed[];
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;

export function cornerRuns(track: TrackGeometry): CornerRun[] {
  const { samples } = track;
  const n = samples.length;
  const ds = track.length / n;
  const on = (i: number): boolean => Math.abs(samples[mod(i, n)].curvature) > KERB_CURVATURE;
  let start = 0;
  while (start < n && on(start)) start++;
  if (start === n) return [];
  const runs: CornerRun[] = [];
  for (let i = start + 1; i <= start + n; i++) {
    if (!on(i)) continue;
    let j = i;
    let sum = 0;
    let peak = 0;
    while (j < start + n && on(j)) {
      const c = samples[mod(j, n)].curvature;
      sum += c;
      peak = Math.max(peak, Math.abs(c));
      j++;
    }
    if ((j - i) * ds >= KERB_MIN_RUN) {
      const hairpin = peak > HAIRPIN_CURVATURE && Math.abs(sum) * ds >= HAIRPIN_TURN;
      const lead = Math.round((hairpin ? KERB_LEAD_HAIRPIN : KERB_LEAD) / ds);
      const from = mod(i - lead, n);
      runs.push({ from, to: from + j - i + 2 * lead, outside: sum > 0 ? -1 : 1, hairpin, tight: peak > BARRIER_CURVATURE });
    }
    i = j;
  }
  return runs;
}

function kerbWidths(track: TrackGeometry, runs: CornerRun[]): Float32Array {
  const n = track.samples.length;
  const w = new Float32Array(n);
  const max = track.def.shoulder * 0.8;
  for (const r of runs) {
    const width = Math.min(max, r.hairpin ? KERB_WIDTH_HAIRPIN : KERB_WIDTH);
    for (let i = r.from; i <= r.to; i++) w[mod(i, n)] = Math.max(w[mod(i, n)], width);
  }
  return w;
}

/** First lateral distance from the centerline that is free of the wall mesh. */
export const outerLateral = (track: TrackGeometry): number => track.def.width / 2 + track.def.shoulder + WALL_THICK;

/** True if a circle at (x, y) with radius r stays beyond every wall of the track and clear of every prop. */
export function makeClearance(track: TrackGeometry, props: readonly PropPlacement[]): (x: number, y: number, r: number) => boolean {
  const proj = createTrackProjection();
  const minLat = outerLateral(track);
  const p = { x: 0, y: 0 };
  return (x, y, r) => {
    p.x = x;
    p.y = y;
    track.projectInto(proj, p);
    if (Math.abs(proj.lateral) - r < minLat) return false;
    return props.every((q) => Math.hypot(q.pos.x - x, q.pos.y - y) >= propRadius(q.kind) * q.scale + r);
  };
}

function pickDecal(rng: Rng, list: readonly GroundDecal[]): GroundDecal {
  let total = 0;
  for (const d of list) total += d.weight;
  let k = rng.range(0, total);
  for (const d of list) {
    k -= d.weight;
    if (k < 0) return d;
  }
  return list[list.length - 1];
}

const heading = (t: Vec2): number => Math.atan2(t.y, t.x);

export function planDressing(track: TrackGeometry, d: ThemeDressing): DressingPlan {
  const { def, samples } = track;
  const n = samples.length;
  const ds = track.length / n;
  const half = def.width / 2;
  const minLat = outerLateral(track);
  const clearOfTrack = makeClearance(track, def.props);
  const taken: { x: number; y: number; r: number }[] = [];
  const clear = (x: number, y: number, r: number): boolean => clearOfTrack(x, y, r) && taken.every((t) => Math.hypot(t.x - x, t.y - y) >= t.r + r);
  const take = (x: number, y: number, r: number): void => {
    taken.push({ x, y, r });
  };
  /** Long pieces: circles of radius r every metre along local x. */
  const alongSeg = (x: number, y: number, rot: number, len: number, f: (px: number, py: number) => boolean): boolean => {
    // At least the two ends and the middle: a short tyre stack checked at its ends only can sit on a prop (WP39).
    const k = Math.max(2, Math.ceil(len));
    for (let i = 0; i <= k; i++) {
      const t = -len / 2 + (len * i) / k;
      if (!f(x + Math.cos(rot) * t, y + Math.sin(rot) * t)) return false;
    }
    return true;
  };
  const clearSeg = (x: number, y: number, rot: number, len: number, r: number): boolean => alongSeg(x, y, rot, len, (px, py) => clear(px, py, r));
  const takeSeg = (x: number, y: number, rot: number, len: number, r: number): void => {
    alongSeg(x, y, rot, len, (px, py) => {
      take(px, py, r);
      return true;
    });
  };
  // One stream per category, so tuning one never reshuffles the others.
  const seed = (hashString(def.id) ^ DRESSING_SEED) >>> 0;
  const rngFor = (k: number): Rng => createRng((seed + Math.imul(k, 0x9e3779b9)) >>> 0);
  const at = (s: number, lat: number): Vec2 => {
    const smp = track.sampleAt(s);
    return { x: smp.pos.x + smp.right.x * lat, y: smp.pos.y + smp.right.y * lat };
  };
  /** Side piece rotation: local +x along travel, local +z away from the road. */
  const sideRot = (s: number, side: number): number => heading(track.sampleAt(s).tangent) + (side < 0 ? Math.PI : 0);

  const corners = cornerRuns(track);
  const kerbWidth = kerbWidths(track, corners);
  const kerbAt = (s: number): number => kerbWidth[mod(Math.round(s / ds), n)];

  // Barriers along the outside of every corner: step along the barrier line, not the centerline.
  const barriers: Placed[] = [];
  const bRng = rngFor(1);
  const seg = BARRIER[d.barrier];
  for (const r of corners.filter((c) => c.tight)) {
    const side = r.outside;
    const lat = side * (minLat + 0.1 + seg.depth / 2);
    for (let s = r.from * ds - BARRIER_EXTRA; s < r.to * ds + BARRIER_EXTRA; ) {
      const smp = track.sampleAt(s);
      const p = at(s, lat);
      const rot = sideRot(s, side);
      // Checked against the track only: neighbouring segments touch on purpose.
      if (alongSeg(p.x, p.y, rot, seg.len * 0.9, (px, py) => clearOfTrack(px, py, seg.depth / 2))) {
        barriers.push({ x: p.x, y: p.y, h: 0, rot, scale: 1, tint: bRng.chance(0.25) ? 1 : 0 });
        takeSeg(p.x, p.y, rot, seg.len * 0.9, seg.depth / 2);
      }
      s += seg.len / Math.max(0.3, 1 - smp.curvature * lat);
    }
  }

  const decals: Decal[] = [];
  const gRng = rngFor(2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const smp of samples) {
    minX = Math.min(minX, smp.pos.x);
    maxX = Math.max(maxX, smp.pos.x);
    minY = Math.min(minY, smp.pos.y);
    maxY = Math.max(maxY, smp.pos.y);
  }
  const ground = (pos: Vec2, g: GroundDecal, rot: number): void => {
    const size = gRng.range(g.size[0], g.size[1]);
    decals.push({ ...pos, rot, w: size * gRng.range(0.7, 1.3), l: size, cell: g.cell, color: g.color, alpha: g.alpha, layer: 'ground' });
  };
  for (let s = 0; s < track.length; s += 4) {
    for (const side of [-1, 1]) {
      if (!gRng.chance(0.8)) continue;
      ground(at(s, side * (minLat + gRng.range(0.5, 30))), pickDecal(gRng, d.ground), gRng.range(0, Math.PI * 2));
    }
  }
  for (let k = 0; k < 220; k++) {
    const pos = { x: gRng.range(minX - 120, maxX + 120), y: gRng.range(minY - 120, maxY + 120) };
    ground(pos, pickDecal(gRng, d.ground), gRng.range(0, Math.PI * 2));
  }

  const sRng = rngFor(3);
  for (let s = 0; s < track.length; s += 9) {
    for (const side of [-1, 1]) {
      if (!sRng.chance(0.5)) continue;
      const g = pickDecal(sRng, d.shoulder);
      const size = Math.min(def.shoulder * 0.9, sRng.range(g.size[0], g.size[1]));
      const pos = at(s, side * (half + def.shoulder / 2 + sRng.range(-0.2, 0.2) * def.shoulder));
      decals.push({ ...pos, rot: heading(track.sampleAt(s).tangent) + sRng.range(-0.3, 0.3), w: size, l: size * sRng.range(1, 2), cell: g.cell, color: g.color, alpha: g.alpha, layer: 'shoulder' });
    }
  }

  // Road: patches under seams, cracks and stains (buffer order is blend order).
  const rRng = rngFor(4);
  const road = (s: number, lat: number, w: number, l: number, rot: number, cell: DecalCell, color: string, alpha: number): void => {
    decals.push({ ...at(s, lat), rot, w, l, cell, color, alpha, layer: 'road' });
  };
  const roadRot = (s: number): number => heading(track.sampleAt(s).tangent);
  for (let s = 20; s < track.length - 20; s += rRng.range(45, 80)) {
    const w = rRng.range(2, 4);
    const l = rRng.range(3, 7);
    road(s, rRng.range(-1, 1) * (half - w / 2 - 1.4), w, l, roadRot(s), 'patch', d.roadPatch, 0.9);
  }
  for (let s = 30; s < track.length - 10; s += rRng.range(45, 90)) road(s, 0, def.width - 1.4, 0.6, roadRot(s), 'seam', d.roadDark, 0.75);
  for (let s = 10; s < track.length; s += rRng.range(15, 35)) {
    const size = rRng.range(2.5, 5);
    road(s, rRng.range(-1, 1) * (half - size / 2 - 1.4), size, size, rRng.range(0, Math.PI * 2), 'crack', d.roadDark, 0.7);
  }
  if (d.roadStain) {
    const st = d.roadStain;
    // Oil drips on the grid too; other stains (sand) only at corners.
    const grid = st.cell === 'stain' ? track.grid.map((g) => track.project(g.pos).s) : [];
    const stains = [...corners.map((r) => ((r.from + r.to) / 2) * ds), ...grid];
    for (const s of stains) {
      const size = rRng.range(st.size[0], st.size[1]);
      road(s + rRng.range(-4, 4), rRng.range(-1, 1) * (half - size / 2 - 1.6), size, size, rRng.range(0, Math.PI * 2), st.cell, st.color, st.alpha);
    }
  }
  for (const g of track.grid) {
    const fwd = { x: Math.cos(g.heading), y: Math.sin(g.heading) };
    decals.push({ x: g.pos.x + fwd.x * 2.4, y: g.pos.y + fwd.y * 2.4, rot: g.heading, w: 2.8, l: 1.2, cell: 'grid', color: '#D8D2C4', alpha: 0.7, layer: 'road' });
  }

  // Tyre marks along a racing line through each corner: outside, apex inside, outside.
  const skids: Strip[] = [];
  const kRng = rngFor(5);
  for (const r of corners) {
    const len = (r.to - r.from) * ds;
    if (len < SKID_MIN_RUN) continue;
    for (let m = 0; m < 2; m++) {
      const jitter = kRng.range(-1.2, 1.2);
      const points: Vec2[] = [];
      for (let t = 0; t <= len; t += SKID_STEP) {
        const lat = r.outside * (half * 0.55 * Math.cos((2 * Math.PI * t) / len) + jitter * 0.4) + jitter;
        points.push(at(r.from * ds + t, Math.max(-half + 1.5, Math.min(half - 1.5, lat))));
      }
      skids.push({ points, width: 1.9, color: d.roadDark, alpha: kRng.range(0.25, 0.45) });
    }
  }

  // Low clutter (scrap heaps, rocks, crates, snow mounds) on the ground beyond the walls.
  const clutter: Placed[] = [];
  if (d.clutter) {
    const cRng = rngFor(9);
    for (let s = 0; s < track.length; s += 6) {
      for (const side of [-1, 1]) {
        if (!cRng.chance(d.clutter.density)) continue;
        const scale = cRng.range(0.7, 1.4);
        const p = at(s + cRng.range(-2, 2), side * (minLat + cRng.range(2.5, 22)));
        if (!clear(p.x, p.y, CLUTTER_RADIUS * scale)) continue;
        take(p.x, p.y, CLUTTER_RADIUS * scale);
        clutter.push({ ...p, h: 0, rot: cRng.range(0, Math.PI * 2), scale, tint: cRng.int(0, d.clutter.colors.length - 1) });
      }
    }
  }

  // Grandstands near the start, with crowd and flags; then crowd clusters behind hairpin barriers.
  const aRng = rngFor(6);
  const stands: Placed[] = [];
  const crowd: Placed[] = [];
  const flags: Placed[] = [];
  const local = (pl: Placed, lx: number, lz: number): Vec2 => {
    const c = Math.cos(pl.rot);
    const sn = Math.sin(pl.rot);
    // local +x = (cos, sin), local +z = (-sin, cos) in sim axes (heading convention).
    return { x: pl.x + c * lx - sn * lz, y: pl.y + sn * lx + c * lz };
  };
  // The stand is a straight box: check its own edges, since next to a bend (a reversed track's start, WP39) the
  // road curves away under one end.
  const standFits = (st: Placed): boolean => {
    for (let a = -STAND.len / 2; a <= STAND.len / 2; a += 2) {
      for (const z of [-STAND.depth / 2, STAND.depth / 2]) {
        const p = local(st, a, z);
        if (!clear(p.x, p.y, 1.2)) return false;
      }
    }
    return true;
  };
  for (const [s, gap] of [track.length - 30, track.length - 55, 40, 90].flatMap((s) => [STAND.gap, STAND.gap * 2.5].map((g) => [s, g]))) {
    if (stands.length >= 2) break;
    for (const side of [-1, 1]) {
      if (stands.length >= 2) continue;
      const c = at(s, side * (minLat + gap + STAND.depth / 2));
      const st: Placed = { x: c.x, y: c.y, h: 0, rot: sideRot(s, side), scale: 1, tint: 0 };
      if (!standFits(st)) continue;
      stands.push(st);
      for (let lx = -STAND.len / 2; lx <= STAND.len / 2; lx += 2) {
        const q = local(st, lx, 0);
        take(q.x, q.y, STAND.depth / 2 + 0.5);
      }
      const tierD = STAND.depth / STAND.tiers;
      for (let t = 0; t < STAND.tiers; t++) {
        for (let lx = -STAND.len / 2 + 0.6; lx < STAND.len / 2 - 0.4; lx += 0.7) {
          if (!aRng.chance(0.8)) continue;
          const p = local(st, lx + aRng.range(-0.15, 0.15), -STAND.depth / 2 + tierD * (t + 0.5));
          crowd.push({ ...p, h: STAND_TIER_H * (t + 1), rot: st.rot + aRng.range(-0.3, 0.3), scale: aRng.range(0.9, 1.1), tint: aRng.int(0, d.crowd.length - 1) });
        }
      }
      for (let lx = -STAND.len / 2 + 1; lx <= STAND.len / 2 - 1; lx += 5) {
        const p = local(st, lx, STAND.depth / 2 + 0.4);
        if (clearOfTrack(p.x, p.y, 0.3)) flags.push({ ...p, h: 0, rot: st.rot, scale: 1, tint: flags.length % 2 });
      }
    }
  }
  for (const r of [...corners.filter((c) => c.hairpin), ...corners.filter((c) => c.tight && !c.hairpin)].slice(0, 3)) {
    const s = ((r.from + r.to) / 2) * ds;
    const back = minLat + BARRIER[d.barrier].depth + 1.5;
    for (let k = 0; k < 40; k++) {
      const p = at(s + aRng.range(-8, 8), r.outside * (back + aRng.range(0, 4)));
      if (!clear(p.x, p.y, 0.4)) continue;
      take(p.x, p.y, 0.3);
      crowd.push({ ...p, h: 0, rot: sideRot(s, r.outside) + aRng.range(-0.4, 0.4), scale: aRng.range(0.9, 1.1), tint: aRng.int(0, d.crowd.length - 1) });
    }
  }

  // Banners on the start straight, where no kerb or barrier is.
  const banners: Placed[] = [];
  for (const side of [-1, 1]) {
    for (let s = -60; s <= 60; s += BANNER_LEN + 0.5) {
      const sw = mod(s, track.length);
      if (kerbAt(sw) > 0 || Math.abs(s) < 4) continue;
      const p = at(sw, side * (minLat + 0.45));
      const rot = sideRot(sw, side);
      if (!clearSeg(p.x, p.y, rot, BANNER_LEN, 0.35)) continue;
      takeSeg(p.x, p.y, rot, BANNER_LEN, 0.35);
      banners.push({ ...p, h: 0, rot, scale: 1, tint: banners.length % 2 });
    }
  }

  const vents: Placed[] = [];
  if (d.vent) {
    const vRng = rngFor(7);
    for (let k = 0; k < 8; k++) {
      const s = (k + vRng.next()) * (track.length / 8);
      const p = at(s, (vRng.chance(0.5) ? -1 : 1) * (minLat + vRng.range(5, 18)));
      if (!clear(p.x, p.y, 2)) continue;
      take(p.x, p.y, 2);
      vents.push({ ...p, h: 0, rot: vRng.range(0, Math.PI * 2), scale: vRng.range(0.8, 1.2), tint: 0 });
    }
  }

  const neon: Placed[] = [];
  if (d.neon) {
    const nRng = rngFor(8);
    for (let s = 30; s < track.length - 30; s += nRng.range(30, 50)) {
      const side = neon.length % 2 === 0 ? 1 : -1;
      const p = at(s, side * (minLat + 1.5));
      const rot = sideRot(s, side);
      if (kerbAt(s) > 0 || !clearSeg(p.x, p.y, rot, NEON_SIZE, 0.8)) continue;
      takeSeg(p.x, p.y, rot, NEON_SIZE, 0.8);
      neon.push({ ...p, h: 0, rot, scale: 1, tint: neon.length % d.neon.length });
    }
  }

  return { kerbWidth, corners, barriers, decals, skids, clutter, stands, crowd, banners, flags, vents, neon };
}
