import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { REDROCK, REDROCK_CRANE_S, REDROCK_PROP_RULES, REDROCK_SCATTER } from './redrock';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('redrock', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(REDROCK);
    const straight = longestStraight(REDROCK);
    const hairpin = tightestTurn(REDROCK);
    console.warn(`WP11 redrock: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${REDROCK.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(REDROCK.width).toBe(16);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(REDROCK.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(REDROCK.id)).toBe(REDROCK);
  });

  trackContentTests(REDROCK, REDROCK_PROP_RULES, REDROCK_SCATTER, 'WP11');

  it('Redrock Quarry: rocks and one crane outside the hairpin wall whose 27 m jib reaches past the centerline', () => {
    expect(count(REDROCK, 'rock')).toBeGreaterThan(0);
    const cranes = REDROCK.props.filter((p) => p.kind === 'crane');
    expect(cranes).toHaveLength(1);
    const g = buildTrackGeometry(REDROCK);
    const pr = g.project(cranes[0].pos);
    expect(Math.abs(pr.s - REDROCK_CRANE_S)).toBeLessThan(5);
    expect(Math.abs(pr.lateral)).toBeGreaterThan(REDROCK.width / 2 + REDROCK.shoulder);
    expect(Math.abs(pr.lateral)).toBeLessThan(27);
  });
});
