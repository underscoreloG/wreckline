// content.md section 5

const DEG = Math.PI / 180;

// ---- machine gun
export const GUN_RATE = 12; // shots per second while fire is held
/** Damage per shot = eff.gunDps / GUN_RATE. */
export const GUN_RANGE = 45; // m
export const GUN_AIM_CONE = 7 * DEG; // half-angle, rad
export const GUN_SPREAD = 1.2 * DEG; // uniform +-, rad
export const GUN_HEAT_PER_SHOT = 0.055;
export const GUN_COOL_RATE = 0.45; // per second when not firing
export const GUN_OVERHEAT_AT = 1.0;
export const GUN_UNLOCK_BELOW = 0.35;
export const GUN_MUZZLE_OFFSET = 0.5; // m ahead of the front bumper

// ---- mines
export const MINE_COOLDOWN = 0.5; // s
export const MINE_DROP_OFFSET = 1.0; // m behind the rear bumper
export const MINE_ARM_TIME = 0.6; // s
export const MINE_TRIGGER_RADIUS = 2.0; // m, plus half the car width
export const MINE_DAMAGE_CENTER = 40;
export const MINE_DAMAGE_EDGE = 20;
export const MINE_BLAST_RADIUS = 4.0; // m, 0 damage beyond
export const MINE_IMPULSE = 8; // m/s away from the mine
export const MINE_SPIN = 3; // rad/s, sign from rng
export const MINE_LIFETIME = 45; // s
export const MINE_MAX_ON_TRACK = 24;

// ---- collisions
export const CAR_IMPACT_THRESHOLD = 6; // m/s
export const CAR_IMPACT_DAMAGE = 1.6; // x sqrt(otherMass / selfMass)
export const WALL_IMPACT_THRESHOLD = 9; // m/s
export const WALL_IMPACT_DAMAGE = 1.0;
export const REPEAT_HIT_IGNORE = 0.25; // s, same pair after a damaging hit
export const IMPACT_EVENT_MIN_SPEED = 4; // m/s

// ---- wrecks
export const WRECK_CREDIT_WINDOW = 5; // s
export const WRECK_EXPLOSION_DAMAGE = 20;
export const WRECK_EXPLOSION_RADIUS = 5; // m
export const WRECK_EXPLOSION_IMPULSE = 6; // m/s outward
