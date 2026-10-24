import { describe, expect, it } from 'vitest';
import { profileForSkill } from './ai';
import { getCar } from './cars';
import { buildQuickRaceSetup } from './quickRace';

describe('buildQuickRaceSetup', () => {
  it('defaults: 4 cars, 3 laps, player first, liveries and AI skills in order', () => {
    const s = buildQuickRaceSetup({ seed: 42 });
    expect(s.seed).toBe(42);
    expect(s.laps).toBe(3);
    expect(s.countdownSeconds).toBe(3);
    expect(s.track.id).toBe('scrapyard');
    expect(s.entrants.map((e) => e.id)).toEqual([0, 1, 2, 3]);
    expect(s.entrants.map((e) => e.name)).toEqual(['YOU', 'VEX', 'RAZOR', 'MOTH']);
    expect(s.entrants.map((e) => e.color)).toEqual(['#FF5A1F', '#2EA8FF', '#B65CFF', '#F5D547']);
    expect(s.entrants[0].ai).toBeNull();
    expect(s.entrants.slice(1).map((e) => e.ai?.skill)).toEqual([0.35, 0.55, 0.75]);
    const raven = getCar('raven');
    for (const e of s.entrants) {
      expect(e.carDefId).toBe('raven');
      expect(e.stats).toEqual(raven.base);
      expect(e.hp).toBe(raven.base.maxHp);
      expect(e.mines).toBe(3);
      expect(e.turbo).toBe(4);
    }
  });

  it('autoplay, laps, ai count, extra AIs at 0.55', () => {
    const s = buildQuickRaceSetup({ seed: 1, laps: 2, aiCount: 5, autoplay: true });
    expect(s.laps).toBe(2);
    expect(s.entrants).toHaveLength(6);
    expect(s.entrants[0].ai).toEqual(profileForSkill(0.55));
    expect(s.entrants[4].ai?.skill).toBe(0.55);
    expect(s.entrants[5].ai?.skill).toBe(0.55);
    expect(new Set(s.entrants.map((e) => e.driverId)).size).toBe(6);
    expect(buildQuickRaceSetup({ seed: 1, aiCount: 1 }).entrants).toHaveLength(2);
  });
});
