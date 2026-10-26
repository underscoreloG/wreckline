import { setRpm, stepMix } from './bench';
import { SMOOTH, TURBO_PITCH, WHINE_LEVEL, WRECK_DROP, WRECK_PITCH, type EngineVoice } from './engine';
import { profileFrequency, type EngineProfile } from './engineProfiles';
import type { EngineSet } from './engineSets';

// Recorded engine voice (WP28): the car's rev-band loops crossfaded by rpm and throttle (bench.ts), each loop's
// playbackRate following rpm. Only steps with a non-zero gain play: a loop starts when its gain rises above zero and
// stops once it has been silent for FADE, so a set with on and off loads plays at most 4 loops (2 rpm steps x 2 loads).
// Turbo lifts the pitch and adds the synth's whine (the car's WP25 profile numbers); a wreck drops the pitch and fades.
/** Gain on every loop, so a recorded car sits at the synth engines' loudness (offline check in ?harness=audio). */
export const RECORDED_LEVEL = 5;
export const MAX_SOURCES = 4;
const ON = 1e-3; // a gain under this is silence
const FADE = 0.03; // s a loop stays silent before it stops
const THROTTLE_TAU = 0.15; // s: the game's throttle flips per frame, the load crossfade follows its average
const OFFSET_STEP = 0.37; // s into the loops per car, so two cars with one set do not play in phase

/** Where a step's loop starts playing for the car at race index `index` (s into the buffer). */
export function loopOffset(step: { loopStart: number; loopEnd: number }, index: number): number {
  return step.loopStart + ((index * OFFSET_STEP) % (step.loopEnd - step.loopStart));
}

interface Slot {
  gain: GainNode;
  src: AudioBufferSourceNode | null;
  silentSince: number; // -1 while sounding
}

export function createRecordedEngineVoice(ctx: BaseAudioContext, dest: AudioNode, now: number, set: EngineSet, pr: EngineProfile, index = 0): EngineVoice {
  const out = ctx.createGain();
  out.gain.value = 0;
  const panner = ctx.createStereoPanner();
  const whine = ctx.createOscillator();
  whine.type = 'sine';
  whine.frequency.value = profileFrequency(pr, 0) * pr.whineRatio;
  const whineGain = ctx.createGain();
  whineGain.gain.value = 0;
  whine.connect(whineGain).connect(out);
  out.connect(panner).connect(dest);
  whine.start(now);
  const slots: Slot[] = set.steps.map(() => {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(out);
    return { gain, src: null, silentSince: -1 };
  });

  let alive = true;
  let throttle = -1; // smoothed, -1 until the first set
  let lastT = now;
  const live = (): number => slots.reduce((n, s) => n + (s.src ? 1 : 0), 0);

  const release = (slot: Slot, when: number): void => {
    slot.src?.stop(when);
    slot.src = null;
    slot.silentSince = -1;
  };

  const start = (i: number, rate: number, t: number): void => {
    // At the cap, the longest-silent loop makes room: its gain is already at zero.
    if (live() >= MAX_SOURCES) {
      const silent = slots.filter((s) => s.src && s.silentSince >= 0).sort((a, b) => a.silentSince - b.silentSince)[0];
      if (silent) release(silent, t);
    }
    const step = set.steps[i]!;
    const src = ctx.createBufferSource();
    src.buffer = step.buffer;
    src.loop = true;
    src.loopStart = step.loopStart;
    src.loopEnd = step.loopEnd;
    src.playbackRate.value = rate;
    src.connect(slots[i]!.gain);
    src.start(t, loopOffset(step, index));
    slots[i]!.src = src;
  };

  const stopAll = (when: number): void => {
    for (const s of slots) release(s, when);
    whine.stop(when);
    whine.onended = () => panner.disconnect();
  };

  return {
    get alive() {
      return alive;
    },
    get sources() {
      return alive ? live() : 0;
    },
    set(p, t) {
      if (!alive) return;
      throttle = throttle < 0 ? p.throttle : throttle + (p.throttle - throttle) * (1 - Math.exp(-Math.max(0, t - lastT) / THROTTLE_TAU));
      lastT = t;
      const pitch = p.turbo ? TURBO_PITCH : 1;
      const mix = stepMix(set.steps, setRpm(set.steps, p.rpm01), throttle);
      // Silent loops first, so a loop starting in this update finds the room they leave.
      mix.forEach((m, i) => {
        const slot = slots[i]!;
        if (m.gain > ON || !slot.src) return;
        slot.gain.gain.setTargetAtTime(0, t, FADE / 3);
        if (slot.silentSince < 0) slot.silentSince = t;
        else if (t - slot.silentSince >= FADE) release(slot, t);
      });
      mix.forEach((m, i) => {
        const slot = slots[i]!;
        if (m.gain <= ON) return;
        if (!slot.src) start(i, m.rate * pitch, t);
        slot.silentSince = -1;
        slot.gain.gain.setTargetAtTime(m.gain * RECORDED_LEVEL, t, SMOOTH);
        slot.src!.playbackRate.setTargetAtTime(m.rate * pitch, t, pr.revTau);
      });
      whine.frequency.setTargetAtTime(profileFrequency(pr, p.rpm01) * pitch * pr.whineRatio, t, pr.revTau);
      whineGain.gain.setTargetAtTime(p.turbo ? WHINE_LEVEL : pr.blower * (0.5 + 0.5 * p.rpm01), t, SMOOTH * 2);
      out.gain.setTargetAtTime(p.gain, t, SMOOTH);
      panner.pan.setTargetAtTime(p.pan, t, SMOOTH);
    },
    kill(t) {
      if (!alive) return;
      alive = false;
      const params = [whine.frequency, ...slots.flatMap((s) => (s.src ? [s.src.playbackRate] : []))];
      for (const param of params) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.exponentialRampToValueAtTime(Math.max(1e-3, param.value * WRECK_PITCH), t + WRECK_DROP);
      }
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + WRECK_DROP);
      stopAll(t + WRECK_DROP + 0.02);
    },
    stop(when) {
      alive = false;
      stopAll(when);
    },
  };
}
