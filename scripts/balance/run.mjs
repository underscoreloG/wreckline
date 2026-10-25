// WP12 balance probes: `node scripts/balance/run.mjs` prints the health-metric table and exits 1 if a row misses its target.
// Options: --seeds N (16), --starts N (4 grid rotations), --tracks a,b, --loadout soak|rival, --skip-races, --skip-career,
// --driver S (careerSim player driver skill), --calibrate (careerSim playerSkill calibration instead of the table), --out DIR (default: a temp dir).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const config = 'scripts/balance/vitest.config.mjs';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? fallback : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(`--${name}`);
const seeds = arg('seeds', '16');
const starts = arg('starts', '4');
const loadout = arg('loadout', 'soak');
const out = arg('out', mkdtempSync(join(tmpdir(), 'wreckline-balance-')));
// Registry order, read from the track index so the probe never pins the list.
const allTracks = [...readFileSync(join(root, 'src/content/tracks/index.ts'), 'utf8').matchAll(/^\s+(\w+): [A-Z_]+,$/gm)].map((m) => m[1]);
const tracks = arg('tracks', allTracks.join(',')).split(',');

function probe(file, env) {
  return new Promise((resolve, reject) => {
    const p = spawn('npx', ['vitest', 'run', '--config', config, file], { cwd: root, env: { ...process.env, BALANCE_OUT: out, BALANCE_SEEDS: seeds, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    p.stdout.on('data', (d) => (log += d));
    p.stderr.on('data', (d) => (log += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${file} ${JSON.stringify(env)} failed:\n${log.slice(-2000)}`))));
  });
}

async function pool(jobs, size) {
  const queue = [...jobs];
  await Promise.all(Array.from({ length: size }, async () => {
    while (queue.length) await queue.shift()();
  }));
}

const read = (name) => JSON.parse(readFileSync(join(out, name), 'utf8'));
const f = (x, d = 2) => (x === null ? '-' : x.toFixed(d));
const workers = Math.max(1, availableParallelism() - 1);

if (flag('calibrate')) {
  const variants = arg('variants', '').split(',').filter(Boolean);
  if (!variants.length) variants.push('base', 'skill:0.35', 'skill:0.65', 'skill:0.75', 'skill:0.95', 'engine:5', 'tires:5', 'armor:5', 'gun:5', 'fuel:5', 'spikes:3', 'car:scorch', 'car:titan', 'car:viper');
  await pool(variants.map((v) => () => probe('scripts/balance/calibrate.probe.mjs', { BALANCE_VARIANT: v })), workers);
  console.log('variant      races  avgPlace');
  for (const v of variants) {
    const r = read(`calib-${v.replace(':', '_')}.json`);
    console.log(`${v.padEnd(12)} ${String(r.races).padStart(5)}  ${f(r.avgPlace, 3)}`);
  }
  process.exit(0);
}

const jobs = [];
if (!flag('skip-races')) for (const t of tracks) jobs.push(() => probe('scripts/balance/races.probe.mjs', { BALANCE_TRACKS: t, BALANCE_STARTS: starts, BALANCE_LOADOUT: loadout }));
if (!flag('skip-career')) jobs.push(() => probe('scripts/balance/career.probe.mjs', arg('driver') ? { BALANCE_DRIVER: arg('driver') } : {}));
const t0 = Date.now();
await pool(jobs, workers);

const rows = [];
const row = (metric, value, target, pass) => rows.push({ metric, value, target, pass });

if (!flag('skip-races')) {
  const per = tracks.map((t) => {
    const races = read(`races-${t}.json`);
    const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
    const placeOf = (skill) => mean(races.flatMap((r) => r.places.filter((p) => p.skill === skill).map((p) => p.position)));
    // Start 0 is runSoak's grid, the one every referenceLapTime was measured on; rotated grids leave a 0.55 car stuck behind the 0.35 (slow laps without contact).
    const laps = races.filter((r) => r.start === 0).flatMap((r) => r.mediumCleanLaps).sort((a, b) => a - b);
    const m = laps.length >> 1;
    const median = laps.length === 0 ? null : laps.length % 2 ? laps[m] : (laps[m - 1] + laps[m]) / 2;
    const ref = Number(readFileSync(join(root, `src/content/tracks/${t}.ts`), 'utf8').match(/referenceLapTime: ([\d.]+)/)?.[1] ?? NaN);
    return {
      t,
      n: races.length,
      wrecks: mean(races.map((r) => r.wrecks)),
      walls: mean(races.map((r) => r.wallImpacts)),
      mines: mean(races.map((r) => r.mineHits)),
      gun: races.reduce((s, r) => s + r.gunDamage, 0),
      dmg: races.reduce((s, r) => s + r.totalDamage, 0),
      spread: placeOf(0.35) - placeOf(0.75),
      median,
      clean: laps.length,
      ref,
      timeouts: races.filter((r) => r.endReason === 'timeout').length,
      shove: mean(races.map((r) => r.shove)),
      longest: Math.max(...races.map((r) => r.longestShove)),
      longShoves: races.filter((r) => r.longestShove > 10).length,
    };
  });
  console.log(`track            races  wrecks  walls  mineHits  gunShare  spread  medianLap start 0 (n)  ref   delta  timeouts  shove m/race (longest s, races > 10 s)`);
  for (const p of per)
    console.log(
      `${p.t.padEnd(16)} ${String(p.n).padStart(5)}  ${f(p.wrecks).padStart(6)}  ${f(p.walls).padStart(5)}  ${f(p.mines).padStart(8)}  ${f(p.gun / p.dmg).padStart(8)}  ${f(p.spread).padStart(6)}  ${f(p.median).padStart(9)} (${p.clean})`.padEnd(98) +
        `${String(p.ref).padStart(5)}  ${p.median === null ? '-' : f(p.median - p.ref).padStart(5)}  ${String(p.timeouts).padStart(8)}  ${f(p.shove, 1)} (${f(p.longest, 1)}, ${p.longShoves})`,
    );
  console.log('');
  const all = (k) => per.reduce((s, p) => s + p[k] * p.n, 0) / per.reduce((s, p) => s + p.n, 0);
  const gunShare = per.reduce((s, p) => s + p.gun, 0) / per.reduce((s, p) => s + p.dmg, 0);
  const minW = Math.min(...per.map((p) => p.wrecks));
  const maxW = Math.max(...per.map((p) => p.wrecks));
  row('Wrecks per AI race (every track)', `${f(minW)}-${f(maxW)} (avg ${f(all('wrecks'))})`, '0.2-2.0', minW >= 0.2 && maxW <= 2.0);
  row('Gun damage share', f(gunShare), '0.45-0.65', gunShare >= 0.45 && gunShare <= 0.65);
  const mines = all('mines');
  row('Mine hits per race', f(mines), '0.8-3', mines >= 0.8 && mines <= 3);
  const minSpread = Math.min(...per.map((p) => p.spread));
  row('AI finish spread 0.75 vs 0.35 (worst track)', `${f(minSpread)} (${per.find((p) => p.spread === minSpread)?.t})`, '>= 0.8', minSpread >= 0.8);
  const deltas = per.map((p) => (p.median === null ? Infinity : Math.abs(p.median - p.ref)));
  const worst = Math.max(...deltas);
  row('Lap time |median - referenceLapTime| (worst)', `${f(worst)} s (${per[deltas.indexOf(worst)]?.t})`, '<= 1 s', worst <= 1);
  const timeouts = per.reduce((s, p) => s + p.timeouts, 0);
  // Report only: not a WP12 metric, and the cause sits in ai.ts behaviour outside WP12's constants (see the tuning log).
  console.log(`Timeouts (WP07 gate, report only): ${timeouts}${timeouts ? ' ' + JSON.stringify(per.filter((p) => p.timeouts).map((p) => p.t)) : ''}\n`);
}

if (!flag('skip-career')) {
  const g = read('career-greedy.json');
  const s = read('career-safe.json');
  const sorted = (xs) => [...xs].sort((a, b) => a - b).join(' ');
  row('Career greedy: champion in 18-35 races', `${g.inWindow}/${g.seeds} (races ${sorted(g.races)})`, `>= 14/16`, g.inWindow >= 14);
  row('Career safe: champion in 25-50 or never by 60', `${s.passing}/${s.seeds} (champions ${s.champions})`, `${s.seeds}/${s.seeds}`, s.passing === s.seeds);
  row('Greedy cash by race 5 (start + payouts, worst seed)', `${g.race5IncomeMin}`, `>= ${g.race5Need}`, g.race5IncomeMin >= g.race5Need);
}

const w = Math.max(...rows.map((r) => r.metric.length));
const wv = Math.max(...rows.map((r) => r.value.length));
console.log(`${'metric'.padEnd(w)}  ${'value'.padEnd(wv)}  target      result`);
for (const r of rows) console.log(`${r.metric.padEnd(w)}  ${r.value.padEnd(wv)}  ${r.target.padEnd(10)}  ${r.pass ? 'PASS' : 'FAIL'}`);
console.log(`\n${rows.filter((r) => r.pass).length}/${rows.length} inside target (${seeds} seeds, ${starts} starts, loadout ${loadout}, ${((Date.now() - t0) / 1000).toFixed(0)} s, raw JSON in ${out})`);
process.exit(rows.every((r) => r.pass) ? 0 : 1);
