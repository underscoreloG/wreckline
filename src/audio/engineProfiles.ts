// Engine voice per car (WP25): one synth profile per car in the registry, same voice structure, different numbers.
// Character targets (judged by ear by the user) are in specs/wp/WP25-engine-voices.md; measured fundamentals and
// centroids are in docs/tuning-log.md.

export interface EngineProfile {
  /** Fake gearbox: inside each of `gears` gears, f = base + (g * 0.7 + 0.3) * span + gear * step (g = 0..1 in the gear). */
  base: number;
  span: number;
  step: number;
  gears: number;
  /** s, pitch smoothing per update: a slow-revving engine lags behind its rpm. */
  revTau: number;
  /** Square one octave under the saw, relative to it: the thick bottom. */
  sub: number;
  /** Lowpass on saw + sub: Hz at rest, Hz added on throttle, Q. */
  cutoff: number;
  cutoffThrottle: number;
  q: number;
  /** Exhaust layer: bandpassed noise (Hz, Q), level relative to the tone, gated by the sub square (0..1): burble or clatter. */
  noise: number;
  noiseHz: number;
  noiseQ: number;
  pulse: number;
  /** Lumpy idle: slow LFO (Hz) on pitch (cents) and cutoff (Hz), fading out by half rpm. */
  wobbleHz: number;
  wobbleCents: number;
  wobbleCutoff: number;
  /** Whine oscillator: frequency ratio to the engine, and an always-on supercharger level (turbo still lifts it). */
  whineRatio: number;
  blower: number;
  /** Output trim so every profile sits within +-3 dB of raven at the same rpm and throttle (offline check). */
  level: number;
}

// raven keeps WP05's pitch curve and filter (83.5-174 Hz) and adds the burble.
const RAVEN: EngineProfile = {
  base: 55,
  span: 95,
  step: 12,
  gears: 3,
  revTau: 0.04,
  sub: 0.5,
  cutoff: 400,
  cutoffThrottle: 1800,
  q: 4,
  noise: 0.35,
  noiseHz: 260,
  noiseQ: 0.8,
  pulse: 1,
  wobbleHz: 3,
  wobbleCents: 35,
  wobbleCutoff: 120,
  whineRatio: 9,
  blower: 0,
  level: 1,
};

export const ENGINE_PROFILES: Readonly<Record<string, EngineProfile>> = {
  raven: RAVEN,
  outlaw: {
    ...RAVEN,
    base: 80,
    span: 130,
    step: 15,
    gears: 4,
    revTau: 0.03,
    sub: 0.3,
    cutoff: 900,
    cutoffThrottle: 2600,
    q: 6,
    noise: 0.25,
    noiseHz: 1200,
    noiseQ: 1,
    pulse: 0.8,
    wobbleHz: 7,
    wobbleCents: 60,
    wobbleCutoff: 300,
  },
  iceberg: {
    ...RAVEN,
    base: 40,
    span: 60,
    step: 6,
    gears: 4,
    revTau: 0.08,
    sub: 0.6,
    cutoff: 350,
    cutoffThrottle: 900,
    q: 2,
    noise: 0.5,
    noiseHz: 2800,
    noiseQ: 1.5,
    pulse: 1,
    wobbleCents: 0,
    wobbleCutoff: 0,
  },
  scorch: {
    ...RAVEN,
    base: 38,
    span: 75,
    step: 8,
    gears: 3,
    sub: 0.8,
    cutoff: 320,
    cutoffThrottle: 1400,
    q: 5,
    noise: 0.5,
    noiseHz: 180,
    noiseQ: 0.7,
    wobbleHz: 2,
    wobbleCents: 50,
    wobbleCutoff: 120,
  },
  blaze: {
    ...RAVEN,
    base: 90,
    span: 220,
    step: 20,
    gears: 4,
    revTau: 0.025,
    sub: 0.15,
    cutoff: 1200,
    cutoffThrottle: 3500,
    q: 3,
    noise: 0.12,
    noiseHz: 3000,
    noiseQ: 0.7,
    pulse: 0.3,
    wobbleCents: 0,
    wobbleCutoff: 0,
  },
  titan: {
    ...RAVEN,
    base: 28,
    span: 45,
    step: 5,
    gears: 5,
    revTau: 0.15,
    sub: 0.7,
    cutoff: 260,
    cutoffThrottle: 700,
    q: 2,
    noise: 0.45,
    noiseHz: 1800,
    noiseQ: 1.2,
    wobbleHz: 1.5,
    wobbleCents: 15,
    wobbleCutoff: 40,
  },
  viper: {
    ...RAVEN,
    base: 110,
    span: 330,
    step: 25,
    gears: 5,
    revTau: 0.025,
    sub: 0.1,
    cutoff: 2000,
    cutoffThrottle: 5000,
    q: 1.5,
    noise: 0.05,
    pulse: 0,
    wobbleCents: 0,
    wobbleCutoff: 0,
  },
  wraith: {
    ...RAVEN,
    base: 45, // ~8% under raven: the same V8, a bigger displacement
    span: 95,
    sub: 0.6,
    whineRatio: 24, // well above the tone's own centroid, so the blower reads as a separate whine
    blower: 0.25,
  },
};

/** Until the game names the race cars (audio harness, tests), every car is a raven. */
export const DEFAULT_PROFILE_ID = 'raven';

export function engineProfile(carDefId: string): EngineProfile {
  return ENGINE_PROFILES[carDefId] ?? RAVEN;
}

/** The profile's fake gearbox (see EngineProfile): continuous inside each gear, pitch falls back at each shift. */
export function profileFrequency(p: EngineProfile, rpm01: number): number {
  const r = Math.max(0, Math.min(1, rpm01));
  const gear = Math.min(p.gears - 1, Math.floor(r * p.gears));
  const g = r * p.gears - gear;
  return p.base + (g * 0.7 + 0.3) * p.span + gear * p.step;
}
