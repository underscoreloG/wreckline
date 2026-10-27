import type { Difficulty, EntrantSetup, RaceSetup } from '../shared/contracts';
import { aiProfile, AUTOPLAY_SKILL, profileForSkill, QUICK_RACE_AI_NAMES, QUICK_RACE_AI_SKILLS, QUICK_RACE_EXTRA_AI_SKILL } from './ai';
import { getCar, STARTER_CAR_ID } from './cars';
import { computeStats, QUICK_RACE_LOADOUT } from './economy';
import { AI_LIVERIES, PLAYER_LIVERY } from './liveries';
import { COUNTDOWN_SECONDS, DEFAULT_LAPS } from './race';
import { RIVALS } from './rivals';
import { DEFAULT_TRACK_ID, getTrack } from './tracks';

export interface QuickRaceOptions {
  seed: number;
  laps?: number;
  aiCount?: number;
  trackId?: string;
  autoplay?: boolean;
  /** The player's car (CCR-10), stock: upgrades 0. Omitted = the starter. The AI cars stay stock starters. */
  carId?: string;
  /** CCR-13: shifts the AI drivers' skill (not the autoplay player's). Default 'normal'. */
  difficulty?: Difficulty;
}

/** Quick race: the player (entrant 0) in a stock `carId` (default raven) and `aiCount` AI drivers in stock ravens. */
export function buildQuickRaceSetup(opts: QuickRaceOptions): RaceSetup {
  const aiCount = opts.aiCount ?? 3;
  if (aiCount < 1 || aiCount > 7) throw new Error(`aiCount ${aiCount} is outside 1..7`);
  const stock = { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 };
  const aiCar = getCar(STARTER_CAR_ID);
  const playerCar = getCar(opts.carId ?? STARTER_CAR_ID);
  // Extra AIs beyond the named three borrow other rivals' identities so names stay unique.
  const extras = RIVALS.filter((r) => !QUICK_RACE_AI_NAMES.includes(r.name));

  const entrant = (id: number, driverId: string, name: string, color: string, ai: EntrantSetup['ai'], car = aiCar): EntrantSetup => {
    const stats = computeStats(car, stock);
    return {
      id,
      driverId,
      name,
      color,
      carDefId: car.id,
      stats,
      mesh: { ...car.mesh },
      hp: stats.maxHp,
      mines: QUICK_RACE_LOADOUT.mines,
      turbo: QUICK_RACE_LOADOUT.turbo,
      ai,
    };
  };

  const entrants: EntrantSetup[] = [entrant(0, 'player', 'YOU', PLAYER_LIVERY, opts.autoplay ? profileForSkill(AUTOPLAY_SKILL) : null, playerCar)];
  for (let i = 0; i < aiCount; i++) {
    const named = QUICK_RACE_AI_NAMES[i];
    const rival = named !== undefined ? RIVALS.find((r) => r.name === named) : extras[i - QUICK_RACE_AI_NAMES.length];
    if (!rival) throw new Error(`no rival identity for AI ${i}`);
    const skill = QUICK_RACE_AI_SKILLS[i] ?? QUICK_RACE_EXTRA_AI_SKILL;
    const color = AI_LIVERIES[i] ?? rival.color;
    entrants.push(entrant(i + 1, rival.driverId, rival.name, color, aiProfile(skill, opts.difficulty ?? 'normal')));
  }

  return {
    seed: opts.seed >>> 0,
    track: getTrack(opts.trackId ?? DEFAULT_TRACK_ID),
    laps: opts.laps ?? DEFAULT_LAPS,
    entrants,
    countdownSeconds: COUNTDOWN_SECONDS,
  };
}
