import type { Difficulty, EntrantSetup, RaceSetup } from '../../shared/contracts';
import { createRng, hashString } from '../../shared/rng';
import { aiProfile, AUTOPLAY_SKILL, profileForSkill } from '../ai';
import { CARS, getCar, STARTER_CAR_ID } from '../cars';
import { computeStats } from '../economy';
import { PLAYER_LIVERY } from '../liveries';
import { COUNTDOWN_SECONDS } from '../race';
import { RIVALS } from '../rivals';
import { arenaOrFirst, arenaTrack } from './index';
import { ARENA_AI_NAMES, ARENA_AI_SKILLS, ARENA_GUN_DPS, ARENA_LOADOUT, ARENA_MAX_HP } from './rules';

export interface ArenaSetupOptions {
  seed: number;
  arenaId?: string; // unknown or omitted = the first arena
  /** The player's car, stock. Omitted = the starter. */
  carId?: string;
  autoplay?: boolean;
  /** Shifts the AI skills (aiProfile), not the autoplay player's. Default 'normal'. */
  difficulty?: Difficulty;
}

const STOCK = { engine: 0, tires: 0, armor: 0, gun: 0, fuel: 0, spikes: 0 };

/**
 * WP41 (CCR-16): last car standing. The player (entrant 0) in a stock `carId` and 7 AI drivers (skills 0.35-0.85) in
 * stock cars: 7 of the 8 models, shuffled per seed so no skill always drives the same car, all with the arena's even hp
 * and gun. One spawn point each,
 * the quick race loadout, no laps.
 */
export function buildArenaSetup(opts: ArenaSetupOptions): RaceSetup {
  const arena = arenaOrFirst(opts.arenaId);
  const seed = opts.seed >>> 0;
  const models = Object.keys(CARS);
  const rng = createRng(hashString(`arena/${seed}`));
  for (let i = models.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [models[i], models[j]] = [models[j] as string, models[i] as string];
  }

  const entrant = (id: number, driverId: string, name: string, color: string, carId: string, ai: EntrantSetup['ai']): EntrantSetup => {
    const car = getCar(carId);
    // Even stats: the same hp and gun for every car (rules.ts); driving stats and mass stay the car's.
    const stats = { ...computeStats(car, STOCK), maxHp: ARENA_MAX_HP, gunDps: ARENA_GUN_DPS };
    return { id, driverId, name, color, carDefId: car.id, stats, mesh: { ...car.mesh }, hp: stats.maxHp, mines: ARENA_LOADOUT.mines, turbo: ARENA_LOADOUT.turbo, ai };
  };

  const entrants: EntrantSetup[] = [
    entrant(0, 'player', 'YOU', PLAYER_LIVERY, opts.carId ?? STARTER_CAR_ID, opts.autoplay ? profileForSkill(AUTOPLAY_SKILL) : null),
  ];
  ARENA_AI_NAMES.forEach((name, i) => {
    const rival = RIVALS.find((r) => r.name === name);
    if (!rival) throw new Error(`no rival named ${name}`);
    entrants.push(entrant(i + 1, rival.driverId, rival.name, rival.color, models[i] as string, aiProfile(ARENA_AI_SKILLS[i] ?? 0.5, opts.difficulty ?? 'normal')));
  });
  if (entrants.length > arena.spawns.length) throw new Error(`arena ${arena.id}: ${entrants.length} cars for ${arena.spawns.length} spawns`);

  return { seed, track: arenaTrack(arena), laps: 1, entrants, countdownSeconds: COUNTDOWN_SECONDS, mode: 'arena' };
}
