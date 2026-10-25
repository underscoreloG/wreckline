import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { runSoak, type SoakStats } from '../../sim/soak';
import { BLAST_PIT, BLAST_PIT_CRANE_S, BLAST_PIT_PROP_RULES, BLAST_PIT_SCATTER } from './blastPit';
import { TRACKS } from './index';
import { NEON_MILE } from './neonMile';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';
import { RAIN_DISTRICT, RAIN_DISTRICT_PROP_RULES, RAIN_DISTRICT_SCATTER } from './rainDistrict';

beforeAll(async () => {
  await initPhysics();
});

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

interface Case {
  def: TrackDef;
  rules: readonly PropRule[];
  scatter: readonly ScatterRule[];
  width: number;
  maxLength: number;
  minStraight: number;
}

const CASES: Case[] = [
  { def: RAIN_DISTRICT, rules: RAIN_DISTRICT_PROP_RULES, scatter: RAIN_DISTRICT_SCATTER, width: 14, maxLength: 1500, minStraight: 200 },
  { def: BLAST_PIT, rules: BLAST_PIT_PROP_RULES, scatter: BLAST_PIT_SCATTER, width: 16, maxLength: 1700, minStraight: 150 },
];

interface Run {
  from: number;
  to: number;
  turn: number; // degrees
}

/** Longest run of samples with |curvature| < 1/150 m (a straight), wrapping over the start line. */
function longestStraight(def: TrackDef): Run {
  const g = buildTrackGeometry(def);
  const n = g.samples.length;
  const ds = g.length / n;
  let best: Run = { from: 0, to: 0, turn: 0 };
  let start = 0;
  for (let i = 0; i < 2 * n; i++) {
    if (Math.abs(g.samples[i % n].curvature) >= 1 / 150) start = i + 1;
    else if ((i + 1 - start) * ds > best.to - best.from && i + 1 - start <= n) best = { from: start * ds, to: (i + 1) * ds, turn: 0 };
  }
  return best;
}

/** Contiguous section tighter than r 25 m with the biggest total turn (a hairpin is >= 150 deg). */
function tightestTurn(def: TrackDef): Run {
  const g = buildTrackGeometry(def);
  const ds = g.length / g.samples.length;
  let best: Run = { from: 0, to: 0, turn: 0 };
  let cur: Run = { from: 0, to: 0, turn: 0 };
  for (const smp of g.samples) {
    if (Math.abs(smp.curvature) > 1 / 25) {
      if (cur.turn === 0) cur = { from: smp.s, to: smp.s, turn: 0 };
      cur.turn += (Math.abs(smp.curvature) * ds * 180) / Math.PI;
      cur.to = smp.s;
      if (cur.turn > best.turn) best = { ...cur };
    } else cur = { from: 0, to: 0, turn: 0 };
  }
  return best;
}

describe.each(CASES)('$def.id', ({ def, rules, scatter, width, maxLength, minStraight }) => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(def);
    const straight = longestStraight(def);
    const hairpin = tightestTurn(def);
    console.warn(
      `WP23b ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${(straight.to - straight.from).toFixed(0)} m, hairpin ${hairpin.turn.toFixed(0)} deg at s ${hairpin.from.toFixed(0)}-${hairpin.to.toFixed(0)}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBe(width);
    expect(v.length).toBeGreaterThanOrEqual(1100);
    expect(v.length).toBeLessThanOrEqual(maxLength);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hairpin.turn).toBeGreaterThanOrEqual(150);
    expect(straight.to - straight.from).toBeGreaterThanOrEqual(minStraight);
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
  // WP07 test 2 finishing rules, on this (not yet registered) track.
  it.each(SEEDS)('soak seed %i: race completes, nobody stuck', (seed) => {
    const r = runSoak({ track: def, seed });
    results.push(r);
    expect(r.trackId).toBe(def.id);
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
      `WP23b ${def.id}: median clean lap (0.55 AI, ${laps.length} laps) ${median.toFixed(2)} s, referenceLapTime ${def.referenceLapTime}, wrecks/race ${wrecks.toFixed(2)}, wall impacts/race ${walls.toFixed(2)}, pickups ${def.pickups.length}`,
    );
    // WP07 health gate (content.md section 12); wall impacts are report-only (flag above 4.5).
    expect(wrecks).toBeGreaterThanOrEqual(0.2);
    expect(wrecks).toBeLessThanOrEqual(2.0);
    expect(Math.abs(median - def.referenceLapTime)).toBeLessThanOrEqual(0.25);
  });
});

describe('track signatures (content.md section 12, tracks 9-10)', () => {
  const count = (def: TrackDef, k: string) => def.props.filter((p) => p.kind === k).length;

  it('Rain District: the hairpin turnaround comes right at the end of the 200 m boulevard', () => {
    const straight = longestStraight(RAIN_DISTRICT);
    const hairpin = tightestTurn(RAIN_DISTRICT);
    expect(hairpin.from - straight.to).toBeGreaterThanOrEqual(0);
    expect(hairpin.from - straight.to).toBeLessThan(15);
  });

  it('Rain District: buildings, billboards outside the walls and more light poles than Neon Mile', () => {
    for (const k of ['building', 'billboard']) expect(count(RAIN_DISTRICT, k)).toBeGreaterThan(0);
    expect(count(RAIN_DISTRICT, 'lightPole')).toBeGreaterThan(count(NEON_MILE, 'lightPole'));
    const g = buildTrackGeometry(RAIN_DISTRICT);
    for (const b of RAIN_DISTRICT.props.filter((p) => p.kind === 'billboard')) {
      expect(Math.abs(g.project(b.pos).lateral)).toBeGreaterThan(RAIN_DISTRICT.width / 2 + RAIN_DISTRICT.shoulder);
    }
  });

  it('Blast Pit: the longest track, and its hairpin is the one between the pits under the crane', () => {
    const len = buildTrackGeometry(BLAST_PIT).length;
    for (const t of [...Object.values(TRACKS), RAIN_DISTRICT]) if (t.id !== BLAST_PIT.id) expect(len).toBeGreaterThan(buildTrackGeometry(t).length);
    const hairpin = tightestTurn(BLAST_PIT);
    expect(BLAST_PIT_CRANE_S).toBeGreaterThan(hairpin.from);
    expect(BLAST_PIT_CRANE_S).toBeLessThan(hairpin.to);
  });

  it('Blast Pit: rocks and one crane outside the hairpin wall whose 27 m jib reaches past the centerline', () => {
    expect(count(BLAST_PIT, 'rock')).toBeGreaterThan(0);
    const cranes = BLAST_PIT.props.filter((p) => p.kind === 'crane');
    expect(cranes).toHaveLength(1);
    const pr = buildTrackGeometry(BLAST_PIT).project(cranes[0].pos);
    expect(Math.abs(pr.s - BLAST_PIT_CRANE_S)).toBeLessThan(5);
    expect(Math.abs(pr.lateral)).toBeGreaterThan(BLAST_PIT.width / 2 + BLAST_PIT.shoulder);
    expect(Math.abs(pr.lateral)).toBeLessThan(27);
  });
});
