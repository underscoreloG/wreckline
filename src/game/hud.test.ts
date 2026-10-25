import { describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import type { HudState, RaceSnapshot, SimEvent } from '../shared/contracts';
import { SIM_HZ } from '../shared/contracts';
import { createFakeSim } from '../sim';
import { BANNER_SECONDS, createHudMemo, deriveHud, KILL_FEED_LIFE } from './hud';

const setup = buildQuickRaceSetup({ seed: 3 });
const base = createFakeSim(setup).snapshot();

/** Snapshot at `tick` with race time following it (racing from tick 0, which is fine for HUD maths). */
const at = (tick: number, patch: Partial<RaceSnapshot> = {}): RaceSnapshot => ({ ...base, phase: 'racing', countdown: 0, tick, time: tick / SIM_HZ, ...patch });

describe('deriveHud', () => {
  it('maps the player car and the field', () => {
    const memo = createHudMemo();
    const hud = deriveHud(base, [], null, setup, memo);
    expect(hud.carCount).toBe(4);
    expect(hud.lap).toBe(1);
    expect(hud.laps).toBe(setup.laps);
    expect(hud.minimap.cars.map((c) => c.color)).toEqual(setup.entrants.map((e) => e.color));
    expect(hud.banner).toBeNull();
  });

  it('shows GO!, LAP 2 and FINAL LAP banners and expires them after 1.5 s', () => {
    const memo = createHudMemo();
    let hud: HudState = deriveHud(at(0), [{ type: 'raceStart' }], null, setup, memo);
    expect(hud.banner).toBe('GO!');
    hud = deriveHud(at(60), [], hud, setup, memo);
    expect(hud.banner).toBe('GO!');
    hud = deriveHud(at(Math.round(BANNER_SECONDS * SIM_HZ) + 1), [], hud, setup, memo);
    expect(hud.banner).toBeNull();

    hud = deriveHud(at(3000), [{ type: 'lapCompleted', car: 0, lap: 1, lapTime: 45 }], hud, setup, memo);
    expect(hud.banner).toBe('LAP 2');
    // Another car's lap does not touch the player's banner.
    hud = deriveHud(at(3010), [{ type: 'lapCompleted', car: 2, lap: 2, lapTime: 44 }], hud, setup, memo);
    expect(hud.banner).toBe('LAP 2');
    const final: SimEvent[] = [
      { type: 'lapCompleted', car: 0, lap: 2, lapTime: 44 },
      { type: 'finalLap', car: 0 },
    ];
    hud = deriveHud(at(6000), final, hud, setup, memo);
    expect(hud.banner).toBe('FINAL LAP');
    hud = deriveHud(at(9000), [{ type: 'lapCompleted', car: 0, lap: 3, lapTime: 44 }, { type: 'carFinished', car: 0, position: 1, time: 150 }], hud, setup, memo);
    expect(hud.banner).toBe('FINISHED');
  });

  it('kill feed names the cars and drops items after 4 s of race time', () => {
    const memo = createHudMemo();
    let hud = deriveHud(at(600), [{ type: 'carWrecked', car: 2, by: 0, pos: { x: 0, y: 0 } }], null, setup, memo);
    expect(hud.killFeed).toHaveLength(1);
    expect(hud.killFeed[0]?.text).toBe(`YOU wrecked ${setup.entrants[2]?.name}`);
    hud = deriveHud(at(600 + 3 * SIM_HZ), [{ type: 'carWrecked', car: 3, by: null, pos: { x: 0, y: 0 } }], hud, setup, memo);
    expect(hud.killFeed.map((k) => k.id)).toEqual([1, 2]);
    expect(hud.killFeed[1]?.text).toBe(`${setup.entrants[3]?.name} crashed out`);
    hud = deriveHud(at(600 + KILL_FEED_LIFE * SIM_HZ - 1), [], hud, setup, memo);
    expect(hud.killFeed).toHaveLength(2);
    hud = deriveHud(at(600 + KILL_FEED_LIFE * SIM_HZ), [], hud, setup, memo);
    expect(hud.killFeed.map((k) => k.id)).toEqual([2]);
  });

  it('player wreck shows WRECKED', () => {
    const hud = deriveHud(at(100), [{ type: 'carWrecked', car: 0, by: 1, pos: { x: 0, y: 0 } }], null, setup, createHudMemo());
    expect(hud.banner).toBe('WRECKED');
  });

  it('hitFlash adds 0.6 per player damage event, caps at 1 and decays 2/s', () => {
    const memo = createHudMemo();
    const dmg = (car: number): SimEvent => ({ type: 'carDamaged', car, amount: 5, source: 'gun', by: 1, pos: { x: 0, y: 0 } });
    let hud = deriveHud(at(0), [dmg(0)], null, setup, memo);
    expect(hud.hitFlash).toBeCloseTo(0.6);
    hud = deriveHud(at(0), [dmg(0), dmg(2)], hud, setup, memo);
    expect(hud.hitFlash).toBe(1);
    hud = deriveHud(at(15), [], hud, setup, memo); // 0.25 s
    expect(hud.hitFlash).toBeCloseTo(0.5);
    hud = deriveHud(at(60), [], hud, setup, memo);
    expect(hud.hitFlash).toBe(0);
  });
});
