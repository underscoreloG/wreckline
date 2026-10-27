import { centroid, pointInPolygon } from '../content/arenas/geometry';
import type { ArenaDef, Vec2 } from '../shared/contracts';
import { createRng, hashString, type Rng } from '../shared/rng';
import { propRadius } from '../shared/trackGeometry';
import { BARRIER, CLUTTER_RADIUS, STAND, STAND_TIER_H, WALL_THICK, type Decal, type DressingPlan, type Placed, type Strip } from './dressing';
import type { GroundDecal, ThemeDressing } from './themes';

/**
 * WP41: the WP27 dressing for an arena, laid out from its wall instead of a track's centerline, for buildDressing:
 * tyre barriers along the outside of the wall, grandstands with a crowd on the two longest sides, banners, clutter
 * and ground paint beyond the wall, stains, cracks and doughnut tyre marks on the floor. Deterministic per arena id.
 */

const DRESSING_SEED = 0x41a7e4;

interface Edge {
  a: Vec2;
  t: Vec2; // unit tangent
  n: Vec2; // unit outward normal
  len: number;
  /** Side piece rotation: local +x along the edge, local +z (right of the heading) away from the floor. */
  rot: number;
}

function edgesOf(wall: readonly Vec2[]): Edge[] {
  const c = centroid(wall);
  return wall.map((a, i) => {
    const b = wall[(i + 1) % wall.length] as Vec2;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let n = { x: -t.y, y: t.x };
    if ((a.x - c.x) * n.x + (a.y - c.y) * n.y < 0) n = { x: -n.x, y: -n.y };
    return { a, t, n, len, rot: Math.atan2(-n.x, n.y) };
  });
}

function pickDecal(rng: Rng, list: readonly GroundDecal[]): GroundDecal {
  let total = 0;
  for (const d of list) total += d.weight;
  let k = rng.range(0, total);
  for (const d of list) {
    k -= d.weight;
    if (k < 0) return d;
  }
  return list[list.length - 1] as GroundDecal;
}

export function planArenaDressing(arena: ArenaDef, d: ThemeDressing): DressingPlan {
  const wall = arena.wall;
  const edges = edgesOf(wall);
  const seed = (hashString(arena.id) ^ DRESSING_SEED) >>> 0;
  const rngFor = (k: number): Rng => createRng((seed + Math.imul(k, 0x9e3779b9)) >>> 0);
  const taken: { x: number; y: number; r: number }[] = arena.props.map((p) => ({ x: p.pos.x, y: p.pos.y, r: propRadius(p.kind) * p.scale }));
  /** Beyond the wall mesh and clear of the props and every piece placed so far. */
  const clear = (x: number, y: number, r: number): boolean => {
    const p = { x, y };
    if (pointInPolygon(p, wall)) return false;
    for (const e of edges) {
      const along = (x - e.a.x) * e.t.x + (y - e.a.y) * e.t.y;
      const out = (x - e.a.x) * e.n.x + (y - e.a.y) * e.n.y;
      if (along > -r && along < e.len + r && out < WALL_THICK + r && out > -r) return false;
    }
    return taken.every((q) => Math.hypot(q.x - x, q.y - y) >= q.r + r);
  };
  const take = (x: number, y: number, r: number): void => {
    taken.push({ x, y, r });
  };
  const at = (e: Edge, along: number, out: number): Vec2 => ({ x: e.a.x + e.t.x * along + e.n.x * out, y: e.a.y + e.t.y * along + e.n.y * out });
  const local = (pl: Placed, lx: number, lz: number): Vec2 => {
    const c = Math.cos(pl.rot);
    const s = Math.sin(pl.rot);
    return { x: pl.x + c * lx - s * lz, y: pl.y + s * lx + c * lz };
  };

  // Grandstands first, centred on the two longest edges, a gap beyond the wall.
  const aRng = rngFor(6);
  const stands: Placed[] = [];
  const crowd: Placed[] = [];
  const flags: Placed[] = [];
  const longest = [...edges].sort((p, q) => q.len - p.len).slice(0, 2);
  for (const e of longest) {
    if (e.len < STAND.len + 6) continue;
    const c = at(e, e.len / 2, WALL_THICK + STAND.gap + STAND.depth / 2);
    const st: Placed = { x: c.x, y: c.y, h: 0, rot: e.rot, scale: 1, tint: 0 };
    let fits = true;
    for (let lx = -STAND.len / 2; lx <= STAND.len / 2 && fits; lx += 2) {
      for (const lz of [-STAND.depth / 2, STAND.depth / 2]) {
        const p = local(st, lx, lz);
        if (!clear(p.x, p.y, 1.2)) fits = false;
      }
    }
    if (!fits) continue;
    stands.push(st);
    for (let lx = -STAND.len / 2; lx <= STAND.len / 2; lx += 2) {
      const q = local(st, lx, 0);
      take(q.x, q.y, STAND.depth / 2 + 0.5);
    }
    const tierD = STAND.depth / STAND.tiers;
    for (let t = 0; t < STAND.tiers; t++) {
      for (let lx = -STAND.len / 2 + 0.6; lx < STAND.len / 2 - 0.4; lx += 0.7) {
        if (!aRng.chance(0.85)) continue;
        const p = local(st, lx + aRng.range(-0.15, 0.15), -STAND.depth / 2 + tierD * (t + 0.5));
        crowd.push({ ...p, h: STAND_TIER_H * (t + 1), rot: st.rot + aRng.range(-0.3, 0.3), scale: aRng.range(0.9, 1.1), tint: aRng.int(0, d.crowd.length - 1) });
      }
    }
    for (let lx = -STAND.len / 2 + 1; lx <= STAND.len / 2 - 1; lx += 5) {
      const p = local(st, lx, STAND.depth / 2 + 0.4);
      flags.push({ ...p, h: 0, rot: st.rot, scale: 1, tint: flags.length % 2 });
    }
  }

  // Banners on the wall, centred on every edge (before the barriers, which leave them room).
  const banners: Placed[] = [];
  for (const e of edges) {
    if (e.len < 10) continue;
    for (const s of [e.len / 2 - 2.25, e.len / 2 + 2.25]) {
      const p = at(e, s, WALL_THICK + 0.45);
      banners.push({ ...p, h: 0, rot: e.rot, scale: 1, tint: banners.length % 2 });
      for (let k = -2; k <= 2; k++) take(p.x + e.t.x * k, p.y + e.t.y * k, 0.35);
    }
  }

  // Barriers hugging the wall outside, on every edge, around the props there.
  const barriers: Placed[] = [];
  const bRng = rngFor(1);
  const seg = BARRIER[d.barrier];
  for (const e of edges) {
    for (let s = seg.len / 2; s < e.len - seg.len / 2; s += seg.len) {
      const p = at(e, s, WALL_THICK + 0.1 + seg.depth / 2);
      if (!taken.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= q.r + seg.depth / 2)) continue;
      barriers.push({ ...p, h: 0, rot: e.rot, scale: 1, tint: bRng.chance(0.25) ? 1 : 0 });
    }
  }
  for (const b of barriers) take(b.x, b.y, seg.depth / 2);

  // Clutter heaps and vents on the ground beyond.
  const clutter: Placed[] = [];
  if (d.clutter) {
    const cRng = rngFor(9);
    for (const e of edges) {
      for (let s = 0; s < e.len; s += 6) {
        if (!cRng.chance(d.clutter.density)) continue;
        const scale = cRng.range(0.7, 1.4);
        const p = at(e, s + cRng.range(-2, 2), WALL_THICK + cRng.range(3, 24));
        if (!clear(p.x, p.y, CLUTTER_RADIUS * scale)) continue;
        take(p.x, p.y, CLUTTER_RADIUS * scale);
        clutter.push({ ...p, h: 0, rot: cRng.range(0, Math.PI * 2), scale, tint: cRng.int(0, d.clutter.colors.length - 1) });
      }
    }
  }
  const vents: Placed[] = [];
  if (d.vent) {
    const vRng = rngFor(7);
    for (let k = 0; k < 8; k++) {
      const e = edges[Math.floor(vRng.next() * edges.length)] as Edge;
      const p = at(e, vRng.range(0, e.len), WALL_THICK + vRng.range(6, 18));
      if (!clear(p.x, p.y, 2)) continue;
      take(p.x, p.y, 2);
      vents.push({ ...p, h: 0, rot: vRng.range(0, Math.PI * 2), scale: vRng.range(0.8, 1.2), tint: 0 });
    }
  }

  // Ground paint beyond the wall, floor paint inside.
  const decals: Decal[] = [];
  const gRng = rngFor(2);
  const xs = wall.map((p) => p.x);
  const ys = wall.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let k = 0; k < 320; k++) {
    const pos = { x: gRng.range(minX - 120, maxX + 120), y: gRng.range(minY - 120, maxY + 120) };
    if (pointInPolygon(pos, wall)) continue;
    const g = pickDecal(gRng, d.ground);
    const size = gRng.range(g.size[0], g.size[1]);
    decals.push({ ...pos, rot: gRng.range(0, Math.PI * 2), w: size * gRng.range(0.7, 1.3), l: size, cell: g.cell, color: g.color, alpha: g.alpha, layer: 'ground' });
  }
  const fRng = rngFor(3);
  const inFloor = (p: Vec2, r: number): boolean => pointInPolygon(p, wall) && edges.every((e) => (p.x - e.a.x) * e.n.x + (p.y - e.a.y) * e.n.y < -r);
  const blockAt = (p: Vec2, r: number): boolean => arena.blocks.some((b) => {
    const c = centroid(b.points);
    const reach = Math.max(...b.points.map((q) => Math.hypot(q.x - c.x, q.y - c.y)));
    return Math.hypot(p.x - c.x, p.y - c.y) < reach + r;
  });
  const floorDecal = (cells: readonly GroundDecal[], layer: Decal['layer'], count: number, scale: number): void => {
    for (let k = 0; k < count; k++) {
      const g = pickDecal(fRng, cells);
      const size = fRng.range(g.size[0], g.size[1]) * scale;
      const pos = { x: fRng.range(minX, maxX), y: fRng.range(minY, maxY) };
      if (!inFloor(pos, size / 2) || blockAt(pos, size / 2)) continue;
      decals.push({ ...pos, rot: fRng.range(0, Math.PI * 2), w: size, l: size * fRng.range(1, 1.6), cell: g.cell, color: g.color, alpha: g.alpha, layer });
    }
  };
  floorDecal(d.ground, 'shoulder', 90, 0.6);
  floorDecal(d.shoulder, 'shoulder', 120, 2);
  floorDecal([{ cell: 'crack', color: d.roadDark, alpha: 0.6, size: [2.5, 5], weight: 1 }], 'road', 24, 1);
  if (d.roadStain) floorDecal([d.roadStain], 'road', 30, 1.4);

  // Doughnuts: circles of tyre marks round the floor, where a derby crowd expects them.
  const skids: Strip[] = [];
  const kRng = rngFor(5);
  for (let k = 0; k < 40 && skids.length < 9; k++) {
    const r = kRng.range(4, 9);
    const c = { x: kRng.range(minX, maxX), y: kRng.range(minY, maxY) };
    if (!inFloor(c, r + 2) || blockAt(c, r + 2)) continue;
    const a0 = kRng.range(0, Math.PI * 2);
    const turn = kRng.range(1.2, 1.9) * Math.PI;
    for (const lane of [-0.8, 0.8]) {
      const points: Vec2[] = [];
      for (let a = 0; a <= turn; a += 0.25) points.push({ x: c.x + Math.cos(a0 + a) * (r + lane), y: c.y + Math.sin(a0 + a) * (r + lane) });
      skids.push({ points, width: 1.6, color: d.roadDark, alpha: kRng.range(0.25, 0.45) });
    }
  }

  return { kerbWidth: new Float32Array(0), corners: [], barriers, decals, skids, clutter, stands, crowd, banners, flags, vents, neon: [] };
}
