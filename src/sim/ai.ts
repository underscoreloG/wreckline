import type { AiProfile, CarId, InputFrame, TrackGeometry } from '../shared/contracts';
import { NEUTRAL_INPUT, PLAYER_CAR_ID, SIM_DT } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import { createTrackSample } from '../shared/trackGeometry';
import type { AiDriver, SimCar, SimWorld } from './internal';
import { buildRacingLine, lineCurvature, lineLimit, type RacingLine } from './racingLine';

// AI-side tuning factors (WP12 tunes these, never src/content), multiplied onto the profile values.
/** Measured over 16 soak seeds: at 1 the pack shoots the leader (usually the player) to a wreck within ~15 s, 2.1 wrecks per race; 0.2 gives ~0.75. WP12: 0.25 with MINE_USE_SCALE 0.6, WP34: 0.55 (docs/tuning-log.md). */
export const AGGRESSION_SCALE = 0.25;
/** WP34: 0.6 -> 0.55 with the wider GUN_CONE: mine hits 2.64 -> 2.49 per race and a wider AI finish spread margin (pineHollow 0.88 -> 0.92). */
export const MINE_USE_SCALE = 0.55;
export const TURBO_USE_SCALE = 1;

const DEG = Math.PI / 180;
// 1. target point
const LOOK_BASE = 6; // m
const LOOK_PER_SPEED = 0.45; // s
const NOISE_FREQ = 0.37; // rad/s
const NOISE_PHASE = 1.7; // rad per car id
// 2. steer
const STEER_GAIN = 2.2; // steer per radian of heading error
// 3. speed
const SPEED_LOOK = 0.5 * 0.3; // s of travel ahead where the speed profile is read
const RUBBER_RANGE = 150; // m of progress gap for the full rubber band
const ERR_ACCEL = 1; // m/s under target before throttling up
const ERR_BRAKE = -1.5; // m/s over target before braking
const THROTTLE_DIV = 4;
const THROTTLE_MIN = 0.3;
const BRAKE_DIV = 6;
const BRAKE_MIN = 0.2;
const HOLD_THROTTLE = 0.4;
// 4. avoidance
const AVOID_RANGE = 14; // m
const AVOID_CONE = 25 * DEG;
const AVOID_SLOWER = 1; // m/s
const AVOID_MAX = 3.5; // m
const AVOID_RATE = 4; // m/s
const AVOID_DECAY = 2; // m/s
/** CCR-7: a wreck ahead (whatever its speed: a pushed wreck moves with the pusher) is passed at least this far from its centre, */
const WRECK_CLEAR = 3.5; // m
/** on the side the AI is on (shoulder allowed, this far from the wall) unless the wreck leaves less than WRECK_ROOM there. */
const WRECK_WALL_MARGIN = 2; // m
const WRECK_ROOM = 2.5; // m
/** Within this range in the avoidance cone the AI crawls, so it does not shove the wreck while steering round. */
const WRECK_CRAWL_RANGE = 8; // m
const WRECK_CRAWL = 3; // m/s
/** CCR-8: crawling under WRECK_CRAWL with a wreck this close ahead counts as stuck (the crawl never drops under STUCK_SPEED, so a glued AI never recovered). */
const WRECK_GLUE_RANGE = 4.5; // m
/** A glued AI reverses this long instead of REVERSE_TIME: 1 s left it too close to turn round the wreck, so it nosed back in. */
const WRECK_REVERSE_TIME = 2.5; // s
/**
 * WP33: glued to a wreck on its own side with its centre this close to that wall, the AI reverses with the nose swinging
 * to the open side until it points WRECK_ESCAPE_ANGLE off the track that way (after at least WRECK_REVERSE_MIN, at most
 * the glued reverse time), then passes the wreck on the open side for WRECK_REGLUE_TIME. Steering toward the avoid
 * target instead swung the rear into the wall: the reverse ground along it and the AI nosed back into the wreck.
 */
const WRECK_WALL_NEAR = 5; // m
const WRECK_ESCAPE_ANGLE = 20 * DEG;
const WRECK_REVERSE_MIN = 0.5; // s
/** Glued again to the same wreck within this long after such a reverse: reverse WRECK_REVERSE_STEP longer, at most WRECK_TRIES_MAX times. */
const WRECK_REGLUE_TIME = 5; // s
const WRECK_REVERSE_STEP = 2; // s
const WRECK_TRIES_MAX = 2;
// 5. handbrake
const HAIRPIN_K = 1 / 18;
const HANDBRAKE_OVERSPEED = 6; // m/s
// 6. stuck recovery
const STUCK_SPEED = 1.5; // m/s
const STUCK_TIME = 1.5; // s
const REVERSE_TIME = 1; // s
const WRONG_WAY_TIME = 2; // s
const TURN_DONE = 60 * DEG;
/** A 3-point turn gives up reversing after this long (a wall behind it), then drives on. */
const TURN_MAX_TIME = 2.5; // s
// 7. gun
const GUN_RANGE = 40; // m
/** WP34: 10 -> 30 deg. On the tight tracks a target ahead sits off the nose in the constant bends, so 10 deg rarely lined up (gun share 0.36); hits still need the 7 deg aim assist. */
const GUN_CONE = 30 * DEG;
const GUN_HEAT_STOP = 0.85;
const RECKLESS_SKILL = 0.3; // below this the AI ignores heat
// 8. mines
const MINE_RANGE = 15; // m
const MINE_CONE = 30 * DEG;
const MINE_AI_COOLDOWN = 3; // s
const MINE_GRACE = 5; // s after the green light
/** No mines while crawling: a stuck car reversing out would back onto its own mine. */
const MINE_MIN_SPEED = 8; // m/s
// 9. turbo
const TURBO_STRAIGHT = 80; // m
const TURBO_K = 1 / 120;
const TURBO_MIN_SPEED = 0.7; // fraction of maxSpeed
// 10. pickups
const PICKUP_RANGE = 40; // m
const REPAIR_BELOW = 0.6; // fraction of maxHp
const MINES_BELOW = 2;
const TURBO_BELOW = 2; // s
// finished cars
const CRUISE_PACE = 0.6;

const MODE_RACE = 0;
const MODE_REVERSE = 1;
const MODE_TURN = 2;

/**
 * Positions, headings and forward speeds of every car, read once per tick for all drivers
 * (Rapier's translation()/linvel() allocate on each call).
 */
interface CarCache {
  tick: number;
  x: Float64Array;
  y: Float64Array;
  h: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
}

const caches = new WeakMap<SimWorld, CarCache>();

function carCache(world: SimWorld): CarCache {
  let c = caches.get(world);
  if (!c) {
    const n = world.cars.length;
    c = { tick: -1, x: new Float64Array(n), y: new Float64Array(n), h: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n) };
    caches.set(world, c);
  }
  if (c.tick !== world.tick) {
    c.tick = world.tick;
    for (const car of world.cars) {
      const t = car.body.translation();
      const v = car.body.linvel();
      c.x[car.id] = t.x;
      c.y[car.id] = t.y;
      c.h[car.id] = car.body.rotation();
      c.vx[car.id] = v.x;
      c.vy[car.id] = v.y;
    }
  }
  return c;
}

/** Linear interpolation of a per-sample array at track distance s (wraps). */
function lineAt(track: TrackGeometry, arr: Float32Array, s: number): number {
  const n = arr.length;
  const f = ((((s / track.length) * n) % n) + n) % n;
  const i = Math.floor(f);
  const t = f - i;
  return arr[i % n] * (1 - t) + arr[(i + 1) % n] * t;
}

function lineFor(world: SimWorld, car: SimCar): RacingLine {
  return buildRacingLine(world.track, car.base.grip, car.base.brake);
}

function resetFrame(f: InputFrame): void {
  f.throttle = 0;
  f.brake = 0;
  f.steer = 0;
  f.handbrake = false;
  f.fire = false;
  f.dropMine = false;
  f.turbo = false;
}

/** WP07 step 3 pedal mapping from the speed error. */
function pedals(f: InputFrame, err: number): void {
  if (err > ERR_ACCEL) f.throttle = clamp(err / THROTTLE_DIV, THROTTLE_MIN, 1);
  else if (err < ERR_BRAKE) f.brake = clamp(-err / BRAKE_DIV, BRAKE_MIN, 1);
  else f.throttle = HOLD_THROTTLE;
}

// ---------------------------------------------------------------- finished cars

interface CruiseState {
  frames: InputFrame[];
  lines: RacingLine[];
  sample: ReturnType<typeof createTrackSample>;
}

const cruises = new WeakMap<SimWorld, CruiseState>();

/**
 * Input for a finished car (and every car once the race is over, content.md section 7): follow the racing
 * line at CRUISE_PACE of its speed profile, no noise, avoidance, handbrake or weapons. One frame per car.
 */
export function cruiseInput(world: SimWorld, car: SimCar): InputFrame {
  let st = cruises.get(world);
  if (!st) {
    st = { frames: world.cars.map(() => ({ ...NEUTRAL_INPUT })), lines: world.cars.map((c) => lineFor(world, c)), sample: createTrackSample() };
    cruises.set(world, st);
  }
  const f = st.frames[car.id];
  const line = st.lines[car.id];
  resetFrame(f);
  const track = world.track;
  const c = carCache(world);
  const id = car.id;
  const h = c.h[id];
  const speed = c.vx[id] * Math.cos(h) + c.vy[id] * Math.sin(h);
  const lim = lineLimit(track);
  const sT = car.trackS + LOOK_BASE + LOOK_PER_SPEED * Math.abs(speed);
  const lat = clamp(lineAt(track, line.offsets, sT), -lim, lim);
  const smp = track.sampleAtInto(st.sample, sT);
  const a = angleWrap(Math.atan2(smp.pos.y + smp.right.y * lat - c.y[id], smp.pos.x + smp.right.x * lat - c.x[id]) - h);
  f.steer = clamp(a * STEER_GAIN, -1, 1);
  const vTarget = Math.min(lineAt(track, line.speeds, car.trackS + SPEED_LOOK * speed), car.eff.maxSpeed) * CRUISE_PACE;
  pedals(f, vTarget - speed);
  return f;
}

// ---------------------------------------------------------------- racing driver

/** WP07 AI driver: racing line, braking, avoidance, weapons, turbo, pickups and stuck recovery. */
export function createAiDriver(world: SimWorld, car: CarId, profile: AiProfile): AiDriver {
  const frame: InputFrame = { ...NEUTRAL_INPUT };
  const sample = createTrackSample();
  const me = world.cars[car];
  if (!me) throw new Error(`createAiDriver: no car ${car}`);
  const line = lineFor(world, me);
  const curvature = lineCurvature(line);
  const track = world.track;
  const lim = lineLimit(track);
  const wreckLim = track.def.width / 2 + track.def.shoulder - WRECK_WALL_MARGIN;
  const wallOff = track.def.width / 2 + track.def.shoulder;
  const here = createTrackSample();
  const pickupSpawns = world.setup.track.pickups;
  const aggression = profile.aggression * AGGRESSION_SCALE;
  const mineUse = profile.mineUse * MINE_USE_SCALE;
  const turboUse = profile.turboUse * TURBO_USE_SCALE;
  const reckless = profile.skill < RECKLESS_SKILL;

  let mode = MODE_RACE;
  let modeTime = 0;
  let reverseTime = REVERSE_TIME;
  let reverseMin = 0;
  let escapeSide = 0; // WP33: the open side of a glued reverse at the wall (+1 = right), 0 = none
  let escapeWreck = -1;
  let escapeTries = 0;
  let sinceEscape = WRECK_REGLUE_TIME;
  let wrongWayTime = 0;
  let avoid = 0;
  let avoidDir = 0;
  let firing = false;
  let mineEncounter = false;
  let mineCooldown = 0;
  let turboRolled = false;
  let turboHold = false;

  /** max |curvature| of the line over [s, s + dist]. */
  const maxCurvature = (s: number, dist: number): number => {
    let k = 0;
    for (let d = 0; d <= dist; d += 1) k = Math.max(k, Math.abs(lineAt(track, curvature, s + d)));
    return k;
  };

  return {
    car,
    profile,
    decide(w: SimWorld): InputFrame {
      const f = frame;
      resetFrame(f);
      if (w.phase !== 'racing' || me.wrecked || me.finished) return f;
      const dt = SIM_DT;
      const c = carCache(w);
      const x = c.x[car];
      const y = c.y[car];
      const h = c.h[car];
      const fx = Math.cos(h);
      const fy = Math.sin(h);
      const speed = c.vx[car] * fx + c.vy[car] * fy;
      const absSpeed = Math.abs(speed);
      mineCooldown = Math.max(0, mineCooldown - dt);

      // 6. stuck / wrong-way detection
      if (mode === MODE_RACE) {
        let glued = -1;
        if (absSpeed < WRECK_CRAWL) {
          for (const o of w.cars) {
            if (!o.wrecked || o.id === car) continue;
            const dx = c.x[o.id] - x;
            const dy = c.y[o.id] - y;
            if (dx * fx + dy * fy > 0 && Math.hypot(dx, dy) < WRECK_GLUE_RANGE) glued = o.id;
          }
        }
        sinceEscape += dt;
        me.stuckTimer = absSpeed < STUCK_SPEED || glued >= 0 ? me.stuckTimer + dt : 0;
        wrongWayTime = me.wrongWay ? wrongWayTime + dt : 0;
        if (me.stuckTimer >= STUCK_TIME) {
          mode = MODE_REVERSE;
          modeTime = 0;
          reverseTime = glued >= 0 ? WRECK_REVERSE_TIME : REVERSE_TIME;
          escapeSide = 0;
          const wallSide = me.lateral >= 0 ? 1 : -1; // the nearest wall
          if (glued >= 0 && wallOff - Math.abs(me.lateral) < WRECK_WALL_NEAR && w.cars[glued].lateral * wallSide > 0) {
            escapeSide = -wallSide;
            escapeTries = glued === escapeWreck && sinceEscape < WRECK_REGLUE_TIME ? Math.min(escapeTries + 1, WRECK_TRIES_MAX) : 0;
            escapeWreck = glued;
            reverseTime += escapeTries * WRECK_REVERSE_STEP;
            reverseMin = WRECK_REVERSE_MIN + escapeTries * WRECK_REVERSE_STEP;
          }
          me.stuckTimer = 0;
        } else if (wrongWayTime >= WRONG_WAY_TIME) {
          mode = MODE_TURN;
          modeTime = 0;
          wrongWayTime = 0;
        }
      }

      // 1. target point (with 4. avoidance and 10. pickups)
      const s = me.trackS;
      const sT = s + LOOK_BASE + LOOK_PER_SPEED * absSpeed;
      const base = lineAt(track, line.offsets, sT) + profile.lineNoise * Math.sin(w.time * NOISE_FREQ + car * NOISE_PHASE);

      let blocked = false;
      let wreckAhead = false;
      let wreckLat = 0;
      let nearest = AVOID_RANGE;
      for (const o of w.cars) {
        if (o.id === car) continue;
        const dx = c.x[o.id] - x;
        const dy = c.y[o.id] - y;
        const d = Math.hypot(dx, dy);
        if (d > nearest || d < 1e-6) continue;
        if ((dx * fx + dy * fy) / d < Math.cos(AVOID_CONE)) continue;
        const oSpeed = c.vx[o.id] * fx + c.vy[o.id] * fy;
        if (!o.wrecked && speed - oSpeed <= AVOID_SLOWER) continue; // CCR-7: a wreck being pushed moves at the pusher's speed
        nearest = d;
        blocked = true;
        wreckAhead = o.wrecked;
        wreckLat = o.lateral;
      }
      if (blocked && wreckAhead) {
        if (avoidDir === 0) {
          avoidDir = me.lateral >= wreckLat ? 1 : -1; // the side the AI is on, kept until the pass is done...
          if (wreckLim - avoidDir * wreckLat < WRECK_ROOM) avoidDir = -avoidDir; // ...unless there is no room
        }
        if (escapeSide !== 0 && sinceEscape < WRECK_REGLUE_TIME) avoidDir = escapeSide; // WP33: the open side after an escape reverse
        const goal = avoidDir > 0 ? Math.max(0, wreckLat + WRECK_CLEAR - base) : Math.min(0, wreckLat - WRECK_CLEAR - base); // never toward it
        avoid = avoid < goal ? Math.min(goal, avoid + AVOID_RATE * dt) : Math.max(goal, avoid - AVOID_RATE * dt);
      } else if (blocked) {
        if (avoidDir === 0) avoidDir = base <= 0 ? 1 : -1; // toward the side with more room
        avoid = clamp(avoid + avoidDir * AVOID_RATE * dt, -AVOID_MAX, AVOID_MAX);
      } else if (avoid !== 0) {
        avoid = avoid > 0 ? Math.max(0, avoid - AVOID_DECAY * dt) : Math.min(0, avoid + AVOID_DECAY * dt);
        if (avoid === 0) avoidDir = 0;
      }

      let lat = base + avoid;
      let bestPickup = PICKUP_RANGE;
      for (const p of w.pickups) {
        if (!p.active || wreckAhead) continue; // a wreck in the way wins over a pickup
        const spawn = pickupSpawns[p.id];
        if (!spawn || Math.abs(spawn.lateral) > lim) continue;
        const needed =
          p.kind === 'repair' ? me.hp < me.base.maxHp * REPAIR_BELOW : p.kind === 'mines' ? me.mines < MINES_BELOW : p.kind === 'turbo' ? me.turbo < TURBO_BELOW : false;
        if (!needed) continue;
        const ahead = (((spawn.s - s) % track.length) + track.length) % track.length;
        if (ahead > bestPickup) continue;
        bestPickup = ahead;
        lat = spawn.lateral;
      }
      lat = wreckAhead ? clamp(lat, -wreckLim, wreckLim) : clamp(lat, -lim, lim);
      const smp = track.sampleAtInto(sample, sT);
      const a = angleWrap(Math.atan2(smp.pos.y + smp.right.y * lat - y, smp.pos.x + smp.right.x * lat - x) - h);

      // 6. recovery modes override driving
      if (mode === MODE_REVERSE) {
        modeTime += dt;
        f.brake = 1;
        f.steer = -Math.sign(a);
        let turned = false;
        if (escapeSide !== 0) {
          // in reverse, steer -side turns the nose toward side
          const tan = track.sampleAtInto(here, s).tangent;
          turned = angleWrap(h - Math.atan2(tan.y, tan.x)) * escapeSide >= WRECK_ESCAPE_ANGLE;
          f.steer = turned ? 0 : -escapeSide;
        }
        if (modeTime >= reverseTime || (turned && modeTime >= reverseMin)) {
          mode = MODE_RACE;
          if (escapeSide !== 0) sinceEscape = 0;
        }
        return f;
      }
      if (mode === MODE_TURN) {
        modeTime += dt;
        f.brake = 1;
        f.steer = a >= 0 ? -1 : 1;
        if (Math.abs(a) < TURN_DONE || modeTime >= TURN_MAX_TIME) mode = MODE_RACE;
        return f;
      }

      // 2. steer
      f.steer = clamp(a * STEER_GAIN, -1, 1);

      // 3. speed
      const vLine = lineAt(track, line.speeds, s + SPEED_LOOK * speed);
      const vMax = me.eff.maxSpeed;
      let vTarget = vLine < vMax ? vLine * profile.cornerSpeedFactor : vMax;
      const player = w.cars[PLAYER_CAR_ID];
      if (player && car !== PLAYER_CAR_ID) vTarget *= 1 + clamp((player.progress - me.progress) / RUBBER_RANGE, -1, 1) * profile.rubberBand;
      if (wreckAhead && nearest < WRECK_CRAWL_RANGE) vTarget = Math.min(vTarget, WRECK_CRAWL);
      pedals(f, vTarget - speed);

      // 5. handbrake in hairpins only
      if (Math.abs(lineAt(track, curvature, sT)) > HAIRPIN_K && speed > vTarget + HANDBRAKE_OVERSPEED) f.handbrake = true;

      // 7. gun
      let target = false;
      for (const o of w.cars) {
        if (o.id === car || o.wrecked || o.finished) continue;
        const dx = c.x[o.id] - x;
        const dy = c.y[o.id] - y;
        const d = Math.hypot(dx, dy);
        if (d > GUN_RANGE || d < 1e-6) continue;
        if ((dx * fx + dy * fy) / d >= Math.cos(GUN_CONE)) {
          target = true;
          break;
        }
      }
      if (!target || me.gunOverheated || (!reckless && me.gunHeat > GUN_HEAT_STOP)) firing = false;
      else if (!firing && w.rng.chance(aggression * dt)) firing = true;
      f.fire = firing;

      // 8. mines
      let behind = false;
      for (const o of w.cars) {
        if (o.id === car || o.wrecked || o.finished) continue;
        const dx = c.x[o.id] - x;
        const dy = c.y[o.id] - y;
        const d = Math.hypot(dx, dy);
        if (d > MINE_RANGE || d < 1e-6) continue;
        if (-(dx * fx + dy * fy) / d >= Math.cos(MINE_CONE)) {
          behind = true;
          break;
        }
      }
      if (!behind) mineEncounter = false;
      else if (!mineEncounter) {
        mineEncounter = true;
        if (mineCooldown <= 0 && me.mines > 0 && w.time >= MINE_GRACE && speed > MINE_MIN_SPEED && w.rng.chance(mineUse)) {
          f.dropMine = true;
          mineCooldown = MINE_AI_COOLDOWN;
        }
      }

      // 9. turbo: one roll per straight, held to its end
      const straight = me.turbo > 0 && maxCurvature(s, TURBO_STRAIGHT) < TURBO_K;
      if (turboHold) {
        turboHold = me.turbo > 0 && Math.abs(lineAt(track, curvature, s)) < TURBO_K && f.brake === 0;
      } else if (!straight) {
        turboRolled = false;
      } else if (!turboRolled && speed > TURBO_MIN_SPEED * me.base.maxSpeed) {
        turboRolled = true;
        turboHold = w.rng.chance(turboUse);
      }
      f.turbo = turboHold;
      return f;
    },
  };
}
