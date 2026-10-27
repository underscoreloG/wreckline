import { beforeAll, describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { getTrack } from './index';
import { JUNKYARD_SPRINT, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER } from './junkyardSprint';
import { trackContentTests, windowHairpins } from './trackTestKit';

beforeAll(async () => {
  await initPhysics();
});

describe('junkyardSprint', () => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const def = JUNKYARD_SPRINT;
    const v = validateTrack(def);
    const hp = windowHairpins(def);
    console.warn(
      `WP32c ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, hairpins ${hp.map((h) => `${h.turn.toFixed(0)} deg at s ${((h.from + h.to) / 2).toFixed(0)}`).join(', ')}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBeGreaterThanOrEqual(13);
    expect(def.width).toBeLessThanOrEqual(16);
    // WP32 length budget: the shortest track.
    expect(v.length).toBeGreaterThanOrEqual(750);
    expect(v.length).toBeLessThanOrEqual(850);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hp).toHaveLength(2);
    expect(getTrack(def.id)).toBe(def);
  });

  it('pickups: a mix on and off the AI line band (WP32)', () => {
    // Outside racingLine's band (width / 2 - 1.6) the AI never steers for a pickup: only a human goes for those.
    const off = JUNKYARD_SPRINT.pickups.filter((p) => Math.abs(p.lateral) > JUNKYARD_SPRINT.width / 2 - 1.6).length;
    expect(off).toBeGreaterThanOrEqual(4);
    expect(JUNKYARD_SPRINT.pickups.length - off).toBeGreaterThanOrEqual(4);
  });

  trackContentTests(JUNKYARD_SPRINT, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER, 'WP32c');

  it('Junkyard Sprint: a hairpin at each end of the paperclip, tire walls outside both', () => {
    const g = buildTrackGeometry(JUNKYARD_SPRINT);
    const xs = windowHairpins(JUNKYARD_SPRINT).map((h) => g.sampleAt((h.from + h.to) / 2).pos.x);
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
