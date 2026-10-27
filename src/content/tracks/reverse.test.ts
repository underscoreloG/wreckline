import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack, REVERSED_TRACKS, TRACKS, trackVariant } from './index';
import { baseTrackId, GRID_DEPTH, isReversedId, REVERSED_REFERENCE_LAP_TIMES, REVERSED_START_S, reversedId, reversedStartS, reverseTrack } from './reverse';
import { trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const pairs = Object.values(TRACKS).map((def) => [def.id, def, REVERSED_TRACKS[reversedId(def.id)] as TrackDef] as const);
const STRAIGHT_K = 1 / 150;
const CAR_HALF = 2.5; // m, half the longest car (5.3 m) rounded down: the grid check spans each slot +-2.5 m

describe('reversed tracks (WP39, CCR-14)', () => {
  it('ids, names and registry access: <id>~r, "<name> Reverse", not in TRACKS', () => {
    expect(Object.keys(REVERSED_TRACKS)).toEqual(Object.keys(TRACKS).map(reversedId));
    for (const [id, def, rev] of pairs) {
      expect([rev.id, rev.name, rev.theme, rev.width, rev.shoulder]).toEqual([`${id}~r`, `${def.name} Reverse`, def.theme, def.width, def.shoulder]);
      expect(getTrack(rev.id)).toBe(rev);
      expect(trackVariant(id, true)).toBe(rev);
      expect(trackVariant(id, false)).toBe(def);
      expect([isReversedId(rev.id), isReversedId(id), baseTrackId(rev.id), baseTrackId(id)]).toEqual([true, false, id, id]);
      expect(REVERSED_REFERENCE_LAP_TIMES[id], id).toBeDefined();
      expect(rev.referenceLapTime).toBe(REVERSED_REFERENCE_LAP_TIMES[id]);
    }
    expect(TRACKS['scrapyard~r']).toBeUndefined();
  });

  it('is deterministic: building it again gives the same def', () => {
    for (const [id, def, rev] of pairs) expect(reverseTrack(def, REVERSED_REFERENCE_LAP_TIMES[id] ?? 0, REVERSED_START_S[id])).toEqual(rev);
  });

  it.each(pairs)('%s: same length and checkpoint count, checkpoints in order, heading opposite on the same road', (_id, def, rev) => {
    const g = buildTrackGeometry(def);
    const r = buildTrackGeometry(rev);
    expect(Math.abs(r.length - g.length)).toBeLessThan(0.05);
    expect(r.checkpoints).toHaveLength(g.checkpoints.length);
    r.checkpoints.forEach((cp, i) => {
      expect(cp.index).toBe(i);
      if (i > 0) expect(cp.s).toBeGreaterThan(r.checkpoints[i - 1].s);
    });
    expect(r.checkpoints[0].s).toBe(0);
    for (let s = 0; s < r.length; s += 5) {
      const smp = r.sampleAt(s);
      const p = g.project(smp.pos);
      expect(Math.abs(p.lateral), `s ${s}`).toBeLessThan(0.05);
      expect(smp.tangent.x * p.sample.tangent.x + smp.tangent.y * p.sample.tangent.y, `s ${s}`).toBeLessThan(-0.999);
    }
  });

  it.each(pairs)('%s: pickups on the same spots (s mirrored, lateral flipped), props unchanged', (_id, def, rev) => {
    const g = buildTrackGeometry(def);
    const r = buildTrackGeometry(rev);
    const at = (geo: typeof g, s: number, lateral: number) => {
      const smp = geo.sampleAt(s);
      return { x: smp.pos.x + smp.right.x * lateral, y: smp.pos.y + smp.right.y * lateral };
    };
    const fwd = def.pickups.map((p) => ({ kind: p.kind, ...at(g, p.s, p.lateral) }));
    expect(rev.pickups).toHaveLength(def.pickups.length);
    for (const p of rev.pickups) {
      const q = at(r, p.s, p.lateral);
      const twin = fwd.find((f) => f.kind === p.kind && Math.hypot(f.x - q.x, f.y - q.y) < 0.2);
      expect(twin, `${p.kind} at s ${p.s}`).toBeDefined();
    }
    expect(rev.props).toBe(def.props);
  });

  it.each(pairs)('%s: the line and the whole grid sit on the start straight', (id, def, rev) => {
    const r = buildTrackGeometry(rev);
    const straightAt = (s: number): boolean => Math.abs(r.sampleAt(s).curvature) < STRAIGHT_K;
    expect(straightAt(0)).toBe(true);
    for (const slot of r.grid) {
      const s = r.project(slot.pos).s;
      for (let d = -CAR_HALF; d <= CAR_HALF; d += 0.5) expect(straightAt(s + d), `slot at s ${s.toFixed(1)}`).toBe(true);
    }
    let run = 0;
    while (straightAt(run + 1)) run++;
    console.warn(`WP39 ${rev.id}: reversed line at forward s ${(REVERSED_START_S[id] ?? reversedStartS(def)).toFixed(1)} (rule ${reversedStartS(def).toFixed(1)}, grid ${GRID_DEPTH} m deep), ${run} m of straight after the line`);
    expect(id).toBe(baseTrackId(rev.id));
  });
});

// The 16-seed soak of the first five reversed layouts; reverseSoak.test.ts runs the other five in a parallel worker.
for (const [, , rev] of pairs.slice(0, 5)) {
  describe(rev.id, () => {
    trackContentTests(rev, null, [], 'WP39');
  });
}
