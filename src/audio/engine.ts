import { MIX } from './mix';

// Engine voice recipe (WP05): saw + square at half frequency -> lowpass (Q 4) -> gain -> pan. Levels: MIX.engine.
export const ENGINE_GAIN_PLAYER = MIX.engine.player;
export const ENGINE_GAIN_AI = MIX.engine.ai;
const SUB_LEVEL = 0.5; // square relative to the saw
const LOWPASS_Q = 4;
const CUTOFF_BASE = 400; // Hz
const CUTOFF_THROTTLE = 1800; // Hz added while accelerating
const TURBO_PITCH = 1.15;
const WHINE_RATIO = 9; // whine frequency / engine frequency
const WHINE_LEVEL = 0.25;
const SMOOTH = 0.04; // s, setTargetAtTime constant per update
const WRECK_DROP = 0.3; // s
const WRECK_PITCH = 0.3; // frequency multiplier at the end of the drop

/** Fake 3-gear sawtooth: continuous inside each gear, 83.5-174 Hz overall. */
export function engineFrequency(rpm01: number): number {
  const r = Math.max(0, Math.min(1, rpm01));
  const gear = Math.min(2, Math.floor(r * 3));
  const g = r * 3 - gear;
  return 55 + (g * 0.7 + 0.3) * 95 + gear * 12;
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

export function createEngineVoice(ctx: BaseAudioContext, dest: AudioNode, now: number): EngineVoice {
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  const sub = ctx.createOscillator();
  sub.type = 'square';
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  const subGain = ctx.createGain();
  subGain.gain.value = SUB_LEVEL;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.Q.value = LOWPASS_Q;
  lowpass.frequency.value = CUTOFF_BASE;
  const out = ctx.createGain();
  out.gain.value = 0;
  const panner = ctx.createStereoPanner();

  const f0 = engineFrequency(0);
  saw.frequency.value = f0;
  sub.frequency.value = f0 / 2;
  whine.frequency.value = f0 * WHINE_RATIO;
  saw.connect(lowpass);
  sub.connect(subGain).connect(lowpass);
  lowpass.connect(out);
  // The whine skips the lowpass so it stays audible as a high layer.
  whine.connect(whineGain).connect(out);
  out.connect(panner).connect(dest);
  const oscs = [saw, sub, whine];
  for (const o of oscs) o.start(now);

  let alive = true;
  const stop = (when: number): void => {
    for (const o of oscs) o.stop(when);
    saw.onended = () => panner.disconnect();
  };

  return {
    get alive() {
      return alive;
    },
    set(p, t) {
      if (!alive) return;
      const f = engineFrequency(p.rpm01) * (p.turbo ? TURBO_PITCH : 1);
      saw.frequency.setTargetAtTime(f, t, SMOOTH);
      sub.frequency.setTargetAtTime(f / 2, t, SMOOTH);
      whine.frequency.setTargetAtTime(f * WHINE_RATIO, t, SMOOTH);
      whineGain.gain.setTargetAtTime(p.turbo ? WHINE_LEVEL : 0, t, SMOOTH * 2);
      lowpass.frequency.setTargetAtTime(CUTOFF_BASE + p.throttle * CUTOFF_THROTTLE, t, SMOOTH * 2);
      out.gain.setTargetAtTime(p.gain, t, SMOOTH);
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
