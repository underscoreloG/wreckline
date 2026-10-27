import { centroid, lineBlocked, loopSegments, rayDistance } from '../content/arenas/geometry';
import type { AiProfile, ArenaDef, CarId, InputFrame, Vec2 } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT } from '../shared/contracts';
import { angleWrap, clamp } from '../shared/math';
import { createRng, hashString } from '../shared/rng';
import type { AiDriver, SimWorld } from './internal';

// WP41 (CCR-16): the arena driver, the mode branch of createAiDriver (ai.ts). No racing line: pick a target, drive at
// it round the blocks, shoot when lined up, ram when close and faster, mine a chaser, fetch a repair when low.
// AI-side tuning factors (never src/content), measured with the arena soak (docs/tuning-log.md WP41).

const DEG = Math.PI / 180;
// targets
/** Re-pick the target this often (and at once when it is wrecked). */
const RETARGET_TIME = 0.6; // s
/** Never more than this many AIs on one car at a time (WP41 fairness rule). */
export const MAX_HUNTERS = 3;
const HUNTER_PENALTY = 25; // m of distance per AI already on that car
const REVENGE_TIME = 3; // s since that car last damaged me
const REVENGE_BONUS = 35; // m
const WEAK_BONUS = 30; // m at 0 hp
const FRONT_BONUS = 15; // m for a car straight ahead
const STICKY_BONUS = 12; // m for the current target
const HIDDEN_PENALTY = 15; // m when a block hides it
/** Hunting one car this long without landing a hit (two cars circling each other): drop it for BORED_SKIP. */
const BORED_TIME = 6; // s
const BORED_SKIP = 8; // s
const BORED_PENALTY = 80; // m
// goals
const REPAIR_BELOW = 0.35; // fraction of maxHp
const PICKUP_DETOUR = 25; // m, mines or rocket fuel are fetched when this close and empty
const LEAD_MAX = 0.6; // s of target velocity added to the aim point
const LEAD_PER_M = 1 / 40; // s per m of distance
/** Waypoints round a block sit this far out from its corners. */
const NAV_CLEAR = 5.5; // m
// steering
const STEER_GAIN = 2.4;
const FEELER_BASE = 6; // m
const FEELER_PER_SPEED = 0.45; // s
const FEELER_OFFSETS = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.5, -1.5] as const; // rad off the wanted direction
const FEELER_TURN_COST = 4; // m of free distance per rad of detour
const WRECK_RADIUS = 3.2; // m, wrecks and cars other than the target are obstacles for the feelers
const TURN_SLOW_ANGLE = 0.9; // rad
const TURN_SLOW_SPEED = 14; // m/s
const HANDBRAKE_ANGLE = 1.5; // rad
/** A target this close and this far off the nose: swing round on the handbrake to bring the gun to bear. */
const SWING_RANGE = 20; // m
const SWING_ANGLE = 1; // rad
const SWING_SPEED = 9; // m/s
const BRAKE_LOOK = 0.6; // s of travel: brake when the way ahead is shorter
// gun
const GUN_RANGE = 40; // m
const GUN_CONE = 9 * DEG;
const GUN_HEAT_STOP = 0.85;
/** Trigger reaction: chance per second to open fire with a car in the sights = BASE + SKILL x aggression. */
const TRIGGER_BASE = 0.5;
const TRIGGER_SKILL = 1.5;
/** Aim wobble at skill 0 (rad), fading to 0 at skill 1. */
const AIM_WOBBLE = 12 * DEG;
const AIM_FREQ = 1.3; // rad/s
// following: inside FOLLOW_RANGE of its target the AI matches speed to sit FOLLOW_DIST behind it and shoot
const FOLLOW_RANGE = 24; // m
const FOLLOW_DIST = 14; // m
const FOLLOW_GAIN = 0.8; // m/s per m of gap error
/** A target slower than this inside ORBIT_RANGE is circled ORBIT_RADIUS out, not parked behind or pushed. */
const ORBIT_SLOW = 3; // m/s
const ORBIT_RANGE = 18; // m
const ORBIT_RADIUS = 11; // m
const ORBIT_STEP = 55 * DEG; // the goal leads round the circle by this angle
/** Closer than this the target is an obstacle for the feelers too, unless rammed. */
const CLOSE_AVOID = 12; // m
// joust: a target coming head-on is passed FOLLOW_SIDESTEP to the side instead of hit nose to nose
const JOUST_RANGE = 45; // m
const JOUST_FACING = 0.7; // cos of the target heading off the line to me
const JOUST_SIDESTEP = 9; // m
/** The opening: every car veers this far right of the centre for OPENING_TIME, so the field swirls instead of meeting in the middle. */
const OPENING_TIME = 2.5; // s
const OPENING_VEER = 45 * DEG;
// ram: close, faster, into the side or rear of a car with less hp or less mass (a ram hurts both cars)
const RAM_RANGE = 14; // m
const RAM_CONE = 25 * DEG;
const RAM_FASTER = 3; // m/s faster than the target along my heading
const RAM_FACING = 0.5; // cos: the target's nose turned less than this toward me
// mines
const MINE_RANGE = 16; // m
const MINE_CONE = 35 * DEG;
const MINE_AI_COOLDOWN = 2.5; // s
const MINE_GRACE = 3; // s after the green light
const MINE_MIN_SPEED = 6; // m/s
const MINE_USE_SCALE = 0.5;
// turbo
const TURBO_DIST = 35; // m to the goal
const TURBO_ANGLE = 0.15; // rad
const TURBO_CLEAR = 30; // m free ahead
const TURBO_MAX_HOLD = 1.2; // s
// stuck recovery
const STUCK_SPEED = 1.5; // m/s
const STUCK_TIME = 1; // s
/** Unstick: reverse (or drive forward, when there is more room ahead) with full lock until moved UNSTICK_MOVE, within these times. */
const UNSTICK_MIN = 0.6; // s
const UNSTICK_MAX = 2; // s
const UNSTICK_MOVE = 3; // m
/** Stuck again this soon after an unstick that moved less than UNSTICK_MOVE: try the other way (wedged between two things). */
const UNSTICK_RETRY = 3; // s
const UNSTICK_SIDE = 0.8; // rad, the feelers that pick the forward turn
/** Pull out forward only with this much room ahead: at a standstill the car cannot turn, nose against a wall. */
const UNSTICK_FORWARD_ROOM = 5; // m
const UNSTICK_NO_GO = 0.5; // m moved after UNSTICK_MIN

const MODE_FIGHT = 0;
const MODE_UNSTICK = 1;

interface Block {
  segs: Float64Array;
  nav: Vec2[];
}

/** Per world: car poses read once per tick, the arena's segments, block waypoints and who hunts whom. */
interface Shared {
  tick: number;
  x: Float64Array;
  y: Float64Array;
  h: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  all: Float64Array; // wall and block edges
  blockSegs: Float64Array; // block edges only (line of sight, paths)
  blocks: Block[];
  target: Int16Array; // each AI's target, -1 = none
}

const shared = new WeakMap<SimWorld, Shared>();

function sharedOf(world: SimWorld, arena: ArenaDef): Shared {
  let s = shared.get(world);
  if (!s) {
    const n = world.cars.length;
    const loops = arena.blocks.map((b) => b.points);
    s = {
      tick: -1,
      x: new Float64Array(n),
      y: new Float64Array(n),
      h: new Float64Array(n),
      vx: new Float64Array(n),
      vy: new Float64Array(n),
      all: loopSegments([arena.wall, ...loops]),
      blockSegs: loopSegments(loops),
      blocks: loops.map((pts) => {
        const c = centroid(pts);
        return {
          segs: loopSegments([pts]),
          nav: pts.map((p) => {
            const dx = p.x - c.x;
            const dy = p.y - c.y;
            const d = Math.hypot(dx, dy);
            return { x: p.x + (dx / d) * NAV_CLEAR, y: p.y + (dy / d) * NAV_CLEAR };
          }),
        };
      }),
      target: new Int16Array(n).fill(-1),
    };
    shared.set(world, s);
  }
  if (s.tick !== world.tick) {
    s.tick = world.tick;
    for (const car of world.cars) {
      const t = car.body.translation();
      const v = car.body.linvel();
      s.x[car.id] = t.x;
      s.y[car.id] = t.y;
      s.h[car.id] = car.body.rotation();
      s.vx[car.id] = v.x;
      s.vy[car.id] = v.y;
    }
  }
  return s;
}

/** Each AI's current target (-1 = none), index = CarId: the fairness test and the soak read it. */
export function arenaTargets(world: SimWorld): readonly number[] {
  const s = shared.get(world);
  return s ? Array.from(s.target) : world.cars.map(() => -1);
}

/** Distance to the first wreck circle (and live car circle but `keep`'s) along the unit ray, `max` when none. */
function carDistance(world: SimWorld, s: Shared, self: CarId, keep: number, ox: number, oy: number, dx: number, dy: number, max: number): number {
  let best = max;
  for (const o of world.cars) {
    if (o.id === self || o.id === keep) continue;
    const wx = s.x[o.id] - ox;
    const wy = s.y[o.id] - oy;
    const along = wx * dx + wy * dy;
    if (along <= 0) continue;
    const perp2 = wx * wx + wy * wy - along * along;
    const r2 = WRECK_RADIUS * WRECK_RADIUS;
    if (perp2 >= r2) continue;
    const hit = along - Math.sqrt(r2 - perp2);
    if (hit < best) best = Math.max(0, hit);
  }
  return best;
}

export function createArenaDriver(world: SimWorld, car: CarId, profile: AiProfile): AiDriver {
  const arena = world.setup.track.arena;
  if (!arena) throw new Error('createArenaDriver: no arena on the track');
  const me = world.cars[car];
  if (!me) throw new Error(`createArenaDriver: no car ${car}`);
  const frame: InputFrame = { ...NEUTRAL_INPUT };
  const skill = clamp(profile.skill, 0, 1);
  const trigger = TRIGGER_BASE + TRIGGER_SKILL * profile.aggression;
  const wobble = AIM_WOBBLE * (1 - skill);
  const mineUse = profile.mineUse * MINE_USE_SCALE;
  const prng = createRng(hashString(`${world.setup.seed}/arena/${car}`));
  const wobblePhase = prng.range(0, 2 * Math.PI);
  const goal: Vec2 = { x: 0, y: 0 };
  const halfWidth = me.entrant.mesh.width / 2;

  let target = -1;
  let retargetIn = 0;
  let huntStart = 0;
  let bored = -1;
  let boredUntil = 0;
  let mode = MODE_FIGHT;
  let modeTime = 0;
  let unstickDir = -1; // -1 = reverse, 1 = forward
  let unstickEnd = -Infinity;
  let unstickMoved = true;
  let unstickX = 0;
  let unstickY = 0;
  let firing = false;
  let mineEncounter = false;
  let mineCooldown = 0;
  let turboHold = 0;
  let turboRolled = false;

  const hunters = (s: Shared, o: CarId): number => {
    let n = 0;
    for (let j = 0; j < s.target.length; j++) if (j !== car && s.target[j] === o) n++;
    return n;
  };

  const pickTarget = (w: SimWorld, s: Shared): number => {
    const x = s.x[car];
    const y = s.y[car];
    const fx = Math.cos(s.h[car]);
    const fy = Math.sin(s.h[car]);
    let best = -1;
    let bestScore = Infinity;
    let nearest = -1;
    let nearestD = Infinity;
    for (const o of w.cars) {
      if (o.id === car || o.wrecked) continue;
      const dx = s.x[o.id] - x;
      const dy = s.y[o.id] - y;
      const d = Math.hypot(dx, dy);
      if (d < nearestD) {
        nearestD = d;
        nearest = o.id;
      }
      const taken = hunters(s, o.id);
      if (taken >= MAX_HUNTERS) continue;
      let score = d + taken * HUNTER_PENALTY;
      if (me.lastDamagedBy === o.id && w.time - me.lastDamagedAt < REVENGE_TIME) score -= REVENGE_BONUS;
      score -= WEAK_BONUS * (1 - o.hp / o.base.maxHp);
      if (d > 1e-6) score -= FRONT_BONUS * Math.max(0, (dx * fx + dy * fy) / d);
      if (o.id === target) score -= STICKY_BONUS;
      if (o.id === bored && w.time < boredUntil) score += BORED_PENALTY;
      if (lineBlocked(s.blockSegs, x, y, s.x[o.id], s.y[o.id])) score += HIDDEN_PENALTY;
      if (score < bestScore) {
        bestScore = score;
        best = o.id;
      }
    }
    // Every car capped (only in a big pile-up of hunters): the nearest, so the AI never idles.
    return best >= 0 ? best : nearest;
  };

  /** Writes into `goal` the point to drive at: straight to `tx, ty`, or round the first block in the way. */
  const route = (s: Shared, x: number, y: number, tx: number, ty: number): void => {
    goal.x = tx;
    goal.y = ty;
    const len = Math.hypot(tx - x, ty - y);
    if (len < 1e-6) return;
    const dx = (tx - x) / len;
    const dy = (ty - y) / len;
    let first: Block | null = null;
    let firstD = len;
    for (const b of s.blocks) {
      const d = rayDistance(b.segs, x, y, dx, dy, len);
      if (d < firstD) {
        firstD = d;
        first = b;
      }
    }
    if (!first) return;
    let bestCost = Infinity;
    for (const c of first.nav) {
      if (lineBlocked(first.segs, x, y, c.x, c.y)) continue;
      const cost = Math.hypot(c.x - x, c.y - y) + Math.hypot(tx - c.x, ty - c.y);
      if (cost < bestCost) {
        bestCost = cost;
        goal.x = c.x;
        goal.y = c.y;
      }
    }
  };

  return {
    car,
    profile,
    decide(w: SimWorld): InputFrame {
      const f = frame;
      f.throttle = 0;
      f.brake = 0;
      f.steer = 0;
      f.handbrake = false;
      f.fire = false;
      f.dropMine = false;
      f.turbo = false;
      const s = sharedOf(w, arena);
      if (w.phase !== 'racing' || me.wrecked) {
        s.target[car] = -1;
        return f;
      }
      const dt = SIM_DT;
      const x = s.x[car];
      const y = s.y[car];
      const h = s.h[car];
      const fx = Math.cos(h);
      const fy = Math.sin(h);
      const speed = s.vx[car] * fx + s.vy[car] * fy;
      const absSpeed = Math.abs(speed);
      mineCooldown = Math.max(0, mineCooldown - dt);

      // 1. target
      retargetIn -= dt;
      const hunted = target >= 0 ? w.cars[target] : undefined;
      if (hunted && !hunted.wrecked) {
        const lastHit = hunted.lastDamagedBy === car ? Math.max(huntStart, hunted.lastDamagedAt) : huntStart;
        if (w.time - lastHit > BORED_TIME) {
          bored = target;
          boredUntil = w.time + BORED_SKIP;
          retargetIn = 0;
        }
      }
      if (target < 0 || w.cars[target]?.wrecked || retargetIn <= 0) {
        const next = pickTarget(w, s);
        if (next !== target) huntStart = w.time;
        target = next;
        retargetIn = RETARGET_TIME;
      }
      s.target[car] = target;
      const tc = target >= 0 ? w.cars[target] : undefined;

      // 2. goal: a repair when low, an empty weapon refilled nearby, else the target's lead point
      let gx = x + fx * 20;
      let gy = y + fy * 20;
      let fetching = false;
      const hpFrac = me.hp / me.base.maxHp;
      let bestPickup = Infinity;
      for (const p of w.pickups) {
        if (!p.active) continue;
        const d = Math.hypot(p.pos.x - x, p.pos.y - y);
        const want = p.kind === 'repair' ? hpFrac < REPAIR_BELOW : (p.kind === 'mines' && me.mines === 0) || (p.kind === 'turbo' && me.turbo < 1) ? d < PICKUP_DETOUR : false;
        if (!want || d >= bestPickup) continue;
        bestPickup = d;
        gx = p.pos.x;
        gy = p.pos.y;
        fetching = true;
      }
      let dTarget = Infinity;
      let tFacing = 0; // cos of the target's heading off the line from it to me
      let tSpeed = 0; // its speed along my heading
      let inFront = false;
      let ramming = false;
      if (!fetching && tc) {
        const tx = s.x[tc.id];
        const ty = s.y[tc.id];
        dTarget = Math.max(1e-6, Math.hypot(tx - x, ty - y));
        tFacing = (Math.cos(s.h[tc.id]) * (x - tx) + Math.sin(s.h[tc.id]) * (y - ty)) / dTarget;
        tSpeed = s.vx[tc.id] * fx + s.vy[tc.id] * fy;
        inFront = ((tx - x) * fx + (ty - y) * fy) / dTarget >= Math.cos(RAM_CONE);
        // Ram: close, in front, faster, into its side or rear, and it is the weaker car (a ram hurts both).
        const weaker = tc.hp < me.hp || tc.base.mass < me.base.mass;
        ramming = dTarget < RAM_RANGE && inFront && weaker && tFacing < RAM_FACING && speed - tSpeed > RAM_FASTER;
        const lead = Math.min(LEAD_MAX, dTarget * LEAD_PER_M);
        gx = tx + s.vx[tc.id] * lead;
        gy = ty + s.vy[tc.id] * lead;
        if (!ramming && dTarget < ORBIT_RANGE && Math.hypot(s.vx[tc.id], s.vy[tc.id]) < ORBIT_SLOW) {
          // Circle a stopped car the way I am already turning round it.
          const side = (tx - x) * fy - (ty - y) * fx >= 0 ? 1 : -1;
          const ang = Math.atan2(y - ty, x - tx) - side * ORBIT_STEP;
          gx = tx + Math.cos(ang) * ORBIT_RADIUS;
          gy = ty + Math.sin(ang) * ORBIT_RADIUS;
        } else if (dTarget < JOUST_RANGE && tFacing > JOUST_FACING) {
          // Pass on my right of its nose: right(h) of the line from me to it.
          gx += (-(ty - y) / dTarget) * JOUST_SIDESTEP;
          gy += ((tx - x) / dTarget) * JOUST_SIDESTEP;
        }
      }
      if (w.time < OPENING_TIME) {
        gx = x + Math.cos(h + OPENING_VEER) * 30;
        gy = y + Math.sin(h + OPENING_VEER) * 30;
      }
      route(s, x, y, gx, gy);
      const gd = Math.hypot(goal.x - x, goal.y - y);
      let want = Math.atan2(goal.y - y, goal.x - x) + wobble * Math.sin(w.time * AIM_FREQ + wobblePhase);

      // 3. feelers: walls, blocks and wrecks in the wanted direction, else the clearest nearby direction
      const look = FEELER_BASE + FEELER_PER_SPEED * absSpeed;
      const reach = Math.min(look, gd);
      const keepTarget = ramming || dTarget >= CLOSE_AVOID ? target : -1;
      const ray = (ox: number, oy: number, a: number, keep: number): number => {
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        return Math.min(rayDistance(s.all, ox, oy, dx, dy, look), carDistance(w, s, car, keep, ox, oy, dx, dy, look));
      };
      const free = (a: number, keep = keepTarget): number => ray(x, y, a, keep);
      /** As free, also from both sides of the car: the centre ray misses a corner the car's flank is against. */
      const freeWide = (a: number, keep: number): number => {
        const rx = -Math.sin(a) * halfWidth;
        const ry = Math.cos(a) * halfWidth;
        return Math.min(ray(x, y, a, keep), ray(x + rx, y + ry, a, keep), ray(x - rx, y - ry, a, keep));
      };
      if (free(want) < reach) {
        let best = want;
        let bestScore = -Infinity;
        for (const off of FEELER_OFFSETS) {
          const score = free(want + off) - FEELER_TURN_COST * Math.abs(off);
          if (score > bestScore) {
            bestScore = score;
            best = want + off;
          }
        }
        want = best;
      }
      const a = angleWrap(want - h);

      // 4. stuck recovery: back out with the nose swinging toward the goal, or pull out forward when the way behind is
      // shorter; the other way when stuck again right after
      if (mode === MODE_FIGHT) {
        me.stuckTimer = absSpeed < STUCK_SPEED ? me.stuckTimer + dt : 0;
        if (me.stuckTimer >= STUCK_TIME) {
          const retry = !unstickMoved && w.time - unstickEnd < UNSTICK_RETRY;
          const front = freeWide(h, -1);
          unstickDir = front >= UNSTICK_FORWARD_ROOM && (retry ? unstickDir < 0 : front > freeWide(h + Math.PI, -1)) ? 1 : -1;
          mode = MODE_UNSTICK;
          modeTime = 0;
          unstickX = x;
          unstickY = y;
          me.stuckTimer = 0;
        }
      }
      if (mode === MODE_UNSTICK) {
        modeTime += dt;
        if (unstickDir < 0) {
          f.brake = 1;
          f.steer = a >= 0 ? -1 : 1;
        } else {
          f.throttle = 1;
          f.steer = free(h + UNSTICK_SIDE, -1) >= free(h - UNSTICK_SIDE, -1) ? 1 : -1;
        }
        const moved = Math.hypot(x - unstickX, y - unstickY);
        unstickMoved = moved >= UNSTICK_MOVE;
        // Pulling out forward that goes nowhere: the nose is against something the feelers missed, back out instead.
        if (unstickDir > 0 && modeTime >= UNSTICK_MIN && moved < UNSTICK_NO_GO) {
          unstickDir = -1;
          modeTime = 0;
        }
        if (modeTime >= UNSTICK_MAX || (modeTime >= UNSTICK_MIN && unstickMoved)) {
          mode = MODE_FIGHT;
          unstickEnd = w.time;
        }
        firing = false;
        return f;
      }

      // 5. steer and speed
      f.steer = clamp(a * STEER_GAIN, -1, 1);
      f.throttle = 1;
      const ahead = free(h);
      if (dTarget < SWING_RANGE && Math.abs(a) > SWING_ANGLE && speed > SWING_SPEED) f.handbrake = true;
      if (Math.abs(a) > TURN_SLOW_ANGLE && speed > TURN_SLOW_SPEED) {
        f.throttle = 0;
        f.brake = 0.6;
        if (Math.abs(a) > HANDBRAKE_ANGLE) f.handbrake = true;
      } else if (ahead < speed * BRAKE_LOOK && speed > 8) {
        f.throttle = 0;
        f.brake = 0.5;
      }

      // 6. ram flat out, or follow at gun range
      if (ramming) {
        f.throttle = 1;
        f.brake = 0;
        f.handbrake = false;
      } else if (tc && !fetching && dTarget < FOLLOW_RANGE) {
        if (inFront && tFacing <= JOUST_FACING) {
          const vWant = Math.max(0, tSpeed + (dTarget - FOLLOW_DIST) * FOLLOW_GAIN);
          if (speed > vWant + 2) {
            f.throttle = 0;
            f.brake = clamp((speed - vWant) / 10, 0.2, 1);
          } else if (speed > vWant - 1) f.throttle = 0.4;
        }
      }

      // 7. gun: any car in the sights, in range and in line of sight
      let inSights = false;
      for (const o of w.cars) {
        if (o.id === car || o.wrecked) continue;
        const dx = s.x[o.id] - x;
        const dy = s.y[o.id] - y;
        const d = Math.hypot(dx, dy);
        if (d > GUN_RANGE || d < 1e-6 || (dx * fx + dy * fy) / d < Math.cos(GUN_CONE)) continue;
        if (lineBlocked(s.blockSegs, x, y, s.x[o.id], s.y[o.id])) continue;
        inSights = true;
        break;
      }
      if (!inSights || me.gunOverheated || me.gunHeat > GUN_HEAT_STOP) firing = false;
      else if (!firing && w.rng.chance(trigger * dt)) firing = true;
      f.fire = firing;

      // 8. mines: a car on my tail
      let chased = false;
      for (const o of w.cars) {
        if (o.id === car || o.wrecked) continue;
        const dx = s.x[o.id] - x;
        const dy = s.y[o.id] - y;
        const d = Math.hypot(dx, dy);
        if (d > MINE_RANGE || d < 1e-6) continue;
        // Only a car hunting me: a passer-by behind is not a chase.
        if (s.target[o.id] === car && -(dx * fx + dy * fy) / d >= Math.cos(MINE_CONE)) {
          chased = true;
          break;
        }
      }
      if (!chased) mineEncounter = false;
      else if (!mineEncounter) {
        mineEncounter = true;
        if (mineCooldown <= 0 && me.mines > 0 && w.time >= MINE_GRACE && speed > MINE_MIN_SPEED && w.rng.chance(mineUse)) {
          f.dropMine = true;
          mineCooldown = MINE_AI_COOLDOWN;
        }
      }

      // 9. rocket fuel: a long clear run at the goal, or a ram; one roll per run
      const run = me.turbo > 0 && f.brake === 0 && Math.abs(a) < TURBO_ANGLE && (ramming || (gd > TURBO_DIST && ahead >= TURBO_CLEAR));
      if (turboHold > 0) {
        turboHold = run ? turboHold - dt : 0;
      } else if (!run) {
        turboRolled = false;
      } else if (!turboRolled) {
        turboRolled = true;
        if (w.rng.chance(profile.turboUse)) turboHold = TURBO_MAX_HOLD;
      }
      f.turbo = turboHold > 0;
      return f;
    },
  };
}
