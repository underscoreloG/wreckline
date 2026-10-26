import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { FROSTBITE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER } from './frostbite';
import { getTrack } from './index';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('frostbite', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(FROSTBITE);
    const straight = longestStraight(FROSTBITE);
    const hairpin = tightestTurn(FROSTBITE);
    console.warn(`WP11 frostbite: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${FROSTBITE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(FROSTBITE.width).toBe(13);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(FROSTBITE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(FROSTBITE.id)).toBe(FROSTBITE);
  });

  trackContentTests(FROSTBITE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER, 'WP11');

  it('Frostbite Pass: snowbanks, pines and sodium light poles', () => {
    for (const k of ['snowbank', 'pine', 'lightPole']) expect(count(FROSTBITE, k)).toBeGreaterThan(0);
  });
});
