import { createRng } from '../shared/rng';

const NOISE_SECONDS = 2;
const NOISE_SEED = 0x5eed;

export interface Noise {
  white: AudioBuffer;
  pink: AudioBuffer;
}

const cache = new WeakMap<BaseAudioContext, Noise>();

/** Shared 2 s white and pink noise buffers, generated once per context from a fixed seed. */
export function getNoise(ctx: BaseAudioContext): Noise {
  const hit = cache.get(ctx);
  if (hit) return hit;
  const n = Math.round(ctx.sampleRate * NOISE_SECONDS);
  const white = ctx.createBuffer(1, n, ctx.sampleRate);
  const pink = ctx.createBuffer(1, n, ctx.sampleRate);
  const w = white.getChannelData(0);
  const p = pink.getChannelData(0);
  const rng = createRng(NOISE_SEED);
  // Paul Kellet's economy pink filter, then normalized to a 0.9 peak.
  let peak = 0;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const x = rng.next() * 2 - 1;
    w[i] = x;
    b0 = 0.99765 * b0 + x * 0.099046;
    b1 = 0.963 * b1 + x * 0.2965164;
    b2 = 0.57 * b2 + x * 1.0526913;
    const v = b0 + b1 + b2 + x * 0.1848;
    p[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const k = 0.9 / peak;
  for (let i = 0; i < n; i++) p[i] *= k;
  const noise = { white, pink };
  cache.set(ctx, noise);
  return noise;
}
