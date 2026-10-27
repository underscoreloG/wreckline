import { describe, expect, it } from 'vitest';
import { aiProfile, profileForSkill } from './ai';
import { CARS, getCar } from './cars';
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

  it('carId: the player drives that car stock, the AI cars stay stock ravens (CCR-10)', () => {
    const raven = getCar('raven');
    for (const car of Object.values(CARS)) {
      const s = buildQuickRaceSetup({ seed: 1, carId: car.id });
      const p = s.entrants[0];
      expect(p.carDefId).toBe(car.id);
      expect(p.stats).toEqual(car.base);
      expect(p.mesh).toEqual(car.mesh);
      expect([p.hp, p.mines, p.turbo, p.color]).toEqual([car.base.maxHp, 3, 4, '#FF5A1F']);
      for (const e of s.entrants.slice(1)) expect([e.carDefId, e.stats]).toEqual(['raven', raven.base]);
    }
    expect(() => buildQuickRaceSetup({ seed: 1, carId: 'nope' })).toThrow();
  });

  it('difficulty (CCR-13) shifts every AI through aiProfile, never the player or autoplay driver', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const s = buildQuickRaceSetup({ seed: 1, aiCount: 5, autoplay: true, difficulty });
      expect(s.entrants[0].ai).toEqual(profileForSkill(0.55));
      expect(s.entrants.slice(1).map((e) => e.ai)).toEqual([0.35, 0.55, 0.75, 0.55, 0.55].map((k) => aiProfile(k, difficulty)));
    }
    expect(buildQuickRaceSetup({ seed: 1 })).toEqual(buildQuickRaceSetup({ seed: 1, difficulty: 'normal' }));
    expect(buildQuickRaceSetup({ seed: 1, difficulty: 'hard' }).entrants.slice(1).map((e) => e.ai?.skill)).toEqual([0.5, 0.7, 1.12].map((k) => expect.closeTo(k, 9)));
  });
});
