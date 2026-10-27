import { getCar, STARTER_CAR_ID } from '../content/cars';
import type { AudioEngine, CarId, CarState, PickupKind, RaceSnapshot, UiSound, Vec2 } from '../shared/contracts';
import { buildBus, fadeRace, setBusVolumes, type Bus } from './bus';
import { createEngineVoice, ENGINE_GAIN_AI, ENGINE_GAIN_PLAYER, type EngineVoice } from './engine';
import { DEFAULT_PROFILE_ID, engineProfile } from './engineProfiles';
import { engineSet, loadEngineSets } from './engineSets';
import { createRecordedEngineVoice } from './recordedEngine';
import { MIX } from './mix';
import { createMusicPlayer, MENU_TRACK, pickRaceTrack, type MusicMode, type MusicPlayer, type MusicState } from './music';
import { loadSamples, playSound } from './samples';
import { PITCH_JITTER, pitchRate, type SfxName } from './sfx';
import { createSkidVoice, SKID_GAIN, type SkidVoice } from './skid';
import { distanceFalloff, MAX_VOICES, panFor, RateLimit, VoicePool, type Voice } from './voices';

// The snapshot carries no per-car stats: until the game names the race cars (setRaceCars, CCR-9), every car is a raven
// and rpm uses the stock starter car's top speed.
const RPM_REF_SPEED = getCar(STARTER_CAR_ID).base.maxSpeed;
const MINE_BEEP_RANGE = 20; // m
const MINE_BEEP_PERIOD = 0.5; // s
const MAX_BEEPING_MINES = 3;
const IMPACT_FULL_SPEED = 25; // m/s
const DAMAGE_SOUND_GAP = 0.25; // s, carDamaged plays at most once per gap

const UI_SFX: Readonly<Record<UiSound, SfxName>> = { move: 'uiMove', confirm: 'uiConfirm', back: 'uiBack', buy: 'uiBuy', error: 'uiError' };
const PICKUP_SFX: Readonly<Record<PickupKind, SfxName>> = { cash: 'pickupCash', repair: 'pickupRepair', mines: 'pickupMines', turbo: 'pickupTurbo' };

interface CarVoices {
  engine: EngineVoice;
  recorded: boolean;
  skid: SkidVoice;
  lastSpeed: number;
  maxSpeed: number;
}

export interface AudioDebug {
  /** Live voices: engine + skid voices still running plus one-shots not yet ended. */
  voices(): number;
  bus(): Bus | null;
  /** Plays one sound straight on the sfx bus (harness buttons). */
  play(name: SfxName): void;
  /** Settles when every sample and recorded engine fetch has finished (loaded or fallen back to synth); null before unlock. */
  samples(): Promise<void> | null;
  /** Per race car: which engine voice it plays. */
  engines(): ('recorded' | 'synth')[];
  /** Music (WP35): the mode asked for, the track playing or loading, each live voice's fade gain, the music bus gain. */
  music(): MusicState & { mode: MusicMode; busGain: number | null };
}

export function createAudioEngine(): AudioEngine & AudioDebug {
  let ctx: AudioContext | null = null;
  let bus: Bus | null = null;
  let master = 1;
  let sfx = 1;
  let musicVol = 1;
  let music: MusicPlayer | null = null;
  let musicMode: MusicMode = 'off';
  let musicTrack: string | null = null;
  let playedRace: string | null = null; // track of the last race that played: the next race skips it
  let cue: { seed: number; track: string } | null = null;
  let cars: CarVoices[] | null = null;
  let raceCars: readonly { carDefId: string; maxSpeed: number }[] = [];
  let raceMuted = false;
  let lastTick = -1;
  const pool = new VoicePool(MAX_VOICES);
  const gunVoices = new Map<CarId, Voice>();
  const mineNextBeep = new Map<number, number>();
  const damageLimit = new RateLimit(DAMAGE_SOUND_GAP);
  let samples: Promise<void> | null = null;

  // Engine sources (1 per synth, the playing loops of a recorded set) plus one skid per car.
  const persistent = (): number => (cars ? cars.reduce((n, c) => n + c.engine.sources + 1, 0) : 0);

  const play = (dest: AudioNode, name: SfxName, gain: number, pan: number): Voice | null => {
    if (!ctx || gain <= 0) return null;
    const now = ctx.currentTime;
    pool.setCap(MAX_VOICES - persistent());
    const v = playSound(ctx, dest, name, now, gain, pan, PITCH_JITTER.has(name) ? pitchRate() : 1);
    pool.add(v, now);
    return v;
  };

  const stopCars = (when: number): void => {
    if (!cars) return;
    for (const c of cars) {
      c.engine.stop(when);
      c.skid.stop(when);
    }
    cars = null;
  };

  const buildCars = (snapshot: RaceSnapshot, now: number): CarVoices[] => {
    if (!bus) return [];
    const { ctx: c, race } = bus;
    return snapshot.cars.map((car, i) => {
      const id = raceCars[i]?.carDefId ?? DEFAULT_PROFILE_ID;
      const set = engineSet(id);
      return {
        engine: set ? createRecordedEngineVoice(c, race, now, set, engineProfile(id), i) : createEngineVoice(c, race, now, engineProfile(id), i),
        recorded: set !== undefined,
        skid: createSkidVoice(c, race, now, i),
        lastSpeed: Math.abs(car.speed),
        maxSpeed: raceCars[i]?.maxSpeed ?? RPM_REF_SPEED,
      };
    });
  };

  // One pick per race seed: the prefetch, the start and a resume after pause hear the same track.
  const raceTrack = (seed: number): string => {
    if (cue?.seed !== seed) cue = { seed, track: pickRaceTrack(seed, playedRace) };
    return cue.track;
  };
  const applyMusic = (): void => music?.play(musicTrack, musicMode === 'off' ? 0 : MIX.music[musicMode], musicMode === 'off');

  return {
    async unlock() {
      if (!ctx) {
        ctx = new AudioContext();
        bus = buildBus(ctx);
        bus.master.gain.value = master;
        bus.sfx.gain.value = sfx;
        bus.music.gain.value = musicVol * MIX.bus.music;
        music = createMusicPlayer(ctx, bus.music);
        applyMusic();
      }
      if (ctx.state !== 'running') await ctx.resume();
      if (!samples) {
        const c = ctx;
        // Sets that load after this race's voices were built swap in at the next update.
        const engines = loadEngineSets(c).then(() => {
          if (cars?.some((v, i) => !v.recorded && engineSet(raceCars[i]?.carDefId ?? DEFAULT_PROFILE_ID))) stopCars(c.currentTime);
        });
        samples = Promise.all([loadSamples(c), engines]).then(() => undefined);
      }
    },

    setVolumes(m, s, mu) {
      master = Math.max(0, Math.min(1, m));
      sfx = Math.max(0, Math.min(1, s));
      musicVol = Math.max(0, Math.min(1, mu));
      if (bus) setBusVolumes(bus, master, sfx, musicVol);
    },

    setMusic(mode, seed) {
      const race = seed === undefined ? (cue?.track ?? null) : raceTrack(seed);
      const track = mode === 'race' ? race : mode === 'menu' ? MENU_TRACK : null;
      if (mode === 'race') playedRace = track;
      else if (race && seed !== undefined) music?.prefetch(race);
      if (mode === musicMode && track === musicTrack) return;
      musicMode = mode;
      musicTrack = track;
      applyMusic();
    },

    update(snapshot, events, listener) {
      if (!ctx || !bus) return;
      const now = ctx.currentTime;
      if (raceMuted) {
        fadeRace(bus, true);
        raceMuted = false;
      }
      // A new race (tick went back, or another field size) gets fresh voices, wrecked engines included.
      if (!cars || cars.length !== snapshot.cars.length || snapshot.tick < lastTick) {
        stopCars(now);
        cars = buildCars(snapshot, now);
      }
      lastTick = snapshot.tick;
      const me: CarState | undefined = snapshot.cars[listener] ?? snapshot.cars[0];
      if (!me) return;
      const lp = me.pos;
      const mixAt = (p: Vec2): { gain: number; pan: number } => ({
        gain: distanceFalloff(Math.hypot(p.x - lp.x, p.y - lp.y)),
        pan: panFor(p.x - lp.x),
      });
      const mixCar = (id: CarId): { gain: number; pan: number } => {
        const c = snapshot.cars[id];
        return id === listener || !c ? { gain: 1, pan: 0 } : mixAt(c.pos);
      };

      for (const car of snapshot.cars) {
        const v = cars[car.id];
        if (!v) continue;
        const isMe = car.id === listener;
        const m = isMe ? { gain: 1, pan: 0 } : mixAt(car.pos);
        const speed = Math.abs(car.speed);
        if (car.wrecked) v.engine.kill(now);
        else
          v.engine.set(
            {
              rpm01: speed / v.maxSpeed,
              throttle: speed > v.lastSpeed + 1e-3 ? 1 : 0,
              turbo: car.turboActive,
              gain: (isMe ? ENGINE_GAIN_PLAYER : ENGINE_GAIN_AI) * m.gain,
              pan: m.pan,
            },
            now,
          );
        v.lastSpeed = speed;
        v.skid.set(car.drifting && !car.wrecked ? SKID_GAIN * m.gain : 0, m.pan, now);
      }

      for (const e of events) {
        switch (e.type) {
          case 'countdown':
            play(bus.race, 'countdown', 1, 0);
            break;
          case 'raceStart':
            play(bus.race, 'raceStart', 1, 0);
            break;
          case 'gunShot': {
            const m = mixCar(e.car);
            const prev = gunVoices.get(e.car);
            if (prev) {
              prev.stop();
              pool.remove(prev);
              gunVoices.delete(e.car);
            }
            const v = play(bus.race, 'gun', m.gain, m.pan);
            if (v) gunVoices.set(e.car, v);
            break;
          }
          case 'gunOverheat': {
            const m = mixCar(e.car);
            play(bus.race, 'overheat', m.gain, m.pan);
            break;
          }
          case 'carWrecked': {
            const m = mixAt(e.pos);
            play(bus.race, 'explosionWreck', m.gain, m.pan);
            break;
          }
          case 'mineExploded': {
            const m = mixAt(e.pos);
            play(bus.race, 'explosionMine', m.gain, m.pan);
            break;
          }
          case 'impact': {
            const m = mixAt(e.pos);
            play(bus.race, 'impact', Math.min(1, e.speed / IMPACT_FULL_SPEED) * m.gain, m.pan);
            break;
          }
          case 'pickupCollected':
            // Only the listener's own pickups chime: an AI's pickup jingle reads as the player's.
            if (e.car === listener) play(bus.race, PICKUP_SFX[e.kind], 1, 0);
            break;
          case 'lapCompleted':
            if (e.car === listener) play(bus.race, 'lapCompleted', 1, 0);
            break;
          case 'carDamaged':
            // The player's car only: an AI being hit is already heard as the gunshot or impact.
            if (e.car === listener && damageLimit.allow(now)) play(bus.race, 'carDamaged', 1, 0);
            break;
          case 'mineDropped': {
            const m = mixAt(e.pos);
            play(bus.race, 'mineDropped', m.gain, m.pan);
            break;
          }
          case 'turboStart': {
            const m = mixCar(e.car);
            play(bus.race, 'turbo', m.gain, m.pan);
            break;
          }
          default:
            break;
        }
      }

      // Armed mines near the listener beep, nearest three only.
      const near = snapshot.mines
        .filter((mine) => mine.armed)
        .map((mine) => ({ mine, d: Math.hypot(mine.pos.x - lp.x, mine.pos.y - lp.y) }))
        .filter((x) => x.d <= MINE_BEEP_RANGE)
        .sort((a, b) => a.d - b.d)
        .slice(0, MAX_BEEPING_MINES);
      for (const id of mineNextBeep.keys()) if (!near.some((x) => x.mine.id === id)) mineNextBeep.delete(id);
      for (const { mine } of near) {
        const next = mineNextBeep.get(mine.id) ?? now;
        if (now < next) continue;
        const m = mixAt(mine.pos);
        play(bus.race, 'mineBeep', m.gain, m.pan);
        mineNextBeep.set(mine.id, now - next < MINE_BEEP_PERIOD ? next + MINE_BEEP_PERIOD : now + MINE_BEEP_PERIOD);
      }
    },

    setRaceCars(list) {
      raceCars = list.map((c) => ({ ...c }));
      // The next update builds this race's voices.
      if (ctx) stopCars(ctx.currentTime);
    },

    stopRace() {
      if (!bus) return;
      const end = fadeRace(bus, false);
      raceMuted = true;
      stopCars(end);
      lastTick = -1;
      gunVoices.clear();
      mineNextBeep.clear();
    },

    ui(sound) {
      if (bus) play(bus.ui, UI_SFX[sound], 1, 0);
    },

    dispose() {
      if (!ctx) return;
      stopCars(ctx.currentTime);
      pool.stopAll();
      void ctx.close();
      ctx = null;
      bus = null;
      music = null;
    },

    voices: () => (ctx ? persistent() + pool.count(ctx.currentTime) : 0),
    bus: () => bus,
    samples: () => samples,
    engines: () => (cars ? cars.map((c) => (c.recorded ? 'recorded' : 'synth')) : []),
    music: () => ({ ...(music?.state() ?? { track: musicTrack, voices: [], loaded: [] }), mode: musicMode, busGain: bus ? bus.music.gain.value : null }),
    play(name) {
      if (bus) play(bus.sfx, name, 1, 0);
    },
  };
}
