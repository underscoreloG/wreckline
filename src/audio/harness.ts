import { buildQuickRaceSetup } from '../content/quickRace';
import type { Sim, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { createFakeSim } from '../sim';
import { buildBus } from './bus';
import { createEngineVoice, ENGINE_GAIN_PLAYER } from './engine';
import { createAudioEngine } from './index';
import { playSound, soundSource } from './samples';
import { SFX_NAMES, type SfxName } from './sfx';
import { createSkidVoice, SKID_GAIN } from './skid';

const MAX_STEPS = 5; // per frame, as in the game loop
const FRAME_MS = 16; // setTimeout, not rAF: a hidden pane pauses rAF, and a page playing audio is not timer-throttled
const CHECK_RATE = 48000;
const CHECK_SECONDS = 3;
// A fresh DynamicsCompressorNode starts far below unity gain and settles over ~0.5 s, so sounds start after it settles.
const CHECK_START = 0.5;
const SILENCE_DB = -60;

export interface SoundCheck {
  name: string;
  source: 'sample' | 'synth';
  duration: number; // s above -60 dBFS
  peakDb: number;
  rmsDb: number; // over the audible span
  ok: boolean; // audible (peak > -40 dBFS) and no sample above 0 dBFS
}

const db = (v: number): number => (v > 0 ? 20 * Math.log10(v) : -Infinity);

/** Renders one sound through the real bus (master and sfx at 1) into an OfflineAudioContext and measures it. */
async function checkSound(name: SfxName | 'engine' | 'engineTurbo' | 'skid'): Promise<SoundCheck> {
  const off = new OfflineAudioContext(2, CHECK_RATE * CHECK_SECONDS, CHECK_RATE);
  const bus = buildBus(off);
  if (name === 'engine' || name === 'engineTurbo') {
    const v = createEngineVoice(off, bus.race, CHECK_START);
    v.set({ rpm01: 0.9, throttle: 1, turbo: name === 'engineTurbo', gain: ENGINE_GAIN_PLAYER, pan: 0 }, CHECK_START);
    v.stop(CHECK_START + 1.5);
  } else if (name === 'skid') {
    const v = createSkidVoice(off, bus.race, CHECK_START, 0);
    v.set(SKID_GAIN, 0, CHECK_START);
    v.stop(CHECK_START + 1);
  } else {
    playSound(off, bus.race, name, CHECK_START, 1, 0);
  }
  const buf = await off.startRendering();
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
  const peakDb = db(peak);
  return {
    name,
    source: name === 'engine' || name === 'engineTurbo' || name === 'skid' ? 'synth' : soundSource(name),
    duration: first < 0 ? 0 : (last - first + 1) / CHECK_RATE,
    peakDb: Math.round(peakDb * 10) / 10,
    rmsDb: n ? Math.round(db(Math.sqrt(sum / n)) * 10) / 10 : -Infinity,
    ok: peakDb > -40 && peak <= 1,
  };
}

/** ?harness=audio: a button per sound, fake race toggle, volume sliders, voice count, offline level check. */
export function mountAudioHarness(root: HTMLElement): void {
  root.style.cssText += ';color:#e8e8e8;font:14px/1.5 monospace;padding:16px';
  const engine = createAudioEngine();
  const unlock = (): Promise<void> => engine.unlock();
  root.addEventListener('pointerdown', () => void unlock());

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', parent: HTMLElement = root): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    e.textContent = text;
    parent.appendChild(e);
    return e;
  };
  el('div', 'Audio harness - click anywhere once to unlock audio; each button shows sample or synth');
  const buttons = el('div');
  buttons.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:12px 0';
  const labels: [HTMLButtonElement, SfxName][] = [];
  for (const name of SFX_NAMES) {
    const b = el('button', name, buttons);
    labels.push([b, name]);
    b.dataset.sound = name;
    b.onclick = async () => {
      await unlock();
      engine.play(name);
    };
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
    return checks;
  };
  checkBtn.onclick = () => void runChecks();

  const draw = (): void => {
    for (const [b, name] of labels) b.textContent = `${name} (${soundSource(name)})`;
    const snap = sim?.snapshot();
    readout.textContent = [
      `context    ${engine.bus()?.ctx.state ?? 'locked'}`,
      `voices     ${engine.voices()}  (max seen ${maxVoices}, cap 48)`,
      `live peak  ${db(livePeak).toFixed(1)} dBFS`,
      snap ? `fake race  t=${snap.time.toFixed(1)} s phase=${snap.phase}` : 'fake race  off',
      '',
      ...checks.map((c) => `${c.ok ? 'ok  ' : 'FAIL'} ${c.name.padEnd(15)} ${c.source.padEnd(6)} ${c.duration.toFixed(3)} s  peak ${c.peakDb} dBFS  rms ${c.rmsDb} dBFS`),
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
    state: () => engine.bus()?.ctx.state ?? 'locked',
    sources: () => Object.fromEntries(SFX_NAMES.map((n) => [n, soundSource(n)])),
  };
}
