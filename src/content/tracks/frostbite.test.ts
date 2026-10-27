import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { FROSTBITE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER } from './frostbite';
import { getTrack } from './index';
import { trackContentTests, windowHairpins } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('frostbite', () => {
  it('validates ok: length inside the WP32 budget (850-990 m), the same id, name, theme and width', () => {
    const v = validateTrack(FROSTBITE);
    console.warn(`WP32 frostbite: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, ${FROSTBITE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(v.length).toBeGreaterThanOrEqual(850);
    expect(v.length).toBeLessThanOrEqual(990);
    expect(v.minRadius).toBeGreaterThanOrEqual(FROSTBITE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect([FROSTBITE.id, FROSTBITE.name, FROSTBITE.theme, FROSTBITE.width]).toEqual(['frostbite', 'Frostbite Pass', 'snow', 13]);
    expect(getTrack(FROSTBITE.id)).toBe(FROSTBITE);
  });

  it('switchbacks: at least two hairpins (three, stacked up the west side)', () => {
    expect(windowHairpins(FROSTBITE).length).toBeGreaterThanOrEqual(2);
  });

  it('pickups: cash 4, mines 3, turbo 3, repair 2, half of them off the AI line band', () => {
    const k = (kind: string) => FROSTBITE.pickups.filter((p) => p.kind === kind).length;
    expect([k('cash'), k('mines'), k('turbo'), k('repair')]).toEqual([4, 3, 3, 2]);
    // lateral 5 is outside racingLine's 4.9 m band (width / 2 - 1.6): the AI never steers for those.
    const off = FROSTBITE.pickups.filter((p) => Math.abs(p.lateral) > FROSTBITE.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(off).toBeLessThanOrEqual(8);
  });

  trackContentTests(FROSTBITE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER, 'WP32');

  it('Frostbite Pass: snowbanks, pines and sodium light poles', () => {
    for (const k of ['snowbank', 'pine', 'lightPole']) expect(count(FROSTBITE, k)).toBeGreaterThan(0);
  });
});
