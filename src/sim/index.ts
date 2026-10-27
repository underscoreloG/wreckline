// The Rapier default import is the one allowed default import (SPEC.md section 4).
import RAPIER from '@dimforge/rapier2d-deterministic-compat';
import type { CarState, InputFrame, RaceSetup, RaceSnapshot, Sim, SimEvent } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT } from '../shared/contracts';
import { createAiDriver } from './ai';
import { arenaResult, updateArena, updateArenaPhase } from './arena';
import { handleCollisions, updateGuns, updateMines, updatePickups, updateTurbo } from './combat';
import type { SimCar, SimWorld } from './internal';
import { updateCountdown, updateProgress } from './race';
import { applyDynamics } from './vehicle';
import { buildResult, buildWorld, stateHashOf } from './world';

export { createFakeSim } from './fake';
// race.ts should import buildResult from './world' (importing it from here would be a cycle).
export { buildResult } from './world';

let ready: Promise<void> | null = null;
let initialized = false;

/** Loads the Rapier WASM once; later calls return the same promise. */
export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init().then(() => {
    initialized = true;
  });
  return ready;
}

function copyInput(dst: InputFrame, src: Readonly<InputFrame>): void {
  dst.throttle = src.throttle;
  dst.brake = src.brake;
  dst.steer = src.steer;
  dst.handbrake = src.handbrake;
  dst.fire = src.fire;
  dst.dropMine = src.dropMine;
  dst.turbo = src.turbo;
}

/** Per-car reaction delay: `slots.length` = reactionTicks preallocated frames. */
interface DelayLine {
  slots: InputFrame[];
  head: number;
}

function carState(c: SimCar): CarState {
  const t = c.body.translation();
  const v = c.body.linvel();
  const h = c.body.rotation();
  return {
    id: c.id,
    pos: { x: t.x, y: t.y },
    heading: h,
    vel: { x: v.x, y: v.y },
    angVel: c.body.angvel(),
    speed: v.x * Math.cos(h) + v.y * Math.sin(h),
    hp: c.hp,
    maxHp: c.base.maxHp,
    mines: c.mines,
    turbo: c.turbo,
    turboActive: c.turboActive,
    gunHeat: c.gunHeat,
    gunOverheated: c.gunOverheated,
    firing: c.firing,
    braking: c.braking,
    drifting: c.drifting,
    offroad: c.offroad,
    wrecked: c.wrecked,
    lap: c.lap,
    nextCheckpoint: c.nextCheckpoint,
    progress: c.progress,
    position: c.position,
    finished: c.finished,
    finishTime: c.finishTime,
    lastLapTime: c.lastLapTime,
    bestLapTime: c.bestLapTime,
    currentLapStart: c.currentLapStart,
    wrongWay: c.wrongWay,
  };
}

/** Test-only: the sim plus its internal world (WP01/WP02/WP07 tests). Game code uses createSim. */
export function createSimWithWorld(setup: RaceSetup): { sim: Sim; world: SimWorld } {
  if (!initialized) throw new Error('createSim: await initPhysics() first');
  const world = buildWorld(RAPIER, setup);
  const delays: (DelayLine | null)[] = setup.entrants.map((e, i) => {
    if (!e.ai) return null;
    world.ai[i] = createAiDriver(world, i, e.ai);
    const n = e.ai.reactionTicks;
    return n > 0 ? { slots: Array.from({ length: n }, () => ({ ...NEUTRAL_INPUT })), head: 0 } : null;
  });
  let disposed = false;
  // CCR-16: an arena fight swaps the two race-rule systems (steps 1 and 10) for the arena's.
  const arena = setup.mode === 'arena';
  const phaseSystem = arena ? updateArenaPhase : updateCountdown;
  const progressSystem = arena ? updateArena : updateProgress;

  const step = (inputs: ReadonlyMap<number, InputFrame>): SimEvent[] => {
    // 1. countdown / phase
    phaseSystem(world);

    // 2. inputs (copied field by field: sources may reuse one frame object)
    for (const car of world.cars) {
      copyInput(car.prevInput, car.input);
      const ai = world.ai[car.id];
      if (ai) {
        const decided = ai.decide(world);
        const line = delays[car.id];
        if (line) {
          // Read the frame written reactionTicks ago before overwriting its slot, or the delay becomes 0.
          const slot = line.slots[line.head];
          copyInput(car.input, slot);
          copyInput(slot, decided);
          line.head = (line.head + 1) % line.slots.length;
        } else {
          copyInput(car.input, decided);
        }
      } else {
        copyInput(car.input, inputs.get(car.id) ?? NEUTRAL_INPUT);
      }
    }

    const live = world.phase !== 'countdown';
    if (live) {
      updateTurbo(world); // 3
      applyDynamics(world); // 4
    } else {
      for (const car of world.cars) {
        car.body.setLinvel({ x: 0, y: 0 }, true);
        car.body.setAngvel(0, true);
      }
    }

    // 5. physics
    for (const car of world.cars) {
      const t = car.body.translation();
      const v = car.body.linvel();
      car.prevPos.x = t.x;
      car.prevPos.y = t.y;
      car.prevVel.x = v.x;
      car.prevVel.y = v.y;
    }
    world.physics.step(world.events);

    if (live) {
      handleCollisions(world); // 6
      updateGuns(world); // 7
      updateMines(world); // 8
      updatePickups(world); // 9
    }
    progressSystem(world); // 10

    // 11.
    world.tick++;
    if (world.phase === 'racing') world.time += SIM_DT;
    const out = world.out.slice();
    world.out.length = 0;
    return out;
  };

  const sim: Sim = {
    setup,
    track: world.track,
    step,
    snapshot: (): RaceSnapshot => ({
      tick: world.tick,
      time: world.time,
      phase: world.phase,
      countdown: world.countdown,
      laps: setup.laps,
      cars: world.cars.map(carState),
      mines: world.mines.map((m) => ({ id: m.id, owner: m.owner, pos: { x: m.pos.x, y: m.pos.y }, armed: m.armed })),
      pickups: world.pickups.map((p) => ({ id: p.id, kind: p.kind, pos: { x: p.pos.x, y: p.pos.y }, active: p.active })),
    }),
    result: () => world.result,
    stateHash: () =>
      stateHashOf(
        world.tick,
        world.cars.map((c) => {
          const t = c.body.translation();
          const v = c.body.linvel();
          return { x: t.x, y: t.y, vx: v.x, vy: v.y, heading: c.body.rotation(), hp: c.hp };
        }),
      ),
    debugFinishRace: () => {
      if (world.phase === 'finished') return;
      world.phase = 'finished';
      world.countdown = 0;
      world.result = arena ? arenaResult(world) : buildResult(world);
      // Returned by the next step(), like an event raised by the race-end rule.
      world.out.push({ type: 'raceFinished' });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      world.events.free();
      world.physics.free();
    },
  };
  return { sim, world };
}

export function createSim(setup: RaceSetup): Sim {
  return createSimWithWorld(setup).sim;
}
