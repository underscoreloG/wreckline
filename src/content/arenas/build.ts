import type { GridSlot, PropKind, PropPlacement, Vec2 } from '../../shared/contracts';
import { createRng, hashString } from '../../shared/rng';
import { propRadius } from '../../shared/trackGeometry';
import { centroid } from './geometry';

// WP41: small builders for the arena data files (closed loops, spawn rings, props along the outside of the wall).

const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Rectangle w x h centred on (cx, cy), turned by `rot` (heading convention). */
export function rect(cx: number, cy: number, w: number, h: number, rot = 0): Vec2[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => ({ x: r1(cx + x * c - y * s), y: r1(cy + x * s + y * c) }));
}

/** n points on an ellipse (radii rx, ry) from angle `phase`, clockwise on screen; `radii` scales each point. */
export function ngon(cx: number, cy: number, rx: number, ry: number, n: number, phase = 0, radii: readonly number[] = []): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i * 2 * Math.PI) / n;
    const k = radii[i % Math.max(1, radii.length)] ?? 1;
    return { x: r1(cx + Math.cos(a) * rx * k), y: r1(cy + Math.sin(a) * ry * k) };
  });
}

/** Rectangle with its corners cut by `chamfer`, clockwise on screen from the top-left. */
export function chamferedRect(cx: number, cy: number, hw: number, hh: number, chamfer: number): Vec2[] {
  const c = chamfer;
  return [
    { x: cx - hw + c, y: cy - hh },
    { x: cx + hw - c, y: cy - hh },
    { x: cx + hw, y: cy - hh + c },
    { x: cx + hw, y: cy + hh - c },
    { x: cx + hw - c, y: cy + hh },
    { x: cx - hw + c, y: cy + hh },
    { x: cx - hw, y: cy + hh - c },
    { x: cx - hw, y: cy - hh + c },
  ];
}

/** 8 spawn points on an ellipse around (cx, cy), from angle `phase`, each facing the centre. */
export function spawnRing(cx: number, cy: number, rx: number, ry: number, phase: number): GridSlot[] {
  return ngon(cx, cy, rx, ry, 8, phase).map((p) => ({ pos: p, heading: Math.round(Math.atan2(cy - p.y, cx - p.x) * 1e4) / 1e4 }));
}

export interface WallPropRule {
  kind: PropKind;
  every: number; // m along the wall
  offset: number; // m from the wall to the prop's edge
  scale: number | readonly [min: number, max: number];
  /** Start this far along the wall perimeter (m), so rules interleave. */
  start?: number;
}

/**
 * Props along the outside of a convex wall: one every `every` m of perimeter, `offset` m beyond the wall, turned to the
 * wall's direction. Deterministic per arena id and rule index.
 */
export function wallProps(arenaId: string, wall: readonly Vec2[], rules: readonly WallPropRule[]): PropPlacement[] {
  const c = centroid(wall);
  const edges = wall.map((a, i) => {
    const b = wall[(i + 1) % wall.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const tx = (b.x - a.x) / len;
    const ty = (b.y - a.y) / len;
    // The normal pointing away from the centroid.
    let nx = -ty;
    let ny = tx;
    if ((a.x - c.x) * nx + (a.y - c.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    return { a, tx, ty, nx, ny, len };
  });
  const perimeter = edges.reduce((s, e) => s + e.len, 0);
  const out: PropPlacement[] = [];
  rules.forEach((rule, k) => {
    const rng = createRng(hashString(`${arenaId}/wall/${k}`));
    for (let d = rule.start ?? 0; d < perimeter; d += rule.every) {
      let rest = d;
      let e = edges[0];
      for (const edge of edges) {
        e = edge;
        if (rest <= edge.len) break;
        rest -= edge.len;
      }
      // Skip the corners: a prop there would sit off the turned wall dressing.
      if (rest < 3 || rest > e.len - 3) continue;
      const scale = typeof rule.scale === 'number' ? rule.scale : r1(rng.range(rule.scale[0], rule.scale[1]));
      const off = rule.offset + propRadius(rule.kind) * scale;
      const pos = { x: r1(e.a.x + e.tx * rest + e.nx * off), y: r1(e.a.y + e.ty * rest + e.ny * off) };
      // Earlier rules win a spot: a prop overlapping one already placed is dropped.
      const r = propRadius(rule.kind) * scale;
      if (out.some((p) => Math.hypot(p.pos.x - pos.x, p.pos.y - pos.y) < r + propRadius(p.kind) * p.scale)) continue;
      out.push({ kind: rule.kind, pos, rotation: Math.round(Math.atan2(e.ty, e.tx) * 1e3) / 1e3, scale });
    }
  });
  return out;
}
