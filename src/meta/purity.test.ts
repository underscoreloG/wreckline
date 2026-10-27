import { describe, expect, it } from 'vitest';
import type { RaceResult, SaveGame } from '../shared/contracts';
import { createRng } from '../shared/rng';
import { applyRaceResult, buildCareerRaceSetup, generateOffers, ladder, newCareer, newlyBeaten, newlyUnlocked, rankOf, sabotageTarget, unlockedTrackIds } from './career';
import { chooseOffer, playerSkill, shopVisit } from './careerSim';
import { simulateOtherRivals } from './offSim';
import { parseSave, writeSave } from './save';
import { buyCar, buyMines, buySabotage, buyTurbo, buyUpgrade, canAfford, carOffer, repair, shopCars } from './shop';
import { endingScene, passedBeats, storySceneFor, withSceneSeen } from './story';

function deepFreeze<T>(v: T): T {
  if (typeof v === 'object' && v !== null) {
    for (const x of Object.values(v)) deepFreeze(x);
    Object.freeze(v);
  }
  return v;
}

describe('purity (test 7)', () => {
  it('every function runs on deep-frozen inputs and leaves them unchanged', () => {
    for (const [points, pending] of [
      [0, false],
      [23, true],
      [100, false],
      [100, true],
    ] as const) {
      const plain: SaveGame = { ...newCareer(4), points, cash: 50000, hp: 60, upgrades: { engine: 1, tires: 0, armor: 2, gun: 0, fuel: 1, spikes: 2 }, beatenCars: ['blaze'] };
      const { offers } = generateOffers(plain);
      const base: SaveGame = pending ? { ...plain, sabotage: { offerId: offers[1].id, pct: 40, price: offers[1].sabotagePrice } } : plain;
      const save = deepFreeze(structuredClone(base));
      deepFreeze(offers);
      const offer = offers[2];
      const result: RaceResult = deepFreeze({
        trackId: offer.trackId,
        laps: offer.laps,
        rows: [0, 1, 2, 3].map((car) => ({
          car,
          driverId: car === 0 ? 'player' : offer.rivals[car - 1],
          name: 'x',
          position: car + 1,
          finished: true,
          wrecked: false,
          totalTime: 1,
          bestLap: 1,
          wrecksCaused: 1,
          cashPicked: 2,
          hpLeft: 40,
          minesLeft: 1,
          turboLeft: 1,
        })),
      });
      expect(() => {
        rankOf(save);
        ladder(save);
        generateOffers(save);
        unlockedTrackIds(save);
        newlyUnlocked(save, save);
        newlyBeaten(save, save);
        for (const o of offers) {
          sabotageTarget(save, o);
          buySabotage(save, o);
          buildCareerRaceSetup(save, o, 7);
          applyRaceResult(save, o, result);
          simulateOtherRivals(save, o, createRng(1));
          withSceneSeen(save, storySceneFor(save, o).id);
        }
        endingScene(save);
        passedBeats(save);
        shopCars(save);
        carOffer(save, 'blaze');
        canAfford(save, 10);
        for (const k of ['engine', 'tires', 'armor', 'gun', 'fuel', 'spikes'] as const) buyUpgrade(save, k);
        buyCar(save, 'viper');
        repair(save, 10);
        buyMines(save, 2);
        buyTurbo(save, 2);
        writeSave({ get: () => null, set: () => {}, remove: () => {} }, save);
        parseSave(save);
        playerSkill(save);
        chooseOffer(save, offers, 'greedy');
        shopVisit(save);
      }).not.toThrow();
      expect(save).toEqual(base);
    }
  });
});
