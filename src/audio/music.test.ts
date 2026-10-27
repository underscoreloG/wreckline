import { afterEach, describe, expect, it, vi } from 'vitest';
import manifestFile from '../../public/music/manifest.json';
import { buildBus, setBusVolumes } from './bus';
import { MIX } from './mix';
import { MENU_TRACK, pickRaceTrack, RACE_TRACKS, type MusicManifest } from './music';

vi.mock('./samples', () => ({ loadSamples: async () => {}, playSound: () => ({ end: 0, stop() {} }) }));
vi.mock('./engineSets', () => ({ loadEngineSets: async () => {}, engineSet: () => undefined }));

const manifest = manifestFile as MusicManifest;
// The encoded files as data: URLs, so the test reads their real length.
const files = import.meta.glob<string>('../../public/music/*.ogg', { query: '?inline', import: 'default', eager: true });

const bytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Decoded length in s of an Ogg Opus file: the last page's granule position minus the OpusHead pre-skip, at 48 kHz. */
function oggOpusSeconds(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const head = bytes(b64.slice(0, 4096));
  const tail = bytes(b64.slice(b64.length - 4 * 16384));
  const find = (buf: Uint8Array, magic: string, last: boolean): number => {
    const at = (i: number): boolean => [...magic].every((c, k) => buf[i + k] === c.charCodeAt(0));
    if (last) {
      for (let i = buf.length - magic.length; i >= 0; i--) if (at(i)) return i;
    } else for (let i = 0; i + magic.length <= buf.length; i++) if (at(i)) return i;
    return -1;
  };
  const opusHead = find(head, 'OpusHead', false);
  const page = find(tail, 'OggS', true);
  if (opusHead < 0 || page < 0) throw new Error('not an Ogg Opus file');
  const preSkip = head[opusHead + 10]! | (head[opusHead + 11]! << 8);
  const view = new DataView(tail.buffer, page + 6, 8);
  const granule = view.getUint32(0, true) + view.getUint32(4, true) * 2 ** 32;
  return (granule - preSkip) / 48000;
}

const param = () => ({ value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} });
const stubNode = () => ({ gain: param(), threshold: param(), ratio: param(), connect: (next: unknown) => next });

class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  createGain = stubNode;
  createDynamicsCompressor = stubNode;
  async resume() {}
  async close() {}
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('race track pick (WP35)', () => {
  it('is the same for the same seed and never the previous track', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 2000; seed++) {
      const prev = RACE_TRACKS[seed % RACE_TRACKS.length]!;
      const t = pickRaceTrack(seed * 7919, prev);
      expect(RACE_TRACKS).toContain(t);
      expect(t).not.toBe(prev);
      expect(pickRaceTrack(seed * 7919, prev)).toBe(t);
      seen.add(pickRaceTrack(seed * 7919, null));
    }
    expect(seen.size).toBe(RACE_TRACKS.length);
  });

  it('the engine: a replayed seed hears the same track, pause keeps it, the next race never repeats it', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404 }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createAudioEngine } = await import('./index');
    // A seed whose own pick is a's track: the engine must move the second race off it.
    const a = 12345;
    const first = pickRaceTrack(a, null);
    const b = [...Array(1000).keys()].find((s) => s !== a && pickRaceTrack(s, null) === first)!;

    const engine = createAudioEngine();
    engine.setMusic('menu');
    await engine.unlock();
    expect(engine.music()).toMatchObject({ mode: 'menu', track: MENU_TRACK });
    engine.setMusic('menu', a); // pre-race: prefetch only
    expect(engine.music().track).toBe(MENU_TRACK);
    engine.setMusic('race', a);
    expect(engine.music()).toMatchObject({ mode: 'race', track: first });
    engine.setMusic('off', a);
    expect(engine.music()).toMatchObject({ mode: 'off', track: null });
    engine.setMusic('race', a);
    expect(engine.music().track).toBe(first);
    engine.setMusic('menu');
    engine.setMusic('menu', b);
    engine.setMusic('race', b);
    const second = engine.music().track;
    expect(second).not.toBe(first);
    expect(second).toBe(pickRaceTrack(b, first));

    const replay = createAudioEngine();
    replay.setMusic('race', a);
    expect(replay.music().track).toBe(first);
  });
});

describe('music manifest (WP35)', () => {
  it('lists every track with loop points inside its file', () => {
    for (const id of [...RACE_TRACKS, MENU_TRACK]) {
      const t = manifest.tracks[id];
      expect(t, id).toBeDefined();
      expect(t!.use, id).toBe(id === MENU_TRACK ? 'menu' : 'race');
      expect(t!.loopStart, id).toBeGreaterThanOrEqual(0);
      expect(t!.loopEnd - t!.loopStart, id).toBeGreaterThan(10);
      expect(t!.loopEnd, id).toBeLessThanOrEqual(t!.duration);
      const file = files[`../../public/music/${t!.file}`];
      expect(file, id).toBeDefined();
      expect(oggOpusSeconds(file!), id).toBeCloseTo(t!.duration, 3);
    }
  });
});

describe('music bus (WP35)', () => {
  // Records every connection so the graph can be walked.
  function graphCtx() {
    const edges = new Map<object, object[]>();
    const node = () => {
      const n = {
        gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(v: number) { n.gain.value = v; }, linearRampToValueAtTime(v: number) { n.gain.value = v; } },
        threshold: { value: 0 },
        ratio: { value: 0 },
        connect(next: object) {
          edges.set(n, [...(edges.get(n) ?? []), next]);
          return next;
        },
      };
      return n;
    };
    const destination = {};
    const ctx = { currentTime: 0, destination, createGain: node, createDynamicsCompressor: node } as unknown as BaseAudioContext;
    const path = (from: object): object[] => {
      const out: object[] = [from];
      for (let n = edges.get(from)?.[0]; n; n = edges.get(n)?.[0]) out.push(n);
      return out;
    };
    return { ctx, path, destination };
  }

  it('music -> master -> out, never through sfx; the setting scales MIX.bus.music', () => {
    const { ctx, path, destination } = graphCtx();
    const bus = buildBus(ctx);
    expect(path(bus.music)).toEqual([bus.music, bus.master, bus.out, destination]);
    expect(path(bus.race)).toEqual([bus.race, bus.sfx, bus.master, bus.out, destination]);
    expect(bus.music.gain.value).toBe(MIX.bus.music);
    setBusVolumes(bus, 0.7, 0, 0.5);
    expect(bus.music.gain.value).toBeCloseTo(0.5 * MIX.bus.music, 10);
    expect(bus.sfx.gain.value).toBe(0);
    expect(bus.master.gain.value).toBe(0.7);
  });
});
