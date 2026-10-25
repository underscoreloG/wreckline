import { describe, expect, it } from 'vitest';
import { DOCKSIDE } from '../../content/tracks/dockside';
import { buildTrackGeometry } from '../../shared/trackGeometry';
import { THEMES } from './index';

describe('WP11 themes', () => {
  it('desert and docks are registered with the WP11 key light and fog', () => {
    expect(THEMES.desert?.key).toMatchObject({ color: '#FFD9A0', intensity: 2.0 });
    expect(THEMES.desert?.fog).toEqual({ color: '#C9A27A', density: 0.004 });
    expect(THEMES.desert?.water).toBeNull();
    expect(THEMES.docks?.key).toMatchObject({ color: '#9FB4FF', intensity: 0.8 });
  });

  it("docks water lies beyond Dockside's water-edge straight and nothing of the track or its props is in it", () => {
    const water = THEMES.docks?.water;
    if (!water) throw new Error('docks theme has no water');
    const g = buildTrackGeometry(DOCKSIDE);
    const depth = (p: { x: number; y: number }) => (p.x - water.point.x) * water.normal.x + (p.y - water.point.y) * water.normal.y;
    for (const p of [...g.leftWall, ...g.rightWall, ...DOCKSIDE.props.map((pr) => pr.pos)]) expect(depth(p)).toBeLessThan(0);
    // The straight's outer wall runs along the water line (s 213-403), a quay apron of under 8 m.
    for (let s = 220; s <= 400; s += 20) {
      const i = Math.round((s / g.length) * g.samples.length);
      expect(depth(g.leftWall[i])).toBeGreaterThan(-8);
    }
  });
});
