import { describe, expect, it } from 'vitest';
import type { TrackTheme } from '../shared/contracts';
import { headlightGeometry, headlightsOn } from './fx';

describe('render: headlight beams (WP26)', () => {
  const g = headlightGeometry();
  const pos = g.getAttribute('position');
  const col = g.getAttribute('color');
  const idx = g.getIndex();
  if (!idx) throw new Error('beam geometry is indexed');
  // Vertices are a grid: rows along the beam, columns across it.
  const rows: { x: number; z: number; k: number }[][] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (!rows.length || rows[rows.length - 1][0].x !== x) rows.push([]);
    rows[rows.length - 1].push({ x, z: pos.getZ(i), k: col.getX(i) });
  }

  it('is one flat layer: triangles cover the footprint exactly once (no stacked inner shape)', () => {
    let area = 0;
    for (let t = 0; t < idx.count; t += 3) {
      const [a, b, c] = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      const ux = pos.getX(b) - pos.getX(a);
      const uz = pos.getZ(b) - pos.getZ(a);
      const vx = pos.getX(c) - pos.getX(a);
      const vz = pos.getZ(c) - pos.getZ(a);
      area += Math.abs(ux * vz - uz * vx) / 2;
    }
    for (let i = 0; i < pos.count; i++) expect(pos.getY(i)).toBe(0);
    const first = rows[0];
    const last = rows[rows.length - 1];
    const footprint = ((last[0].x - first[0].x) * (2 * Math.abs(first[0].z) + 2 * Math.abs(last[0].z))) / 2;
    expect(area).toBeCloseTo(footprint, 4);
  });

  it('has one fade: a single peak along the centre, each cross-section peaks in the middle and is 0 at both sides', () => {
    const mid = (rows[0].length - 1) / 2;
    const centre = rows.map((r) => r[mid].k);
    const peak = centre.indexOf(Math.max(...centre));
    for (let i = 1; i <= peak; i++) expect(centre[i]).toBeGreaterThan(centre[i - 1]);
    for (let i = peak + 1; i < centre.length; i++) expect(centre[i]).toBeLessThan(centre[i - 1]);
    expect(centre[0]).toBe(0); // soft start at the lamp
    expect(centre[centre.length - 1]).toBe(0); // gone at the far end
    for (const r of rows) {
      expect(r[0].k).toBe(0);
      expect(r[r.length - 1].k).toBe(0);
      for (let j = 1; j <= mid; j++) expect(r[j].k).toBeGreaterThanOrEqual(r[j - 1].k);
      for (let j = mid + 1; j < r.length; j++) expect(r[j].k).toBeLessThanOrEqual(r[j - 1].k);
    }
  });

  it('shows on dark themes only', () => {
    const want: Record<TrackTheme, boolean> = { scrapyard: true, docks: true, snow: true, city: true, desert: false, quarry: false };
    for (const [theme, on] of Object.entries(want)) expect(headlightsOn(theme as TrackTheme), theme).toBe(on);
  });
});
