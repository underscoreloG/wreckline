import { ARENA_SUDDEN_DEATH_AT } from '../content/arenas/rules';
import type { HudState, KillFeedItem, RaceSetup, RaceSnapshot, SimEvent } from '../shared/contracts';
import { PLAYER_CAR_ID, SIM_DT } from '../shared/contracts';

export const BANNER_SECONDS = 1.5;
export const KILL_FEED_LIFE = 4; // s of race time (contracts)
export const HIT_FLASH_PER_HIT = 0.6;
export const HIT_FLASH_DECAY = 2; // per s
const KILL_FEED_MAX = 5; // the UI shows 3, a little slack for items fading out
const MS_TO_KMH = 3.6;

/** Module-internal HUD memory that HudState does not carry (owned by the race session). */
export interface HudMemo {
  bannerUntilTick: number;
  lastTick: number;
  nextFeedId: number;
}

export const createHudMemo = (): HudMemo => ({ bannerUntilTick: 0, lastTick: -1, nextFeedId: 1 });

/** HUD state from the latest snapshot and every event since the previous call. Updates `memo`. */
export function deriveHud(snap: RaceSnapshot, events: readonly SimEvent[], prev: HudState | null, setup: RaceSetup, memo: HudMemo): HudState {
  const me = snap.cars[PLAYER_CAR_ID];
  if (!me) throw new Error('deriveHud: no player car in snapshot');
  const name = (id: number): string => setup.entrants[id]?.name ?? `CAR ${id}`;
  // Ticks, not race time: race time stops at the finish but flashes and banners must still fade.
  const dt = memo.lastTick < 0 ? 0 : Math.max(0, snap.tick - memo.lastTick) * SIM_DT;
  memo.lastTick = snap.tick;

  let banner = prev && snap.tick < memo.bannerUntilTick ? prev.banner : null;
  let hitFlash = Math.max(0, (prev?.hitFlash ?? 0) - HIT_FLASH_DECAY * dt);
  const feed: KillFeedItem[] = (prev?.killFeed ?? []).filter((it) => snap.time - it.time < KILL_FEED_LIFE);
  const show = (text: string): void => {
    banner = text;
    memo.bannerUntilTick = snap.tick + Math.round(BANNER_SECONDS / SIM_DT);
  };

  const arena = setup.mode === 'arena';
  if (arena && prev && prev.raceTime < ARENA_SUDDEN_DEATH_AT && snap.time >= ARENA_SUDDEN_DEATH_AT) show('SUDDEN DEATH');
  for (const e of events) {
    switch (e.type) {
      case 'raceFinished':
        // WP41: the fight is over; a race's own end has no banner (FINISHED came with the player's line).
        if (arena) show(me.wrecked ? 'FIGHT OVER' : 'LAST CAR STANDING');
        break;
      case 'raceStart':
        show('GO!');
        break;
      case 'lapCompleted':
        if (e.car === PLAYER_CAR_ID && e.lap < snap.laps) show(`LAP ${e.lap + 1}`);
        break;
      case 'finalLap':
        if (e.car === PLAYER_CAR_ID) show('FINAL LAP');
        break;
      case 'carFinished':
        if (e.car === PLAYER_CAR_ID) show('FINISHED');
        break;
      case 'carWrecked': {
        const text = e.by !== null && e.by !== e.car ? `${name(e.by)} wrecked ${name(e.car)}` : `${name(e.car)} crashed out`;
        feed.push({ id: memo.nextFeedId++, text, time: snap.time });
        if (e.car === PLAYER_CAR_ID) show('WRECKED');
        break;
      }
      case 'carDamaged':
        if (e.car === PLAYER_CAR_ID) hitFlash = Math.min(1, hitFlash + HIT_FLASH_PER_HIT);
        break;
      default:
        break;
    }
  }

  return {
    position: me.position,
    carCount: snap.cars.length,
    lap: Math.min(snap.laps, me.lap + 1),
    laps: snap.laps,
    raceTime: snap.time,
    lapTime: snap.phase === 'countdown' ? 0 : Math.max(0, snap.time - me.currentLapStart),
    bestLap: me.bestLapTime,
    speedKmh: Math.abs(me.speed) * MS_TO_KMH,
    hp: me.hp,
    maxHp: me.maxHp,
    turbo: me.turbo,
    turboActive: me.turboActive,
    mines: me.mines,
    gunHeat: me.gunHeat,
    gunOverheated: me.gunOverheated,
    countdown: snap.countdown,
    banner,
    wrongWay: me.wrongWay,
    minimap: {
      cars: snap.cars.map((c) => ({ id: c.id, pos: { x: c.pos.x, y: c.pos.y }, color: setup.entrants[c.id]?.color ?? '#ffffff', wrecked: c.wrecked })),
    },
    killFeed: feed.slice(-KILL_FEED_MAX),
    hitFlash,
  };
}
