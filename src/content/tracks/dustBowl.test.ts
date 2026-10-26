import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { DUST_BOWL, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER } from './dustBowl';
import { getTrack } from './index';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('dustBowl', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(DUST_BOWL);
    const straight = longestStraight(DUST_BOWL);
    const hairpin = tightestTurn(DUST_BOWL);
    console.warn(`WP11 dustBowl: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${DUST_BOWL.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(DUST_BOWL.width).toBe(15);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(DUST_BOWL.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(200);
    expect(getTrack(DUST_BOWL.id)).toBe(DUST_BOWL);
  });

  trackContentTests(DUST_BOWL, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER, 'WP11');

  it('Dust Bowl: rocks, cacti, wrecks, tire stacks, no containers', () => {
    for (const k of ['rock', 'cactus', 'wreck', 'tireStack']) expect(count(DUST_BOWL, k)).toBeGreaterThan(0);
    expect(count(DUST_BOWL, 'container')).toBe(0);
  });
});
