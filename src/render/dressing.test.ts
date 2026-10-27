import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { REVERSED_TRACKS, TRACKS } from '../content/tracks';
import type { TrackGeometry } from '../shared/contracts';
import { buildTrackGeometry, propRadius } from '../shared/trackGeometry';
import { BANNER_LEN, BARRIER, CLUTTER_RADIUS, NEON_SIZE, outerLateral, planDressing, STAND, type Placed } from './dressing';
import { buildDressing } from './dressingMesh';
import type { WorldTextures } from './textures';
import { themeFor } from './themes';

// WP39: the reversed layouts too, since stands, banners and the grid follow the start line.
const tracks = [...Object.values(TRACKS), ...Object.values(REVERSED_TRACKS)].map((def) => ({ def, g: buildTrackGeometry(def), theme: themeFor(def.theme) }));

/** Points of a piece's footprint: centre plus both ends along local x. */
function footprint(p: Placed, len: number): { x: number; y: number }[] {
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  return [-0.5, 0, 0.5].map((t) => ({ x: p.x + c * len * t, y: p.y + s * len * t }));
}

/** Fails if a circle of radius r at p reaches the drivable area, the wall mesh or any prop of the track. */
function expectClear(g: TrackGeometry, p: { x: number; y: number }, r: number, what: string): void {
  const lat = Math.abs(g.project(p).lateral);
  expect(lat - r, `${g.def.id} ${what} at (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) overlaps the walls`).toBeGreaterThanOrEqual(outerLateral(g) - 1e-6);
  for (const q of g.def.props) {
    const d = Math.hypot(q.pos.x - p.x, q.pos.y - p.y);
    // expect only on a miss: it is the slow part of this loop over every piece and prop (20 tracks since WP39).
    if (d < propRadius(q.kind) * q.scale + r - 1e-6) expect(d, `${g.def.id} ${what} overlaps prop ${q.kind}`).toBeGreaterThanOrEqual(propRadius(q.kind) * q.scale + r - 1e-6);
  }
}

describe('WP27 track dressing', () => {
  it('is deterministic per track: two plans of the same track are identical', () => {
    for (const { g, theme } of tracks) {
      const a = planDressing(g, theme.dressing);
      const b = planDressing(g, theme.dressing);
      expect({ ...a, kerbWidth: Array.from(a.kerbWidth) }).toEqual({ ...b, kerbWidth: Array.from(b.kerbWidth) });
    }
  });

  it('places every 3D piece beyond the wall mesh and clear of every prop', () => {
    for (const { g, theme } of tracks) {
      const p = planDressing(g, theme.dressing);
      const seg = BARRIER[theme.dressing.barrier];
      for (const b of p.barriers) for (const q of footprint(b, seg.len * 0.9)) expectClear(g, q, seg.depth / 2, 'barrier');
      for (const c of p.clutter) expectClear(g, c, CLUTTER_RADIUS * c.scale, 'clutter');
      for (const c of p.crowd) expectClear(g, c, 0.3, 'crowd');
      for (const f of p.flags) expectClear(g, f, 0.1, 'flag');
      for (const v of p.vents) expectClear(g, v, 2, 'vent');
      for (const b of p.banners) for (const q of footprint(b, BANNER_LEN)) expectClear(g, q, 0.3, 'banner');
      for (const n of p.neon) for (const q of footprint(n, NEON_SIZE)) expectClear(g, q, 0.5, 'neon');
      for (const s of p.stands) {
        for (const z of [-STAND.depth / 2, STAND.depth / 2]) {
          const back = { ...s, x: s.x - Math.sin(s.rot) * z, y: s.y + Math.cos(s.rot) * z };
          for (const q of footprint(back, STAND.len)) expectClear(g, q, 1, 'stand');
        }
      }
    }
  });

  it('keeps road paint inside the road and kerbs on the shoulder', () => {
    for (const { g, theme } of tracks) {
      const p = planDressing(g, theme.dressing);
      const half = g.def.width / 2;
      for (const d of p.decals.filter((dc) => dc.layer === 'road')) {
        const f = { x: Math.cos(d.rot) * (d.l / 2), y: Math.sin(d.rot) * (d.l / 2) };
        const r = { x: -Math.sin(d.rot) * (d.w / 2), y: Math.cos(d.rot) * (d.w / 2) };
        for (const [sf, sr] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) {
          const corner = { x: d.x + f.x * sf + r.x * sr, y: d.y + f.y * sf + r.y * sr };
          expect(Math.abs(g.project(corner).lateral), `${g.def.id} ${d.cell} leaves the road`).toBeLessThanOrEqual(half + 0.05);
        }
      }
      for (const s of p.skids) for (const q of s.points) expect(Math.abs(g.project(q).lateral) + s.width / 2).toBeLessThanOrEqual(half);
      for (const w of p.kerbWidth) expect(w).toBeLessThanOrEqual(g.def.shoulder);
      expect(p.kerbWidth.some((w) => w > 0)).toBe(true);
    }
  });

  it('builds at most 30 draw calls per track, high-only pieces flagged for low quality', () => {
    const tex = { decals: new THREE.Texture(), glow: new THREE.Texture() } as unknown as WorldTextures;
    for (const { g, theme } of tracks) {
      const group = buildDressing(theme, planDressing(g, theme.dressing), tex);
      let draws = 0;
      let lowDraws = 0;
      group.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        draws++;
        let high = false;
        for (let a: THREE.Object3D | null = o; a; a = a.parent) high ||= a.userData.highOnly === true;
        if (!high) lowDraws++;
      });
      expect(draws, g.def.id).toBeLessThanOrEqual(30);
      expect(lowDraws, g.def.id).toBeLessThanOrEqual(3);
    }
  });
});
