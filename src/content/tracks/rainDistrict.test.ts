import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { NEON_MILE } from './neonMile';
import { RAIN_DISTRICT, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER } from './rainDistrict';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('rainDistrict', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const def = RAIN_DISTRICT;
    const v = validateTrack(def);
    const straight = longestStraight(def);
    const hairpin = tightestTurn(def);
    console.warn(
      `WP23b ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg at s ${hairpin.from.toFixed(0)}-${hairpin.to.toFixed(0)}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBe(14);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(200);
    expect(getTrack(def.id)).toBe(def);
  });

  trackContentTests(RAIN_DISTRICT, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER, 'WP23b');

  it('Rain District: the hairpin turnaround comes right at the end of the 200 m boulevard', () => {
    const straight = longestStraight(RAIN_DISTRICT);
    const hairpin = tightestTurn(RAIN_DISTRICT);
    expect(hairpin.from - straight.to).toBeGreaterThanOrEqual(0);
    expect(hairpin.from - straight.to).toBeLessThan(15);
  });

  it('Rain District: buildings, billboards outside the walls and more light poles than Neon Mile', () => {
    for (const k of ['building', 'billboard']) expect(count(RAIN_DISTRICT, k)).toBeGreaterThan(0);
    expect(count(RAIN_DISTRICT, 'lightPole')).toBeGreaterThan(count(NEON_MILE, 'lightPole'));
    const g = buildTrackGeometry(RAIN_DISTRICT);
    for (const b of RAIN_DISTRICT.props.filter((p) => p.kind === 'billboard')) {
      expect(Math.abs(g.project(b.pos).lateral)).toBeGreaterThan(RAIN_DISTRICT.width / 2 + RAIN_DISTRICT.shoulder);
    }
  });
});
