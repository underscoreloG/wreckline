import { describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, trackShape, validateTrack } from '../../shared/trackGeometry';
import { REVERSED_TRACKS, TRACKS } from './index';

/** Death Rally tight track rules (content.md section 12, "Track shape", user decision 2026-10-26). */
const TIGHT = {
  maxNearStraightShare: 0.25,
  maxStraight: 80, // m
  maxStartStraight: 100, // m, the straight through the start line holds the 8-car grid
  minCorners: 10,
  minTurnPer100m: 110, // degrees
  minRadius: 12, // m
  referenceLapTime: [21, 28], // s (WP37: 22-27 measured; was 24-32 before the AI pace pass)
} as const;

/** A track opts in with `shape: 'tight'` on its exported TrackDef (WP31: Scrapyard first, the rest in WP32). */
const isTight = (def: TrackDef): boolean => (def as { shape?: string }).shape === 'tight';
// WP39: the reversed layouts follow the same rules as their forward tracks.
const tight = [...Object.values(TRACKS), ...Object.values(REVERSED_TRACKS)].filter(isTight);

describe('Death Rally tight tracks (WP31)', () => {
  it('Scrapyard opts in; the opted-in list is logged', () => {
    console.warn(`WP31 tight tracks: ${tight.map((t) => t.id).join(', ')} (${tight.length} of ${Object.keys(TRACKS).length})`);
    expect(tight.map((t) => t.id)).toContain('scrapyard');
  });

  it.each(tight.map((def) => [def.id, def] as const))('%s follows the tight rules', (_id, def) => {
    const g = buildTrackGeometry(def);
    const shape = trackShape(g);
    console.warn(
      `WP31 ${def.id}: length ${g.length.toFixed(0)} m, near-straight ${(shape.nearStraightShare * 100).toFixed(1)}%, corners ${shape.corners}, longest straight ${shape.longestStraight.toFixed(0)} m, turning ${shape.turnPer100m.toFixed(0)} deg/100 m, min radius ${shape.minRadius.toFixed(1)} m, referenceLapTime ${def.referenceLapTime} s`,
    );
    expect(shape.nearStraightShare).toBeLessThanOrEqual(TIGHT.maxNearStraightShare);
    for (const st of shape.straights) {
      // The straight through the start line is the one run that covers s 0 (it may wrap past the end).
      const throughStart = st.s === 0 || st.s + st.length > g.length;
      expect(st.length, `straight at s ${st.s.toFixed(0)}`).toBeLessThanOrEqual(throughStart ? TIGHT.maxStartStraight : TIGHT.maxStraight);
    }
    expect(shape.corners).toBeGreaterThanOrEqual(TIGHT.minCorners);
    expect(shape.turnPer100m).toBeGreaterThanOrEqual(TIGHT.minTurnPer100m);
    expect(shape.minRadius).toBeGreaterThanOrEqual(TIGHT.minRadius);
    expect(validateTrack(def).errors).toEqual([]);
    expect(def.referenceLapTime).toBeGreaterThanOrEqual(TIGHT.referenceLapTime[0]);
    expect(def.referenceLapTime).toBeLessThanOrEqual(TIGHT.referenceLapTime[1]);
  });
});
