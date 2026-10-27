import { beforeAll, describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { placeProps } from './placeProps';
import { SCRAPYARD, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER } from './scrapyard';
import { trackContentTests, windowHairpins } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

describe('scrapyard', () => {
  it('placeProps output is identical across two calls', () => {
    const base = { ...SCRAPYARD, props: [] };
    const a = placeProps(base, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER);
    const b = placeProps(base, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER);
    expect(a).toEqual(b);
    expect(a).toEqual(SCRAPYARD.props);
  });

  it('places rule props and the infield scatter', () => {
    const count = (k: string) => SCRAPYARD.props.filter((p) => p.kind === k).length;
    expect(count('lightPole')).toBeGreaterThan(10);
    expect(count('container')).toBeGreaterThan(5);
    expect(count('barrel')).toBeGreaterThan(10);
    // 6 scatter wrecks on top of the rule wrecks (the scatter may skip a few on rejection).
    expect(count('wreck')).toBeGreaterThan(5);
    expect(count('crate')).toBeGreaterThan(10);
  });

  it('validates ok: length 892 +- 5, 22 checkpoints, the same id, name, theme and width', () => {
    const v = validateTrack(SCRAPYARD);
    expect(v.errors).toEqual([]);
    expect(Math.abs(v.length - 892)).toBeLessThanOrEqual(5);
    expect(buildTrackGeometry(SCRAPYARD).checkpoints).toHaveLength(22);
    expect([SCRAPYARD.id, SCRAPYARD.name, SCRAPYARD.theme, SCRAPYARD.width]).toEqual(['scrapyard', 'Scrapyard', 'scrapyard', 14]);
    expect(getTrack('scrapyard')).toBe(SCRAPYARD);
  });

  it('has one hairpin (content.md section 12): >= 150 deg while the 10 m curvature of the shape metric stays above 1/25', () => {
    // The per-sample curvature dips to r 29 for a few m at the hairpin entry (the spline after a short leg),
    // which splits the WP11 per-sample measure; the shape metric's 10 m window reads the corner as one.
    expect(windowHairpins(SCRAPYARD)).toHaveLength(1);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2 (tuning pass 1), half of them off the AI line band', () => {
    const count = (k: string) => SCRAPYARD.pickups.filter((p) => p.kind === k).length;
    expect([count('cash'), count('mines'), count('turbo'), count('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 5.5 is outside racingLine's 5.4 m band (width / 2 - 1.6): the AI never steers for those.
    const off = SCRAPYARD.pickups.filter((p) => Math.abs(p.lateral) > SCRAPYARD.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(SCRAPYARD, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER, 'WP31');
});
