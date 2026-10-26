#!/usr/bin/env node
// WP28 recorded engine import (dev machine only, needs Homebrew ffmpeg). Reads art-incoming/engines/sources.csv and
// art-incoming/engines/<car>/<slot>.mp3, writes public/sfx/engines/<car>/<slot>.mp3, public/sfx/engines/manifest.json
// and the engines section of docs/sfx-sources.md. The game reads only the manifest: a new car is its files, its
// sources.csv rows and one row in CARS below.
// Per file: decode to mono 44.1 kHz, estimate the firing frequency, pick the steadiest window (level and pitch
// variance), cut a loop of 1-3 s whose end matches its start (best correlation) and crossfade the tail into the head.
// Every loop gets one gain so all steps of all cars share one loudness (K-weighted, BS.1770) with peaks under -3 dBFS;
// the game sets the level against the synth engines. The file holds the loop with 50 ms of its own tail before and
// of its own head after, so a decoder that trims MP3 padding a few samples differently still loops seamlessly;
// loopStart/loopEnd are measured on the decoded file.
// Usage: node scripts/sfx/importEngines.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IN_DIR = path.join(ROOT, 'art-incoming', 'engines');
const OUT_DIR = path.join(ROOT, 'public', 'sfx', 'engines');
const DOC = path.join(ROOT, 'docs', 'sfx-sources.md');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

// One row per car. cylinders: 4-stroke firing frequency f = rpm / 60 * cylinders / 2. Per slot: load ('on' full load,
// 'off' zero load, 'any' one load only) and the rpm the source page states, or a hint where it states none. The
// firing frequency is searched within +-40% of the stated or hinted rpm (less than an octave, so no octave errors).
const CARS = {
  blaze: {
    engine: 'Mercedes 190E-16V, 4 cylinders, dyno',
    cylinders: 4,
    slots: {
      '500_on': { load: 'on', stated: 500 },
      '2500_on': { load: 'on', stated: 2500 },
      '6500_on': { load: 'on', stated: 6500 },
      '500_off': { load: 'off', stated: 500 },
      '2500_off': { load: 'off', stated: 2500 },
      '6500_off': { load: 'off', stated: 6500 },
    },
  },
  iceberg: {
    engine: 'BMW 120d diesel, 4 cylinders, outside mic',
    cylinders: 4,
    slots: { idle: { load: 'any', hint: 800 }, low: { load: 'any', hint: 1500 }, mid: { load: 'any', hint: 2200 }, high: { load: 'any', hint: 3000 } },
  },
  titan: {
    engine: 'city bus diesel, 6 cylinders',
    cylinders: 6,
    slots: { idle: { load: 'any', hint: 600 }, low: { load: 'any', hint: 1200 }, mid: { load: 'any', stated: 2000 } },
  },
};

const RATE = 44100;
const LICENCE = 'CC0 1.0';
const MIN_LOOP = 1; // s
const MAX_LOOP = 3; // s
const XF = 0.05; // s, tail-into-head crossfade
const PAD = 0.05; // s of cyclic padding on each side of the loop in the file
const EDGE = 0.05; // s skipped at both ends of the source
const LOOP_SEARCH = 0.1; // s, the loop end moves back by up to this much to match its start
const SEARCH_SPAN = 1.4; // firing frequency search: stated or hinted value / 1.4 .. x 1.4
const FRAME = 0.1; // s, steadiness frames
const HOP = 0.02; // s
const PITCH_SPAN = 1.12; // per frame pitch search around the file's firing frequency
const PERIODIC = 0.5; // frames with a weaker best correlation have no reliable pitch
const PEAK_DB = -3;
const CEILING_DB = PEAK_DB - 0.5; // MP3 encoding overshoots the PCM peak by up to ~0.5 dB
const STEP_BAND_DB = 2; // steps of a car within this loudness band
const SEAM_MAX = 3; // seam jump / median step of the loop
const MAX_TOTAL = 1024 * 1024; // bytes

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const fail = (msg) => {
  console.error(`importEngines: ${msg}`);
  process.exit(1);
};
const median = (a) => {
  const s = Float64Array.from(a).sort();
  return s.length ? s[s.length >> 1] : 0;
};
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = a.reduce((s, v) => s + v, 0) / a.length;
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

/** sources.csv: car,slot,freesound_id,author,page,licence,preview_url; double-quoted fields allowed. */
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
  const want = 'car,slot,freesound_id,author,page,licence,preview_url';
  const [head, ...lines] = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (parse(head).join() !== want) fail(`sources.csv header is "${head}", expected ${want}`);
  return lines.map(parse).map(([car, slot, id, author, page, licence, preview]) => ({ car, slot, id, author, page, licence, preview }));
}

// PCM goes to ffmpeg through a temp file, as in importSfx.mjs (stdin hung now and then with ffmpeg 8.1 on macOS).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'importEngines-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) fail(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

const toFloats = (buf) => new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

/** Any audio file -> mono Float32Array at RATE; `filter` is an optional ffmpeg -af chain. */
function decode(file, filter) {
  return toFloats(ffmpeg(['-i', file, ...(filter ? ['-af', filter] : []), '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']));
}

function encode(samples, file) {
  if (!samples.every(Number.isFinite)) fail(`${file}: non-finite samples`);
  const pcm = path.join(TMP, 'in.f32');
  fs.writeFileSync(pcm, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
  ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '1', '-i', pcm, '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', String(RATE), '-ac', '1', file]);
}

/** BS.1770 K-weighting (pre-filter shelf + RLB high-pass), as in importSfx.mjs. */
function kWeight(x) {
  const biquad = (b0, b1, b2, a1, a2, input) => {
    const y = new Float64Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const v = b0 * input[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = input[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  let K = Math.tan((Math.PI * 1681.974450955533) / RATE);
  let Q = 0.7071752369554196;
  const Vh = 10 ** (3.999843853973347 / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const shelf = biquad((Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0, x);
  K = Math.tan((Math.PI * 38.13547087602444) / RATE);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  return biquad(1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0, shelf);
}

/** Peak (dBFS), RMS (dBFS) and loudness (LUFS over the whole steady loop). */
function measure(x) {
  let peak = 0;
  let ss = 0;
  for (const v of x) {
    peak = Math.max(peak, Math.abs(v));
    ss += v * v;
  }
  const k = kWeight(x);
  let ks = 0;
  for (const v of k) ks += v * v;
  return { peak: db(peak), rms: 10 * Math.log10(ss / x.length), lufs: -0.691 + 10 * Math.log10(ks / k.length) };
}

/** Normalised correlation of x[a..a+n) and x[b..b+n). */
function corr(x, a, b, n) {
  let xy = 0, xx = 0, yy = 0;
  for (let i = 0; i < n; i++) {
    xy += x[a + i] * x[b + i];
    xx += x[a + i] ** 2;
    yy += x[b + i] ** 2;
  }
  return xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
}

/** Best periodicity of x[s..s+n) between fLo and fHi: { hz, r } (parabolic interpolation between lags). */
function period(x, s, n, fLo, fHi) {
  const lo = Math.floor(RATE / fHi);
  const hi = Math.ceil(RATE / fLo);
  const r = new Float64Array(hi + 2);
  let best = lo;
  for (let lag = lo - 1; lag <= hi + 1; lag++) {
    r[lag] = corr(x, s, s + lag, n);
    if (lag >= lo && lag <= hi && r[lag] > r[best]) best = lag;
  }
  const [a, b, c] = [r[best - 1], r[best], r[best + 1]];
  const d = a - 2 * b + c;
  return { hz: RATE / (best + (d < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / d)) : 0)), r: b };
}

/** In-place radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const [wr, wi] = [Math.cos(ang * k), Math.sin(ang * k)];
        const [a, b] = [i + k, i + k + len / 2];
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

const FFT_N = 16384; // 2.7 Hz bins

/** Mean magnitude spectrum of Hann-windowed FFT_N frames (50% overlap) of x. */
function spectrum(x) {
  const acc = new Float64Array(FFT_N / 2);
  for (let s = 0; s + FFT_N <= x.length; s += FFT_N / 2) {
    const re = new Float64Array(FFT_N);
    const im = new Float64Array(FFT_N);
    for (let i = 0; i < FFT_N; i++) re[i] = x[s + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_N - 1)));
    fft(re, im);
    for (let k = 0; k < FFT_N / 2; k++) acc[k] += Math.hypot(re[k], im[k]);
  }
  return acc;
}

/** Strongest spectral line between fLo and fHi, Hz (parabolic interpolation on log magnitude). */
function spectralPeak(spec, fLo, fHi) {
  const bin = RATE / FFT_N;
  let best = Math.ceil(fLo / bin);
  for (let k = best; k <= Math.floor(fHi / bin); k++) if (spec[k] > spec[best]) best = k;
  const [a, b, c] = [spec[best - 1], spec[best], spec[best + 1]].map((v) => Math.log(v + 1e-12));
  const d = a - 2 * b + c;
  return (best + (d < 0 ? (0.5 * (a - c)) / d : 0)) * bin;
}

function centroid(spec) {
  let num = 0;
  let den = 0;
  for (let k = 1; k < spec.length; k++) (num += k * spec[k]), (den += spec[k]);
  return den > 0 ? (num / den) * (RATE / FFT_N) : 0;
}

/** Cut the steadiest loop of one source and shape its seam. */
function cutLoop(name, raw, lp, firingRef) {
  const edge = Math.round(EDGE * RATE);
  const xf = Math.round(XF * RATE);
  const search = Math.round(LOOP_SEARCH * RATE);
  const maxLag = Math.ceil((RATE * SEARCH_SPAN) / firingRef) + 2;
  const usable = raw.length - 2 * edge - maxLag;
  const loopLen = Math.min(Math.round(MAX_LOOP * RATE), usable - xf);
  if (loopLen < MIN_LOOP * RATE) fail(`${name}: ${(raw.length / RATE).toFixed(2)} s is too short for a ${MIN_LOOP} s loop`);

  // Firing frequency: the best periodicity, or for a source with no clear period (noisy, high rpm) the strongest
  // spectral line in the same range.
  const [fLo, fHi] = [firingRef / SEARCH_SPAN, firingRef * SEARCH_SPAN];
  const firingIn = (s, n) => {
    const p = period(lp, s, n, fLo, fHi);
    return p.r >= PERIODIC ? { ...p, by: 'acf' } : { hz: spectralPeak(spectrum(lp.subarray(s, s + n)), fLo, fHi), r: p.r, by: 'fft' };
  };
  // The file's firing frequency (whole usable span), then a pitch and level per frame around it.
  const whole = firingIn(edge, usable);
  const frame = Math.round(FRAME * RATE);
  const hop = Math.round(HOP * RATE);
  const frames = [];
  for (let s = edge; s + frame + maxLag < raw.length - edge; s += hop) {
    let ss = 0;
    for (let i = s; i < s + frame; i++) ss += raw[i] ** 2;
    const p = period(lp, s, frame, whole.hz / PITCH_SPAN, whole.hz * PITCH_SPAN);
    frames.push({ s, levelDb: 10 * Math.log10(ss / frame + 1e-20), semis: 12 * Math.log2(p.hz), periodic: p.r >= PERIODIC });
  }
  const pitched = frames.filter((f) => f.periodic).length >= frames.length / 2;

  // Steadiest window: level spread (dB) + pitch spread (semitones) over the frames inside it.
  const win = loopLen + xf;
  let start = edge;
  let bestScore = Infinity;
  for (let s = edge; s + win + maxLag + edge <= raw.length; s += hop) {
    const inside = frames.filter((f) => f.s >= s && f.s + frame <= s + win);
    const score = sd(inside.map((f) => f.levelDb)) + (pitched ? sd(inside.filter((f) => f.periodic).map((f) => f.semis)) : 0);
    if (score < bestScore) (bestScore = score), (start = s);
  }
  const inWin = frames.filter((f) => f.s >= start && f.s + frame <= start + win);
  const firing = firingIn(start, win);

  // Loop end: the length (up to LOOP_SEARCH shorter) whose next XF match the loop's first XF best, preferring
  // ends where the natural step into the next sample is at most the median step (the step the seam will play).
  let medStep = 0;
  {
    const steps = new Float64Array(loopLen - 1);
    for (let i = 0; i + 1 < loopLen; i++) steps[i] = Math.abs(raw[start + i + 1] - raw[start + i]);
    medStep = median(steps);
  }
  let len = loopLen;
  let rho = -Infinity;
  for (const quiet of [true, false]) {
    for (let L = loopLen; L >= loopLen - search; L--) {
      if (quiet && Math.abs(raw[start + L] - raw[start + L - 1]) > medStep) continue;
      const c = corr(raw, start, start + L, xf);
      if (c > rho) (rho = c), (len = L);
    }
    if (rho > -Infinity) break;
  }
  // Tail into head. Weights keep the power constant for the measured correlation: linear when the two match
  // (rho 1), equal power when they are unrelated (rho 0).
  const p = Math.max(0, Math.min(1, rho));
  const loop = raw.slice(start, start + len);
  for (let i = 0; i < xf; i++) {
    const u = 0.5 - 0.5 * Math.cos((Math.PI * i) / xf);
    const v = 1 - u;
    const k = 1 / Math.sqrt(u * u + v * v + 2 * p * u * v);
    loop[i] = k * (u * raw[start + i] + v * raw[start + len + i]);
  }
  return {
    loop,
    at: start / RATE,
    firing,
    rho,
    centroid: centroid(spectrum(raw.subarray(start, start + win))),
    levelSd: sd(inWin.map((f) => f.levelDb)),
    pitchSd: pitched ? sd(inWin.filter((f) => f.periodic).map((f) => f.semis)) : NaN,
  };
}

/** Loop with PAD of its own tail before and its own head after. */
function cyclic(loop) {
  const pad = Math.round(PAD * RATE);
  const out = new Float32Array(loop.length + 2 * pad);
  for (let i = 0; i < out.length; i++) out[i] = loop[(((i - pad) % loop.length) + loop.length) % loop.length];
  return out;
}

/** Sample offset of `decoded` against `written` (what a decoder adds or trims at the start), within +-2048. */
function decoderOffset(written, decoded) {
  const n = Math.min(RATE / 2, written.length - 4096);
  let best = 0;
  let bestC = -Infinity;
  for (let d = -2048; d <= 2048; d++) {
    let xy = 0;
    for (let i = 2048; i < n; i++) xy += written[i] * (decoded[i + d] ?? 0);
    if (xy > bestC) (bestC = xy), (best = d);
  }
  return best;
}

const csvFile = path.join(IN_DIR, 'sources.csv');
if (!fs.existsSync(csvFile)) fail(`${csvFile} not found`);
const sources = readCsv(csvFile);
for (const s of sources) {
  if (!CARS[s.car]?.slots[s.slot]) fail(`sources.csv row ${s.car}/${s.slot} is not in CARS`);
  if (s.licence !== LICENCE) fail(`${s.car}/${s.slot}: licence "${s.licence}" is not "${LICENCE}"`);
}

const items = [];
for (const [car, def] of Object.entries(CARS)) {
  for (const [slot, sd_] of Object.entries(def.slots)) {
    const src = sources.find((s) => s.car === car && s.slot === slot);
    if (!src) fail(`missing sources.csv row for ${car}/${slot}`);
    const file = path.join(IN_DIR, car, `${slot}.mp3`);
    if (!fs.existsSync(file)) fail(`missing file art-incoming/engines/${car}/${slot}.mp3`);
    const raw = decode(file);
    // Pitch from a low-passed copy: the firing pulses, not the exhaust hiss.
    const lp = decode(file, 'highpass=f=10,lowpass=f=1200');
    const ref = sd_.stated ?? sd_.hint;
    const cut = cutLoop(`${car}/${slot}`, raw, lp, (ref * def.cylinders) / 120);
    items.push({ car, slot, def: sd_, src, raw, cut, rpm: Math.round((cut.firing.hz * 120) / def.cylinders), m: measure(cut.loop) });
  }
}

// One loudness for every loop: the loudest level every loop reaches with its peak at the ceiling.
const target = Math.min(...items.map((it) => it.m.lufs + CEILING_DB - it.m.peak));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
let total = 0;
let bad = 0;
const rows = [];
const manifest = { cars: {} };
for (const it of items) {
  const g = 10 ** ((target - it.m.lufs) / 20);
  const written = cyclic(it.cut.loop.map((v) => v * g));
  const rel = `${it.car}/${it.slot}.mp3`;
  const file = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  encode(written, file);
  const back = decode(file);
  const d = decoderOffset(written, back);
  const ls = Math.round(PAD * RATE) + d;
  const le = ls + it.cut.loop.length;
  if (le > back.length) fail(`${rel}: decoded file is shorter than its loop`);
  const loopBack = back.subarray(ls, le);
  const m = measure(loopBack);
  const steps = new Float64Array(loopBack.length - 1);
  for (let i = 0; i + 1 < loopBack.length; i++) steps[i] = Math.abs(loopBack[i + 1] - loopBack[i]);
  const seam = Math.abs(back[ls] - back[le - 1]) / median(steps);
  const size = fs.statSync(file).size;
  total += size;
  it.out = { m, seam, size };
  (manifest.cars[it.car] ??= { steps: [] }).steps.push({
    slot: it.slot,
    file: rel,
    rpm: it.rpm,
    load: it.def.load,
    loopStart: ls / RATE,
    loopEnd: le / RATE,
  });
  const ok = seam <= SEAM_MAX && m.peak <= PEAK_DB;
  if (!ok) bad++;
  const ref = it.def.stated ? `${it.def.stated} page` : `${it.def.hint} hint`;
  rows.push([
    it.car,
    it.slot,
    it.def.load,
    (it.raw.length / RATE).toFixed(2),
    it.cut.at.toFixed(2),
    (it.cut.loop.length / RATE).toFixed(3),
    it.cut.firing.hz.toFixed(1),
    `${it.cut.firing.by} ${it.cut.firing.r.toFixed(2)}`,
    String(it.rpm),
    ref,
    it.cut.levelSd.toFixed(2),
    Number.isNaN(it.cut.pitchSd) ? '-' : it.cut.pitchSd.toFixed(2),
    it.cut.rho.toFixed(2),
    it.m.rms.toFixed(1),
    String(Math.round(it.cut.centroid)),
    m.lufs.toFixed(1),
    m.rms.toFixed(1),
    m.peak.toFixed(1),
    seam.toFixed(2),
    (size / 1024).toFixed(1),
    ok ? 'ok' : 'FAIL',
  ]);
}

for (const [car, set] of Object.entries(manifest.cars)) {
  const l = items.filter((it) => it.car === car).map((it) => it.out.m.lufs);
  if (Math.max(...l) - Math.min(...l) > STEP_BAND_DB) (bad++, console.error(`${car}: steps spread over ${(Math.max(...l) - Math.min(...l)).toFixed(1)} dB`));
  for (const load of new Set(set.steps.map((s) => s.load))) {
    const rpms = set.steps.filter((s) => s.load === load).map((s) => s.rpm);
    if (new Set(rpms).size !== rpms.length) fail(`${car}: two ${load} steps at the same rpm estimate`);
  }
  if (set.steps.some((s) => s.load === 'any') && set.steps.some((s) => s.load !== 'any')) fail(`${car}: mixes 'any' with on/off loads`);
  set.steps.sort((a, b) => (a.load === b.load ? a.rpm - b.rpm : a.load < b.load ? -1 : 1));
}

const head = ['car', 'slot', 'load', 'src_s', 'at_s', 'loop_s', 'fire_Hz', 'by r', 'rpm_est', 'rpm_ref', 'lvl_sd', 'semi_sd', 'xf_rho', 'src_rms', 'src_cent', 'LUFS', 'rms', 'peak', 'seam', 'kB', ''];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
for (const r of [head, ...rows]) console.log(r.map((c, i) => (i < 3 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  '));
console.log(`loudness target ${target.toFixed(1)} LUFS for every loop (steps within ${STEP_BAND_DB} dB per car); seam = wrap step / median step (limit ${SEAM_MAX})`);
console.log(`total public/sfx/engines ${(total / 1024).toFixed(1)} kB with the manifest (limit ${(MAX_TOTAL / 1024).toFixed(0)} kB)`);

const manifestFile = path.join(OUT_DIR, 'manifest.json');
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
total += fs.statSync(manifestFile).size;

// The engines section replaces anything from its heading to the end of docs/sfx-sources.md.
const HEADING = '## Engines';
const doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '# Sound sources\n';
const kept = doc.includes(HEADING) ? doc.slice(0, doc.indexOf(HEADING)) : `${doc.trimEnd()}\n\n`;
const section = [
  HEADING,
  '',
  'Generated by `node scripts/sfx/importEngines.mjs` from `art-incoming/engines/sources.csv`; do not edit by hand.',
  'Every file in `public/sfx/engines/` is a loop cut, made mono and loudness-matched by that script from a Freesound HQ preview.',
  '',
  '| car | slot | engine | author | Freesound page | licence |',
  '|---|---|---|---|---|---|',
  ...items.map((it) => `| ${it.car} | ${it.slot} | ${CARS[it.car].engine} | ${it.src.author} | ${it.src.page} | ${it.src.licence} |`),
  '',
].join('\n');
fs.writeFileSync(DOC, kept + section);

if (total > MAX_TOTAL) fail(`public/sfx/engines is ${(total / 1024).toFixed(1)} kB, over 1 MB`);
if (bad) fail(`${bad} problem(s): seam over ${SEAM_MAX}x the median step, peak over ${PEAK_DB} dBFS or steps spread over ${STEP_BAND_DB} dB`);
