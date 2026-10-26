import { beforeAll, describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { BLAST_PIT, BLAST_PIT_CRANE_S, BLAST_PIT_PROP_RULES, BLAST_PIT_SCATTER } from './blastPit';
import { getTrack, TRACKS } from './index';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

describe('blastPit', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const def = BLAST_PIT;
    const v = validateTrack(def);
    const straight = longestStraight(def);
    const hairpin = tightestTurn(def);
    console.warn(
      `WP23b ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg at s ${hairpin.from.toFixed(0)}-${hairpin.to.toFixed(0)}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBe(16);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1700);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(def.id)).toBe(def);
  });

  trackContentTests(BLAST_PIT, BLAST_PIT_PROP_RULES, BLAST_PIT_SCATTER, 'WP23b');

  it('Blast Pit: the longest track, and its hairpin is the one between the pits under the crane', () => {
    const len = buildTrackGeometry(BLAST_PIT).length;
    for (const t of Object.values(TRACKS)) if (t.id !== BLAST_PIT.id) expect(len).toBeGreaterThan(buildTrackGeometry(t).length);
    const hairpin = tightestTurn(BLAST_PIT);
    expect(BLAST_PIT_CRANE_S).toBeGreaterThan(hairpin.from);
    expect(BLAST_PIT_CRANE_S).toBeLessThan(hairpin.to);
  });

  it('Blast Pit: rocks and one crane outside the hairpin wall whose 27 m jib reaches past the centerline', () => {
    expect(BLAST_PIT.props.filter((p) => p.kind === 'rock').length).toBeGreaterThan(0);
    const cranes = BLAST_PIT.props.filter((p) => p.kind === 'crane');
    expect(cranes).toHaveLength(1);
    const pr = buildTrackGeometry(BLAST_PIT).project(cranes[0].pos);
    expect(Math.abs(pr.s - BLAST_PIT_CRANE_S)).toBeLessThan(5);
    expect(Math.abs(pr.lateral)).toBeGreaterThan(BLAST_PIT.width / 2 + BLAST_PIT.shoulder);
    expect(Math.abs(pr.lateral)).toBeLessThan(27);
  });
});
