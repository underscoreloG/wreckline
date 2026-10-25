import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIX } from './mix';
import { PITCH_VARIATION, pitchRate, SFX_CATEGORY, SFX_NAMES, type SfxName } from './sfx';
import { RateLimit } from './voices';

// Minimal stand-in for a BaseAudioContext: records which nodes get created and what each buffer source plays.
function fakeCtx() {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  });
  const created: string[] = [];
  const played: unknown[] = [];
  const node = (kind: string) => {
    created.push(kind);
    const n = {
      gain: param(),
      pan: param(),
      frequency: param(),
      Q: param(),
      playbackRate: param(),
      buffer: null as unknown,
      loop: false,
      type: '',
      onended: null,
      connect: (next: unknown) => next,
      disconnect() {},
      start() {
        if (kind === 'source') played.push(n.buffer);
      },
      stop() {},
    };
    return n;
  };
  const decoded = { duration: 0.3, tag: 'decoded' };
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    createGain: () => node('gain'),
    createStereoPanner: () => node('panner'),
    createBiquadFilter: () => node('biquad'),
    createOscillator: () => node('osc'),
    createBufferSource: () => node('source'),
    createBuffer: (_ch: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    decodeAudioData: async () => decoded,
  };
  return { ctx: ctx as unknown as BaseAudioContext, created, played, decoded };
}

describe('samples: fallback to the synth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('a failed fetch (network error or HTTP 404) plays the synth recipe, a loaded one plays the sample', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('/gun.mp3')) throw new Error('offline');
      if (url.endsWith('/impact.mp3')) return { ok: false, status: 404 };
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) };
    });
    const { loadSamples, playSound, soundSource } = await import('./samples');
    const { ctx, created, played, decoded } = fakeCtx();
    await expect(loadSamples(ctx)).resolves.toBeUndefined();
    expect(soundSource('gun')).toBe('synth');
    expect(soundSource('impact')).toBe('synth');
    expect(soundSource('uiMove')).toBe('sample');

    playSound(ctx, ctx.createGain() as unknown as AudioNode, 'gun', 0, 1, 0);
    expect(created).toContain('osc'); // the synth gun: noise burst + square click
    expect(played).not.toContain(decoded);

    created.length = 0;
    playSound(ctx, ctx.createGain() as unknown as AudioNode, 'uiMove', 0, 1, 0);
    expect(created).not.toContain('osc');
    expect(played).toContain(decoded);
  });

  it('nothing loaded (every fetch fails): every sound is synth and nothing throws', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    const { loadSamples, soundSource } = await import('./samples');
    await loadSamples(fakeCtx().ctx);
    for (const name of SFX_NAMES) expect(soundSource(name)).toBe('synth');
  });
});

describe('carDamaged rate limit', () => {
  it('allows at most one sound per 0.25 s', () => {
    const limit = new RateLimit(0.25);
    const at = [0, 0.05, 0.1, 0.2, 0.25, 0.3, 0.49, 0.5, 1.2];
    expect(at.filter((t) => limit.allow(t))).toEqual([0, 0.25, 0.5, 1.2]);
  });
  it('a 60 Hz stream of hits plays 4 per second', () => {
    const limit = new RateLimit(0.25);
    let n = 0;
    for (let i = 0; i < 60; i++) if (limit.allow(i / 60)) n++;
    expect(n).toBe(4);
  });
});

describe('pitch variation', () => {
  it('stays within +-4 %', () => {
    expect(PITCH_VARIATION).toBe(0.04);
    expect(pitchRate(() => 0)).toBeCloseTo(0.96, 12);
    expect(pitchRate(() => 0.5)).toBe(1);
    expect(pitchRate(() => 1 - 1e-12)).toBeLessThanOrEqual(1.04);
    for (let i = 0; i < 10000; i++) {
      const r = pitchRate();
      expect(r).toBeGreaterThanOrEqual(0.96);
      expect(r).toBeLessThanOrEqual(1.04);
    }
  });
});

describe('MIX', () => {
  it('has a level and a category for every SfxName', () => {
    const sound: Record<string, number> = MIX.sound;
    for (const name of SFX_NAMES) {
      expect(sound[name], name).toBeGreaterThan(0);
      expect(Number.isFinite(sound[name])).toBe(true);
      const cat = SFX_CATEGORY[name as SfxName];
      expect(MIX.category[cat], name).toBeGreaterThan(0);
    }
  });
  it('bus, engine and skid levels are positive', () => {
    for (const v of [MIX.bus.race, MIX.bus.ui, MIX.engine.player, MIX.engine.ai, MIX.skid]) expect(v).toBeGreaterThan(0);
  });
});
