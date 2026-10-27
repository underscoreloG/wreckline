import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { NEON_MILE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER } from './neonMile';
import { SCRAPYARD } from './scrapyard';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('neonMile', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(NEON_MILE);
    const straight = longestStraight(NEON_MILE);
    const hairpin = tightestTurn(NEON_MILE);
    console.warn(`WP11 neonMile: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${NEON_MILE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(NEON_MILE.width).toBe(14);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(NEON_MILE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(NEON_MILE.id)).toBe(NEON_MILE);
  });

  trackContentTests(NEON_MILE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER, 'WP11');

  it('Neon Mile: buildings, billboards and more light poles than Scrapyard', () => {
    for (const k of ['building', 'billboard']) expect(count(NEON_MILE, k)).toBeGreaterThan(0);
    expect(count(NEON_MILE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });
});
