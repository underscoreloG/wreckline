import { MIX } from './mix';
import { playSfx, SFX_CATEGORY, SFX_NAMES, type SfxName } from './sfx';
import type { Voice } from './voices';

// Recorded sounds (WP16): public/sfx/<name>.mp3, made by scripts/sfx/importSfx.mjs. A sound whose file did not
// load plays its synth recipe instead.
const STOP_FADE = 0.01; // s, a retriggered gun cuts the previous shot without a click

const buffers = new Map<SfxName, AudioBuffer>();

export const sampleUrl = (name: SfxName): string => `${import.meta.env.BASE_URL}sfx/${name}.mp3`;

/** Fetches and decodes every sample in parallel; a failure is logged and that sound stays synth. */
export async function loadSamples(ctx: BaseAudioContext): Promise<void> {
  await Promise.all(
    SFX_NAMES.map(async (name) => {
      try {
        const res = await fetch(sampleUrl(name));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch (err) {
        console.warn(`audio: sample ${name} not loaded, using the synth (${String(err)})`);
      }
    }),
  );
}

export const hasSample = (name: SfxName): boolean => buffers.has(name);

/** What `playSound` will play for `name`. */
export const soundSource = (name: SfxName): 'sample' | 'synth' => (hasSample(name) ? 'sample' : 'synth');

/** Plays the loaded sample `name`; same Voice shape as playSfx. `rate` is the playback rate (pitch). */
export function playSample(ctx: BaseAudioContext, dest: AudioNode, name: SfxName, t0: number, gain: number, pan: number, rate = 1): Voice {
  const buffer = buffers.get(name);
  if (!buffer) throw new Error(`audio: sample ${name} is not loaded`);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  src.connect(g).connect(panner).connect(dest);
  src.start(t0);
  src.onended = () => panner.disconnect();
  return {
    end: t0 + buffer.duration / rate,
    stop: () => {
      const now = Math.max(ctx.currentTime, t0);
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + STOP_FADE);
      src.stop(now + STOP_FADE);
    },
  };
}

/** The sample at its MIX level when loaded, else the synth recipe (which ignores `rate`). */
export function playSound(ctx: BaseAudioContext, dest: AudioNode, name: SfxName, t0: number, gain: number, pan: number, rate = 1): Voice {
  if (!hasSample(name)) return playSfx(ctx, dest, name, t0, gain, pan);
  return playSample(ctx, dest, name, t0, gain * MIX.category[SFX_CATEGORY[name]] * MIX.sound[name], pan, rate);
}
