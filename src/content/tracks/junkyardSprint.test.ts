import { beforeAll, describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { JUNKYARD_SPRINT, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER } from './junkyardSprint';
import { hairpins, longestStraight, trackContentTests } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

describe('junkyardSprint', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const def = JUNKYARD_SPRINT;
    const v = validateTrack(def);
    const hp = hairpins(def);
    const straight = longestStraight(def);
    console.warn(
      `WP23a ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpins ${hp.map((h) => `${h.turn.toFixed(0)} deg at s ${((h.from + h.to) / 2).toFixed(0)}`).join(', ')}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBeGreaterThanOrEqual(13);
    expect(def.width).toBeLessThanOrEqual(16);
    expect(v.length).toBeGreaterThanOrEqual(800);
    expect(v.length).toBeLessThanOrEqual(1000);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hp).toHaveLength(2);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(150);
    expect(getTrack(def.id)).toBe(def);
  });

  trackContentTests(JUNKYARD_SPRINT, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER, 'WP23a');

  it('Junkyard Sprint: a hairpin at each end of the paperclip, tire walls outside both', () => {
    const g = buildTrackGeometry(JUNKYARD_SPRINT);
    const xs = hairpins(JUNKYARD_SPRINT).map((h) => g.sampleAt((h.from + h.to) / 2).pos.x);
    const minX = Math.min(...g.samples.map((s) => s.pos.x));
    const maxX = Math.max(...g.samples.map((s) => s.pos.x));
    expect(Math.min(...xs) - minX).toBeLessThan(25);
    expect(maxX - Math.max(...xs)).toBeLessThan(25);
    for (const k of ['tireStack', 'wreck', 'container', 'crate', 'lightPole']) expect(JUNKYARD_SPRINT.props.some((p) => p.kind === k)).toBe(true);
    for (const x of xs) {
      const near = JUNKYARD_SPRINT.props.filter((p) => p.kind === 'tireStack' && Math.abs(p.pos.x - x) < 40);
      expect(near.length).toBeGreaterThanOrEqual(10);
    }
  });
});
