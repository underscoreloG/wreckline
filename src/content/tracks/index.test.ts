import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics } from '../../sim/index';
import { runSoak } from '../../sim/soak';
import { DEFAULT_TRACK_ID, getTrack, TRACKS } from './index';

beforeAll(async () => {
  await initPhysics();
});

describe('tracks registry', () => {
  it('lists the WP22 tracks after the first three, in unlock order', () => {
    const ids = Object.keys(TRACKS);
    expect(ids.slice(0, 6)).toEqual(['scrapyard', 'dustBowl', 'dockside', 'frostbite', 'neonMile', 'redrock']);
  });

  it('getTrack returns the registered def by its own id, and throws on an unknown id', () => {
    for (const [id, def] of Object.entries(TRACKS)) {
      expect(def.id).toBe(id);
      expect(getTrack(id)).toBe(def);
    }
    expect(TRACKS[DEFAULT_TRACK_ID]).toBeDefined();
    expect(() => getTrack('nope')).toThrow();
  });
});

describe('runSoak track option (WP22)', () => {
  it('soaks an unregistered TrackDef and counts wall impacts', () => {
    const registered = getTrack(DEFAULT_TRACK_ID);
    const def = { ...registered, id: 'unregistered' };
    expect(Object.keys(TRACKS)).not.toContain('unregistered');
    const r = runSoak({ track: def, seed: 1 });
    console.warn(`WP22 soak unregistered (${registered.id} layout) seed 1: ${r.endReason}, wallImpacts ${r.wallImpacts}, wrecks ${r.wrecks}`);
    expect(r.trackId).toBe('unregistered');
    expect(r.endReason).not.toBe('timeout');
    expect(r.wallImpacts).toBeGreaterThanOrEqual(0);
    // Same race as the registered track: the track option only swaps the TrackDef.
    expect(runSoak({ trackId: registered.id, seed: 1 }).wallImpacts).toBe(r.wallImpacts);
  });
});
