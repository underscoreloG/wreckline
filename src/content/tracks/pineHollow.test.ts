import { beforeAll, describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { PINE_HOLLOW, PINE_HOLLOW_KINK, PINE_HOLLOW_PROP_RULES, PINE_HOLLOW_SCATTER } from './pineHollow';
import { hairpins, longestStraight, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

describe('pineHollow', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const def = PINE_HOLLOW;
    const v = validateTrack(def);
    const hp = hairpins(def);
    const straight = longestStraight(def);
    console.warn(
      `WP23a ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpins ${hp.map((h) => `${h.turn.toFixed(0)} deg at s ${((h.from + h.to) / 2).toFixed(0)}`).join(', ')}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBeGreaterThanOrEqual(13);
    expect(def.width).toBeLessThanOrEqual(16);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hp).toHaveLength(1);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(def.id)).toBe(def);
  });

  trackContentTests(PINE_HOLLOW, PINE_HOLLOW_PROP_RULES, PINE_HOLLOW_SCATTER, 'WP23a');

  it('Pine Hollow: the hairpin is at the far (east) end, a wall of pines inside the blind kink', () => {
    const g = buildTrackGeometry(PINE_HOLLOW);
    const [hp] = hairpins(PINE_HOLLOW);
    const maxX = Math.max(...g.samples.map((s) => s.pos.x));
    expect(maxX - g.sampleAt((hp.from + hp.to) / 2).pos.x).toBeLessThan(25);
    const kinkPines = PINE_HOLLOW.props.filter((p) => {
      if (p.kind !== 'pine') return false;
      const pr = g.project(p.pos);
      return pr.s >= PINE_HOLLOW_KINK[0] && pr.s <= PINE_HOLLOW_KINK[1] && pr.lateral < 0 && pr.lateral > -(PINE_HOLLOW.width / 2 + PINE_HOLLOW.shoulder + 6);
    });
    expect(kinkPines.length).toBeGreaterThanOrEqual(6);
    for (const k of ['pine', 'snowbank', 'lightPole']) expect(PINE_HOLLOW.props.some((p) => p.kind === k)).toBe(true);
  });
});
