import { beforeAll, describe, expect, it } from 'vitest';
import { ARENAS } from '../content/arenas';
import { MAX_HUNTERS } from './arenaAi';
import { runArenaSoak, type ArenaSoakStats, type WreckCause } from './arenaSoak';
import { initPhysics } from './index';

beforeAll(async () => {
  await initPhysics();
});

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);
const quantile = (xs: readonly number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] ?? NaN;
};

// WP41 arena soak (content.md section 13): all-AI fights, the player slot on autoplay. Every number moves with any AI
// or arena edit: the soak is chaotic, so re-run it (and the WP41 tuning-log table) after one.
describe.each(Object.keys(ARENAS))('arena soak: %s, 16 seeds', (arenaId) => {
  let runs: ArenaSoakStats[] = [];
  beforeAll(() => {
    runs = SEEDS.map((seed) => runArenaSoak({ arenaId, seed }));
  });

  it('every fight ends, typically in 60-150 s, 90% by 180 s', () => {
    const times = runs.map((r) => r.fightTime ?? Infinity);
    expect(times.every(Number.isFinite)).toBe(true);
    expect(quantile(times, 0.5)).toBeGreaterThanOrEqual(60);
    expect(quantile(times, 0.5)).toBeLessThanOrEqual(150);
    expect(times.filter((t) => t <= 180).length).toBeGreaterThanOrEqual(Math.ceil(0.9 * runs.length));
  });

  it('no stuck cars, never more than 3 AIs on one car, every weapon wrecks', () => {
    expect(runs.flatMap((r) => r.stuck).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Math.max(...runs.map((r) => r.maxHunters))).toBeLessThanOrEqual(MAX_HUNTERS);
    const wrecks: Record<WreckCause, number> = { gun: 0, mine: 0, ram: 0, blast: 0, wall: 0, suddenDeath: 0 };
    for (const r of runs) for (const k of Object.keys(wrecks) as WreckCause[]) wrecks[k] += r.wrecks[k];
    // 7 wrecks per fight (a draw at the time limit leaves more cars running).
    expect(Object.values(wrecks).reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(6 * runs.length);
    for (const k of ['gun', 'mine', 'ram', 'wall'] as const) expect(wrecks[k]).toBeGreaterThan(0);
  });
});
