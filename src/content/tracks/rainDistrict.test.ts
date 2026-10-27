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
  it('passes validateTrack and the content.md section 12 constraints, length inside the WP32 budget 850-990 m', () => {
    const def = RAIN_DISTRICT;
    const v = validateTrack(def);
    const straight = longestStraight(def);
    const hairpin = tightestTurn(def);
    console.warn(
      `WP32 ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg at s ${hairpin.from.toFixed(0)}-${hairpin.to.toFixed(0)}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect([def.id, def.name, def.theme, def.width]).toEqual(['rainDistrict', 'Rain District', 'city', 14]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(getTrack(def.id)).toBe(def);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, about half of them off the AI line band', () => {
    const c = (k: string) => RAIN_DISTRICT.pickups.filter((p) => p.kind === k).length;
    expect([c('cash'), c('mines'), c('turbo'), c('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 5.5 is outside racingLine's 5.4 m band (width / 2 - 1.6): the AI never steers for those.
    const off = RAIN_DISTRICT.pickups.filter((p) => Math.abs(p.lateral) > RAIN_DISTRICT.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(RAIN_DISTRICT, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER, 'WP32');

  it('Rain District: the boulevard is the start straight (it covers s 0) and the hairpin turnaround comes right at its end', () => {
    const len = buildTrackGeometry(RAIN_DISTRICT).length;
    const straight = longestStraight(RAIN_DISTRICT);
    const hairpin = tightestTurn(RAIN_DISTRICT);
    // The straight wraps over the start line, so its end runs past the lap length.
    expect(straight.from).toBeLessThan(len);
    expect(straight.to).toBeGreaterThan(len);
    const gap = (((hairpin.from - straight.to) % len) + len) % len;
    expect(gap).toBeLessThan(15);
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
