import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DOCKSIDE } from '../../content/tracks/dockside';
import { SCRAPYARD } from '../../content/tracks/scrapyard';
import { buildTrackGeometry } from '../../shared/trackGeometry';
import { triangles } from '../geo';
import { buildProps } from '../props';
import { THEMES, type ThemeDef } from './index';

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
    // The straight's outer wall runs along the water line (s 213-403), the water 1-3 m beyond it.
    for (let s = 220; s <= 400; s += 20) {
      const i = Math.round((s / g.length) * g.samples.length);
      expect(depth(g.leftWall[i])).toBeGreaterThan(-3);
    }
  });
});

describe('WP22 themes and props', () => {
  it('snow, city and quarry are registered with their design.md fog colors', () => {
    expect(THEMES.snow?.fog.color).toBe('#1A2230');
    expect(THEMES.city?.fog.color).toBe('#120A1E');
    expect(THEMES.quarry?.fog.color).toBe('#B89A7A');
    expect(THEMES.snow?.key.color).toBe('#A8C4FF');
    for (const t of ['snow', 'city', 'quarry'] as const) expect(THEMES[t]?.water).toBeNull();
  });

  it('pine, snowbank, billboard and crane: one InstancedMesh each (billboard + its glowing panel), under 300 triangles', () => {
    const kinds = ['pine', 'snowbank', 'billboard', 'crane'] as const;
    const def = {
      ...SCRAPYARD,
      id: 'wp22props',
      props: kinds.map((kind, i) => ({ kind, pos: { x: 0, y: -40 - i * 20 }, rotation: 0, scale: 1 })),
    };
    const group = buildProps(buildTrackGeometry(def), THEMES.snow as ThemeDef, new THREE.Texture());
    const meshes = group.children as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(kinds.length + 1);
    for (const m of meshes) {
      expect(m.isInstancedMesh).toBe(true);
      expect(triangles(m.geometry)).toBeLessThan(300);
    }
  });
});
