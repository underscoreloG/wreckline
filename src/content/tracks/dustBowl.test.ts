import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { DUST_BOWL, DUST_BOWL_CORNERS, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER } from './dustBowl';
import { getTrack } from './index';
import { trackContentTests, windowHairpins } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('dustBowl', () => {
  it('validates ok: length inside the WP32 budget (850-990 m), the same id, name, theme and width', () => {
    const v = validateTrack(DUST_BOWL);
    console.warn(`WP32 dustBowl: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, ${DUST_BOWL.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(DUST_BOWL.width);
    expect(v.minRadius).toBeLessThan(25);
    expect([DUST_BOWL.id, DUST_BOWL.name, DUST_BOWL.theme, DUST_BOWL.width]).toEqual(['dustBowl', 'Dust Bowl', 'desert', 15]);
    expect(getTrack(DUST_BOWL.id)).toBe(DUST_BOWL);
  });

  it('the most open tight track: one hairpin, the other bends mostly wider (r 26-34) with a few 22-24s', () => {
    expect(windowHairpins(DUST_BOWL)).toHaveLength(1);
    const wide = DUST_BOWL_CORNERS.filter((c) => c.r >= 26).length;
    expect(wide).toBeGreaterThanOrEqual(DUST_BOWL_CORNERS.length / 2);
    expect(DUST_BOWL_CORNERS.some((c) => c.r <= 24)).toBe(true);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, half of them off the AI line band', () => {
    const k = (kind: string) => DUST_BOWL.pickups.filter((p) => p.kind === kind).length;
    expect([k('cash'), k('mines'), k('turbo'), k('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 6 is outside racingLine's 5.9 m band (width / 2 - 1.6): the AI never steers for those.
    const off = DUST_BOWL.pickups.filter((p) => Math.abs(p.lateral) > DUST_BOWL.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(DUST_BOWL, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER, 'WP32');

  it('Dust Bowl: rocks, cacti, wrecks, tire stacks, no containers', () => {
    for (const k of ['rock', 'cactus', 'wreck', 'tireStack']) expect(count(DUST_BOWL, k)).toBeGreaterThan(0);
    expect(count(DUST_BOWL, 'container')).toBe(0);
  });
});
