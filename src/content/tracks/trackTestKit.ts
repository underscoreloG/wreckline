/**
 * Shared test helpers for the per-track test files (`<trackId>.test.ts`, WP31). Test-only: never imported by
 * the game. A track's own test file calls these, so redrawing one track touches only its two files.
 */
import { expect, it } from 'vitest';
import type { TrackDef } from '../../shared/contracts';
import { buildTrackGeometry } from '../../shared/trackGeometry';
import { runSoak, type SoakStats } from '../../sim/soak';
import { placeProps, type PropRule, type ScatterRule } from './placeProps';

export const SOAK_SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

export interface Run {
  from: number; // m
  to: number; // m
  turn: number; // degrees, 0 for a straight
}

/** Longest run of samples with |curvature| < 1/150 m (the WP11-WP23 straight), wrapping over the start line. */
export function longestStraight(def: TrackDef): Run {
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

/** Every contiguous section tighter than r 25 m, with its total turn in degrees (a hairpin is >= 150). */
export function tightSections(def: TrackDef): Run[] {
  const g = buildTrackGeometry(def);
  const ds = g.length / g.samples.length;
  const out: Run[] = [];
  let cur: Run | null = null;
  for (const smp of g.samples) {
    if (Math.abs(smp.curvature) > 1 / 25) {
      cur ??= { from: smp.s, to: smp.s, turn: 0 };
      cur.turn += (Math.abs(smp.curvature) * ds * 180) / Math.PI;
      cur.to = smp.s;
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export const hairpins = (def: TrackDef): Run[] => tightSections(def).filter((r) => r.turn >= 150);

/** The tight section with the biggest total turn. */
export const tightestTurn = (def: TrackDef): Run => tightSections(def).reduce((a, b) => (b.turn > a.turn ? b : a), { from: 0, to: 0, turn: 0 });

/**
 * The content checks every track shares (WP11-WP23 pattern), registered inside the caller's describe:
 * pickup mix, stable props, the 16-seed soak (WP07 finishing rules) and referenceLapTime = the 0.55 AI
 * median clean lap within 0.25 s with wrecks inside the WP07 gate. `tag` prefixes the logged numbers.
 */
export function trackContentTests(def: TrackDef, rules: readonly PropRule[], scatter: readonly ScatterRule[], tag: string): void {
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
  it.each(SOAK_SEEDS)('soak seed %i: race completes, nobody stuck', (seed) => {
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
    expect(results.length).toBe(SOAK_SEEDS.length);
    const laps = results.flatMap((r) => r.cars.filter((c) => Math.abs(c.skill - 0.55) < 1e-9).flatMap((c) => c.cleanLaps)).sort((a, b) => a - b);
    expect(laps.length).toBeGreaterThan(0);
    const m = laps.length >> 1;
    const median = laps.length % 2 ? laps[m] : (laps[m - 1] + laps[m]) / 2;
    const wrecks = results.reduce((s, r) => s + r.wrecks, 0) / results.length;
    const walls = results.reduce((s, r) => s + r.wallImpacts, 0) / results.length;
    console.warn(
      `${tag} ${def.id}: median clean lap (0.55 AI, ${laps.length} laps) ${median.toFixed(2)} s, referenceLapTime ${def.referenceLapTime}, wrecks/race ${wrecks.toFixed(2)}, wall impacts/race ${walls.toFixed(2)}, pickups ${def.pickups.length}`,
    );
    // WP07 health gate (content.md section 12); wall impacts are report-only (flag above 4.5).
    expect(wrecks).toBeGreaterThanOrEqual(0.2);
    expect(wrecks).toBeLessThanOrEqual(2.0);
    expect(Math.abs(median - def.referenceLapTime)).toBeLessThanOrEqual(0.25);
  });
}
