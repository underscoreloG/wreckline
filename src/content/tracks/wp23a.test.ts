import { beforeAll, describe, expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry, validateTrack } from '../../shared/trackGeometry';
import { initPhysics } from '../../sim/index';
import { runSoak, type SoakStats } from '../../sim/soak';
import { JUNKYARD_SPRINT, JUNKYARD_SPRINT_PROP_RULES, JUNKYARD_SPRINT_SCATTER } from './junkyardSprint';
import { PINE_HOLLOW, PINE_HOLLOW_KINK, PINE_HOLLOW_PROP_RULES, PINE_HOLLOW_SCATTER } from './pineHollow';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

beforeAll(async () => {
  await initPhysics();
});

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

interface Case {
  def: TrackDef;
  rules: readonly PropRule[];
  scatter: readonly ScatterRule[];
  minLength: number;
  maxLength: number;
  hairpins: number;
}

const CASES: Case[] = [
  { def: JUNKYARD_SPRINT, rules: JUNKYARD_SPRINT_PROP_RULES, scatter: JUNKYARD_SPRINT_SCATTER, minLength: 800, maxLength: 1000, hairpins: 2 },
  { def: PINE_HOLLOW, rules: PINE_HOLLOW_PROP_RULES, scatter: PINE_HOLLOW_SCATTER, minLength: 1100, maxLength: 1500, hairpins: 1 },
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

/** Contiguous sections tighter than r 25 m turning at least 150 degrees: their mid s and turn in degrees. */
function hairpins(def: TrackDef): { s: number; deg: number }[] {
  const g = buildTrackGeometry(def);
  const ds = g.length / g.samples.length;
  const out: { s: number; deg: number }[] = [];
  let turn = 0;
  let from = 0;
  for (const smp of g.samples) {
    if (Math.abs(smp.curvature) > 1 / 25) {
      if (turn === 0) from = smp.s;
      turn += Math.abs(smp.curvature) * ds;
    } else {
      if ((turn * 180) / Math.PI >= 150) out.push({ s: (from + smp.s) / 2, deg: (turn * 180) / Math.PI });
      turn = 0;
    }
  }
  return out;
}

describe.each(CASES)('$def.id', ({ def, rules, scatter, minLength, maxLength, hairpins: wantHairpins }) => {
  it('passes validateTrack and the content.md section 12 constraints', () => {
    const v = validateTrack(def);
    const hp = hairpins(def);
    console.warn(
      `WP23a ${def.id}: length ${v.length.toFixed(1)} m, minRadius ${v.minRadius.toFixed(1)} m, minClearance ${v.minClearance.toFixed(1)} m, straight ${longestStraight(def).toFixed(0)} m, hairpins ${hp.map((h) => `${h.deg.toFixed(0)} deg at s ${h.s.toFixed(0)}`).join(', ')}, ${def.props.length} props`,
    );
    expect(v.errors).toEqual([]);
    expect(def.width).toBeGreaterThanOrEqual(13);
    expect(def.width).toBeLessThanOrEqual(16);
    expect(v.length).toBeGreaterThanOrEqual(minLength);
    expect(v.length).toBeLessThanOrEqual(maxLength);
    expect(v.minRadius).toBeGreaterThanOrEqual(def.width);
    expect(v.minRadius).toBeLessThan(25);
    expect(v.minClearance).toBeGreaterThanOrEqual(def.width + 2 * def.shoulder + 8);
    expect(hp).toHaveLength(wantHairpins);
    expect(longestStraight(def)).toBeGreaterThanOrEqual(150);
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
  // WP07 test 2 finishing rules, on this (unregistered) track.
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

  it('referenceLapTime is the 0.55 AI median clean lap (rounded to 0.5 s), wrecks inside the WP07 gate', () => {
    expect(results.length).toBe(SEEDS.length);
    const laps = results.flatMap((r) => r.cars.filter((c) => Math.abs(c.skill - 0.55) < 1e-9).flatMap((c) => c.cleanLaps)).sort((a, b) => a - b);
    expect(laps.length).toBeGreaterThan(0);
    const m = laps.length >> 1;
    const median = laps.length % 2 ? laps[m] : (laps[m - 1] + laps[m]) / 2;
    const wrecks = results.reduce((s, r) => s + r.wrecks, 0) / results.length;
    const walls = results.reduce((s, r) => s + r.wallImpacts, 0) / results.length;
    console.warn(
      `WP23a ${def.id}: median clean lap (0.55 AI, ${laps.length} laps) ${median.toFixed(2)} s, referenceLapTime ${def.referenceLapTime}, wrecks/race ${wrecks.toFixed(2)}, wall impacts/race ${walls.toFixed(2)}, pickups ${def.pickups.length}`,
    );
    // WP07 health gate (content.md section 12); wall impacts are report-only.
    expect(wrecks).toBeGreaterThanOrEqual(0.2);
    expect(wrecks).toBeLessThanOrEqual(2.0);
    expect(Math.abs(median - def.referenceLapTime)).toBeLessThanOrEqual(0.25);
  });
});

describe('signature props', () => {
  it('Junkyard Sprint: a hairpin at each end of the paperclip, tire walls outside both', () => {
    const g = buildTrackGeometry(JUNKYARD_SPRINT);
    const xs = hairpins(JUNKYARD_SPRINT).map((h) => g.sampleAt(h.s).pos.x);
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

  it('Pine Hollow: the hairpin is at the far (east) end, a wall of pines inside the blind kink', () => {
    const g = buildTrackGeometry(PINE_HOLLOW);
    const [hp] = hairpins(PINE_HOLLOW);
    const maxX = Math.max(...g.samples.map((s) => s.pos.x));
    expect(maxX - g.sampleAt(hp.s).pos.x).toBeLessThan(25);
    const kinkPines = PINE_HOLLOW.props.filter((p) => {
      if (p.kind !== 'pine') return false;
      const pr = g.project(p.pos);
      return pr.s >= PINE_HOLLOW_KINK[0] && pr.s <= PINE_HOLLOW_KINK[1] && pr.lateral < 0 && pr.lateral > -(PINE_HOLLOW.width / 2 + PINE_HOLLOW.shoulder + 6);
    });
    expect(kinkPines.length).toBeGreaterThanOrEqual(6);
    for (const k of ['pine', 'snowbank', 'lightPole']) expect(PINE_HOLLOW.props.some((p) => p.kind === k)).toBe(true);
  });
});
