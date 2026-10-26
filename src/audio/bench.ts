// Recorded engine math (WP28, from the WP25 test bench): crossfade a rev-band set of loops by rpm and throttle, and
// map the game's rpm01 onto a set's rpm range. Pure functions, so they are tested without Web Audio.
/** 'on' full load, 'off' zero load, 'any' a set recorded at one load only. */
export type EngineLoad = 'on' | 'off' | 'any';

export interface EngineStep {
  rpm: number;
  load: EngineLoad;
}

export interface StepMix {
  gain: number; // equal-power weight
  rate: number; // playbackRate, so the loop's pitch follows rpm
}

/** Most a loop is pitched up above the top step (turbo overspeed). */
export const MAX_PITCH_UP = 1.5;

/**
 * Per step (same order as `steps`): inside each load, an equal-power crossfade between the two steps around `rpm`
 * (the nearest one alone outside them); between on and off load an equal-power crossfade by throttle (0..1) when the
 * set has both, else the load plays at full weight. Every step's rate is rpm / its own rpm.
 */
export function stepMix(steps: readonly EngineStep[], rpm: number, throttle: number): StepMix[] {
  const t = Math.max(0, Math.min(1, throttle));
  const mix = steps.map((s) => ({ gain: 0, rate: rpm / s.rpm }));
  const both = steps.some((s) => s.load === 'on') && steps.some((s) => s.load === 'off');
  for (const load of new Set(steps.map((s) => s.load))) {
    const loadGain = !both || load === 'any' ? 1 : load === 'on' ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    const idx = steps.flatMap((s, i) => (s.load === load ? [i] : [])).sort((a, b) => steps[a]!.rpm - steps[b]!.rpm);
    const first = idx[0]!;
    const last = idx[idx.length - 1]!;
    if (rpm <= steps[first]!.rpm) mix[first]!.gain = loadGain;
    else if (rpm >= steps[last]!.rpm) mix[last]!.gain = loadGain;
    else
      for (let k = 0; k + 1 < idx.length; k++) {
        const lo = steps[idx[k]!]!.rpm;
        const hi = steps[idx[k + 1]!]!.rpm;
        if (rpm < lo || rpm > hi) continue;
        const x = (rpm - lo) / (hi - lo);
        mix[idx[k]!]!.gain = loadGain * Math.cos((x * Math.PI) / 2);
        mix[idx[k + 1]!]!.gain = loadGain * Math.sin((x * Math.PI) / 2);
        break;
      }
  }
  return mix;
}

/** rpm01 0..1 spans the set's idle step to its top step; above 1 the rpm keeps rising, capped at MAX_PITCH_UP x the top step. */
export function setRpm(steps: readonly EngineStep[], rpm01: number): number {
  const lo = Math.min(...steps.map((s) => s.rpm));
  const hi = Math.max(...steps.map((s) => s.rpm));
  return Math.min(lo + Math.max(0, rpm01) * (hi - lo), hi * MAX_PITCH_UP);
}

export const SWEEP_SECONDS = 4;

/** The 4 s rev sweep: idle -> max with throttle on, then max -> idle off throttle. */
export function sweepAt(t: number): { rpm01: number; throttle: number } {
  const half = SWEEP_SECONDS / 2;
  const x = Math.max(0, Math.min(SWEEP_SECONDS, t));
  return x < half ? { rpm01: x / half, throttle: 1 } : { rpm01: 2 - x / half, throttle: 0 };
}
