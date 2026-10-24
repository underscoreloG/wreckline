/**
 * Wreckline - sim-internal contract (FROZEN after WP00).
 *
 * WP00 copies this file verbatim to src/sim/internal.ts. It is the shared mutable
 * world that the sim systems (WP01 vehicle/race, WP02 combat, WP07 AI) read and write.
 * Only src/sim/** may import it. Same change rules as contracts.ts.
 */
import type RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type {
  AiProfile,
  CarId,
  CarStats,
  EntrantSetup,
  InputFrame,
  PickupKind,
  RacePhase,
  RaceResult,
  RaceSetup,
  SimEvent,
  TrackGeometry,
  Vec2,
} from '../shared/contracts';
import type { Rng } from '../shared/rng';

export type Rapier = typeof RAPIER;

/** Collision groups (Rapier InteractionGroups: membership << 16 | filter). */
export const GROUP_CAR = 0x0001;
export const GROUP_WALL = 0x0002;
export const GROUP_PROP = 0x0004;

export interface SimCar {
  id: CarId;
  entrant: EntrantSetup;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  base: CarStats; // entrant.stats, never mutated
  /** Stats used this tick after turbo/offroad modifiers (WP01 writes, WP02 reads). */
  eff: CarStats;
  /**
   * input / prevInput are preallocated per car and never reassigned. Each tick WP00 first copies
   * input into prevInput field by field, then copies the new frame into input field by field
   * (never stores a reference: decide() and external sources may reuse one object).
   */
  input: InputFrame; // input applied this tick (after AI decision / reaction delay)
  prevInput: InputFrame; // previous tick's input, for edge detection (dropMine)
  prevPos: Vec2; // position before the physics step this tick
  prevVel: Vec2; // velocity before the physics step (impact speed computation)
  // ---- mirrored into CarState by snapshot()
  hp: number;
  mines: number;
  turbo: number;
  turboActive: boolean;
  gunHeat: number;
  gunOverheated: boolean;
  gunCooldown: number; // seconds until next shot
  firing: boolean;
  braking: boolean; // WP01 writes it (rule in WP01 step 7), mirrored to CarState.braking
  drifting: boolean;
  offroad: boolean;
  wrecked: boolean;
  wreckedAt: number | null; // race time of the wreck (WP02 sets it with wrecked); ranking: later wreck ranks higher
  lap: number;
  nextCheckpoint: number;
  crossedStart: boolean; // false until the car first crosses the start line after the green light
  trackS: number; // projected s this tick (0..length)
  lateral: number;
  progress: number;
  position: number;
  finished: boolean;
  finishTime: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;
  currentLapStart: number;
  wrongWayTimer: number; // seconds of negative progress
  wrongWay: boolean;
  lastDamagedBy: CarId | null;
  lastDamagedAt: number; // race time
  wrecksCaused: number;
  cashPicked: number;
  mineCooldown: number; // seconds
  stuckTimer: number; // used by AI (WP07)
}

export interface SimMine {
  id: number;
  owner: CarId;
  pos: Vec2;
  age: number; // seconds since dropped
  armed: boolean;
}

export interface SimPickup {
  id: number;
  kind: PickupKind;
  pos: Vec2;
  active: boolean;
  respawnIn: number; // seconds
}

export interface AiDriver {
  readonly car: CarId;
  readonly profile: AiProfile;
  /** Called once per tick before vehicle dynamics. Must be deterministic (use world.rng only). */
  decide(world: SimWorld): InputFrame;
}

export interface SimWorld {
  rapier: Rapier;
  physics: RAPIER.World;
  events: RAPIER.EventQueue;
  setup: RaceSetup;
  track: TrackGeometry;
  rng: Rng;
  tick: number;
  time: number; // race time since green
  phase: RacePhase;
  countdown: number;
  cars: SimCar[];
  mines: SimMine[];
  pickups: SimPickup[];
  nextMineId: number;
  /** Collider handle -> CarId, for collision events and ray hits. Walls/props are absent. */
  colliderToCar: Map<number, CarId>;
  out: SimEvent[]; // events emitted this tick; flushed by step()
  ai: (AiDriver | null)[]; // index === CarId
  result: RaceResult | null;
  playerFinishedAt: number | null; // race time, drives the 15 s end rule (content.md section 7)
  /**
   * Race time the player was first seen wrecked, drives the 2 s end rule. WP01's updateProgress sets
   * it when cars[0].wrecked && playerWreckedAt === null, so it works whoever set wrecked (combat or a test).
   */
  playerWreckedAt: number | null;
}

/**
 * Fixed system order inside Sim.step (implemented by WP00 in src/sim/index.ts):
 *  1. race.updateCountdown(world)              WP01  (phase/countdown events)
 *  2. inputs                                   WP00  (reaction-delay ring buffer lives in index.ts)
 *     car i uses world.ai[i].decide(world) when world.ai[i] is non-null, else inputs.get(i) ?? NEUTRAL_INPUT
 *     (so tests drive any car by setting entrants[i].ai = null and passing inputs for it)
 *  3. combat.updateTurbo(world)                WP02  (sets turboActive, drains turbo)
 *  4. vehicle.applyDynamics(world)             WP01  (writes eff, sets linvel/angvel)
 *  5. store prevPos/prevVel, physics.step(events) WP00
 *  6. combat.handleCollisions(world)           WP02  (impact events + collision damage)
 *  7. combat.updateGuns(world)                 WP02
 *  8. combat.updateMines(world)                WP02
 *  9. combat.updatePickups(world)              WP02
 * 10. race.updateProgress(world)               WP01  (projection, checkpoints, laps, positions, finish)
 * 11. tick++, time += SIM_DT when racing; return and clear world.out
 *
 * During 'countdown' steps 3-9 are skipped and cars are frozen on the grid.
 * After 'finished' the sim keeps stepping physics (cars coast) but emits no race events.
 */
export type SimSystem = (world: SimWorld) => void;
