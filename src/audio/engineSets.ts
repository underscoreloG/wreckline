import type { EngineLoad, EngineStep } from './bench';

// Recorded engine sets (WP28): public/sfx/engines/manifest.json and the loops it lists, made by
// scripts/sfx/importEngines.mjs. A car plays its set only when every file of it loaded; otherwise its synth profile.

export interface ManifestStep extends EngineStep {
  slot: string;
  file: string; // relative to sfx/engines/
  loopStart: number; // s, measured on the decoded file
  loopEnd: number;
}

export interface EngineManifest {
  cars: Record<string, { steps: ManifestStep[] }>;
}

export interface EngineSetStep extends EngineStep {
  buffer: AudioBuffer;
  loopStart: number;
  loopEnd: number;
}

export interface EngineSet {
  car: string;
  steps: readonly EngineSetStep[];
}

const LOADS: readonly EngineLoad[] = ['on', 'off', 'any'];

const sets = new Map<string, EngineSet>();

export const engineFileUrl = (file: string): string => `${import.meta.env.BASE_URL}sfx/engines/${file}`;

/** Why a manifest entry cannot be played, or null: the crossfade needs distinct rpms per load and no 'any' next to on/off. */
function invalid(steps: readonly ManifestStep[]): string | null {
  if (!steps.length) return 'no steps';
  for (const s of steps) {
    if (!LOADS.includes(s.load)) return `${s.slot}: unknown load ${String(s.load)}`;
    if (!(s.rpm > 0) || !(s.loopEnd > s.loopStart) || !(s.loopStart >= 0)) return `${s.slot}: bad rpm or loop points`;
  }
  if (steps.some((s) => s.load === 'any') && steps.some((s) => s.load !== 'any')) return "'any' mixed with on/off";
  for (const load of LOADS) {
    const rpms = steps.filter((s) => s.load === load).map((s) => s.rpm);
    if (new Set(rpms).size !== rpms.length) return `two ${load} steps at one rpm`;
  }
  return null;
}

/** Fetches the manifest and every set in parallel; a car with any failed file is logged once and stays synth. */
export async function loadEngineSets(ctx: BaseAudioContext): Promise<void> {
  let manifest: EngineManifest;
  try {
    const res = await fetch(engineFileUrl('manifest.json'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    manifest = (await res.json()) as EngineManifest;
  } catch (err) {
    console.warn(`audio: recorded engine manifest not loaded, every car uses its synth (${String(err)})`);
    return;
  }
  await Promise.all(
    Object.entries(manifest.cars ?? {}).map(async ([car, { steps }]) => {
      try {
        const why = invalid(steps);
        if (why) throw new Error(why);
        const loaded = await Promise.all(
          steps.map(async (s) => {
            const res = await fetch(engineFileUrl(s.file));
            if (!res.ok) throw new Error(`${s.file}: HTTP ${res.status}`);
            const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
            return { rpm: s.rpm, load: s.load, buffer, loopStart: s.loopStart, loopEnd: Math.min(s.loopEnd, buffer.duration) };
          }),
        );
        sets.set(car, { car, steps: loaded });
      } catch (err) {
        console.warn(`audio: recorded engine ${car} not loaded, using its synth (${String(err)})`);
      }
    }),
  );
}

/** The car's recorded set when it loaded, else undefined (synth). */
export const engineSet = (carDefId: string): EngineSet | undefined => sets.get(carDefId);

export const recordedCars = (): string[] => [...sets.keys()];
