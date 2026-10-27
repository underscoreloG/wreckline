import { getCar } from '../content/cars';
import { buildQuickRaceSetup } from '../content/quickRace';
import { generateOffers, newCareer } from '../meta/career';
import { storySceneFor } from '../meta/story';
import type { HudState, Payout, RaceResult, SaveGame, Screen, UiState, Vec2 } from '../shared/contracts';
import { buildTrackGeometry } from '../shared/trackGeometry';

// Harness fixtures built from the real M1 content (Scrapyard, the quick race entrants).

export type HudFixture = 'countdown' | 'mid' | 'critical';

const setup = buildQuickRaceSetup({ seed: 1 });
const geo = buildTrackGeometry(setup.track);
const step = Math.max(1, Math.round(8 / (geo.length / geo.samples.length)));
const minimapPath: Vec2[] = geo.samples.filter((_, i) => i % step === 0).map((s) => ({ ...s.pos }));
const entrants = setup.entrants.map((e) => ({ id: e.id, name: e.name, color: e.color, carName: getCar(e.carDefId).name }));
const at = (s: number): Vec2 => ({ ...geo.sampleAt(s).pos });

const minimap = (pos: Vec2[], wrecked: number[] = []): HudState['minimap'] => ({
  cars: entrants.map((e, i) => ({ id: e.id, pos: pos[i] ?? at(0), color: e.color, wrecked: wrecked.includes(e.id) })),
});

const HUD_BASE: HudState = {
  position: 4,
  carCount: entrants.length,
  lap: 1,
  laps: setup.laps,
  raceTime: 0,
  lapTime: 0,
  bestLap: null,
  speedKmh: 0,
  hp: 100,
  maxHp: 100,
  turbo: 4,
  turboActive: false,
  mines: 3,
  gunHeat: 0,
  gunOverheated: false,
  countdown: 0,
  banner: null,
  wrongWay: false,
  minimap: minimap(geo.grid.map((g) => ({ ...g.pos }))),
  killFeed: [],
  hitFlash: 0,
};

export function fixtureHud(kind: HudFixture): HudState {
  const L = geo.length;
  switch (kind) {
    case 'countdown':
      return { ...HUD_BASE, countdown: 2.4 };
    case 'mid':
      return {
        ...HUD_BASE,
        position: 2,
        lap: 2,
        raceTime: 78.3,
        lapTime: 31.12,
        bestLap: 46.87,
        speedKmh: 118.4,
        hp: 72,
        turbo: 2.5,
        turboActive: true,
        mines: 2,
        gunHeat: 0.45,
        banner: 'LAP 2',
        // player, VEX, RAZOR (wrecked), MOTH
        minimap: minimap([at(L * 0.42), at(L * 0.31), at(L * 0.47), at(L * 0.55)], [2]),
        killFeed: [
          { id: 1, text: 'YOU wrecked RAZOR', time: 75.1 },
          { id: 2, text: 'MOTH hit a mine', time: 77.8 },
        ],
      };
    case 'critical':
      return {
        ...HUD_BASE,
        position: 4,
        lap: 3,
        raceTime: 121.6,
        lapTime: 18.4,
        bestLap: 45.9,
        speedKmh: 34.2,
        hp: 18,
        turbo: 0,
        mines: 0,
        gunHeat: 1,
        gunOverheated: true,
        wrongWay: true,
        hitFlash: 0.8,
        minimap: minimap([at(L * 0.12), at(L * 0.4), at(L * 0.33), at(L * 0.28)]),
        killFeed: [{ id: 3, text: 'VEX shot YOU', time: 120.9 }],
      };
  }
}

const RESULTS: RaceResult = {
  trackId: setup.track.id,
  laps: setup.laps,
  rows: [
    { car: 3, driverId: 'r09', name: 'MOTH', position: 1, finished: true, wrecked: false, totalTime: 141.3, bestLap: 46.12, wrecksCaused: 1, cashPicked: 150, hpLeft: 44, minesLeft: 0, turboLeft: 0 },
    { car: 0, driverId: 'player', name: 'YOU', position: 2, finished: true, wrecked: false, totalTime: 143.85, bestLap: 45.9, wrecksCaused: 1, cashPicked: 300, hpLeft: 61, minesLeft: 1, turboLeft: 0.5 },
    { car: 1, driverId: 'r06', name: 'VEX', position: 3, finished: true, wrecked: false, totalTime: 151.02, bestLap: 48.77, wrecksCaused: 0, cashPicked: 0, hpLeft: 30, minesLeft: 2, turboLeft: 1 },
    { car: 2, driverId: 'r10', name: 'RAZOR', position: 4, finished: false, wrecked: true, totalTime: null, bestLap: 49.8, wrecksCaused: 0, cashPicked: 50, hpLeft: 0, minesLeft: 0, turboLeft: 0 },
  ],
};

export const CAREER_SCREENS: readonly Screen[] = ['career', 'garage', 'shop', 'raceSelect', 'standings', 'champion', 'story'];

/** Mid-career save from the real meta functions: some upgrades, a damaged car, points on the board. */
function careerSave(screen: Screen): SaveGame {
  const s = newCareer(1);
  const mid: SaveGame = {
    ...s,
    cash: 2450,
    upgrades: { engine: 2, tires: 1, armor: 0, gun: 1, fuel: 0, spikes: 0 },
    hp: 64,
    mines: 3,
    turbo: 4,
    points: 24,
    racesRun: 8,
    wins: 3,
    rivals: s.rivals.map((r, i) => ({ ...r, points: r.points + (i % 4) * 3 })),
  };
  if (screen === 'champion') return { ...mid, cash: 18640, points: 96, racesRun: 31, wins: 14, wrecks: 23, cashEarned: 61250, championWon: true };
  // Low cash so the garage shows all three repairs: +25% unaffordable, MAX partial, FULL.
  if (screen === 'garage') return { ...mid, cash: 90 };
  // CARS tab (CCR-10): outlaw unlocked, scorch discounted, the other rival-only cars locked.
  return screen === 'shop' ? { ...mid, cash: 6000, beatenCars: ['outlaw', 'scorch'] } : mid;
}

const PAYOUT: Payout = { prize: 350, wreckBonus: 250, pickups: 300, total: 900, pointsGained: 2 };

/**
 * A full UiState for any screen; race, hud and results are always filled so the fake store can move between screens.
 * `career` adds a save and offers (on by default for the career screens) and, on results, the payout.
 */
export function fixtureState(screen: Screen, hud: HudFixture = 'mid', career = CAREER_SCREENS.includes(screen)): UiState {
  const save = career ? careerSave(screen) : null;
  const offers = save ? generateOffers(save).offers : null;
  const sub = screen !== 'career' && screen !== 'champion' && screen !== 'story' && CAREER_SCREENS.includes(screen);
  return {
    screen,
    previousScreen: screen === 'settings' || screen === 'controls' ? 'title' : sub ? 'career' : null,
    settings: { version: 1, masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.5, quality: 'high', cameraShake: true, showFps: false, quickTrackId: null, quickCarId: null },
    usingGamepad: false,
    version: __APP_VERSION__,
    race: { trackId: setup.track.id, trackName: setup.track.name, laps: setup.laps, entrants, minimapPath },
    hud: fixtureHud(hud),
    results: RESULTS,
    save,
    offers,
    selectedOffer: offers && screen === 'results' ? (offers[0]?.id ?? null) : null,
    lastPayout: career && screen === 'results' ? PAYOUT : null,
    toast: null,
    // The mid-career save's scene before its medium race (CCR-12).
    story: save && offers && screen === 'story' ? storySceneFor(save, offers[1]!) : null,
  };
}
