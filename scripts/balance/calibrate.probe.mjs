import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, it } from 'vitest';
import { profileForSkill } from '../../src/content/ai';
import { getCar } from '../../src/content/cars';
import { computeStats } from '../../src/content/economy';
import { soakSetup } from '../../src/sim/soak';
import { initPhysics } from '../../src/sim/index';
import { runRace } from './races';

/**
 * careerSim playerSkill calibration: one car with a variant (a skill or an upgrade line) against three stock
 * 0.55 ravens; its average place, rotated over the 4 grid slots, says what the variant is worth in skill.
 */
const FIELD_SKILL = 0.55;
const env = process.env;
const variant = env.BALANCE_VARIANT ?? 'base';
const tracks = (env.BALANCE_TRACKS ?? 'scrapyard,dockside,junkyardSprint,pineHollow').split(',');
const seeds = Number(env.BALANCE_SEEDS ?? 16);
const out = env.BALANCE_OUT ?? 'balance-out';
const NONE = { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 };

/** 'skill:0.75', 'engine:5' (any upgrade line), 'car:viper', or 'base'. */
function parse(v) {
  const [k, n] = v.split(':');
  const base = { skill: FIELD_SKILL, upgrades: NONE, car: null };
  if (k === 'skill') return { ...base, skill: Number(n) };
  if (k === 'car') return { ...base, car: n };
  if (k && k in NONE) return { ...base, upgrades: { ...NONE, [k]: Number(n) } };
  return base;
}

beforeAll(async () => {
  await initPhysics();
});

it('calibration probe', () => {
  const v = parse(variant);
  const places = [];
  for (const trackId of tracks)
    for (let seed = 1; seed <= seeds; seed++)
      for (let focus = 0; focus < 4; focus++) {
        const setup = soakSetup({ trackId, seed });
        setup.entrants.forEach((e, i) => {
          e.ai = profileForSkill(i === focus ? v.skill : FIELD_SKILL);
          if (i !== focus) return;
          const car = getCar(v.car ?? e.carDefId);
          e.carDefId = car.id;
          e.stats = computeStats(car, v.upgrades);
          e.mesh = { ...car.mesh, spikes: v.upgrades.spikes };
          e.hp = e.stats.maxHp;
        });
        places.push(runRace(setup).places.find((p) => p.car === focus)?.position ?? 4);
      }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, `calib-${variant.replace(':', '_')}.json`), JSON.stringify({ variant, races: places.length, avgPlace: places.reduce((s, x) => s + x, 0) / places.length }));
}, 3_600_000);
