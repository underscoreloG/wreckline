import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, it } from 'vitest';
import { TRACKS } from '../../src/content/tracks';
import { initPhysics } from '../../src/sim/index';
import { runProbeRace } from './races';

// Driven by run.mjs through env vars; one process per track so the tracks run in parallel.
const env = process.env;
const tracks = env.BALANCE_TRACKS ? env.BALANCE_TRACKS.split(',') : Object.keys(TRACKS);
const seeds = Number(env.BALANCE_SEEDS ?? 16);
const starts = Number(env.BALANCE_STARTS ?? 4);
const loadout = (env.BALANCE_LOADOUT ?? 'soak');
const difficulty = env.BALANCE_DIFFICULTY;
const out = env.BALANCE_OUT ?? 'balance-out';

beforeAll(async () => {
  await initPhysics();
});

it('races probe', () => {
  mkdirSync(out, { recursive: true });
  for (const trackId of tracks) {
    const races = [];
    for (let seed = 1; seed <= seeds; seed++) for (let start = 0; start < starts; start++) races.push(runProbeRace({ trackId, seed, start, loadout, difficulty }));
    writeFileSync(join(out, `races-${trackId}.json`), JSON.stringify(races));
  }
}, 3_600_000);
