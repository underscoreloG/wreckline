import { DEFAULT_PROFILE_ID, engineProfile, profileFrequency, type EngineProfile } from './engineProfiles';
import { MIX } from './mix';
import { getNoise } from './noise';

// Engine voice recipe (WP05, per-car numbers from WP25's profiles): saw + square at half frequency -> lowpass -> gain
// -> pan, plus a bandpassed noise layer gated by the square (burble or clatter), a slow LFO on pitch and cutoff
// (lumpy idle) and a whine oscillator (turbo, or an always-on supercharger). Levels: MIX.engine.
export const ENGINE_GAIN_PLAYER = MIX.engine.player;
export const ENGINE_GAIN_AI = MIX.engine.ai;
const TURBO_PITCH = 1.15;
const WHINE_LEVEL = 0.25;
const SMOOTH = 0.04; // s, setTargetAtTime constant per update for levels and pan
const WRECK_DROP = 0.3; // s
const WRECK_PITCH = 0.3; // frequency multiplier at the end of the drop
const NOISE_OFFSET_STEP = 0.37; // s into the shared noise buffer per car, so exhausts do not hiss in unison
const NOISE_IDLE = 0.6; // noise layer level off throttle, relative to on throttle

/** Raven's fake 3-gear sawtooth (WP05): continuous inside each gear, 83.5-174 Hz overall. */
export function engineFrequency(rpm01: number): number {
  return profileFrequency(engineProfile(DEFAULT_PROFILE_ID), rpm01);
}

export interface EngineParams {
  rpm01: number;
  throttle: number; // 0..1, "speed rising"
  turbo: boolean;
  gain: number;
  pan: number;
}

export interface EngineVoice {
  readonly alive: boolean;
  set(p: EngineParams, now: number): void;
  /** Wreck: 0.3 s pitch drop to silence, then the oscillators stop. */
  kill(now: number): void;
  stop(when: number): void;
}

export function createEngineVoice(ctx: BaseAudioContext, dest: AudioNode, now: number, pr: EngineProfile = engineProfile(DEFAULT_PROFILE_ID), index = 0): EngineVoice {
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  const sub = ctx.createOscillator();
  sub.type = 'square';
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  const lfo = ctx.createOscillator();
  lfo.frequency.value = pr.wobbleHz;
  const subGain = ctx.createGain();
  subGain.gain.value = pr.sub;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = pr.q;
  lowpass.frequency.value = pr.cutoff;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoise(ctx).white;
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = pr.noiseHz;
  band.Q.value = pr.noiseQ;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;
  const gate = ctx.createGain(); // the sub square swings the noise level by +-gate around noiseGain
  gate.gain.value = 0;
  const wobblePitch = ctx.createGain();
  wobblePitch.gain.value = 0;
  const wobbleCutoff = ctx.createGain();
  wobbleCutoff.gain.value = 0;
  const out = ctx.createGain();
  out.gain.value = 0;
  const panner = ctx.createStereoPanner();

  const f0 = profileFrequency(pr, 0);
  saw.frequency.value = f0;
  sub.frequency.value = f0 / 2;
  whine.frequency.value = f0 * pr.whineRatio;
  saw.connect(lowpass);
  sub.connect(subGain).connect(lowpass);
  lowpass.connect(out);
  sub.connect(gate).connect(noiseGain.gain);
  noise.connect(band).connect(noiseGain).connect(out);
  lfo.connect(wobblePitch);
  wobblePitch.connect(saw.detune);
  wobblePitch.connect(sub.detune);
  lfo.connect(wobbleCutoff).connect(lowpass.frequency);
  // The whine skips the lowpass so it stays audible as a high layer.
  whine.connect(whineGain).connect(out);
  out.connect(panner).connect(dest);
  const oscs = [saw, sub, whine, lfo];
  for (const o of oscs) o.start(now);
  noise.start(now, (index * NOISE_OFFSET_STEP) % 2);

  let alive = true;
  const stop = (when: number): void => {
    for (const o of oscs) o.stop(when);
    noise.stop(when);
    saw.onended = () => panner.disconnect();
  };

  return {
    get alive() {
      return alive;
    },
    set(p, t) {
      if (!alive) return;
      const f = profileFrequency(pr, p.rpm01) * (p.turbo ? TURBO_PITCH : 1);
      const idle = Math.max(0, 1 - 2 * Math.max(0, Math.min(1, p.rpm01)));
      const n = pr.noise * (NOISE_IDLE + (1 - NOISE_IDLE) * p.throttle);
      saw.frequency.setTargetAtTime(f, t, pr.revTau);
      sub.frequency.setTargetAtTime(f / 2, t, pr.revTau);
      whine.frequency.setTargetAtTime(f * pr.whineRatio, t, pr.revTau);
      whineGain.gain.setTargetAtTime(p.turbo ? WHINE_LEVEL : pr.blower * (0.5 + 0.5 * p.rpm01), t, SMOOTH * 2);
      lowpass.frequency.setTargetAtTime(pr.cutoff + p.throttle * pr.cutoffThrottle, t, SMOOTH * 2);
      noiseGain.gain.setTargetAtTime(n, t, SMOOTH * 2);
      gate.gain.setTargetAtTime(n * pr.pulse, t, SMOOTH * 2);
      wobblePitch.gain.setTargetAtTime(pr.wobbleCents * idle, t, SMOOTH * 2);
      wobbleCutoff.gain.setTargetAtTime(pr.wobbleCutoff * idle, t, SMOOTH * 2);
      out.gain.setTargetAtTime(p.gain * pr.level, t, SMOOTH);
      panner.pan.setTargetAtTime(p.pan, t, SMOOTH);
    },
    kill(t) {
      if (!alive) return;
      alive = false;
      for (const param of [saw.frequency, sub.frequency, whine.frequency]) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.exponentialRampToValueAtTime(Math.max(1, param.value * WRECK_PITCH), t + WRECK_DROP);
      }
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + WRECK_DROP);
      stop(t + WRECK_DROP + 0.02);
    },
    stop(when) {
      alive = false;
      stop(when);
    },
  };
}
