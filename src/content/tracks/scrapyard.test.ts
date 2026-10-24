import { describe, expect, it } from 'vitest';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { getTrack, TRACKS } from './index';
import { placeProps } from './placeProps';
import { SCRAPYARD, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER } from './scrapyard';

describe('scrapyard + placeProps', () => {
  it('placeProps output is identical across two calls', () => {
    const base = { ...SCRAPYARD, props: [] };
    const a = placeProps(base, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER);
    const b = placeProps(base, SCRAPYARD_PROP_RULES, SCRAPYARD_SCATTER);
    expect(a).toEqual(b);
    expect(a).toEqual(SCRAPYARD.props);
  });

  it('places rule props and the infield scatter', () => {
    const count = (k: string) => SCRAPYARD.props.filter((p) => p.kind === k).length;
    expect(count('lightPole')).toBeGreaterThan(10);
    expect(count('container')).toBeGreaterThan(5);
    expect(count('barrel')).toBeGreaterThan(10);
    // 6 scatter wrecks on top of the rule wrecks (the scatter may skip a few on rejection).
    expect(count('wreck')).toBeGreaterThan(5);
    expect(count('crate')).toBeGreaterThan(10);
  });

  it('validates ok: length 1049 +- 5, 26 checkpoints', () => {
    const v = validateTrack(SCRAPYARD);
    expect(v.errors).toEqual([]);
    expect(Math.abs(v.length - 1049)).toBeLessThanOrEqual(5);
    expect(buildTrackGeometry(SCRAPYARD).checkpoints).toHaveLength(26);
  });

  it('track registry', () => {
    expect(TRACKS.scrapyard).toBe(SCRAPYARD);
    expect(getTrack('scrapyard')).toBe(SCRAPYARD);
    expect(() => getTrack('nope')).toThrow();
  });
});
