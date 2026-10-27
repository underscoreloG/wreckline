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
  it('passes validateTrack and the content.md section 12 constraints, length inside the WP32 budget 850-990 m', () => {
    const v = validateTrack(REDROCK);
    const straight = longestStraight(REDROCK);
    const hairpin = tightestTurn(REDROCK);
    console.warn(`WP32 redrock: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${REDROCK.props.length} props`);
    expect(v.errors).toEqual([]);
    expect([REDROCK.id, REDROCK.name, REDROCK.theme, REDROCK.width]).toEqual(['redrock', 'Redrock Quarry', 'quarry', 16]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(REDROCK.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(getTrack(REDROCK.id)).toBe(REDROCK);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, about half of them off the AI line band', () => {
    const c = (k: string) => REDROCK.pickups.filter((p) => p.kind === k).length;
    expect([c('cash'), c('mines'), c('turbo'), c('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 6.5 is outside racingLine's 6.4 m band (width / 2 - 1.6): the AI never steers for those.
    const off = REDROCK.pickups.filter((p) => Math.abs(p.lateral) > REDROCK.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(REDROCK, REDROCK_PROP_RULES, REDROCK_SCATTER, 'WP32');

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
