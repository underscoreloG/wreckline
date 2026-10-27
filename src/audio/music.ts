import { rampTo } from './bus';

// Background music (WP35): public/music/<id>.ogg and manifest.json, made by scripts/sfx/importMusic.mjs. A playing
// track is a buffer source looping loopStart..loopEnd into its own fade gain into the music bus. A track is fetched
// only when it is about to play; a missing or broken file is logged once and that track stays silent.

export type MusicMode = 'off' | 'menu' | 'race';

export const RACE_TRACKS = ['darknessRoad', 'systemOverload', 'hotRoadway', 'awake', 'glutton', 'hyperflight'] as const;
export const MENU_TRACK = 'hyperton';
export const MUSIC_FADE_IN = 1.5; // s
export const MUSIC_FADE_OUT = 0.8; // s

export interface MusicTrack {
  file: string; // relative to music/
  use: 'race' | 'menu';
  loopStart: number; // s, measured on the decoded file
  loopEnd: number;
  duration: number;
}

export interface MusicManifest {
  tracks: Record<string, MusicTrack>;
}

export const musicFileUrl = (file: string): string => `${import.meta.env.BASE_URL}music/${file}`;

/** The race track for `seed` (a hash of it picks one); the track of the race before, `previous`, is skipped. */
export function pickRaceTrack(seed: number, previous: string | null): string {
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  let i = h % RACE_TRACKS.length;
  if (RACE_TRACKS[i] === previous) i = (i + 1) % RACE_TRACKS.length;
  return RACE_TRACKS[i]!;
}

export interface MusicState {
  track: string | null;
  voices: { id: string; gain: number }[];
  loaded: string[];
}

export interface MusicPlayer {
  /**
   * Fades `track` (null: none) in to `level`, from where it is if it still plays; every other track fades out and
   * stops, or with `keep` stays silent where it is so a later call resumes it.
   */
  play(track: string | null, level: number, keep: boolean): void;
  prefetch(track: string): void;
  state(): MusicState;
}

interface Loaded {
  buffer: AudioBuffer;
  loopStart: number;
  loopEnd: number;
}

export function createMusicPlayer(ctx: BaseAudioContext, dest: AudioNode): MusicPlayer {
  let manifest: Promise<MusicManifest | null> | null = null;
  const buffers = new Map<string, Promise<Loaded | null>>();
  const loaded = new Set<string>();
  const voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  let target: string | null = null;
  let level = 0;

  const loadManifest = (): Promise<MusicManifest | null> =>
    (manifest ??= fetch(musicFileUrl('manifest.json'))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as MusicManifest;
      })
      .catch((err: unknown) => {
        console.warn(`audio: music manifest not loaded, no music (${String(err)})`);
        return null;
      }));

  const load = (id: string): Promise<Loaded | null> => {
    let p = buffers.get(id);
    if (!p) {
      p = loadManifest().then(async (m) => {
        if (!m) return null;
        try {
          const t = m.tracks?.[id];
          if (!t || !(t.loopStart >= 0) || !(t.loopEnd > t.loopStart)) throw new Error('no valid manifest entry');
          const res = await fetch(musicFileUrl(t.file));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
          loaded.add(id);
          return { buffer, loopStart: t.loopStart, loopEnd: Math.min(t.loopEnd, buffer.duration) };
        } catch (err) {
          console.warn(`audio: music ${id} not loaded, silent (${String(err)})`);
          return null;
        }
      });
      buffers.set(id, p);
    }
    return p;
  };

  const start = (id: string): void => {
    void load(id).then((l) => {
      // Another call may have changed the target, or started this track, while it loaded.
      if (!l || target !== id || voices.has(id)) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = l.buffer;
      src.loop = true;
      src.loopStart = l.loopStart;
      src.loopEnd = l.loopEnd;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(dest);
      src.start(now);
      rampTo(gain.gain, level, now, MUSIC_FADE_IN);
      voices.set(id, { src, gain });
    });
  };

  return {
    play(track, lvl, keep) {
      target = track;
      level = lvl;
      const now = ctx.currentTime;
      for (const [id, v] of voices) {
        if (id === track) continue;
        rampTo(v.gain.gain, 0, now, MUSIC_FADE_OUT);
        if (keep) continue;
        v.src.onended = () => v.gain.disconnect();
        v.src.stop(now + MUSIC_FADE_OUT);
        voices.delete(id);
      }
      if (!track) return;
      const v = voices.get(track);
      if (v) rampTo(v.gain.gain, level, now, MUSIC_FADE_IN);
      else start(track);
    },
    prefetch(track) {
      void load(track);
    },
    state: () => ({ track: target, voices: [...voices].map(([id, v]) => ({ id, gain: v.gain.gain.value })), loaded: [...loaded] }),
  };
}
