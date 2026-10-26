import { CARS } from '../content/cars';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { Sim, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { createFakeSim } from '../sim';
import { setRpm, stepMix, sweepAt, SWEEP_SECONDS } from './bench';
import { buildBus } from './bus';
import { createEngineVoice, ENGINE_GAIN_PLAYER, type EngineVoice } from './engine';
import { DEFAULT_PROFILE_ID, engineProfile } from './engineProfiles';
import { engineSet, recordedCars, type EngineSet } from './engineSets';
import { createAudioEngine } from './index';
import { fundamentalHz, spectralCentroid } from './measure';
import { createRecordedEngineVoice, loopOffset } from './recordedEngine';
import { playSound, soundSource } from './samples';
import { playSfx, SFX_NAMES, type SfxName } from './sfx';
import { createSkidVoice, SKID_GAIN } from './skid';

const MAX_STEPS = 5; // per frame, as in the game loop
const FRAME_MS = 16; // setTimeout, not rAF: a hidden pane pauses rAF, and a page playing audio is not timer-throttled
const CHECK_RATE = 48000;
const CHECK_SECONDS = 3;
// A fresh DynamicsCompressorNode starts far below unity gain and settles over ~0.5 s, so sounds start after it settles.
const CHECK_START = 0.5;
const SILENCE_DB = -60;
// Engine profiles (WP25): level at mid rpm on throttle, character (fundamental, centroid) at two rpms.
const PROFILE_LEVEL_RPM = 0.5;
const PROFILE_CHAR_RPMS = [0.2, 0.8] as const;
const PROFILE_MAX_DB_FROM_RAVEN = 3;
const CHAR_AT = 1.2; // s, the voice has settled (slowest revTau x 3 after CHECK_START)
const CHAR_SAMPLES = 8192;
const DISTINCT = 0.05; // two profiles closer than 5% on both fundamental and centroid at one rpm count as the same
const SWEEP_SETS = 80; // scheduled set() calls per sweep
// Recorded engines (WP28): level at three rpms on throttle, held long enough for every loop to wrap at least once.
const RECORDED_RPMS = [0.2, 0.5, 0.8] as const;
const RECORDED_SECONDS = 12;
const WRAP_WINDOW = 0.002; // s around each loop wrap
const STEP_PERCENTILE = 0.999;
// Sharpest step at a wrap / the render's 99.9th percentile step. A window of ordinary sound scores about 1 (the
// control: the same windows half a loop later); a discontinuity at the loop point would score several times that.
const SEAM_OK = 1.5;

export interface SoundCheck {
  name: string;
  source: 'sample' | 'synth';
  duration: number; // s above -60 dBFS
  peakDb: number;
  rmsDb: number; // over the audible span
  ok: boolean; // audible (peak > -40 dBFS) and no sample above 0 dBFS
}

export interface ProfileCheck {
  car: string;
  peakDb: number;
  rmsDb: number;
  fromRavenDb: number;
  /** [rpm01, fundamental Hz, centroid Hz] per PROFILE_CHAR_RPMS, throttle on. */
  character: [number, number, number][];
  ok: boolean; // audible, peak <= 0 dBFS, rms within +-3 dB of raven
}

export interface RecordedCheck {
  car: string;
  /** [rpm01, peak dBFS, rms dBFS, seam, seam control] per RECORDED_RPMS, throttle on. */
  levels: [number, number, number, number, number][];
  fromRavenDb: number; // rms at rpm01 0.5 vs raven's synth
  ok: boolean; // peak <= 0 dBFS everywhere, rms within +-3 dB of raven, every seam <= SEAM_OK
}

const db = (v: number): number => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** `car`'s engine voice: its recorded set when asked and loaded, else its synth profile. */
function engineVoice(ctx: BaseAudioContext, dest: AudioNode, now: number, car: string, recorded: boolean): EngineVoice {
  const set = recorded ? engineSet(car) : undefined;
  return set ? createRecordedEngineVoice(ctx, dest, now, set, engineProfile(car)) : createEngineVoice(ctx, dest, now, engineProfile(car));
}

/** One engine voice for `carDefId`, held at rpm01 and throttle, through the real bus. */
async function renderEngine(carDefId: string, rpm01: number, throttle: number, turbo = false, recorded = false): Promise<AudioBuffer> {
  const seconds = recorded ? RECORDED_SECONDS : CHECK_SECONDS;
  const off = new OfflineAudioContext(2, CHECK_RATE * seconds, CHECK_RATE);
  const bus = buildBus(off);
  const v = engineVoice(off, bus.race, CHECK_START, carDefId, recorded);
  v.set({ rpm01, throttle, turbo, gain: ENGINE_GAIN_PLAYER, pan: 0 }, CHECK_START);
  v.stop(recorded ? seconds - 0.1 : CHECK_START + 1.5);
  return off.startRendering();
}

/**
 * Clicks at the loop points of a held recorded render: the sharpest sample step within 2 ms of every predicted wrap
 * of every sounding loop, over the 99.9th percentile step of the whole steady render; and the same half a loop
 * later, away from any wrap, as a control.
 */
function seamMetric(buf: AudioBuffer, set: EngineSet, rpm01: number): [wrap: number, control: number] {
  const d = buf.getChannelData(0);
  const from = Math.round((CHECK_START + 0.3) * CHECK_RATE);
  const to = Math.round((RECORDED_SECONDS - 0.2) * CHECK_RATE);
  const step = (i: number): number => Math.abs(d[i + 1]! - d[i]!);
  const steps = Float64Array.from({ length: to - from }, (_v, k) => step(from + k)).sort();
  const ref = steps[Math.floor(STEP_PERCENTILE * steps.length)]!;
  const worst = [0, 0] as [number, number];
  stepMix(set.steps, setRpm(set.steps, rpm01), 1).forEach((m, i) => {
    if (m.gain <= 1e-3) return;
    const s = set.steps[i]!;
    const period = (s.loopEnd - s.loopStart) / m.rate;
    for (let t = CHECK_START + (s.loopEnd - loopOffset(s, 0)) / m.rate; t * CHECK_RATE < to; t += period)
      for (const j of [0, 1]) {
        const c = Math.round((t + (j * period) / 2) * CHECK_RATE);
        const w = Math.round(WRAP_WINDOW * CHECK_RATE);
        for (let k = Math.max(from, c - w); k <= Math.min(to - 1, c + w); k++) worst[j] = Math.max(worst[j]!, step(k) / ref);
      }
  });
  return worst;
}

/** Renders one sound through the real bus (master and sfx at 1) into an OfflineAudioContext and measures it. */
async function checkSound(name: SfxName | 'engine' | 'engineTurbo' | 'skid'): Promise<SoundCheck> {
  let buf: AudioBuffer;
  if (name === 'engine' || name === 'engineTurbo') {
    buf = await renderEngine(DEFAULT_PROFILE_ID, 0.9, 1, name === 'engineTurbo');
  } else {
    const off = new OfflineAudioContext(2, CHECK_RATE * CHECK_SECONDS, CHECK_RATE);
    const bus = buildBus(off);
    if (name === 'skid') {
      const v = createSkidVoice(off, bus.race, CHECK_START, 0);
      v.set(SKID_GAIN, 0, CHECK_START);
      v.stop(CHECK_START + 1);
    } else {
      playSound(off, bus.race, name, CHECK_START, 1, 0);
    }
    buf = await off.startRendering();
  }
  const m = measureLevels(buf);
  return {
    name,
    source: name === 'engine' || name === 'engineTurbo' || name === 'skid' ? 'synth' : soundSource(name),
    duration: m.duration,
    peakDb: round1(m.peakDb),
    rmsDb: round1(m.rmsDb),
    ok: m.peakDb > -40 && m.peak <= 1,
  };
}

/** Each car's profile: level vs raven at mid rpm, fundamental and centroid at low and high rpm. */
async function checkProfiles(): Promise<ProfileCheck[]> {
  const out: ProfileCheck[] = [];
  for (const car of Object.keys(CARS)) {
    const m = measureLevels(await renderEngine(car, PROFILE_LEVEL_RPM, 1));
    const character: [number, number, number][] = [];
    for (const rpm01 of PROFILE_CHAR_RPMS) {
      const seg = (await renderEngine(car, rpm01, 1)).getChannelData(0).subarray(CHAR_AT * CHECK_RATE, CHAR_AT * CHECK_RATE + CHAR_SAMPLES);
      character.push([rpm01, Math.round(fundamentalHz(seg, CHECK_RATE) * 10) / 10, Math.round(spectralCentroid(seg, CHECK_RATE))]);
    }
    out.push({ car, peakDb: round1(m.peakDb), rmsDb: round1(m.rmsDb), fromRavenDb: 0, character, ok: false });
  }
  const raven = out.find((c) => c.car === DEFAULT_PROFILE_ID)?.rmsDb ?? 0;
  for (const c of out) {
    c.fromRavenDb = round1(c.rmsDb - raven);
    c.ok = c.peakDb > -40 && c.peakDb <= 0 && Math.abs(c.fromRavenDb) <= PROFILE_MAX_DB_FROM_RAVEN;
  }
  return out;
}

/** Each loaded recorded set at RECORDED_RPMS on throttle: level, rms vs raven's synth at 0.5, seam metric. */
async function checkRecorded(ravenRmsDb: number): Promise<RecordedCheck[]> {
  const out: RecordedCheck[] = [];
  for (const car of recordedCars()) {
    const set = engineSet(car)!;
    const levels: RecordedCheck['levels'] = [];
    for (const rpm01 of RECORDED_RPMS) {
      const buf = await renderEngine(car, rpm01, 1, false, true);
      const m = measureLevels(buf);
      const [wrap, control] = seamMetric(buf, set, rpm01).map((v) => Math.round(v * 100) / 100) as [number, number];
      levels.push([rpm01, round1(m.peakDb), round1(m.rmsDb), wrap, control]);
    }
    const fromRavenDb = round1((levels.find(([r]) => r === PROFILE_LEVEL_RPM)?.[2] ?? -Infinity) - ravenRmsDb);
    const ok = levels.every(([, peak, , seam]) => peak <= 0 && seam <= SEAM_OK) && Math.abs(fromRavenDb) <= PROFILE_MAX_DB_FROM_RAVEN;
    out.push({ car, levels, fromRavenDb, ok });
  }
  return out;
}

/** Pairs of cars within 5% on both fundamental and centroid at some checked rpm. */
function sameSounding(checks: readonly ProfileCheck[]): string[] {
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= DISTINCT * Math.max(a, b);
  const pairs: string[] = [];
  checks.forEach((a, i) =>
    checks.slice(i + 1).forEach((b) => {
      if (a.character.some(([, fa, ca], k) => near(fa, b.character[k]![1]) && near(ca, b.character[k]![2]))) pairs.push(`${a.car}/${b.car}`);
    }),
  );
  return pairs;
}

/** Peak, audible span (above -60 dBFS) and RMS over that span, all channels. */
function measureLevels(buf: AudioBuffer): { peak: number; peakDb: number; rmsDb: number; duration: number } {
  const threshold = 10 ** (SILENCE_DB / 20);
  let peak = 0;
  let first = -1;
  let last = -1;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a > threshold) {
        if (first < 0 || i < first) first = i;
        if (i > last) last = i;
      }
    }
  }
  let sum = 0;
  let n = 0;
  if (first >= 0)
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = first; i <= last; i++) {
        sum += d[i] ** 2;
        n++;
      }
    }
  return {
    peak,
    peakDb: db(peak),
    rmsDb: n ? db(Math.sqrt(sum / n)) : -Infinity,
    duration: first < 0 ? 0 : (last - first + 1) / CHECK_RATE,
  };
}

/** ?harness=audio: a button per sound, fake race toggle, volume sliders, voice count, offline level check. */
export function mountAudioHarness(root: HTMLElement): void {
  // The page clips overflow (game layout), so the harness scrolls itself.
  root.style.cssText += ';color:#e8e8e8;font:14px/1.5 monospace;padding:16px;height:100vh;overflow:auto;box-sizing:border-box';
  const engine = createAudioEngine();
  const unlock = (): Promise<void> => engine.unlock();
  root.addEventListener('pointerdown', () => void unlock());

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', parent: HTMLElement = root): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    e.textContent = text;
    parent.appendChild(e);
    return e;
  };
  el('div', 'Audio harness - click anywhere once to unlock audio; "sample" plays the recorded file at its MIX level (what the game plays), "synth" the fallback recipe');
  const buttons = el('div');
  buttons.style.cssText = 'display:grid;grid-template-columns:max-content max-content max-content;gap:4px 8px;align-items:center;margin:12px 0';
  const labels: [HTMLButtonElement, SfxName][] = [];
  // Synth on the same bus node as engine.play, so the A/B only differs by source.
  const playSynth = async (name: SfxName): Promise<void> => {
    await unlock();
    const bus = engine.bus();
    if (bus) playSfx(bus.ctx, bus.sfx, name, bus.ctx.currentTime, 1, 0);
  };
  for (const name of SFX_NAMES) {
    el('span', name, buttons);
    const b = el('button', 'sample', buttons);
    labels.push([b, name]);
    b.dataset.sound = name;
    b.onclick = async () => {
      await unlock();
      engine.play(name);
    };
    const s = el('button', 'synth', buttons);
    s.dataset.synth = name;
    s.onclick = () => void playSynth(name);
  }

  // A 4 s rev sweep per car, scheduled ahead on the race bus: its recorded set (WP28) or its synth profile, picked
  // by the switch next to it (both at the game's level, so the A/B is loudness-matched).
  const sweeps = el('div');
  sweeps.style.cssText = 'display:grid;grid-template-columns:repeat(4,max-content);gap:4px 8px;margin:0 0 12px';
  const synthOnly = new Set<string>();
  const sweepCar = async (car: string, recorded = !synthOnly.has(car)): Promise<void> => {
    await unlock();
    await engine.samples();
    const bus = engine.bus();
    if (!bus) return;
    const t0 = bus.ctx.currentTime;
    const v = engineVoice(bus.ctx, bus.race, t0, car, recorded);
    for (let k = 0; k <= SWEEP_SETS; k++) {
      const t = (k / SWEEP_SETS) * SWEEP_SECONDS;
      v.set({ ...sweepAt(t), turbo: false, gain: ENGINE_GAIN_PLAYER, pan: 0 }, t0 + t);
    }
    v.stop(t0 + SWEEP_SECONDS + 0.1);
  };
  const switches: [HTMLButtonElement, string][] = [];
  for (const car of Object.keys(CARS)) {
    const b = el('button', `sweep ${car}`, sweeps);
    b.dataset.sweep = car;
    b.onclick = () => void sweepCar(car);
    const sw = el('button', '', sweeps);
    sw.dataset.source = car;
    sw.onclick = () => void (synthOnly.has(car) ? synthOnly.delete(car) : synthOnly.add(car));
    switches.push([sw, car]);
  }

  const sliders = el('div');
  let master = 1;
  let sfx = 1;
  for (const [label, set] of [
    ['master', (v: number) => (master = v)],
    ['sfx', (v: number) => (sfx = v)],
  ] as const) {
    const row = el('label', `${label} `, sliders);
    row.style.cssText = 'display:block';
    const input = el('input', '', row);
    input.type = 'range';
    input.min = '0';
    input.max = '1';
    input.step = '0.01';
    input.value = '1';
    input.oninput = () => {
      set(Number(input.value));
      engine.setVolumes(master, sfx);
    };
  }

  const raceBtn = el('button', 'fake race: off');
  raceBtn.style.cssText = 'margin:12px 0;display:block';
  const checkBtn = el('button', 'offline level check');
  const readout = el('pre');

  let sim: Sim | null = null;
  let timer = 0;
  let lastT = 0;
  let acc = 0;
  let maxVoices = 0;
  let livePeak = 0;
  let analyser: AnalyserNode | null = null;
  let scratch = new Float32Array(0);
  let checks: SoundCheck[] = [];
  let profiles: ProfileCheck[] = [];
  let recordedChecks: RecordedCheck[] = [];

  const newSim = (): Sim => createFakeSim(buildQuickRaceSetup({ seed: 1, laps: 3, aiCount: 3 }));
  const tick = (): void => {
    timer = window.setTimeout(tick, FRAME_MS);
    if (!sim) return;
    const t = performance.now();
    acc = Math.min(acc + (t - lastT) / 1000, MAX_STEPS * SIM_DT);
    lastT = t;
    const events: SimEvent[] = [];
    while (acc >= SIM_DT) {
      events.push(...sim.step(new Map()));
      acc -= SIM_DT;
    }
    engine.update(sim.snapshot(), events, 0);
    if (sim.result()) {
      sim.dispose();
      sim = newSim();
    }
    maxVoices = Math.max(maxVoices, engine.voices());
    if (analyser) {
      analyser.getFloatTimeDomainData(scratch);
      for (const v of scratch) livePeak = Math.max(livePeak, Math.abs(v));
    }
  };
  const startRace = async (): Promise<void> => {
    await unlock();
    const bus = engine.bus();
    if (bus && !analyser) {
      analyser = bus.ctx.createAnalyser();
      analyser.fftSize = 2048;
      scratch = new Float32Array(analyser.fftSize);
      bus.out.connect(analyser);
    }
    sim = newSim();
    lastT = performance.now();
    acc = 0;
    timer = window.setTimeout(tick, FRAME_MS);
    raceBtn.textContent = 'fake race: on';
  };
  const stopRace = (): void => {
    window.clearTimeout(timer);
    sim?.dispose();
    sim = null;
    engine.stopRace();
    raceBtn.textContent = 'fake race: off';
  };
  raceBtn.onclick = () => (sim ? stopRace() : void startRace());

  const runChecks = async (): Promise<SoundCheck[]> => {
    await unlock();
    await engine.samples();
    checks = [];
    for (const name of [...SFX_NAMES, 'engine', 'engineTurbo', 'skid'] as const) checks.push(await checkSound(name));
    profiles = await checkProfiles();
    recordedChecks = await checkRecorded(profiles.find((c) => c.car === DEFAULT_PROFILE_ID)?.rmsDb ?? 0);
    return checks;
  };
  checkBtn.onclick = () => void runChecks();

  const draw = (): void => {
    for (const [b, name] of labels) {
      b.textContent = soundSource(name) === 'sample' ? 'sample' : 'sample (not loaded: plays synth)';
    }
    for (const [sw, car] of switches) {
      sw.disabled = !engineSet(car);
      sw.textContent = !engineSet(car) ? 'synth (no recording)' : synthOnly.has(car) ? 'synth' : 'recorded';
    }
    const snap = sim?.snapshot();
    readout.textContent = [
      `context    ${engine.bus()?.ctx.state ?? 'locked'}`,
      `voices     ${engine.voices()}  (max seen ${maxVoices}, cap 48)`,
      `live peak  ${db(livePeak).toFixed(1)} dBFS`,
      snap ? `fake race  t=${snap.time.toFixed(1)} s phase=${snap.phase}` : 'fake race  off',
      '',
      ...checks.map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(15)} ${c.source.padEnd(6)} ${c.duration.toFixed(3)} s  peak ${c.peakDb} dBFS  rms ${c.rmsDb} dBFS`),
      ...(profiles.length
        ? [
            '',
            `engine profiles: rpm01 ${PROFILE_LEVEL_RPM} on throttle (rms vs raven, +-${PROFILE_MAX_DB_FROM_RAVEN} dB); fundamental / centroid at rpm01 ${PROFILE_CHAR_RPMS.join(' and ')}`,
            ...profiles.map(
              (c) =>
                `${c.ok ? 'ok  ' : 'FAIL'} ${c.car.padEnd(15)} peak ${c.peakDb} dBFS  rms ${c.rmsDb} dBFS (${c.fromRavenDb >= 0 ? '+' : ''}${c.fromRavenDb} dB)  ` +
                c.character.map(([r, fund, cen]) => `${r}: ${fund} Hz / ${cen} Hz`).join('  '),
            ),
            (() => {
              const same = sameSounding(profiles);
              return same.length ? `FAIL same-sounding (5%): ${same.join(', ')}` : 'ok   every pair differs by > 5% in fundamental or centroid';
            })(),
          ]
        : []),
      ...(recordedChecks.length
        ? [
            '',
            `recorded engines: peak / rms / seam (sharpest step at the loop wraps vs the render's ${STEP_PERCENTILE * 100}th percentile step, <= ${SEAM_OK}) at rpm01 ${RECORDED_RPMS.join(', ')} on throttle; rms vs raven's synth at ${PROFILE_LEVEL_RPM}`,
            ...recordedChecks.map(
              (c) =>
                `${c.ok ? 'ok  ' : 'FAIL'} ${c.car.padEnd(15)} ${c.fromRavenDb >= 0 ? '+' : ''}${c.fromRavenDb} dB vs raven  ` +
                c.levels.map(([r, peak, rmsDb, seam, control]) => `${r}: ${peak} / ${rmsDb} dBFS seam ${seam} (control ${control})`).join('  '),
            ),
          ]
        : []),
    ].join('\n');
  };
  const drawLoop = (): void => {
    draw();
    window.setTimeout(drawLoop, 250);
  };
  drawLoop();

  window.__harness = {
    engine,
    unlock,
    play: (name: SfxName) => engine.play(name),
    playSynth,
    ui: (s: Parameters<typeof engine.ui>[0]) => engine.ui(s),
    voices: () => engine.voices(),
    maxVoices: () => maxVoices,
    livePeakDb: () => db(livePeak),
    resetStats: () => {
      maxVoices = 0;
      livePeak = 0;
    },
    startFakeRace: startRace,
    stopFakeRace: stopRace,
    fakeRaceTime: () => sim?.snapshot().time ?? null,
    check: runChecks,
    profiles: () => profiles,
    sameSounding: () => sameSounding(profiles),
    sweepCar,
    recorded: () => recordedChecks,
    engines: () => engine.engines(),
    state: () => engine.bus()?.ctx.state ?? 'locked',
    sources: () => Object.fromEntries(SFX_NAMES.map((n) => [n, soundSource(n)])),
  };
}
