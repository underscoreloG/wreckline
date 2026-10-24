import { getNoise } from './noise';

// Skid recipe (WP05): looping noise -> bandpass 900 Hz -> gain (0.12 while drifting, 80 ms ramp) -> pan.
export const SKID_GAIN = 0.12;
const SKID_FREQ = 900;
const SKID_Q = 1.2;
const RAMP_TAU = 0.08 / 3; // setTargetAtTime reaches 95% in 3 time constants
const OFFSET_STEP = 0.37; // s into the noise buffer per car, so cars do not skid in unison

export interface SkidVoice {
  set(gain: number, pan: number, now: number): void;
  stop(when: number): void;
}

export function createSkidVoice(ctx: BaseAudioContext, dest: AudioNode, now: number, index: number): SkidVoice {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx).white;
  src.loop = true;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = SKID_FREQ;
  bandpass.Q.value = SKID_Q;
  const out = ctx.createGain();
  out.gain.value = 0;
  const panner = ctx.createStereoPanner();
  src.connect(bandpass).connect(out).connect(panner).connect(dest);
  src.start(now, (index * OFFSET_STEP) % 2);
  src.onended = () => panner.disconnect();
  return {
    set(gain, pan, t) {
      out.gain.setTargetAtTime(gain, t, RAMP_TAU);
      panner.pan.setTargetAtTime(pan, t, RAMP_TAU);
    },
    stop(when) {
      src.stop(when);
    },
  };
}
