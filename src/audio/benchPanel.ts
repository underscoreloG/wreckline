import { benchMix, BENCH_RPMS, BENCH_SLOTS, parseBenchFile, slotName, sweepAt, SWEEP_SECONDS } from './bench';
import type { Bus } from './bus';
import { createEngineVoice, ENGINE_GAIN_PLAYER, type EngineVoice } from './engine';
import { engineProfile } from './engineProfiles';
import { rms } from './measure';

// The "recorded set" panel of ?harness=audio (WP25): the user's local WAVs against BLAZE's synth profile, A/B.
const SYNTH_ID = 'blaze';
const RPM_MIN: number = BENCH_RPMS[0];
const RPM_MAX: number = BENCH_RPMS[BENCH_RPMS.length - 1]!;
const TICK_MS = 30;
const TAU = 0.03; // s, gain and rate smoothing per tick
const TRIM_DB = 12; // +- range of the user's loudness nudge
const MATCH_RATE = 48000;

interface BenchFile {
  name: string;
  buffer: AudioBuffer;
  norm: number; // gain that brings this file's RMS to the synth's
  slot: number; // index in BENCH_SLOTS, -1 = unused
}

export interface BenchDebug {
  load(files: readonly File[]): Promise<void>;
  play(): Promise<void>;
  stop(): void;
  sweep(): Promise<void>;
  set(p: { rpm?: number; throttle?: boolean; ab?: 'recorded' | 'synth'; trimDb?: number }): void;
  state(): { playing: boolean; rpm: number; throttle: boolean; ab: string; slots: (string | null)[]; empty: string[]; gains: number[]; rates: number[] };
}

const rpm01Of = (rpm: number): number => (rpm - RPM_MIN) / (RPM_MAX - RPM_MIN);

/** RMS of BLAZE's voice at mid rpm on throttle, at the player's level, before the bus: the loudness the files are matched to. */
async function synthRms(): Promise<number> {
  const off = new OfflineAudioContext(1, MATCH_RATE * 2, MATCH_RATE);
  const v = createEngineVoice(off, off.destination, 0, engineProfile(SYNTH_ID));
  v.set({ rpm01: 0.5, throttle: 1, turbo: false, gain: ENGINE_GAIN_PLAYER, pan: 0 }, 0);
  const buf = await off.startRendering();
  return rms([buf.getChannelData(0).subarray(MATCH_RATE)]);
}

export function mountBenchPanel(root: HTMLElement, getBus: () => Bus | null, unlock: () => Promise<void>): BenchDebug {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', parent: HTMLElement = box): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    e.textContent = text;
    parent.appendChild(e);
    return e;
  };
  const box = document.createElement('fieldset');
  box.style.cssText = 'margin:12px 0;border:1px solid #555;padding:8px 12px';
  root.appendChild(box);
  el('legend', 'recorded set vs BLAZE synth');
  el('div', 'Pick WAVs from the Mercedes 190E-16V pack (Chippy569, freesound pack 9658, CC0): 500 / 2500 / 6500 rpm, full and zero load.');
  const picker = el('input');
  picker.type = 'file';
  picker.multiple = true;
  picker.accept = '.wav,audio/*';
  const table = el('table');
  const status = el('div');
  const controls = el('div');
  controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px';
  const playBtn = el('button', 'play', controls);
  const sweepBtn = el('button', `${SWEEP_SECONDS} s sweep`, controls);
  const throttleBtn = el('button', 'throttle: off', controls);
  const abBtn = el('button', 'A/B: recorded', controls);
  const rpmLabel = el('label', 'rpm ', controls);
  const rpmInput = el('input', '', rpmLabel);
  rpmInput.type = 'range';
  rpmInput.min = String(RPM_MIN);
  rpmInput.max = String(RPM_MAX);
  rpmInput.step = '10';
  const rpmText = el('span', '', controls);
  const trimLabel = el('label', 'recorded trim ', controls);
  const trimInput = el('input', '', trimLabel);
  trimInput.type = 'range';
  trimInput.min = String(-TRIM_DB);
  trimInput.max = String(TRIM_DB);
  trimInput.step = '0.5';
  trimInput.value = '0';
  const trimText = el('span', '', controls);

  const files: BenchFile[] = [];
  const notes: string[] = [];
  let rpm = RPM_MIN;
  let throttle = false;
  let ab: 'recorded' | 'synth' = 'recorded';
  let trimDb = 0;
  let target: Promise<number> | null = null;
  let timer = 0;
  let sweepStart: number | null = null;
  let graph: { slots: GainNode[]; trim: GainNode; sources: (AudioBufferSourceNode | null)[]; synth: EngineVoice } | null = null;
  let last = BENCH_SLOTS.map(() => ({ gain: 0, rate: 1 }));

  // The last file assigned to a slot wins.
  const slotFile = (i: number): BenchFile | undefined => {
    for (let k = files.length - 1; k >= 0; k--) if (files[k]!.slot === i) return files[k];
    return undefined;
  };

  const startSources = (): void => {
    const bus = getBus();
    if (!graph || !bus) return;
    for (const s of graph.sources) s?.stop();
    graph.sources = BENCH_SLOTS.map((_s, i) => {
      const f = slotFile(i);
      if (!f) return null;
      const src = bus.ctx.createBufferSource();
      src.buffer = f.buffer;
      src.loop = true;
      src.connect(graph!.slots[i]!);
      src.start();
      return src;
    });
  };

  const apply = (): void => {
    const bus = getBus();
    if (!graph || !bus) return;
    const now = bus.ctx.currentTime;
    if (sweepStart !== null) {
      const t = now - sweepStart;
      if (t > SWEEP_SECONDS) sweepStart = null;
      const s = sweepAt(t);
      rpm = RPM_MIN + s.rpm01 * (RPM_MAX - RPM_MIN);
      throttle = s.throttle > 0;
    }
    last = benchMix(
      rpm,
      throttle ? 1 : 0,
      BENCH_SLOTS.map((_s, i) => slotFile(i) !== undefined),
    );
    last.forEach((m, i) => {
      graph!.slots[i]!.gain.setTargetAtTime(ab === 'recorded' ? m.gain * (slotFile(i)?.norm ?? 0) : 0, now, TAU);
      graph!.sources[i]?.playbackRate.setTargetAtTime(m.rate, now, TAU);
    });
    graph.trim.gain.setTargetAtTime(10 ** (trimDb / 20), now, TAU);
    graph.synth.set({ rpm01: rpm01Of(rpm), throttle: throttle ? 1 : 0, turbo: false, gain: ab === 'synth' ? ENGINE_GAIN_PLAYER : 0, pan: 0 }, now);
  };

  const draw = (): void => {
    rpmInput.value = String(rpm);
    trimInput.value = String(trimDb);
    rpmText.textContent = `${Math.round(rpm)}`;
    trimText.textContent = `${trimDb >= 0 ? '+' : ''}${trimDb} dB`;
    throttleBtn.textContent = `throttle: ${throttle ? 'on' : 'off'}`;
    abBtn.textContent = `A/B: ${ab === 'recorded' ? 'recorded' : 'synth (blaze)'}`;
    playBtn.textContent = graph ? 'stop' : 'play';
    const empty = BENCH_SLOTS.filter((_s, i) => !slotFile(i)).map(slotName);
    status.textContent = [
      empty.length ? `empty slots: ${empty.join(', ')}${empty.length === BENCH_SLOTS.length ? ' (recorded side is silent)' : ' (plays what it has)'}` : 'all slots filled',
      ...notes,
    ].join(' | ');
  };

  const drawTable = (): void => {
    table.replaceChildren();
    for (const f of files) {
      const row = el('tr', '', table);
      el('td', f.name, row);
      const cell = el('td', '', row);
      const select = el('select', '', cell);
      for (const [value, label] of [['-1', 'unused'], ...BENCH_SLOTS.map((s, i) => [String(i), slotName(s)])] as [string, string][]) {
        const o = el('option', label, select);
        o.value = value;
      }
      select.value = String(f.slot);
      select.onchange = () => {
        f.slot = Number(select.value);
        startSources();
        draw();
      };
    }
  };

  const load = async (list: readonly File[]): Promise<void> => {
    await unlock();
    const bus = getBus();
    if (!bus) return;
    target ??= synthRms();
    const want = await target;
    notes.length = 0;
    for (const file of list) {
      try {
        const buffer = await bus.ctx.decodeAudioData(await file.arrayBuffer());
        const level = rms(Array.from({ length: buffer.numberOfChannels }, (_c, ch) => buffer.getChannelData(ch)));
        const parsed = parseBenchFile(file.name);
        const free = (i: number): boolean => !slotFile(i);
        let slot = -1;
        if (parsed?.load) slot = BENCH_SLOTS.findIndex((s) => s.rpm === parsed.rpm && s.load === parsed.load);
        else if (parsed) slot = BENCH_SLOTS.findIndex((s, i) => s.rpm === parsed.rpm && free(i));
        files.push({ name: file.name, buffer, norm: level > 0 ? want / level : 0, slot });
      } catch (err) {
        notes.push(`${file.name}: not decoded (${String(err)})`);
      }
    }
    drawTable();
    startSources();
    draw();
  };

  const play = async (): Promise<void> => {
    await unlock();
    const bus = getBus();
    if (!bus || graph) return;
    const trim = bus.ctx.createGain();
    trim.connect(bus.race);
    const slots = BENCH_SLOTS.map(() => {
      const g = bus.ctx.createGain();
      g.gain.value = 0;
      g.connect(trim);
      return g;
    });
    graph = { slots, trim, sources: [], synth: createEngineVoice(bus.ctx, bus.race, bus.ctx.currentTime, engineProfile(SYNTH_ID)) };
    startSources();
    apply();
    timer = window.setInterval(() => {
      apply();
      draw();
    }, TICK_MS);
    draw();
  };

  const stop = (): void => {
    window.clearInterval(timer);
    sweepStart = null;
    if (graph) {
      const now = getBus()?.ctx.currentTime ?? 0;
      for (const s of graph.sources) s?.stop();
      graph.synth.stop(now);
      graph.trim.disconnect();
      graph = null;
    }
    draw();
  };

  const sweep = async (): Promise<void> => {
    await play();
    const bus = getBus();
    if (bus) sweepStart = bus.ctx.currentTime;
  };

  const set: BenchDebug['set'] = (p) => {
    if (p.rpm !== undefined) {
      rpm = Math.max(RPM_MIN, Math.min(RPM_MAX, p.rpm));
      sweepStart = null;
    }
    if (p.throttle !== undefined) throttle = p.throttle;
    if (p.ab !== undefined) ab = p.ab;
    if (p.trimDb !== undefined) trimDb = Math.max(-TRIM_DB, Math.min(TRIM_DB, p.trimDb));
    apply();
    draw();
  };

  picker.onchange = () => void load(Array.from(picker.files ?? []));
  playBtn.onclick = () => (graph ? stop() : void play());
  sweepBtn.onclick = () => void sweep();
  throttleBtn.onclick = () => set({ throttle: !throttle });
  abBtn.onclick = () => set({ ab: ab === 'recorded' ? 'synth' : 'recorded' });
  rpmInput.oninput = () => set({ rpm: Number(rpmInput.value) });
  trimInput.oninput = () => set({ trimDb: Number(trimInput.value) });
  draw();

  return {
    load,
    play,
    stop,
    sweep,
    set,
    state: () => ({
      playing: graph !== null,
      rpm,
      throttle,
      ab,
      slots: BENCH_SLOTS.map((_s, i) => slotFile(i)?.name ?? null),
      empty: BENCH_SLOTS.filter((_s, i) => !slotFile(i)).map(slotName),
      gains: last.map((m) => m.gain),
      rates: last.map((m) => m.rate),
    }),
  };
}
