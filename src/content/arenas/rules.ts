// content.md section 13 (Arena, WP41 CCR-16)

/** Player + 7 AI, one per spawn point. */
export const ARENA_CARS = 8;
/** AI skills before the difficulty shift (aiProfile), spread 0.35-0.85 in entrant order. */
export const ARENA_AI_SKILLS: readonly number[] = [0.35, 0.43, 0.52, 0.6, 0.68, 0.77, 0.85];
/** AI identities from RIVALS, in entrant order: distinct liveries, none close to the player's orange. */
export const ARENA_AI_NAMES: readonly string[] = ['VEX', 'RAZOR', 'MOTH', 'JINX', 'OXIDE', 'VOLT', 'HALO'];
/** Carried at the start, as in a quick race. */
export const ARENA_LOADOUT = { mines: 3, turbo: 4 } as const;

/** Fight time when sudden death starts. */
export const ARENA_SUDDEN_DEATH_AT = 120; // s
/** In sudden death every car loses this fraction of its max hp per second... */
export const ARENA_DECAY_PER_SECOND = 0.01;
/** ...and wall and block hits deal this multiple of their damage. */
export const ARENA_SUDDEN_WALL_MULT = 2;
/** Pickups respawn this long after collection; repair pickups stop respawning in sudden death, so it always ends. */
export const ARENA_PICKUP_RESPAWN_SECONDS = 10;
/** Safety end: the survivors are ranked by hp. Sudden death with no repairs wrecks every car by 220 s from full hp. */
export const ARENA_TIME_LIMIT = 300; // s
