import { CARS } from '../content/cars';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { Sim, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { createFakeSim } from '../sim';
import { sweepAt, SWEEP_SECONDS } from './bench';
import { mountBenchPanel } from './benchPanel';
import { buildBus } from './bus';
import { createEngineVoice, ENGINE_GAIN_PLAYER } from './engine';
import { DEFAULT_PROFILE_ID, engineProfile } from './engineProfiles';
import { createAudioEngine } from './index';
import { fundamentalHz, spectralCentroid } from './measure';
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

const db = (v: number): number => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** One engine voice with `carDefId`'s profile, held at rpm01 and throttle, through the real bus. */
async function renderEngine(carDefId: string, rpm01: number, throttle: number, turbo = false): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, CHECK_RATE * CHECK_SECONDS, CHECK_RATE);
  const bus = buildBus(off);
  const v = createEngineVoice(off, bus.race, CHECK_START, engineProfile(carDefId));
  v.set({ rpm01, throttle, turbo, gain: ENGINE_GAIN_PLAYER, pan: 0 }, CHECK_START);
  v.stop(CHECK_START + 1.5);
  return off.startRendering();
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

  // A 4 s rev sweep per car with its own engine profile, scheduled ahead on the race bus.
  const sweeps = el('div');
  sweeps.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px';
  el('span', 'engine sweep:', sweeps);
  const sweepCar = async (car: string): Promise<void> => {
    await unlock();
    const bus = engine.bus();
    if (!bus) return;
    const t0 = bus.ctx.currentTime;
    const v = createEngineVoice(bus.ctx, bus.race, t0, engineProfile(car));
    for (let k = 0; k <= SWEEP_SETS; k++) {
      const t = (k / SWEEP_SETS) * SWEEP_SECONDS;
      v.set({ ...sweepAt(t), turbo: false, gain: ENGINE_GAIN_PLAYER, pan: 0 }, t0 + t);
    }
    v.stop(t0 + SWEEP_SECONDS + 0.1);
  };
  for (const car of Object.keys(CARS)) {
    const b = el('button', car, sweeps);
    b.dataset.sweep = car;
    b.onclick = () => void sweepCar(car);
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
  const bench = mountBenchPanel(root, () => engine.bus(), unlock);

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
    return checks;
  };
  checkBtn.onclick = () => void runChecks();

  const draw = (): void => {
    for (const [b, name] of labels) {
      b.textContent = soundSource(name) === 'sample' ? 'sample' : 'sample (not loaded: plays synth)';
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
    bench,
    state: () => engine.bus()?.ctx.state ?? 'locked',
    sources: () => Object.fromEntries(SFX_NAMES.map((n) => [n, soundSource(n)])),
  };
}
