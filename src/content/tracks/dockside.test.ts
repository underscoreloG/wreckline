import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { DOCKSIDE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER } from './dockside';
import { getTrack } from './index';
import { SCRAPYARD } from './scrapyard';
import { longestStraight, tightestTurn, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

describe('dockside', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(DOCKSIDE);
    const straight = longestStraight(DOCKSIDE);
    const hairpin = tightestTurn(DOCKSIDE);
    console.warn(`WP11 dockside: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg, ${DOCKSIDE.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(DOCKSIDE.width).toBe(13);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(DOCKSIDE.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(DOCKSIDE.id)).toBe(DOCKSIDE);
  });

  trackContentTests(DOCKSIDE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER, 'WP11');

  it('Dockside: containers, crates, barrels, cones and more light poles than Scrapyard', () => {
    for (const k of ['container', 'crate', 'barrel', 'cone']) expect(count(DOCKSIDE, k)).toBeGreaterThan(0);
    expect(count(DOCKSIDE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });
});
