import type { ArenaDef } from '../../shared/contracts';
import { propRadius } from '../../shared/trackGeometry';
import { centroid, distToLoop, isConvex, loopGap, pointInPolygon, selfIntersects } from './geometry';
import { ARENA_CARS } from './rules';

// content.md section 13 layout rules: room to drive round every block, spawns and pickups in the open.
export const ARENA_SPAN = [120, 185] as const; // m, the wall's width and height
export const ARENA_BLOCKS = [3, 6] as const;
/** A gap a car (5.3 m long at most) turns in, between two blocks or a block and the wall. */
export const BLOCK_GAP = 10; // m
export const SPAWN_CLEAR = 6; // m from the wall and every block
export const SPAWN_GAP = 10; // m between spawns
export const SPAWN_FACING = (35 * Math.PI) / 180; // max angle between a spawn heading and the line to the centre
export const PICKUP_CLEAR = 4; // m from the wall and every block
export const PROP_CLEAR = 1; // m beyond the wall line, as on the tracks (validateTrack)

export interface ArenaValidation {
  ok: boolean;
  errors: string[];
  width: number;
  height: number;
}

export function validateArena(a: ArenaDef): ArenaValidation {
  const errors: string[] = [];
  const xs = a.wall.map((p) => p.x);
  const ys = a.wall.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  if (a.wall.length < 4) errors.push('wall needs at least 4 points');
  if (selfIntersects(a.wall)) errors.push('wall crosses itself');
  // The arena AI steers straight at its goal and only plans round blocks: a convex wall never stands in between.
  if (!isConvex(a.wall)) errors.push('wall is not convex');
  for (const [name, v] of [['width', width], ['height', height]] as const) {
    if (v < ARENA_SPAN[0] || v > ARENA_SPAN[1]) errors.push(`wall ${name} ${v.toFixed(1)} m is outside ${ARENA_SPAN[0]}-${ARENA_SPAN[1]} m`);
  }

  if (a.blocks.length < ARENA_BLOCKS[0] || a.blocks.length > ARENA_BLOCKS[1]) errors.push(`${a.blocks.length} blocks, needs ${ARENA_BLOCKS[0]}-${ARENA_BLOCKS[1]}`);
  a.blocks.forEach((b, i) => {
    if (!isConvex(b.points)) errors.push(`block ${i} (${b.style}) is not convex`);
    if (!b.points.every((p) => pointInPolygon(p, a.wall))) errors.push(`block ${i} (${b.style}) is not inside the wall`);
    const toWall = Math.min(...b.points.map((p) => distToLoop(p, a.wall)));
    if (toWall < BLOCK_GAP) errors.push(`block ${i} (${b.style}) is ${toWall.toFixed(1)} m from the wall, needs ${BLOCK_GAP}`);
    for (let j = i + 1; j < a.blocks.length; j++) {
      const g = loopGap(b.points, (a.blocks[j] as (typeof a.blocks)[number]).points);
      if (g < BLOCK_GAP) errors.push(`blocks ${i} and ${j} are ${g.toFixed(1)} m apart, need ${BLOCK_GAP}`);
    }
  });

  // Clearance from the wall and every block, negative inside a block or outside the wall.
  const clearance = (p: { x: number; y: number }): number => {
    let d = pointInPolygon(p, a.wall) ? distToLoop(p, a.wall) : -distToLoop(p, a.wall);
    for (const b of a.blocks) d = Math.min(d, pointInPolygon(p, b.points) ? -distToLoop(p, b.points) : distToLoop(p, b.points));
    return d;
  };

  const c = centroid(a.wall);
  if (a.spawns.length !== ARENA_CARS) errors.push(`${a.spawns.length} spawns, needs ${ARENA_CARS}`);
  a.spawns.forEach((s, i) => {
    const d = clearance(s.pos);
    if (d < SPAWN_CLEAR) errors.push(`spawn ${i} has ${d.toFixed(1)} m of clearance, needs ${SPAWN_CLEAR}`);
    const toCentre = Math.atan2(c.y - s.pos.y, c.x - s.pos.x);
    const off = Math.abs(Math.atan2(Math.sin(s.heading - toCentre), Math.cos(s.heading - toCentre)));
    if (off > SPAWN_FACING) errors.push(`spawn ${i} faces ${((off * 180) / Math.PI).toFixed(0)} deg off the centre`);
    for (let j = i + 1; j < a.spawns.length; j++) {
      const o = (a.spawns[j] as (typeof a.spawns)[number]).pos;
      const g = Math.hypot(o.x - s.pos.x, o.y - s.pos.y);
      if (g < SPAWN_GAP) errors.push(`spawns ${i} and ${j} are ${g.toFixed(1)} m apart, need ${SPAWN_GAP}`);
    }
  });

  a.pickups.forEach((p, i) => {
    if (p.kind === 'cash') errors.push(`pickup ${i} is cash: an arena has no prize money`);
    const d = clearance(p.pos);
    if (d < PICKUP_CLEAR) errors.push(`pickup ${i} (${p.kind}) has ${d.toFixed(1)} m of clearance, needs ${PICKUP_CLEAR}`);
  });

  a.props.forEach((p, i) => {
    const need = PROP_CLEAR + propRadius(p.kind) * p.scale;
    const d = distToLoop(p.pos, a.wall);
    if (pointInPolygon(p.pos, a.wall) || d < need) errors.push(`prop ${i} (${p.kind}) is ${pointInPolygon(p.pos, a.wall) ? 'inside the wall' : `${d.toFixed(1)} m beyond the wall, needs ${need.toFixed(1)}`}`);
  });

  for (let i = 0; i < a.props.length; i++) {
    const p = a.props[i] as (typeof a.props)[number];
    for (let j = i + 1; j < a.props.length; j++) {
      const q = a.props[j] as (typeof a.props)[number];
      if (Math.hypot(p.pos.x - q.pos.x, p.pos.y - q.pos.y) < propRadius(p.kind) * p.scale + propRadius(q.kind) * q.scale) errors.push(`props ${i} (${p.kind}) and ${j} (${q.kind}) overlap`);
    }
  }

  return { ok: errors.length === 0, errors, width, height };
}
