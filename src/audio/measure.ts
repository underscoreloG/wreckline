// Offline measurements for the audio harness (WP25): engine character by numbers, since the build agent cannot listen.
const MIN_HZ = 20;
const MAX_HZ = 1000;
const PEAK_SHARE = 0.9; // the shortest lag within 90% of the best correlation is the period (avoids octave-down picks)

/** Fundamental in Hz by normalised autocorrelation over 20-1000 Hz; 0 for silence. */
export function fundamentalHz(x: Float32Array, rate: number): number {
  const minLag = Math.floor(rate / MAX_HZ);
  const maxLag = Math.min(Math.ceil(rate / MIN_HZ), x.length - 1);
  const r = new Float64Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i + lag < x.length; i++) {
      xy += x[i]! * x[i + lag]!;
      xx += x[i]! ** 2;
      yy += x[i + lag]! ** 2;
    }
    r[lag] = xx > 0 && yy > 0 ? xy / Math.sqrt(xx * yy) : 0;
    if (lag <= maxLag) best = Math.max(best, r[lag]!);
  }
  if (best <= 0) return 0;
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    const [a, b, c] = [r[lag - 1]!, r[lag]!, r[lag + 1]!];
    if (b >= PEAK_SHARE * best && b >= a && b >= c) {
      // Parabolic interpolation between the neighbouring lags.
      const d = a - 2 * b + c;
      return rate / (lag + (d !== 0 ? (0.5 * (a - c)) / d : 0));
    }
  }
  return 0;
}

/** Spectral centroid in Hz of a Hann-windowed FFT; x.length must be a power of two. */
export function spectralCentroid(x: Float32Array, rate: number): number {
  const n = x.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  let num = 0;
  let den = 0;
  for (let k = 1; k < n / 2; k++) {
    const m = Math.hypot(re[k]!, im[k]!);
    num += ((k * rate) / n) * m;
    den += m;
  }
  return den > 0 ? num / den : 0;
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error(`fft: length ${n} is not a power of two`);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
}

/** Root mean square of a buffer's samples, all channels. */
export function rms(channels: readonly Float32Array[]): number {
  let sum = 0;
  let n = 0;
  for (const d of channels) {
    for (const v of d) sum += v * v;
    n += d.length;
  }
  return n ? Math.sqrt(sum / n) : 0;
}
