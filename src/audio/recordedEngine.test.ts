import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARS } from '../content/cars';
import type { RaceSnapshot } from '../shared/contracts';
import { setRpm, stepMix, type EngineStep } from './bench';
import type { EngineParams } from './engine';
import { ENGINE_PROFILES } from './engineProfiles';
import type { EngineManifest, EngineSet } from './engineSets';

// index.ts with the voices replaced by recorders: which voice (recorded or synth) each race car gets.
const made: { kind: 'synth' | 'recorded'; set?: EngineSet; sets: EngineParams[] }[] = [];
const voice = (kind: 'synth' | 'recorded', set?: EngineSet) => {
  const rec = { kind, set, sets: [] as EngineParams[] };
  made.push(rec);
  return { alive: true, sources: 1, set: (p: EngineParams) => rec.sets.push(p), kill() {}, stop() {} };
};
vi.mock('./engine', async (orig) => ({ ...(await orig<typeof import('./engine')>()), createEngineVoice: () => voice('synth') }));
vi.mock('./recordedEngine', async (orig) => ({
  ...(await orig<typeof import('./recordedEngine')>()),
  createRecordedEngineVoice: (_c: unknown, _d: unknown, _n: number, set: EngineSet) => voice('recorded', set),
}));
vi.mock('./skid', () => ({ SKID_GAIN: 0.12, createSkidVoice: () => ({ set() {}, stop() {} }) }));
vi.mock('./samples', () => ({ loadSamples: async () => {}, playSound: () => ({ end: 0, stop() {} }) }));
vi.mock('./bus', () => ({ buildBus: (ctx: unknown) => ({ ctx, master: { gain: {} }, sfx: { gain: {} }, race: {}, ui: {}, out: {} }) }));

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  async resume() {}
  async decodeAudioData(data: ArrayBuffer) {
    return { duration: 3, tag: new TextDecoder().decode(data) };
  }
}

const snapshot = (n: number): RaceSnapshot =>
  ({
    tick: 10,
    cars: Array.from({ length: n }, (_, id) => ({ id, pos: { x: id * 5, y: 0 }, speed: 10, wrecked: false, turboActive: false, drifting: false })),
    mines: [],
  }) as unknown as RaceSnapshot;

// A fixture manifest built from the car registry: the first car's files all load, the second car has one file
// that 404s, the third is not in the manifest.
const [okCar, brokenCar, plainCar] = Object.keys(CARS);
const step = (car: string, slot: string, rpm: number) => ({ slot, file: `${car}/${slot}.mp3`, rpm, load: 'any' as const, loopStart: 0.05, loopEnd: 2 });
const manifest: EngineManifest = {
  cars: {
    [okCar!]: { steps: [step(okCar!, 'idle', 800), step(okCar!, 'high', 3000)] },
    [brokenCar!]: { steps: [step(brokenCar!, 'idle', 700), step(brokenCar!, 'high', 2500)] },
  },
};

function stubFetch(): void {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/manifest.json')) return { ok: true, status: 200, json: async () => manifest };
    if (url.endsWith(`${brokenCar}/high.mp3`)) return { ok: false, status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
  });
}

describe('recorded or synth per car (WP28)', () => {
  beforeEach(() => {
    vi.resetModules();
    made.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const start = async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { createAudioEngine } = await import('./index');
    const engine = createAudioEngine();
    await engine.unlock();
    await engine.samples();
    return engine;
  };

  it('a car whose files loaded plays its set; a failed file or no set plays the synth, logged once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch();
    const engine = await start();
    engine.setRaceCars([okCar!, brokenCar!, plainCar!].map((carDefId) => ({ carDefId, maxSpeed: 40 })));
    engine.update(snapshot(3), [], 0);
    expect(made.map((m) => m.kind)).toEqual(['recorded', 'synth', 'synth']);
    expect(engine.engines()).toEqual(['recorded', 'synth', 'synth']);
    expect(made[0]!.set!.steps.map((s) => s.rpm)).toEqual([800, 3000]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain(brokenCar);
    // A later race does not log again.
    engine.setRaceCars([brokenCar!, okCar!].map((carDefId) => ({ carDefId, maxSpeed: 40 })));
    engine.update(snapshot(2), [], 0);
    expect(made.slice(3).map((m) => m.kind)).toEqual(['synth', 'recorded']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('no manifest: every car is synth and nothing throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
    const engine = await start();
    engine.setRaceCars([okCar!, brokenCar!].map((carDefId) => ({ carDefId, maxSpeed: 40 })));
    engine.update(snapshot(2), [], 0);
    expect(made.map((m) => m.kind)).toEqual(['synth', 'synth']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('a set that loads after the race voices were built swaps in at the next update', async () => {
    stubFetch();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { createAudioEngine } = await import('./index');
    const engine = createAudioEngine();
    engine.setRaceCars([{ carDefId: okCar!, maxSpeed: 40 }]);
    await engine.unlock();
    engine.update(snapshot(1), [], 0); // before the fetches settle
    expect(made.map((m) => m.kind)).toEqual(['synth']);
    await engine.samples();
    engine.update(snapshot(1), [], 0);
    expect(made.map((m) => m.kind)).toEqual(['synth', 'recorded']);
  });
});

// The real voice on a fake context that records which loops play.
function voiceCtx() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const playing = new Set<{ buffer: unknown }>();
  const node = () => ({ gain: param(), pan: param(), frequency: param(), playbackRate: param(), type: '', connect: (n: unknown) => n, disconnect() {}, start() {}, stop() {} });
  const ctx = {
    currentTime: 0,
    createGain: node,
    createStereoPanner: node,
    createOscillator: node,
    createBufferSource: () => {
      const n = {
        ...node(),
        buffer: null as unknown,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        start: () => playing.add(n),
        stop: () => playing.delete(n),
      };
      return n;
    },
  };
  return { ctx: ctx as unknown as BaseAudioContext, playing };
}

describe('recorded engine voice: cost', () => {
  const steps: EngineStep[] = [
    { rpm: 650, load: 'on' },
    { rpm: 2550, load: 'on' },
    { rpm: 6250, load: 'on' },
    { rpm: 530, load: 'off' },
    { rpm: 2470, load: 'off' },
    { rpm: 6300, load: 'off' },
  ];
  const set: EngineSet = { car: 'fixture', steps: steps.map((s, i) => ({ ...s, buffer: { id: i } as unknown as AudioBuffer, loopStart: 0.05, loopEnd: 1.5 })) };
  const params = (rpm01: number, throttle: number): EngineParams => ({ rpm01, throttle, turbo: false, gain: 0.28, pan: 0 });

  it('only steps with a non-zero gain play (a silent loop stops within one frame after its fade)', async () => {
    const { createRecordedEngineVoice, MAX_SOURCES } = await vi.importActual<typeof import('./recordedEngine')>('./recordedEngine');
    const { ctx, playing } = voiceCtx();
    const v = createRecordedEngineVoice(ctx, {} as AudioNode, 0, set, ENGINE_PROFILES.blaze!);
    const silentSince = steps.map(() => 0);
    for (let k = 0; k <= 600; k++) {
      const t = k / 60;
      const rpm01 = 1.3 * Math.abs(Math.sin(t / 3)); // up past the top step and back
      const throttle = t < 5 ? 1 : 0; // steady inside each half; checked once the smoothed throttle has settled
      v.set(params(rpm01, throttle), t);
      const mix = stepMix(steps, setRpm(steps, rpm01), throttle);
      mix.forEach((m, i) => {
        if (m.gain > 1e-3) silentSince[i] = t;
        const sounding = [...playing].some((s) => s.buffer === set.steps[i]!.buffer);
        if ((t < 5 || t > 6.5) && t - silentSince[i]! > 0.03 + 1 / 60) expect(sounding, `step ${i} at ${t.toFixed(2)} s`).toBe(false);
      });
      expect(v.sources).toBe(playing.size);
      expect(playing.size).toBeLessThanOrEqual(MAX_SOURCES);
    }
  });

  it('at most 4 loops with a per-frame flickering throttle, and none after a wreck', async () => {
    const { createRecordedEngineVoice, MAX_SOURCES } = await vi.importActual<typeof import('./recordedEngine')>('./recordedEngine');
    const { ctx, playing } = voiceCtx();
    const v = createRecordedEngineVoice(ctx, {} as AudioNode, 0, set, ENGINE_PROFILES.blaze!);
    let most = 0;
    for (let k = 0; k <= 1200; k++) {
      const t = k / 60;
      v.set(params(0.6 * (1 + Math.sin(t)), k % 2), t);
      most = Math.max(most, playing.size);
      expect(playing.size).toBeLessThanOrEqual(MAX_SOURCES);
    }
    expect(most).toBe(MAX_SOURCES); // two rpm steps x two loads around most rpms
    v.kill(20);
    expect(v.sources).toBe(0);
    expect(playing.size).toBe(0);
  });
});
