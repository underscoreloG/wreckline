import type { PropKind, PropPlacement, TrackDef, Vec2 } from '../../shared/contracts';
import { createRng, hashString } from '../../shared/rng';
import { buildTrackGeometry, createTrackProjection, propRadius } from '../../shared/trackGeometry';

export interface PropRule {
  sFrom: number;
  sTo: number | 'length';
  every: number; // m along s
  /** 'alternate' = both sides, one prop per step, switching side each step. */
  side: 'left' | 'right' | 'both' | 'alternate';
  offset: number; // gap in m between the wall and the prop's edge
  kind: PropKind;
  scale: number | readonly [min: number, max: number];
}

export interface ScatterRule {
  kind: PropKind;
  count: number;
}

const JITTER_S = 1.5;
const JITTER_LATERAL = 0.5;
const SCATTER_WALL_GAP = 6;
const SCATTER_GAP = 4;
const SCATTER_TRIES = 200;

interface Placed {
  pos: Vec2;
  r: number;
}

function insidePolygon(p: Vec2, poly: readonly { pos: Vec2 }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i].pos;
    const b = poly[j].pos;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Deterministic prop layout (content.md section 12): rule props along the walls, then infield scatter.
 * Placements overlapping an earlier prop are skipped, so validateTrack's overlap check always passes.
 */
export function placeProps(base: TrackDef, rules: readonly PropRule[], extraScatter: readonly ScatterRule[]): PropPlacement[] {
  const g = buildTrackGeometry(base);
  const out: PropPlacement[] = [];
  const placed: Placed[] = [];
  const overlaps = (pos: Vec2, r: number, gap: number): boolean => placed.some((q) => Math.hypot(q.pos.x - pos.x, q.pos.y - pos.y) < q.r + r + gap);
  const wallOff = base.width / 2 + base.shoulder;

  const rng = createRng(hashString(base.id));
  for (const rule of rules) {
    const end = rule.sTo === 'length' ? g.length : rule.sTo;
    let step = 0;
    for (let s = rule.sFrom; s < end; s += rule.every, step++) {
      const sides = rule.side === 'both' ? [-1, 1] : rule.side === 'alternate' ? [step % 2 === 0 ? -1 : 1] : [rule.side === 'left' ? -1 : 1];
      for (const side of sides) {
        const scale = typeof rule.scale === 'number' ? rule.scale : rng.range(rule.scale[0], rule.scale[1]);
        const r = propRadius(rule.kind) * scale;
        const smp = g.sampleAt(s + rng.range(-JITTER_S, JITTER_S));
        const lateral = side * (wallOff + rule.offset + r) + rng.range(-JITTER_LATERAL, JITTER_LATERAL);
        const pos = { x: smp.pos.x + smp.right.x * lateral, y: smp.pos.y + smp.right.y * lateral };
        if (overlaps(pos, r, 0)) continue;
        placed.push({ pos, r });
        out.push({ kind: rule.kind, pos, rotation: Math.atan2(smp.tangent.y, smp.tangent.x), scale });
      }
    }
  }

  const scatterRng = createRng((hashString(base.id) + 1) >>> 0);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const smp of g.samples) {
    minX = Math.min(minX, smp.pos.x);
    minY = Math.min(minY, smp.pos.y);
    maxX = Math.max(maxX, smp.pos.x);
    maxY = Math.max(maxY, smp.pos.y);
  }
  const proj = createTrackProjection();
  for (const sc of extraScatter) {
    const r = propRadius(sc.kind);
    for (let k = 0; k < sc.count; k++) {
      for (let tries = 0; tries < SCATTER_TRIES; tries++) {
        const pos = { x: scatterRng.range(minX, maxX), y: scatterRng.range(minY, maxY) };
        const rotation = scatterRng.range(0, Math.PI * 2);
        if (!insidePolygon(pos, g.samples)) continue;
        g.projectInto(proj, pos);
        const toWall = Math.hypot(pos.x - proj.sample.pos.x, pos.y - proj.sample.pos.y) - wallOff - r;
        if (toWall < SCATTER_WALL_GAP || overlaps(pos, r, SCATTER_GAP)) continue;
        placed.push({ pos, r });
        out.push({ kind: sc.kind, pos, rotation, scale: 1 });
        break;
      }
    }
  }
  return out;
}
