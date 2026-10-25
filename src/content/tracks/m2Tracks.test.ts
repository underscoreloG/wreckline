import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { runSoak, type SoakStats } from '../../sim/soak';
import { DOCKSIDE, DOCKSIDE_PROP_RULES, DOCKSIDE_SCATTER } from './dockside';
import { DUST_BOWL, DUST_BOWL_PROP_RULES, DUST_BOWL_SCATTER } from './dustBowl';
import { FROSTBITE, FROSTBITE_PROP_RULES, FROSTBITE_SCATTER } from './frostbite';
import { getTrack, TRACKS } from './index';
import { NEON_MILE, NEON_MILE_PROP_RULES, NEON_MILE_SCATTER } from './neonMile';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { REDROCK, REDROCK_CRANE_S, REDROCK_PROP_RULES, REDROCK_SCATTER } from './redrock';
import { SCRAPYARD } from './scrapyard';

beforeAll(async () => {
  await initPhysics();
});

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

interface Case {
  def: TrackDef;
  rules: readonly PropRule[];
  scatter: readonly ScatterRule[];
  width: number;
  minStraight: number;
}

const CASES: Case[] = [
  { def: DUST_BOWL, rules: DUST_BOWL_PROP_RULES, scatter: DUST_BOWL_SCATTER, width: 15, minStraight: 200 },
  { def: DOCKSIDE, rules: DOCKSIDE_PROP_RULES, scatter: DOCKSIDE_SCATTER, width: 13, minStraight: 150 },
  { def: FROSTBITE, rules: FROSTBITE_PROP_RULES, scatter: FROSTBITE_SCATTER, width: 13, minStraight: 150 },
  { def: NEON_MILE, rules: NEON_MILE_PROP_RULES, scatter: NEON_MILE_SCATTER, width: 14, minStraight: 150 },
  { def: REDROCK, rules: REDROCK_PROP_RULES, scatter: REDROCK_SCATTER, width: 16, minStraight: 150 },
];

/** Longest run of samples with |curvature| < 1/150 m (a straight), wrapping over the start line. */
function longestStraight(def: TrackDef): number {
  const g = buildTrackGeometry(def);
  const n = g.samples.length;
  let best = 0;
  let run = 0;
  for (let i = 0; i < 2 * n; i++) {
    run = Math.abs(g.samples[i % n].curvature) < 1 / 150 ? run + 1 : 0;
    best = Math.max(best, Math.min(run, n));
  }
  return (best * g.length) / n;
}

/** Biggest total turn (degrees) of one contiguous section tighter than r 25 m (a hairpin is >= 150). */
function tightestTurn(def: TrackDef): number {
  const g = buildTrackGeometry(def);
  const ds = g.length / g.samples.length;
  let best = 0;
  let turn = 0;
  for (const smp of g.samples) {
    turn = Math.abs(smp.curvature) > 1 / 25 ? turn + Math.abs(smp.curvature) * ds : 0;
    best = Math.max(best, turn);
  }
  return (best * 180) / Math.PI;
}

describe.each(CASES)('$def.id', ({ def, rules, scatter, width, minStraight }) => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(def);
    console.warn(`WP11 ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${longestStraight(def).toFixed(0)} m, hairpin ${tightestTurn(def).toFixed(0)} deg, ${def.props.length} props`);
    expect(v.errors).toEqual([]);
    expect(def.width).toBe(width);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(1500);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(tightestTurn(def)).toBeGreaterThanOrEqual(150);
    expect(longestStraight(def)).toBeGreaterThanOrEqual(minStraight);
    expect(getTrack(def.id)).toBe(def);
  });

  it('pickups: 10-14 (up to 18 above 1400 m), every kind at least twice, cash the most common', () => {
    const count = (k: string) => def.pickups.filter((p) => p.kind === k).length;
    expect(def.pickups.length).toBeGreaterThanOrEqual(10);
    expect(def.pickups.length).toBeLessThanOrEqual(buildTrackGeometry(def).length > 1400 ? 18 : 14);
    for (const k of ['cash', 'repair', 'mines', 'turbo']) expect(count(k)).toBeGreaterThanOrEqual(2);
    for (const k of ['repair', 'mines', 'turbo']) expect(count('cash')).toBeGreaterThan(count(k));
  });

  it('placeProps output is stable', () => {
    const base = { ...def, props: [] };
    const a = placeProps(base, rules, scatter);
    expect(placeProps(base, rules, scatter)).toEqual(a);
    expect(a).toEqual(def.props);
  });

  const results: SoakStats[] = [];
  const raceTimeLimit = 3 * def.referenceLapTime * 1.6;
  // WP07 test 2 finishing rules, on this track.
  it.each(SEEDS)('soak seed %i: race completes, nobody stuck', (seed) => {
    const r = runSoak({ trackId: def.id, seed });
    results.push(r);
    expect(r.endReason).not.toBe('timeout');
    const live = r.cars.filter((c) => !c.wrecked);
    if (r.endReason === 'allFinished') {
      expect(live.every((c) => c.finished)).toBe(true);
      expect(r.raceTime).toBeLessThan(raceTimeLimit);
    } else if (r.endReason === 'playerFinished15s') {
      expect(live.every((c) => c.finished || c.lap >= 2)).toBe(true);
    }
    for (const c of live) expect(c.stuckCount).toBeLessThanOrEqual(2);
  });

  it('referenceLapTime is the 0.55 AI median clean lap (rounded to 0.5 s)', () => {
    expect(results.length).toBe(SEEDS.length);
    const laps = results.flatMap((r) => r.cars.filter((c) => Math.abs(c.skill - 0.55) < 1e-9).flatMap((c) => c.cleanLaps)).sort((a, b) => a - b);
    expect(laps.length).toBeGreaterThan(0);
    const m = laps.length >> 1;
    const median = laps.length % 2 ? laps[m] : (laps[m - 1] + laps[m]) / 2;
    const wrecks = results.reduce((s, r) => s + r.wrecks, 0) / results.length;
    const walls = results.reduce((s, r) => s + r.wallImpacts, 0) / results.length;
    console.warn(
      `WP11 ${def.id}: median clean lap (0.55 AI, ${laps.length} laps) ${median.toFixed(2)} s, referenceLapTime ${def.referenceLapTime}, wrecks/race ${wrecks.toFixed(2)}, wall impacts/race ${walls.toFixed(2)}, pickups ${def.pickups.length}`,
    );
    // WP07 health gate (content.md section 12); wall impacts are report-only.
    expect(wrecks).toBeGreaterThanOrEqual(0.2);
    expect(wrecks).toBeLessThanOrEqual(2.0);
    expect(Math.abs(median - def.referenceLapTime)).toBeLessThanOrEqual(0.25);
  });
});

describe('theme-specific props', () => {
  const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

  it('Dust Bowl: rocks, cacti, wrecks, tire stacks, no containers', () => {
    for (const k of ['rock', 'cactus', 'wreck', 'tireStack']) expect(count(DUST_BOWL, k)).toBeGreaterThan(0);
    expect(count(DUST_BOWL, 'container')).toBe(0);
  });

  it('Dockside: containers, crates, barrels, cones and more light poles than Scrapyard', () => {
    for (const k of ['container', 'crate', 'barrel', 'cone']) expect(count(DOCKSIDE, k)).toBeGreaterThan(0);
    expect(count(DOCKSIDE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });

  it('Frostbite Pass: snowbanks, pines and sodium light poles', () => {
    for (const k of ['snowbank', 'pine', 'lightPole']) expect(count(FROSTBITE, k)).toBeGreaterThan(0);
  });

  it('Neon Mile: buildings, billboards and more light poles than Scrapyard', () => {
    for (const k of ['building', 'billboard']) expect(count(NEON_MILE, k)).toBeGreaterThan(0);
    expect(count(NEON_MILE, 'lightPole')).toBeGreaterThan(count(SCRAPYARD, 'lightPole'));
  });

  it('Redrock Quarry: rocks and one crane outside the hairpin wall whose 27 m jib reaches past the centerline', () => {
    expect(count(REDROCK, 'rock')).toBeGreaterThan(0);
    const cranes = REDROCK.props.filter((p) => p.kind === 'crane');
    expect(cranes).toHaveLength(1);
    const g = buildTrackGeometry(REDROCK);
    const pr = g.project(cranes[0].pos);
    expect(Math.abs(pr.s - REDROCK_CRANE_S)).toBeLessThan(5);
    expect(Math.abs(pr.lateral)).toBeGreaterThan(REDROCK.width / 2 + REDROCK.shoulder);
    expect(Math.abs(pr.lateral)).toBeLessThan(27);
  });
});

describe('tracks registry (WP22)', () => {
  it('lists the WP22 tracks after the first three, in unlock order', () => {
    const ids = Object.keys(TRACKS);
    expect(ids.slice(0, 6)).toEqual(['scrapyard', 'dustBowl', 'dockside', 'frostbite', 'neonMile', 'redrock']);
  });
});

describe('runSoak track option (WP22)', () => {
  it('soaks an unregistered TrackDef and counts wall impacts', () => {
    const def = { ...SCRAPYARD, id: 'unregistered' };
    expect(Object.keys(TRACKS)).not.toContain('unregistered');
    const r = runSoak({ track: def, seed: 1 });
    console.warn(`WP22 soak unregistered (Scrapyard layout) seed 1: ${r.endReason}, wallImpacts ${r.wallImpacts}, wrecks ${r.wrecks}`);
    expect(r.trackId).toBe('unregistered');
    expect(r.endReason).not.toBe('timeout');
    expect(r.wallImpacts).toBeGreaterThanOrEqual(0);
    // Same race as the registered Scrapyard: the track option only swaps the TrackDef.
    expect(runSoak({ trackId: 'scrapyard', seed: 1 }).wallImpacts).toBe(r.wallImpacts);
  });
});
