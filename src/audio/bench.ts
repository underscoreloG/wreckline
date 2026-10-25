// Recorded-engine test bench (WP25, audio harness only): slot mapping and crossfade math for a rev-band set of loops,
// the Mercedes 190E-16V dyno pack (Chippy569, freesound.org pack 9658, CC0) that the user picks from disk.
export const BENCH_RPMS = [500, 2500, 6500] as const;
export type BenchLoad = 'full' | 'zero';
export const BENCH_LOADS: readonly BenchLoad[] = ['full', 'zero'];

export interface BenchSlot {
  rpm: number;
  load: BenchLoad;
}

/** rpm-major: 500 full, 500 zero, 2500 full, ... */
export const BENCH_SLOTS: readonly BenchSlot[] = BENCH_RPMS.flatMap((rpm) => BENCH_LOADS.map((load) => ({ rpm, load })));

export const slotName = (s: BenchSlot): string => `${s.rpm} ${s.load}`;

/** rpm and load from a file name like `19_2500_D6.wav` (`<nn>_<rpm>_<mic>`); load is null when the name does not say. */
export function parseBenchFile(name: string): { rpm: number; load: BenchLoad | null } | null {
  const tokens = name
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const rpm = BENCH_RPMS.find((r) => tokens.includes(String(r)));
  if (rpm === undefined) return null;
  const has = (re: RegExp): boolean => tokens.some((t) => re.test(t));
  const load = has(/^(full|fullload|wot|onload|loaded)$/) ? 'full' : has(/^(zero|zeroload|noload|offload|unloaded)$/) ? 'zero' : null;
  return { rpm, load };
}

export interface SlotMix {
  gain: number; // equal-power weight
  rate: number; // playbackRate, so the loop's pitch follows rpm
}

/**
 * Per slot (BENCH_SLOTS order): equal-power crossfade between the two loaded rpm steps around `rpm` (the nearest one
 * alone outside them), and between full and zero load by throttle (0..1). A load with no files gives its share to the
 * other. Slots without a file get gain 0; with no file at all every gain is 0.
 */
export function benchMix(rpm: number, throttle: number, loaded: readonly boolean[]): SlotMix[] {
  const t = Math.max(0, Math.min(1, throttle));
  const mix = BENCH_SLOTS.map((s) => ({ gain: 0, rate: rpm / s.rpm }));
  const loadsWithFiles = BENCH_LOADS.filter((load) => BENCH_SLOTS.some((s, i) => s.load === load && loaded[i]));
  for (const load of loadsWithFiles) {
    const loadGain = loadsWithFiles.length === 1 ? 1 : load === 'full' ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    const steps = BENCH_SLOTS.flatMap((s, i) => (s.load === load && loaded[i] ? [i] : []));
    const first = steps[0]!;
    const last = steps[steps.length - 1]!;
    if (rpm <= BENCH_SLOTS[first]!.rpm) mix[first]!.gain = loadGain;
    else if (rpm >= BENCH_SLOTS[last]!.rpm) mix[last]!.gain = loadGain;
    else
      for (let k = 0; k + 1 < steps.length; k++) {
        const lo = BENCH_SLOTS[steps[k]!]!.rpm;
        const hi = BENCH_SLOTS[steps[k + 1]!]!.rpm;
        if (rpm < lo || rpm > hi) continue;
        const x = (rpm - lo) / (hi - lo);
        mix[steps[k]!]!.gain = loadGain * Math.cos((x * Math.PI) / 2);
        mix[steps[k + 1]!]!.gain = loadGain * Math.sin((x * Math.PI) / 2);
        break;
      }
  }
  return mix;
}

export const SWEEP_SECONDS = 4;

/** The 4 s rev sweep: idle -> max with throttle on, then max -> idle off throttle. */
export function sweepAt(t: number): { rpm01: number; throttle: number } {
  const half = SWEEP_SECONDS / 2;
  const x = Math.max(0, Math.min(SWEEP_SECONDS, t));
  return x < half ? { rpm01: x / half, throttle: 1 } : { rpm01: 2 - x / half, throttle: 0 };
}
