#!/usr/bin/env node
// WP16 sound import (dev machine only, needs Homebrew ffmpeg). Reads art-incoming/sfx/sources.csv and the
// "Import table (WP16 reads this)" in specs/sfx/list.md, writes public/sfx/<name>.mp3 and docs/sfx-sources.md.
// Per sound: decode to mono 44.1 kHz, trim silence below -50 dBFS at both ends, cut to target_s with a 10 ms
// fade-out (loops: 50 ms crossfade of the tail into the head), then a gain to its category's loudness level;
// a sound whose peak would pass -3 dBFS at that gain goes through a lookahead limiter at -3 dBFS. The table is
// measured on the encoded files (decoded back), so it shows what the game plays.
// Loudness: K-weighted (BS.1770) max over a 400 ms sliding window (the clip length if shorter). EBU "short-term"
// uses 3 s, longer than almost every clip here, so it would measure the clip length instead of its loudness.
// Usage: node scripts/sfx/importSfx.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IN_DIR = path.join(ROOT, 'art-incoming', 'sfx');
const OUT_DIR = path.join(ROOT, 'public', 'sfx');
const DOC = path.join(ROOT, 'docs', 'sfx-sources.md');
const LIST = path.join(ROOT, 'specs', 'sfx', 'list.md');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const RATE = 44100;
const SILENCE_DB = -50;
const FADE_OUT = 0.01; // s
const LOOP_XFADE = 0.05; // s
const PEAK_DB = -3;
const CEILING_DB = PEAK_DB - 0.5; // limiter ceiling: MP3 encoding overshoots the PCM peak by up to ~0.6 dB
const BAND_LU = 2;
const MAX_LIMIT_DB = 6; // most peak reduction any sound gets to reach its category level
const WINDOW = 0.4; // s, loudness window
const HOP = 0.01; // s
const MAX_TOTAL = 1.5 * 1024 * 1024; // bytes
const LICENCE = 'Pixabay Content License';
// name -> why another licence was accepted. Empty: every sound must carry LICENCE.
const LICENCE_NOTES = {};
// Rows that may be missing from art-incoming: the game keeps the synth for them.
const OPTIONAL = new Set(['skid']);

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const fail = (msg) => {
  console.error(`importSfx: ${msg}`);
  process.exit(1);
};

/** The import table: rows of name, category, kind, target_s, channels. */
function readTable() {
  const md = fs.readFileSync(LIST, 'utf8');
  const start = md.indexOf('## Import table (WP16 reads this)');
  if (start < 0) fail('import table not found in specs/sfx/list.md');
  const rest = md.slice(start + 3);
  const end = rest.indexOf('\n## ');
  const rows = (end < 0 ? rest : rest.slice(0, end))
    .split('\n')
    .filter((l) => l.startsWith('|') && !l.startsWith('|---'))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const [head, ...body] = rows;
  const want = ['name', 'category', 'kind', 'target_s', 'channels'];
  if (head?.join() !== want.join()) fail(`import table columns are ${head?.join()}, expected ${want.join()}`);
  return body.map(([name, category, kind, target, channels]) => ({ name, category, kind, target: Number(target), channels }));
}

/** sources.csv with double-quoted fields allowed. */
function readCsv(file) {
  const parse = (line) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q && c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = !q;
      else if (c === ',' && !q) out.push(cur), (cur = '');
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const [head, ...lines] = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (parse(head).join() !== 'name,url,title,licence') fail(`sources.csv header is "${head}", expected name,url,title,licence`);
  return new Map(lines.map(parse).map(([name, url, title, licence]) => [name, { name, url, title, licence }]));
}

// PCM goes to ffmpeg through a temp file: feeding it on stdin hung now and then (ffmpeg 8.1, macOS).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'importSfx-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));
const PCM_IN = ['-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i'];

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) fail(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

function pcmFile(x) {
  const file = path.join(TMP, 'in.f32');
  fs.writeFileSync(file, Buffer.from(x.buffer, x.byteOffset, x.byteLength));
  return file;
}

const toFloats = (buf) => new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

/** Any audio file -> mono Float32Array at RATE. */
function decode(file) {
  return toFloats(ffmpeg(['-i', file, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']));
}

function encode(samples, file) {
  if (!samples.every(Number.isFinite)) fail(`${file}: non-finite samples`);
  ffmpeg(['-y', ...PCM_IN, pcmFile(samples), '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', String(RATE), '-ac', '1', file]);
}

/** BS.1770 K-weighting (pre-filter shelf + RLB high-pass) for any sample rate. */
function kWeight(x, fs) {
  const biquad = (b0, b1, b2, a1, a2, input) => {
    const y = new Float64Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const v = b0 * input[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = input[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  let Q = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad((Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0, x);
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return biquad(1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0, shelf);
}

/** Peak (dBFS) and loudness (LUFS, max over the sliding window). */
function measure(x) {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const k = kWeight(x, RATE);
  const win = Math.min(k.length, Math.round(WINDOW * RATE));
  const hop = Math.round(HOP * RATE);
  let best = 0;
  for (let s = 0; s + win <= k.length; s += hop) {
    let sum = 0;
    for (let i = s; i < s + win; i++) sum += k[i] * k[i];
    best = Math.max(best, sum / win);
  }
  return { peak: db(peak), lufs: best > 0 ? -0.691 + 10 * Math.log10(best) : -Infinity };
}

/** Trim, cut and fade (or crossfade for loops). */
function shape(x, row) {
  const thr = 10 ** (SILENCE_DB / 20);
  let a = 0;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  let b = x.length - 1;
  while (b > a && Math.abs(x[b]) < thr) b--;
  if (a >= x.length) fail(`${row.name}: the file is silent below ${SILENCE_DB} dBFS`);
  const target = Math.round(row.target * RATE);
  if (row.kind === 'loop') {
    const xf = Math.round(LOOP_XFADE * RATE);
    if (b - a + 1 < target + xf) fail(`${row.name}: loop needs ${row.target + LOOP_XFADE} s of sound`);
    const out = x.slice(a, a + target);
    // The 50 ms after the loop end fade into the loop start, so the wrap point is continuous.
    for (let i = 0; i < xf; i++) {
      const t = i / xf;
      out[i] = out[i] * Math.sqrt(t) + x[a + target + i] * Math.sqrt(1 - t);
    }
    return out;
  }
  const out = x.slice(a, Math.min(b + 1, a + target));
  const fade = Math.min(out.length, Math.round(FADE_OUT * RATE));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

const table = readTable();
const csvFile = path.join(IN_DIR, 'sources.csv');
if (!fs.existsSync(csvFile)) fail(`${csvFile} not found`);
const sources = readCsv(csvFile);
for (const name of sources.keys()) if (!table.some((r) => r.name === name)) fail(`sources.csv row "${name}" is not in the import table`);

const items = [];
for (const row of table) {
  const src = sources.get(row.name);
  const file = ['.mp3', '.wav'].map((e) => path.join(IN_DIR, row.name + e)).find((f) => fs.existsSync(f));
  if (!src && !file && OPTIONAL.has(row.name)) {
    console.log(`${row.name}: optional and absent, stays synth`);
    continue;
  }
  if (!file) fail(`missing file art-incoming/sfx/${row.name}.mp3 (or .wav)`);
  if (!src) fail(`missing sources.csv row for ${row.name}`);
  if (src.licence !== LICENCE && !LICENCE_NOTES[row.name]) fail(`${row.name}: licence "${src.licence}" is not "${LICENCE}" and has no note in LICENCE_NOTES`);
  if (row.channels !== 'mono') fail(`${row.name}: channels "${row.channels}" not supported (mono only)`);
  const raw = decode(file);
  const cut = shape(raw, row);
  items.push({ row, src, raw, cut, m: measure(cut) });
}

/** Lookahead limiter at CEILING_DB (ffmpeg alimiter, delay compensated, no auto level). */
function limit(x) {
  const f = `alimiter=limit=${10 ** (CEILING_DB / 20)}:level=0:latency=1`;
  return toFloats(ffmpeg([...PCM_IN, pcmFile(x), '-af', f, '-f', 'f32le', '-'])).slice(0, x.length);
}

/** The cut at `gainDb`, through the limiter when its peak would pass CEILING_DB. `drive` = dB over the ceiling. */
function render(it, gainDb) {
  const g = 10 ** (gainDb / 20);
  const x = it.cut.map((v) => v * g);
  const drive = Math.max(0, it.m.peak + gainDb - CEILING_DB);
  return { x: drive > 0 ? limit(x) : x, drive };
}

// Per category level: the median loudness the sounds reach with their peak at -3 dBFS, lowered so that the
// peakiest sound (clicks, clanks) gets there with at most MAX_LIMIT_DB of drive into the limiter.
const peakGain = (it) => CEILING_DB - it.m.peak;
const level = new Map();
for (const cat of new Set(items.map((it) => it.row.category))) {
  const inCat = items.filter((it) => it.row.category === cat);
  const r = inCat.map((it) => it.m.lufs + peakGain(it)).sort((a, b) => a - b);
  const reachable = Math.min(...inCat.map((it) => measure(render(it, peakGain(it) + MAX_LIMIT_DB).x).lufs));
  level.set(cat, Math.min(r[Math.floor((r.length - 1) / 2)], reachable + 1));
}

/** Gain that lands the sound on its category level; limited sounds lose loudness, so iterate. */
function fit(it) {
  const target = level.get(it.row.category);
  let gainDb = target - it.m.lufs;
  let out = render(it, gainDb);
  for (let i = 0; i < 6 && out.drive > 0; i++) {
    const miss = target - measure(out.x).lufs;
    if (Math.abs(miss) < 0.1) break;
    gainDb = Math.min(gainDb + miss, peakGain(it) + MAX_LIMIT_DB);
    out = render(it, gainDb);
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
let total = 0;
let bad = 0;
const rows = [];
for (const it of items) {
  const { x: out, drive } = fit(it);
  const file = path.join(OUT_DIR, `${it.row.name}.mp3`);
  encode(out, file);
  const back = decode(file);
  const m = measure(back);
  const size = fs.statSync(file).size;
  total += size;
  const dur = back.length / RATE;
  const ok = dur <= it.row.target + 0.03 && m.peak <= PEAK_DB && Math.abs(m.lufs - level.get(it.row.category)) <= BAND_LU + 0.5;
  if (!ok) bad++;
  rows.push([it.row.name, it.row.category, (it.raw.length / RATE).toFixed(2), dur.toFixed(3), it.row.target.toFixed(2), m.peak.toFixed(1), m.lufs.toFixed(1), (m.lufs - level.get(it.row.category)).toFixed(1), drive.toFixed(1), (size / 1024).toFixed(1), ok ? 'ok' : 'FAIL']);
}

const head = ['name', 'category', 'src_s', 'out_s', 'target_s', 'peak_dB', 'LUFS', 'vs_cat', 'limit_dB', 'kB', ''];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
for (const r of [head, ...rows]) console.log(r.map((c, i) => (i < 2 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  '));
for (const [cat, l] of level) console.log(`category ${cat.padEnd(8)} level ${l.toFixed(1)} LUFS (band +-${BAND_LU} LU)`);
console.log(`total public/sfx ${(total / 1024).toFixed(1)} kB (limit ${(MAX_TOTAL / 1024).toFixed(0)} kB)`);

const doc = [
  '# Sound sources',
  '',
  'Generated by `node scripts/sfx/importSfx.mjs` from `art-incoming/sfx/sources.csv`; do not edit by hand.',
  'Every file in `public/sfx/` was trimmed, cut, made mono and loudness-matched by that script.',
  '',
  '| name | title | URL | licence |',
  '|---|---|---|---|',
  ...items.map(({ src }) => `| ${src.name} | ${src.title.replace(/\|/g, '\\|')} | ${src.url} | ${src.licence}${LICENCE_NOTES[src.name] ? ` (${LICENCE_NOTES[src.name]})` : ''} |`),
  '',
].join('\n');
// The "## Engines" section to the end is written by importEngines.mjs (WP28): keep it (CCR from WP28).
const prev = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
const engines = prev.indexOf('\n## Engines');
fs.mkdirSync(path.dirname(DOC), { recursive: true });
fs.writeFileSync(DOC, engines >= 0 ? doc + prev.slice(engines) : doc);

if (total > MAX_TOTAL) fail('public/sfx is over 1.5 MB');
if (bad) fail(`${bad} sound(s) outside their length, peak or loudness band`);
