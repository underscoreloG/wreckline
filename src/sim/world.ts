import type { CarId, EntrantSetup, RaceResult, RaceSetup, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT } from '../shared/contracts';
import { createRng, hashString } from '../shared/rng';
import { buildTrackGeometry, propRadius } from '../shared/trackGeometry';
import { GROUP_CAR, GROUP_PROP, GROUP_WALL, type Rapier, type SimCar, type SimPickup, type SimWorld } from './internal';

const WALL_FRICTION = 0.3;
const WALL_RESTITUTION = 0.2;
const CAR_FRICTION = 0.4;
const CAR_RESTITUTION = 0.3;
/** Cuboid prop colliders: half-width as a fraction of propRadius (container = 6.1 x 2.6 m box, building square). */
const CONTAINER_ASPECT = 2.6 / 6.1;
const BUILDING_HALF = Math.SQRT1_2;
/** Billboard: two posts at +-3 m along the prop's x (render/props.ts BILLBOARD_POST_X), 0.3 m square. */
const BILLBOARD_POST_X = 3;
const BILLBOARD_POST_HALF = 0.15;

/** Rapier InteractionGroups: membership in the high 16 bits, filter in the low 16. */
const groups = (membership: number, filter: number): number => ((membership << 16) | filter) >>> 0;

function closedLoopCollider(rapier: Rapier, pts: readonly Vec2[]) {
  const verts = new Float32Array(pts.length * 2);
  const idx = new Uint32Array(pts.length * 2);
  pts.forEach((p, i) => {
    verts[i * 2] = p.x;
    verts[i * 2 + 1] = p.y;
    idx[i * 2] = i;
    idx[i * 2 + 1] = (i + 1) % pts.length;
  });
  return rapier.ColliderDesc.polyline(verts, idx)
    .setFriction(WALL_FRICTION)
    .setRestitution(WALL_RESTITUTION)
    .setCollisionGroups(groups(GROUP_WALL, GROUP_CAR));
}

/** Builds the Rapier world, track colliders, cars on the grid and pickups. AI drivers are attached by index.ts. */
export function buildWorld(rapier: Rapier, setup: RaceSetup): SimWorld {
  const track = buildTrackGeometry(setup.track);
  const physics = new rapier.World({ x: 0, y: 0 });
  physics.integrationParameters.dt = SIM_DT;

  const fixed = physics.createRigidBody(rapier.RigidBodyDesc.fixed());
  physics.createCollider(closedLoopCollider(rapier, track.leftWall), fixed);
  physics.createCollider(closedLoopCollider(rapier, track.rightWall), fixed);

  for (const prop of setup.track.props) {
    const r = propRadius(prop.kind) * prop.scale;
    let desc;
    if (prop.kind === 'container') desc = rapier.ColliderDesc.cuboid(r, r * CONTAINER_ASPECT);
    else if (prop.kind === 'building' || prop.kind === 'crane') desc = rapier.ColliderDesc.cuboid(r * BUILDING_HALF, r * BUILDING_HALF);
    else if (prop.kind === 'billboard') {
      // Posts only: the panel is overhead decoration.
      const c = Math.cos(prop.rotation) * BILLBOARD_POST_X * prop.scale;
      const s = Math.sin(prop.rotation) * BILLBOARD_POST_X * prop.scale;
      for (const k of [-1, 1]) {
        const post = rapier.ColliderDesc.cuboid(BILLBOARD_POST_HALF * prop.scale, BILLBOARD_POST_HALF * prop.scale);
        post.setTranslation(prop.pos.x + k * c, prop.pos.y + k * s).setRotation(prop.rotation).setCollisionGroups(groups(GROUP_PROP, GROUP_CAR));
        physics.createCollider(post, fixed);
      }
      continue;
    }
    else if (prop.kind === 'rock') desc = rapier.ColliderDesc.ball(r);
    else continue;
    desc.setTranslation(prop.pos.x, prop.pos.y).setRotation(prop.rotation).setCollisionGroups(groups(GROUP_PROP, GROUP_CAR));
    physics.createCollider(desc, fixed);
  }

  const colliderToCar = new Map<number, CarId>();
  const cars: SimCar[] = setup.entrants.map((e: EntrantSetup, id: number): SimCar => {
    const slot = track.grid[id];
    if (!slot) throw new Error(`no grid slot for entrant ${id}`);
    const body = physics.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(slot.pos.x, slot.pos.y)
        .setRotation(slot.heading)
        .setCcdEnabled(true)
        .setLinearDamping(0)
        .setAngularDamping(0),
    );
    const collider = physics.createCollider(
      rapier.ColliderDesc.cuboid(e.mesh.length / 2, e.mesh.width / 2)
        .setMass(e.stats.mass)
        .setFriction(CAR_FRICTION)
        .setRestitution(CAR_RESTITUTION)
        .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(groups(GROUP_CAR, GROUP_CAR | GROUP_WALL | GROUP_PROP)),
      body,
    );
    colliderToCar.set(collider.handle, id);
    const proj = track.project(slot.pos);
    return {
      id,
      entrant: e,
      body,
      collider,
      base: e.stats,
      eff: { ...e.stats },
      input: { ...NEUTRAL_INPUT },
      prevInput: { ...NEUTRAL_INPUT },
      prevPos: { x: slot.pos.x, y: slot.pos.y },
      prevVel: { x: 0, y: 0 },
      hp: e.hp,
      mines: e.mines,
      turbo: e.turbo,
      turboActive: false,
      gunHeat: 0,
      gunOverheated: false,
      gunCooldown: 0,
      firing: false,
      braking: false,
      drifting: false,
      offroad: false,
      wrecked: false,
      wreckedAt: null,
      lap: 0,
      nextCheckpoint: 0,
      crossedStart: false,
      trackS: proj.s,
      lateral: proj.lateral,
      progress: proj.s - track.length,
      position: id + 1,
      finished: false,
      finishTime: null,
      lastLapTime: null,
      bestLapTime: null,
      currentLapStart: 0,
      wrongWayTimer: 0,
      wrongWay: false,
      lastDamagedBy: null,
      lastDamagedAt: 0,
      wrecksCaused: 0,
      cashPicked: 0,
      mineCooldown: 0,
      stuckTimer: 0,
    };
  });

  const pickups: SimPickup[] = setup.track.pickups.map((p, id) => {
    const smp = track.sampleAt(p.s);
    return { id, kind: p.kind, pos: { x: smp.pos.x + smp.right.x * p.lateral, y: smp.pos.y + smp.right.y * p.lateral }, active: true, respawnIn: 0 };
  });

  return {
    rapier,
    physics,
    events: new rapier.EventQueue(true),
    setup,
    track,
    rng: createRng(setup.seed),
    tick: 0,
    time: 0,
    phase: 'countdown',
    countdown: setup.countdownSeconds,
    cars,
    mines: [],
    pickups,
    nextMineId: 0,
    colliderToCar,
    out: [],
    ai: cars.map(() => null),
    result: null,
    playerFinishedAt: null,
    playerWreckedAt: null,
  };
}

// ---- ranking and results (shared by the real sim, debugFinishRace, WP01's race end and the fake sim)

/** The fields the ranking rule reads (SimCar has them all). */
export interface RankedCar {
  id: CarId;
  finished: boolean;
  finishTime: number | null;
  progress: number;
  wrecked: boolean;
  wreckedAt: number | null;
}

export interface ResultCar extends RankedCar {
  entrant: EntrantSetup;
  bestLapTime: number | null;
  wrecksCaused: number;
  cashPicked: number;
  hp: number;
  mines: number;
  turbo: number;
}

/**
 * content.md section 7: finished cars by finishTime, then by progress desc, wrecked last
 * (later wreck ranks higher). A car that finished keeps its finish rank even if wrecked afterwards.
 * Ties fall back to the car id so the order is total and deterministic.
 */
export function compareRank(a: RankedCar, b: RankedCar): number {
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (a.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0) || a.id - b.id;
  if (a.wrecked !== b.wrecked) return a.wrecked ? 1 : -1;
  if (a.wrecked) return (b.wreckedAt ?? 0) - (a.wreckedAt ?? 0) || a.id - b.id;
  return b.progress - a.progress || a.id - b.id;
}

export function buildResultFrom(setup: RaceSetup, cars: readonly ResultCar[]): RaceResult {
  const ranked = [...cars].sort(compareRank);
  return {
    trackId: setup.track.id,
    laps: setup.laps,
    rows: ranked.map((c, i) => ({
      car: c.id,
      driverId: c.entrant.driverId,
      name: c.entrant.name,
      position: i + 1,
      finished: c.finished,
      wrecked: c.wrecked,
      totalTime: c.finished ? c.finishTime : null,
      bestLap: c.bestLapTime,
      wrecksCaused: c.wrecksCaused,
      cashPicked: c.cashPicked,
      hpLeft: Math.max(0, c.hp),
      minesLeft: c.mines,
      turboLeft: c.turbo,
    })),
  };
}

/** The race result builder used by the race-end rule (WP01) and debugFinishRace. */
export const buildResult = (world: SimWorld): RaceResult => buildResultFrom(world.setup, world.cars);

/** FNV-1a over tick and per-car position, velocity, heading (rounded to 1e-4) and hp. */
export function stateHashOf(tick: number, cars: readonly { x: number; y: number; vx: number; vy: number; heading: number; hp: number }[]): string {
  const r = (v: number): number => Math.round(v * 1e4);
  let s = `${tick}`;
  for (const c of cars) s += `|${r(c.x)},${r(c.y)},${r(c.vx)},${r(c.vy)},${r(c.heading)},${r(c.hp)}`;
  return hashString(s).toString(16).padStart(8, '0');
}
