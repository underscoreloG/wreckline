import { getCar, STARTER_CAR_ID } from '../content/cars';
import type { AudioEngine, CarId, CarState, PickupKind, RaceSnapshot, UiSound, Vec2 } from '../shared/contracts';
import { buildBus, fadeRace, setBusVolumes, type Bus } from './bus';
import { createEngineVoice, ENGINE_GAIN_AI, ENGINE_GAIN_PLAYER, type EngineVoice } from './engine';
import { playSfx, type SfxName } from './sfx';
import { createSkidVoice, SKID_GAIN, type SkidVoice } from './skid';
import { distanceFalloff, MAX_VOICES, panFor, VoicePool, type Voice } from './voices';

// The snapshot carries no per-car stats, so rpm uses the stock starter car's top speed (faster cars sit at the top of gear 3).
const RPM_REF_SPEED = getCar(STARTER_CAR_ID).base.maxSpeed;
const MINE_BEEP_RANGE = 20; // m
const MINE_BEEP_PERIOD = 0.5; // s
const MAX_BEEPING_MINES = 3;
const IMPACT_FULL_SPEED = 25; // m/s

const UI_SFX: Readonly<Record<UiSound, SfxName>> = { move: 'uiMove', confirm: 'uiConfirm', back: 'uiBack', buy: 'uiBuy', error: 'uiError' };
const PICKUP_SFX: Readonly<Record<PickupKind, SfxName>> = { cash: 'pickupCash', repair: 'pickupRepair', mines: 'pickupMines', turbo: 'pickupTurbo' };

interface CarVoices {
  engine: EngineVoice;
  skid: SkidVoice;
  lastSpeed: number;
}

export interface AudioDebug {
  /** Live voices: engine + skid voices still running plus one-shots not yet ended. */
  voices(): number;
  bus(): Bus | null;
  /** Plays one sound straight on the sfx bus (harness buttons). */
  play(name: SfxName): void;
}

export function createAudioEngine(): AudioEngine & AudioDebug {
  let ctx: AudioContext | null = null;
  let bus: Bus | null = null;
  let master = 1;
  let sfx = 1;
  let cars: CarVoices[] | null = null;
  let raceMuted = false;
  let lastTick = -1;
  const pool = new VoicePool(MAX_VOICES);
  const gunVoices = new Map<CarId, Voice>();
  const mineNextBeep = new Map<number, number>();

  const persistent = (): number => (cars ? cars.reduce((n, c) => n + (c.engine.alive ? 2 : 1), 0) : 0);

  const play = (dest: AudioNode, name: SfxName, gain: number, pan: number): Voice | null => {
    if (!ctx || gain <= 0) return null;
    const now = ctx.currentTime;
    pool.setCap(MAX_VOICES - persistent());
    const v = playSfx(ctx, dest, name, now, gain, pan);
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
    return snapshot.cars.map((car, i) => ({
      engine: createEngineVoice(c, race, now),
      skid: createSkidVoice(c, race, now, i),
      lastSpeed: Math.abs(car.speed),
    }));
  };

  return {
    async unlock() {
      if (!ctx) {
        ctx = new AudioContext();
        bus = buildBus(ctx);
        bus.master.gain.value = master;
        bus.sfx.gain.value = sfx;
      }
      if (ctx.state !== 'running') await ctx.resume();
    },

    setVolumes(m, s) {
      master = Math.max(0, Math.min(1, m));
      sfx = Math.max(0, Math.min(1, s));
      if (bus) setBusVolumes(bus, master, sfx);
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
              rpm01: speed / RPM_REF_SPEED,
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
    },

    voices: () => (ctx ? persistent() + pool.count(ctx.currentTime) : 0),
    bus: () => bus,
    play(name) {
      if (bus) play(bus.sfx, name, 1, 0);
    },
  };
}
