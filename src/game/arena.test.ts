import { describe, expect, it } from 'vitest';
import { ARENA_SUDDEN_DEATH_AT } from '../content/arenas/rules';
import { buildArenaSetup } from '../content/arenas/setup';
import type { CarState, RaceSnapshot } from '../shared/contracts';
import { decorateArenaHud, spectateTarget } from './arena';
import { createHudMemo, deriveHud } from './hud';

const car = (id: number, position: number, wrecked = false): CarState => ({ id, position, wrecked }) as CarState;
const snap = (cars: CarState[], time = 50): RaceSnapshot => ({ tick: Math.round(time * 60), time, phase: 'racing', countdown: 0, laps: 1, cars, mines: [], pickups: [] });

describe('arena game side (WP41)', () => {
  it('spectates the leader, keeps watching that car while it runs, never the player', () => {
    const s = snap([car(0, 8, true), car(1, 3), car(2, 1), car(3, 2)]);
    expect(spectateTarget(s, null)).toBe(2);
    expect(spectateTarget(s, 3)).toBe(3);
    expect(spectateTarget(snap([car(0, 1), car(1, 2, true)]), null)).toBeNull();
    expect(spectateTarget(snap([car(0, 8, true), car(1, 1), car(2, 2, true)]), 2)).toBe(1);
  });

  it('the HUD readout: cars left and the sudden death clock', () => {
    const s = snap([car(0, 1), car(1, 2), car(2, 3, true)], 100);
    const hud = decorateArenaHud({} as never, s, null);
    expect(hud.arena).toEqual({ alive: 2, suddenDeathIn: ARENA_SUDDEN_DEATH_AT - 100, spectating: null });
    expect(decorateArenaHud({} as never, snap(s.cars, ARENA_SUDDEN_DEATH_AT + 5), 1).arena?.suddenDeathIn).toBe(0);
  });

  it('banners: SUDDEN DEATH when the clock crosses it, LAST CAR STANDING or FIGHT OVER at the end', () => {
    const setup = buildArenaSetup({ seed: 1 });
    const memo = createHudMemo();
    const full = (time: number, playerWrecked = false): RaceSnapshot => ({
      ...snap([], time),
      cars: setup.entrants.map((_, i) => ({ id: i, pos: { x: 0, y: 0 }, heading: 0, vel: { x: 0, y: 0 }, speed: 0, hp: 50, maxHp: 100, wrecked: i === 0 && playerWrecked, position: i + 1, lap: 0, currentLapStart: 0 }) as unknown as CarState),
    });
    let hud = deriveHud(full(ARENA_SUDDEN_DEATH_AT - 0.1), [], null, setup, memo);
    expect(hud.banner).toBeNull();
    hud = deriveHud(full(ARENA_SUDDEN_DEATH_AT + 0.1), [], hud, setup, memo);
    expect(hud.banner).toBe('SUDDEN DEATH');
    expect(deriveHud(full(130), [{ type: 'raceFinished' }], hud, setup, createHudMemo()).banner).toBe('LAST CAR STANDING');
    expect(deriveHud(full(130, true), [{ type: 'raceFinished' }], hud, setup, createHudMemo()).banner).toBe('FIGHT OVER');
  });
});
