import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { angleWrap } from '../../shared/math';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { NEON_MILE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER } from './neonMile';
import { SCRAPYARD } from './scrapyard';
import { trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('neonMile', () => {
  it('validates ok: length inside the WP32 budget 850-990 m, the same id, name, theme and width', () => {
    const v = validateTrack(NEON_MILE);
    console.warn(`WP32 neonMile: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, ${NEON_MILE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(NEON_MILE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect([NEON_MILE.id, NEON_MILE.name, NEON_MILE.theme, NEON_MILE.width]).toEqual(['neonMile', 'Neon Mile', 'city', 14]);
    expect(getTrack(NEON_MILE.id)).toBe(NEON_MILE);
  });

  it('has one hairpin, the U-turn round the last block: >= 150 deg while the 10 m curvature of the shape metric stays above 1/25', () => {
    // As on Scrapyard: the per-sample curvature dips at the hairpin entry (the spline after a short leg), which
    // splits the WP11 per-sample measure; the shape metric's 10 m window reads the corner as one.
    const g = buildTrackGeometry(NEON_MILE);
    const n = g.samples.length;
    const ds = g.length / n;
    const w = Math.round(10 / ds);
    const h = g.samples.map((smp) => Math.atan2(smp.tangent.y, smp.tangent.x));
    // Signed heading change from sample a to b (b > a, may run past n).
    const turnBetween = (a: number, b: number): number => {
      let t = 0;
      for (let i = a; i < b; i++) t += angleWrap(h[(i + 1) % n] - h[i % n]);
      return t;
    };
    const turns: number[] = [];
    let from = -1;
    for (let i = 0; i <= n; i++) {
      const k = Math.abs(angleWrap(h[(i + w) % n] - h[i % n])) / (w * ds);
      if (k > 1 / 25 && from < 0) from = i;
      else if (k <= 1 / 25 && from >= 0) {
        // The forward window: the run ends w samples before the corner does.
        turns.push((Math.abs(turnBetween(from, i - 1 + w)) * 180) / Math.PI);
        from = -1;
      }
    }
    expect(turns.filter((t) => t >= 150)).toHaveLength(1);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, about half of them off the AI line band', () => {
    const c = (k: string) => NEON_MILE.pickups.filter((p) => p.kind === k).length;
    expect([c('cash'), c('mines'), c('turbo'), c('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 5.5 is outside racingLine's 5.4 m band (width / 2 - 1.6): the AI never steers for those.
    const off = NEON_MILE.pickups.filter((p) => Math.abs(p.lateral) > NEON_MILE.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(NEON_MILE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER, 'WP32');

  it('Neon Mile: buildings, billboards and more light poles than Scrapyard', () => {
    for (const k of ['building', 'billboard']) expect(count(NEON_MILE, k)).toBeGreaterThan(0);
    expect(count(NEON_MILE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });
});
