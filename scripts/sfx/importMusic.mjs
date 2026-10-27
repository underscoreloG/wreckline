#!/usr/bin/env node
// WP35 music import (dev machine only, needs Homebrew ffmpeg). Reads the source files of TRACKS (<id>.<any ext>) from
// a folder outside the repo (default art-incoming/music, gitignored), writes public/music/<id>.ogg (Opus, 96 kbps
// stereo), public/music/manifest.json (loop points) and the music section of docs/sfx-sources.md.
// The game plays a file from 0 and jumps from loopEnd back to loopStart without a crossfade, so the music after
// loopEnd in the file must be the music after loopStart. Per track `loop`:
// - 'file': the artist made the whole track loop end to start. The file gets the track's first LEAD + TAIL s again
//   after its end, so loopStart = LEAD and loopEnd = the track length + LEAD jump between identical samples.
// - 'repeat': the track holds a sample-identical repeat. Per-band log energies (BANDS bands, 23 ms frames) score
//   every lag of at least MIN_LOOP of the track by how well the WINDOW s after a frame match the WINDOW s one lag
//   later; the longest lag within LAG_TOL of the best score wins, refined to the sample by waveform correlation, and
//   loopStart goes where the two repeats differ least.
// - 'bars': no identical repeat. The same search, then the lag snapped to whole bars of `bpm` and refined on the
//   bass (under LOW_HZ), and loopStart just before the strongest bass onset in the first two bars: a musical edit
//   on the beat, like a looped phrase.
// The file ends TAIL s after loopEnd, so a decoder that places samples a few ms differently still finds music there.
// Loop points are measured on the decoded file. Loudness: integrated BS.1770 (K-weighting as in importSfx.mjs, 400 ms
// blocks, -70 LUFS and -10 LU gates) of the loop. One gain per track puts every track on the same level: the loudest
// level every track reaches with its peak under CEILING_DB. The game sets the music level against the race sounds
// (MIX.bus.music in src/audio/mix.ts).
// Usage: node scripts/sfx/importMusic.mjs [source folder]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IN_DIR = path.resolve(process.argv[2] ?? path.join(ROOT, 'art-incoming', 'music'));
const OUT_DIR = path.join(ROOT, 'public', 'music');
const DOC = path.join(ROOT, 'docs', 'sfx-sources.md');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

// Every page was checked for CC0 on the download date. `from`: seconds of the source cut off before everything else.
const DOWNLOADED = '2026-10-27';
const TRACKS = [
  // Page: "This music is loopable"; 128 s is 88 bars at 165 bpm.
  { id: 'darknessRoad', use: 'race', loop: 'file', title: 'Darkness Road', artist: 'MintoDog', page: 'https://opengameart.org/content/darkness-road', source: 'darkness_road_bpm165.flac' },
  // Fades out at its end. minLoop: the whole main body, from the end of the intro to the end of the break (108 bars).
  { id: 'systemOverload', use: 'race', loop: 'bars', bpm: 154, minLoop: 0.8, title: 'system_overload (T & T Free Cyberpunk Pack 2)', artist: 'Alexander Ehlers (tricksntraps)', page: 'https://opengameart.org/node/119238', source: 'system_overload_154bpm.ogg' },
  // Page: "This music is loopable"; 120 s is 80 bars at 160 bpm.
  { id: 'hotRoadway', use: 'race', loop: 'file', title: 'Hot Roadway', artist: 'MintoDog', page: 'https://opengameart.org/content/hot-roadway', source: 'hot_roadway_bpm160.flac' },
  // Page: "It also loops perfectly"; the file is two identical halves.
  { id: 'awake', use: 'race', loop: 'repeat', title: 'Awake! (Megawall-10)', artist: 'cynicmusic', page: 'https://opengameart.org/content/awake-megawall-10', source: 'awake10_megaWall.mp3' },
  { id: 'glutton', use: 'race', loop: 'repeat', title: 'Glutton', artist: 'Kistol', page: 'https://opengameart.org/content/glutton', source: 'Glutton.ogg' },
  // Page: "The action dies off just as it gets started". Only the 303 part from 28 s on is kept and looped.
  { id: 'hyperflight', use: 'race', loop: 'bars', bpm: 134, from: 28, title: 'Hyperflight Racing', artist: 'cynicmusic', page: 'https://opengameart.org/content/hyperflight-racing', source: '2012_november_fakeAwake04 back to A minor.wav' },
  // Page: "Loopable". An MP3: the track is 64 bars at 160 bpm (96 s) from its first sound.
  { id: 'hyperton', use: 'menu', loop: 'file', bars: 64, bpm: 160, title: 'Hyperton', artist: 'Sudocolon', page: 'https://opengameart.org/content/hyperton', source: 'Hyperton.mp3' },
];
const LICENCE = 'CC0 1.0';

const RATE = 44100; // analysis rate (every source is 44.1 kHz)
const OUT_RATE = 48000; // Opus decodes at 48 kHz
const BITRATE = '96k';
const FFT = 2048;
const HOP = 1024;
const BANDS = 24;
const BAND_LO = 60; // Hz
const BAND_HI = 16000; // Hz
const WINDOW = 8; // s compared after both loop points
const MIN_LOOP = 0.4; // share of the track the loop spans at least (a track's `minLoop` overrides it)
const LAG_TOL = 0.01; // score margin within which the longer loop wins
const XCORR = 1; // s of waveform for the sample refine
const SEAM = 2048; // samples after the loop points compared for the start pick and the seam figure
const LEAD = 1; // s, loopStart of a 'file' loop
const TAIL = 1; // s kept after loopEnd
const LOW_HZ = 200; // 'bars': the lag and the start follow the bass and kick
const ONSET_LEAD = 0.005; // s, 'bars' loopStart before the bass onset
const SILENT = 1e-4; // 'file' with `bars`: the track starts at its first sample above this
const FADE = 0.005; // s, fade-in where the source is cut (`from`) and fade-out at the file end
const CEILING_DB = -1.5; // sample peak; Opus overshoots it by a fraction of a dB
const PEAK_DB = -1;
const SEAM_MAX_DB = -15; // 'file', 'repeat': residual of the jump (music after loopEnd minus after loopStart) vs the music
const WRAP_MAX = 10; // 'file': the track's own wrap (last sample -> first) vs the median sample step
const BAND_LU = 0.5; // every decoded track within this of the target
const MAX_TOTAL = 16 * 1024 * 1024; // bytes

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const fail = (msg) => {
  console.error(`importMusic: ${msg}`);
  process.exit(1);
};

// PCM goes to ffmpeg through a temp file, as in importSfx.mjs (stdin hung now and then with ffmpeg 8.1 on macOS).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'importMusic-'));
process.on('exit', () => fs.rmSync(TMP, { recursive: true, force: true }));

function ffmpeg(args) {
  const r = spawnSync(FFMPEG, ['-nostdin', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1024 * 1024 * 1024 });
  if (r.status !== 0) fail(`ffmpeg ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/** Any audio file -> [left, right] Float32Arrays at `rate`. */
function decode(file, rate) {
  const buf = ffmpeg(['-i', file, '-ac', '2', '-ar', String(rate), '-f', 'f32le', '-']);
  const x = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const n = x.length >> 1;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) (l[i] = x[2 * i]), (r[i] = x[2 * i + 1]);
  return [l, r];
}

function encode([l, r], file) {
  const x = new Float32Array(l.length * 2);
  for (let i = 0; i < l.length; i++) (x[2 * i] = l[i]), (x[2 * i + 1] = r[i]);
  if (!x.every(Number.isFinite)) fail(`${file}: non-finite samples`);
  const pcm = path.join(TMP, 'in.f32');
  fs.writeFileSync(pcm, Buffer.from(x.buffer));
  ffmpeg(['-y', '-f', 'f32le', '-ar', String(RATE), '-ac', '2', '-i', pcm, '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', BITRATE, '-vbr', 'on', '-application', 'audio', '-ar', String(OUT_RATE), file]);
}

/** BS.1770 K-weighting (pre-filter shelf + RLB high-pass) for any sample rate, as in importSfx.mjs. */
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

/** Integrated loudness (LUFS, BS.1770-4 gating) and sample peak (dBFS) of channels[a..b). */
function loudness(chs, rate, a = 0, b = chs[0].length) {
  const k = chs.map((c) => kWeight(c.subarray(a, b), rate));
  const block = Math.round(0.4 * rate);
  const step = Math.round(0.1 * rate);
  const z = [];
  for (let s = 0; s + block <= b - a; s += step) {
    let sum = 0;
    for (const c of k) for (let i = s; i < s + block; i++) sum += c[i] * c[i];
    z.push(sum / block);
  }
  const lk = (v) => -0.691 + 10 * Math.log10(v);
  const mean = (arr) => arr.reduce((p, v) => p + v, 0) / arr.length;
  const abs = z.filter((v) => lk(v) > -70);
  const rel = lk(mean(abs)) - 10;
  const gated = abs.filter((v) => lk(v) > rel);
  let peak = 0;
  for (const c of chs) for (let i = a; i < b; i++) peak = Math.max(peak, Math.abs(c[i]));
  return { lufs: gated.length ? lk(mean(gated)) : -Infinity, peak: db(peak) };
}

/** In-place iterative radix-2 FFT. */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) ([re[i], re[j]] = [re[j], re[i]]), ([im[i], im[j]] = [im[j], im[i]]);
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

/** Per frame (HOP apart), BANDS log band energies, each band z-scored over the track, each frame unit length. */
function features(mono) {
  const frames = Math.floor((mono.length - FFT) / HOP) + 1;
  const edges = Array.from({ length: BANDS + 1 }, (_v, i) => Math.round(((BAND_LO * (BAND_HI / BAND_LO) ** (i / BANDS)) * FFT) / RATE));
  const f = Array.from({ length: frames }, () => new Float64Array(BANDS));
  const re = new Float64Array(FFT);
  const im = new Float64Array(FFT);
  for (let t = 0; t < frames; t++) {
    for (let i = 0; i < FFT; i++) (re[i] = mono[t * HOP + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1)))), (im[i] = 0);
    fft(re, im);
    for (let b = 0; b < BANDS; b++) {
      let e = 0;
      for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) e += re[k] * re[k] + im[k] * im[k];
      f[t][b] = Math.log10(e + 1e-9);
    }
  }
  for (let b = 0; b < BANDS; b++) {
    let m = 0;
    for (const v of f) m += v[b];
    m /= frames;
    let sd = 0;
    for (const v of f) sd += (v[b] - m) ** 2;
    sd = Math.sqrt(sd / frames) || 1;
    for (const v of f) v[b] = (v[b] - m) / sd;
  }
  for (const v of f) {
    const n = Math.hypot(...v) || 1;
    for (let b = 0; b < BANDS; b++) v[b] /= n;
  }
  return f;
}

/** Best (start frame, lag frames, score): the WINDOW after `start` matches the WINDOW after `start + lag`. */
function bestRepeat(f, minLoop) {
  const n = f.length;
  const w = Math.round((WINDOW * RATE) / HOP);
  const per = [];
  const sim = new Float64Array(n);
  for (let lag = Math.ceil(minLoop * n); lag + w <= n; lag++) {
    for (let t = 0; t + lag < n; t++) {
      let d = 0;
      for (let b = 0; b < BANDS; b++) d += f[t][b] * f[t + lag][b];
      sim[t] = d;
    }
    let run = 0;
    for (let t = 0; t < w; t++) run += sim[t];
    let best = { start: 0, score: run / w };
    for (let s = 1; s + lag + w <= n; s++) {
      run += sim[s + w - 1] - sim[s - 1];
      if (run / w > best.score) best = { start: s, score: run / w };
    }
    per.push({ lag, ...best });
  }
  if (!per.length) fail('track too short for its loop window');
  const top = Math.max(...per.map((p) => p.score));
  return per.filter((p) => p.score >= top - LAG_TOL).reduce((a, p) => (p.lag > a.lag ? p : a));
}

/** Lag (samples) near `lag` with the best normalised waveform correlation of the XCORR s from `at`. */
function refineLag(x, at, lag, radius) {
  const m = Math.round(XCORR * RATE);
  let best = { lag, r: -2 };
  for (let d = -radius; d <= radius; d++) {
    let xy = 0, xx = 0, yy = 0;
    for (let i = at; i < at + m; i++) {
      const a = x[i];
      const b = x[i + lag + d];
      xy += a * b;
      xx += a * a;
      yy += b * b;
    }
    const r = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
    if (r > best.r) best = { lag: lag + d, r };
  }
  return best;
}

/** Squared difference of the SEAM samples after p and after p + lag, both channels. */
function residual(chs, p, lag) {
  let d = 0;
  for (const c of chs) for (let k = 0; k < SEAM; k++) d += (c[p + k] - c[p + lag + k]) ** 2;
  return d;
}

/** Start in [from, to) where the two repeats differ least (prefix sums over the SEAM window). */
function quietestSeam(chs, from, to, lag) {
  const n = to - from + SEAM;
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let d = 0;
    for (const c of chs) d += (c[from + i] - c[from + i + lag]) ** 2;
    pre[i + 1] = pre[i] + d;
  }
  let best = from;
  let bestD = Infinity;
  for (let p = from; p < to; p++) {
    const d = pre[p - from + SEAM] - pre[p - from];
    if (d < bestD) (bestD = d), (best = p);
  }
  return best;
}

/** Residual of the jump vs the music after loopStart, in dB. */
function seamDb(chs, start, lag) {
  let e = 0;
  for (const c of chs) for (let k = 0; k < SEAM; k++) e += c[start + k] ** 2;
  return 10 * Math.log10(residual(chs, start, lag) / e);
}

/** RBJ low-pass biquad at `hz`, twice (12 dB/oct x 2). */
function lowPass(x, hz) {
  const w = (2 * Math.PI * hz) / RATE;
  const al = Math.sin(w) / Math.SQRT2;
  const a0 = 1 + al;
  const [b0, b1, a1, a2] = [(1 - Math.cos(w)) / 2 / a0, (1 - Math.cos(w)) / a0, (-2 * Math.cos(w)) / a0, (1 - al) / a0];
  let y = x;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(y.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = b0 * y[i] + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = y[i]; y2 = y1; y1 = v; out[i] = v;
    }
    y = out;
  }
  return y;
}

/** Sample of the strongest rise in energy (256-sample frames) within [from, to). */
function strongestOnset(x, from, to) {
  const n = 256;
  let prev = -Infinity;
  let best = { at: from, rise: -Infinity };
  for (let p = from; p + n <= to; p += n) {
    let e = 0;
    for (let i = p; i < p + n; i++) e += x[i] * x[i];
    const l = Math.log10(e + 1e-12);
    if (l - prev > best.rise) best = { at: p, rise: l - prev };
    prev = l;
  }
  return best.at;
}

/** Median absolute step between neighbouring samples. */
function medianStep(x) {
  const steps = [];
  for (let i = 0; i + 1 < x.length; i += 7) steps.push(Math.abs(x[i + 1] - x[i]));
  return steps.sort((p, q) => p - q)[steps.length >> 1];
}

if (!fs.existsSync(IN_DIR)) fail(`source folder ${IN_DIR} not found`);
const items = [];
for (const t of TRACKS) {
  const name = fs.readdirSync(IN_DIR).find((f) => path.parse(f).name === t.id);
  if (!name) fail(`missing source ${t.id}.* in ${IN_DIR}`);
  const full = decode(path.join(IN_DIR, name), RATE);
  const from = Math.round((t.from ?? 0) * RATE);
  let chs = full.map((c) => c.slice(from));
  const mono = chs[0].map((v, i) => (v + chs[1][i]) / 2);
  let start;
  let lag;
  let match;
  if (t.loop === 'file') {
    // The track is [a, a + len); its head is written again after it.
    let a = 0;
    if (t.bars) while (a < mono.length && Math.abs(mono[a]) < SILENT) a++;
    const len = t.bars ? Math.round(((t.bars * 240) / t.bpm) * RATE) : mono.length;
    if (a + len > mono.length) fail(`${t.id}: ${t.bars} bars at ${t.bpm} bpm run past the file end`);
    const pred = 2 * mono[a + len - 1] - mono[a + len - 2];
    match = `wrap ${(Math.abs(pred - mono[a]) / medianStep(mono)).toFixed(2)}`;
    if (Math.abs(pred - mono[a]) / medianStep(mono) > WRAP_MAX) fail(`${t.id}: the track's own wrap jumps (${match})`);
    const extra = Math.round((LEAD + TAIL) * RATE);
    chs = chs.map((c) => {
      const out = new Float32Array(a + len + extra);
      out.set(c.subarray(0, a + len));
      out.set(c.subarray(a, a + extra), a + len);
      return out;
    });
    start = a + Math.round(LEAD * RATE);
    lag = len;
  } else {
    const rep = bestRepeat(features(mono), t.minLoop ?? MIN_LOOP);
    const coarse = refineLag(mono, rep.start * HOP, rep.lag * HOP, HOP);
    if (t.loop === 'repeat') {
      const searchEnd = Math.min((rep.start + Math.round((WINDOW * RATE) / HOP)) * HOP - SEAM, mono.length - coarse.lag - SEAM);
      start = quietestSeam(chs, rep.start * HOP, searchEnd, coarse.lag);
      lag = coarse.lag;
      match = `xcorr ${coarse.r.toFixed(3)}`;
    } else {
      const bar = (240 / t.bpm) * RATE;
      const bars = Math.round(coarse.lag / bar);
      const low = lowPass(mono, LOW_HZ);
      const onset = strongestOnset(low, rep.start * HOP, Math.round(rep.start * HOP + 2 * bar));
      start = Math.max(0, onset - Math.round(ONSET_LEAD * RATE));
      const fine = refineLag(low, start, Math.round(bars * bar), Math.round(0.005 * RATE));
      lag = fine.lag;
      match = `${bars} bars, bass r ${fine.r.toFixed(2)}`;
    }
  }
  const end = start + lag;
  const keep = Math.min(chs[0].length, end + Math.round(TAIL * RATE));
  const cut = chs.map((c) => c.slice(0, keep));
  const fade = Math.round(FADE * RATE);
  for (const c of cut)
    for (let i = 0; i < fade; i++) {
      if (from > 0) c[i] *= i / fade;
      c[c.length - 1 - i] *= i / fade;
    }
  const src = loudness(chs, RATE, start, end);
  const { peak } = loudness(cut, RATE);
  items.push({ t, srcSeconds: full[0].length / RATE, from, cut, start, lag, match, src, peak, seamSrc: seamDb(chs, start, lag) });
}

const target = Math.min(...items.map((it) => it.src.lufs + CEILING_DB - it.peak));

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const ratio = OUT_RATE / RATE;
const manifest = { tracks: {} };
const rows = [];
let total = 0;
let bad = 0;
for (const it of items) {
  const g = 10 ** ((target - it.src.lufs) / 20);
  const file = path.join(OUT_DIR, `${it.t.id}.ogg`);
  encode(it.cut.map((c) => c.map((v) => v * g)), file);
  const back = decode(file, OUT_RATE);
  // The same loop on the decoded file: the start mapped to 48 kHz, the lag searched again a few samples around.
  const start = Math.round(it.start * ratio);
  const guess = Math.round(it.lag * ratio);
  let lag = guess;
  for (let d = -8; d <= 8; d++) if (residual(back, start, guess + d) < residual(back, start, lag)) lag = guess + d;
  const end = start + lag;
  if (end + SEAM > back[0].length) fail(`${it.t.id}: decoded file is shorter than its loop`);
  const out = loudness(back, OUT_RATE, start, end);
  const seam = seamDb(back, start, lag);
  const size = fs.statSync(file).size;
  total += size;
  const duration = back[0].length / OUT_RATE;
  manifest.tracks[it.t.id] = { file: `${it.t.id}.ogg`, use: it.t.use, loopStart: start / OUT_RATE, loopEnd: end / OUT_RATE, duration };
  const ok = out.peak <= PEAK_DB && (it.t.loop === 'bars' || seam <= SEAM_MAX_DB) && Math.abs(out.lufs - target) <= BAND_LU;
  if (!ok) bad++;
  rows.push([
    it.t.id,
    it.t.use,
    it.t.loop,
    it.srcSeconds.toFixed(1),
    (it.from / RATE).toFixed(1),
    (start / OUT_RATE).toFixed(3),
    (end / OUT_RATE).toFixed(3),
    (lag / OUT_RATE).toFixed(3),
    duration.toFixed(1),
    it.match,
    it.seamSrc.toFixed(1),
    seam.toFixed(1),
    it.src.lufs.toFixed(1),
    out.lufs.toFixed(1),
    out.peak.toFixed(1),
    (size / 1024).toFixed(0),
    ok ? 'ok' : 'FAIL',
  ]);
}

const manifestFile = path.join(OUT_DIR, 'manifest.json');
fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
total += fs.statSync(manifestFile).size;

// match: 'file' the track's own wrap step vs the median step, 'repeat' the waveform correlation at the lag, 'bars' the
// loop in bars and the bass correlation at the lag. seam: residual of the jump on the source and on the decoded file
// (dB under the music; a 'bars' loop is a musical edit, so its seam is not limited).
const head = ['id', 'use', 'loop', 'src_s', 'cut_s', 'loopStart', 'loopEnd', 'loop_s', 'file_s', 'match', 'seam_src', 'seam', 'src_LUFS', 'LUFS', 'peak', 'kB', ''];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
for (const r of [head, ...rows]) console.log(r.map((c, i) => (i < 3 || i === 9 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  '));
console.log(`loudness target ${target.toFixed(1)} LUFS integrated for every loop (band +-${BAND_LU} LU); seam limit ${SEAM_MAX_DB} dB`);
console.log(`total public/music ${(total / 1024).toFixed(0)} kB with the manifest (limit ${(MAX_TOTAL / 1024).toFixed(0)} kB)`);

// The music section replaces anything from its heading to the end of docs/sfx-sources.md.
const HEADING = '## Music';
const doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '# Sound sources\n';
const kept = doc.includes(HEADING) ? doc.slice(0, doc.indexOf(HEADING)) : `${doc.trimEnd()}\n\n`;
const section = [
  HEADING,
  '',
  'Generated by `node scripts/sfx/importMusic.mjs`; do not edit by hand.',
  'Every file in `public/music/` was cut to its loop, loudness-matched and encoded (Opus) by that script from the OpenGameArt download.',
  '',
  '| id | use | title | artist | OpenGameArt page | file | licence | downloaded |',
  '|---|---|---|---|---|---|---|---|',
  ...TRACKS.map((t) => `| ${t.id} | ${t.use} | ${t.title} | ${t.artist} | ${t.page} | ${t.source} | ${LICENCE} | ${DOWNLOADED} |`),
  '',
].join('\n');
fs.writeFileSync(DOC, kept + section);

if (total > MAX_TOTAL) fail(`public/music is ${(total / 1024).toFixed(0)} kB, over ${(MAX_TOTAL / 1024).toFixed(0)} kB`);
if (bad) fail(`${bad} track(s) with a peak over ${PEAK_DB} dBFS, a 'file' or 'repeat' seam over ${SEAM_MAX_DB} dB or off the loudness target`);
