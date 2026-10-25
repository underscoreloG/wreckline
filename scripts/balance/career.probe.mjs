import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { careerSummary } from './career';

const env = process.env;
const seeds = Number(env.BALANCE_SEEDS ?? 16);
const out = env.BALANCE_OUT ?? 'balance-out';
const driver = env.BALANCE_DRIVER ? Number(env.BALANCE_DRIVER) : undefined;

it('career probe', () => {
  mkdirSync(out, { recursive: true });
  for (const policy of ['greedy', 'safe']) writeFileSync(join(out, `career-${policy}.json`), JSON.stringify(careerSummary(policy, seeds, driver)));
});
