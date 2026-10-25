import type RAPIER from '@dimforge/rapier2d-deterministic-compat';
import {
  MAX_MINES_CARRIED,
  MAX_TURBO_CARRIED,
  PICKUP_CASH_UNITS,
  PICKUP_MINES,
  PICKUP_RADIUS,
  PICKUP_REPAIR_HP,
  PICKUP_RESPAWN_SECONDS,
  PICKUP_TURBO_SECONDS,
} from '../content/pickups';
import {
  CAR_IMPACT_DAMAGE,
  CAR_IMPACT_THRESHOLD,
  GUN_AIM_CONE,
  GUN_COOL_RATE,
  GUN_HEAT_PER_SHOT,
  GUN_MUZZLE_OFFSET,
  GUN_OVERHEAT_AT,
  GUN_RANGE,
  GUN_RATE,
  GUN_SPREAD,
  GUN_UNLOCK_BELOW,
  IMPACT_EVENT_MIN_SPEED,
  MINE_ARM_TIME,
  MINE_BLAST_RADIUS,
  MINE_COOLDOWN,
  MINE_DAMAGE_CENTER,
  MINE_DAMAGE_EDGE,
  MINE_DROP_OFFSET,
  MINE_IMPULSE,
  MINE_LIFETIME,
  MINE_MAX_ON_TRACK,
  MINE_SPIN,
  MINE_TRIGGER_RADIUS,
  REPEAT_HIT_IGNORE,
  WALL_IMPACT_DAMAGE,
  WALL_IMPACT_THRESHOLD,
  WRECK_CREDIT_WINDOW,
  WRECK_EXPLOSION_DAMAGE,
  WRECK_EXPLOSION_IMPULSE,
  WRECK_EXPLOSION_RADIUS,
} from '../content/weapons';
import type { CarId, DamageSource, PickupKind, Vec2 } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import type { SimCar, SimMine, SimSystem, SimWorld } from './internal';

/** Started contacts handled per tick; more in one tick are dropped (4-8 cars never get close). */
const MAX_PAIRS = 64;
/** Pair cooldown ring size (WP02 spec: max 32 entries, overwrite oldest). */
const MAX_COOLDOWNS = 32;
/** Cooldown pair key for any wall or prop. */
const WALL = -1;

/**
 * Per-world scratch, preallocated once so the systems do not allocate per tick (SimWorld is frozen,
 * so it lives in a WeakMap keyed by the world). Positions are cached per system call because
 * Rapier's translation() allocates on every call.
 */
interface CombatState {
  pairH1: Float64Array;
  pairH2: Float64Array;
  pairCount: number;
  onCollision: (h1: number, h2: number, started: boolean) => void;
  impact: Float64Array; // per car, -1 = not computed this tick
  cdA: Int32Array;
  cdB: Int32Array;
  cdUntil: Float64Array;
  cdNext: number;
  ray: RAPIER.Ray;
  px: Float64Array;
  py: Float64Array;
  ph: Float64Array;
  vec: { x: number; y: number };
}

const states = new WeakMap<SimWorld, CombatState>();

function stateOf(world: SimWorld): CombatState {
  let st = states.get(world);
  if (st) return st;
  const n = world.cars.length;
  const s: CombatState = {
    pairH1: new Float64Array(MAX_PAIRS),
    pairH2: new Float64Array(MAX_PAIRS),
    pairCount: 0,
    onCollision: (h1, h2, started) => {
      if (!started || s.pairCount >= MAX_PAIRS) return;
      s.pairH1[s.pairCount] = h1;
      s.pairH2[s.pairCount] = h2;
      s.pairCount++;
    },
    impact: new Float64Array(n),
    cdA: new Int32Array(MAX_COOLDOWNS),
    cdB: new Int32Array(MAX_COOLDOWNS),
    cdUntil: new Float64Array(MAX_COOLDOWNS).fill(-Infinity),
    cdNext: 0,
    ray: new world.rapier.Ray({ x: 0, y: 0 }, { x: 1, y: 0 }),
    px: new Float64Array(n),
    py: new Float64Array(n),
    ph: new Float64Array(n),
    vec: { x: 0, y: 0 },
  };
  st = s;
  states.set(world, st);
  return st;
}

function readPositions(world: SimWorld, st: CombatState): void {
  for (const car of world.cars) {
    const t = car.body.translation();
    st.px[car.id] = t.x;
    st.py[car.id] = t.y;
    st.ph[car.id] = car.body.rotation();
  }
}

/** Adds a velocity change of `dv` m/s along the unit vector (dx, dy). */
function push(st: CombatState, car: SimCar, dx: number, dy: number, dv: number): void {
  st.vec.x = dx * dv * car.base.mass;
  st.vec.y = dy * dv * car.base.mass;
  car.body.applyImpulse(st.vec, true);
}

// ---------------------------------------------------------------- damage and wrecks

function applyDamage(world: SimWorld, car: SimCar, amount: number, source: DamageSource, by: CarId | null, pos: Vec2): void {
  // Finished cars are immune (content.md section 7).
  if (car.wrecked || car.finished || amount <= 0) return;
  const before = car.hp;
  car.hp = Math.max(0, car.hp - amount);
  if (by !== null && by !== car.id) {
    car.lastDamagedBy = by;
    car.lastDamagedAt = world.time;
  }
  world.out.push({ type: 'carDamaged', car: car.id, amount: before - car.hp, source, by, pos: { x: pos.x, y: pos.y } });
  if (car.hp > 0) return;

  car.wrecked = true;
  car.wreckedAt = world.time;
  const credit = car.lastDamagedBy !== null && world.time - car.lastDamagedAt <= WRECK_CREDIT_WINDOW ? car.lastDamagedBy : null;
  const creditor = credit !== null ? world.cars[credit] : undefined;
  if (creditor) creditor.wrecksCaused++;
  const t = car.body.translation();
  world.out.push({ type: 'carWrecked', car: car.id, by: credit, pos: { x: t.x, y: t.y } });

  // Wreck explosion: by = null, so a chain wreck keeps whatever credit the victim already had.
  const st = stateOf(world);
  for (const other of world.cars) {
    if (other === car || other.wrecked || other.finished) continue;
    const q = other.body.translation();
    const dx = q.x - t.x;
    const dy = q.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d > WRECK_EXPLOSION_RADIUS) continue;
    // No 'explosion' DamageSource exists in the contract; 'collision' is the closest physical cause.
    applyDamage(world, other, WRECK_EXPLOSION_DAMAGE, 'collision', null, t);
    if (d > 1e-6) push(st, other, dx / d, dy / d, WRECK_EXPLOSION_IMPULSE);
    else push(st, other, 1, 0, WRECK_EXPLOSION_IMPULSE);
  }
}

// ---------------------------------------------------------------- 1. turbo

export const updateTurbo: SimSystem = (world) => {
  const racing = world.phase === 'racing';
  for (const car of world.cars) {
    const active = racing && !car.wrecked && !car.finished && car.input.turbo && car.turbo > 0;
    if (active !== car.turboActive) world.out.push({ type: active ? 'turboStart' : 'turboEnd', car: car.id });
    car.turboActive = active;
    if (active) car.turbo = Math.max(0, car.turbo - SIM_DT);
  }
};

// ---------------------------------------------------------------- 2. collisions

function impactOf(st: CombatState, car: SimCar): number {
  let v = st.impact[car.id];
  if (v < 0) {
    const after = car.body.linvel();
    v = Math.hypot(after.x - car.prevVel.x, after.y - car.prevVel.y);
    st.impact[car.id] = v;
  }
  return v;
}

function onCooldown(st: CombatState, a: number, b: number, time: number): boolean {
  for (let i = 0; i < MAX_COOLDOWNS; i++) {
    if (st.cdA[i] === a && st.cdB[i] === b && time < st.cdUntil[i]) return true;
  }
  return false;
}

function addCooldown(st: CombatState, a: number, b: number, until: number): void {
  st.cdA[st.cdNext] = a;
  st.cdB[st.cdNext] = b;
  st.cdUntil[st.cdNext] = until;
  st.cdNext = (st.cdNext + 1) % MAX_COOLDOWNS;
}

function carVsCar(world: SimWorld, st: CombatState, ia: CarId, ib: CarId): void {
  const a = world.cars[Math.min(ia, ib)];
  const b = world.cars[Math.max(ia, ib)];
  if (!a || !b || onCooldown(st, a.id, b.id, world.time)) return;
  const impA = impactOf(st, a);
  const impB = impactOf(st, b);
  const dmgA = Math.max(0, impA - CAR_IMPACT_THRESHOLD) * CAR_IMPACT_DAMAGE * Math.sqrt(b.base.mass / a.base.mass);
  const dmgB = Math.max(0, impB - CAR_IMPACT_THRESHOLD) * CAR_IMPACT_DAMAGE * Math.sqrt(a.base.mass / b.base.mass);
  const pos = { x: (st.px[a.id] + st.px[b.id]) / 2, y: (st.py[a.id] + st.py[b.id]) / 2 };
  const speed = Math.max(impA, impB);
  if (speed >= IMPACT_EVENT_MIN_SPEED) world.out.push({ type: 'impact', a: a.id, b: b.id, speed, pos: { x: pos.x, y: pos.y } });
  if (dmgA > 0 || dmgB > 0) addCooldown(st, a.id, b.id, world.time + REPEAT_HIT_IGNORE);
  applyDamage(world, a, dmgA, 'collision', b.id, pos);
  applyDamage(world, b, dmgB, 'collision', a.id, pos);
}

function carVsWall(world: SimWorld, st: CombatState, id: CarId): void {
  const car = world.cars[id];
  if (!car || onCooldown(st, id, WALL, world.time)) return;
  const imp = impactOf(st, car);
  const dmg = Math.max(0, imp - WALL_IMPACT_THRESHOLD) * WALL_IMPACT_DAMAGE;
  const pos = { x: st.px[id], y: st.py[id] };
  if (imp >= IMPACT_EVENT_MIN_SPEED) world.out.push({ type: 'impact', a: id, b: 'wall', speed: imp, pos: { x: pos.x, y: pos.y } });
  if (dmg > 0) addCooldown(st, id, WALL, world.time + REPEAT_HIT_IGNORE);
  applyDamage(world, car, dmg, 'wall', null, pos);
}

export const handleCollisions: SimSystem = (world) => {
  const st = stateOf(world);
  st.pairCount = 0;
  world.events.drainCollisionEvents(st.onCollision);
  if (world.phase !== 'racing' || st.pairCount === 0) return;
  st.impact.fill(-1);
  readPositions(world, st);
  for (let i = 0; i < st.pairCount; i++) {
    const ca = world.colliderToCar.get(st.pairH1[i]);
    const cb = world.colliderToCar.get(st.pairH2[i]);
    if (ca !== undefined && cb !== undefined) carVsCar(world, st, ca, cb);
    else if (ca !== undefined) carVsWall(world, st, ca);
    else if (cb !== undefined) carVsWall(world, st, cb);
  }
};

// ---------------------------------------------------------------- 3. guns

/** First collider hit from (ox, oy) along the unit (dx, dy), ignoring the shooter. */
function cast(world: SimWorld, st: CombatState, shooter: SimCar, ox: number, oy: number, dx: number, dy: number): RAPIER.RayColliderHit | null {
  st.ray.origin.x = ox;
  st.ray.origin.y = oy;
  st.ray.dir.x = dx;
  st.ray.dir.y = dy;
  return world.physics.castRay(st.ray, GUN_RANGE, true, undefined, undefined, shooter.collider);
}

function fireShot(world: SimWorld, st: CombatState, car: SimCar): void {
  const h = st.ph[car.id];
  const fx = Math.cos(h);
  const fy = Math.sin(h);
  const off = car.entrant.mesh.length / 2 + GUN_MUZZLE_OFFSET;
  const mx = st.px[car.id] + fx * off;
  const my = st.py[car.id] + fy * off;

  // Aim assist: the target closest to the heading inside the cone, in range, in line of sight.
  let ax = fx;
  let ay = fy;
  let bestCos = Math.cos(GUN_AIM_CONE);
  for (const other of world.cars) {
    if (other === car || other.wrecked || other.finished) continue;
    const dx = st.px[other.id] - mx;
    const dy = st.py[other.id] - my;
    const d = Math.hypot(dx, dy);
    if (d > GUN_RANGE || d < 1e-6) continue;
    const c = (dx * fx + dy * fy) / d;
    if (c < bestCos) continue;
    const los = cast(world, st, car, mx, my, dx / d, dy / d);
    if (!los || los.collider.handle !== other.collider.handle) continue;
    bestCos = c;
    ax = dx / d;
    ay = dy / d;
  }

  const a = world.rng.range(-GUN_SPREAD, GUN_SPREAD);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const dx = ax * ca - ay * sa;
  const dy = ax * sa + ay * ca;
  const hit = cast(world, st, car, mx, my, dx, dy);
  const reach = hit ? hit.timeOfImpact : GUN_RANGE;
  const to = { x: mx + dx * reach, y: my + dy * reach };
  let hitCar: CarId | null = null;
  let hitWall = false;
  if (hit) {
    const id = world.colliderToCar.get(hit.collider.handle);
    if (id !== undefined) hitCar = id;
    else hitWall = true;
  }
  world.out.push({ type: 'gunShot', car: car.id, from: { x: mx, y: my }, to, hitCar, hitWall });
  const target = hitCar !== null ? world.cars[hitCar] : undefined;
  if (target) applyDamage(world, target, car.eff.gunDps / GUN_RATE, 'gun', car.id, to);
}

export const updateGuns: SimSystem = (world) => {
  const racing = world.phase === 'racing';
  let positionsRead = false;
  for (const car of world.cars) {
    const firing = racing && car.input.fire && !car.gunOverheated && !car.wrecked && !car.finished;
    car.firing = firing;
    if (!firing) {
      car.gunHeat = Math.max(0, car.gunHeat - GUN_COOL_RATE * SIM_DT);
      if (car.gunOverheated && car.gunHeat < GUN_UNLOCK_BELOW) car.gunOverheated = false;
      // Clamped so a long pause does not bank a burst of shots for the next trigger pull.
      car.gunCooldown = Math.max(0, car.gunCooldown - SIM_DT);
      continue;
    }
    // Keeps the exact rate across ticks: the remainder carries over instead of resetting.
    car.gunCooldown -= SIM_DT;
    while (car.gunCooldown <= 0) {
      if (!positionsRead) {
        readPositions(world, stateOf(world));
        positionsRead = true;
      }
      car.gunCooldown += 1 / GUN_RATE;
      fireShot(world, stateOf(world), car);
      car.gunHeat += GUN_HEAT_PER_SHOT;
      if (car.gunHeat >= GUN_OVERHEAT_AT) {
        car.gunHeat = GUN_OVERHEAT_AT;
        car.gunOverheated = true;
        world.out.push({ type: 'gunOverheat', car: car.id });
        break;
      }
    }
  }
};

// ---------------------------------------------------------------- 4. mines

function explodeMine(world: SimWorld, st: CombatState, m: SimMine): void {
  const hitCars: CarId[] = [];
  world.out.push({ type: 'mineExploded', mine: m.id, pos: { x: m.pos.x, y: m.pos.y }, hitCars });
  for (const car of world.cars) {
    if (car.wrecked || car.finished) continue;
    const dx = st.px[car.id] - m.pos.x;
    const dy = st.py[car.id] - m.pos.y;
    const d = Math.hypot(dx, dy);
    if (d > MINE_BLAST_RADIUS) continue;
    const dmg = MINE_DAMAGE_CENTER + (MINE_DAMAGE_EDGE - MINE_DAMAGE_CENTER) * (d / MINE_BLAST_RADIUS);
    applyDamage(world, car, dmg, 'mine', m.owner === car.id ? null : m.owner, m.pos);
    const h = st.ph[car.id];
    if (d > 1e-6) push(st, car, dx / d, dy / d, MINE_IMPULSE);
    else push(st, car, Math.cos(h), Math.sin(h), MINE_IMPULSE);
    car.body.setAngvel(car.body.angvel() + (world.rng.chance(0.5) ? MINE_SPIN : -MINE_SPIN), true);
    hitCars.push(car.id);
  }
}

function triggered(world: SimWorld, st: CombatState, m: SimMine): boolean {
  for (const car of world.cars) {
    if (car.wrecked || car.finished) continue;
    const r = MINE_TRIGGER_RADIUS + car.entrant.mesh.width / 2;
    const dx = st.px[car.id] - m.pos.x;
    const dy = st.py[car.id] - m.pos.y;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export const updateMines: SimSystem = (world) => {
  if (world.phase !== 'racing') return;
  const st = stateOf(world);
  readPositions(world, st);

  for (const car of world.cars) {
    if (!car.input.dropMine || car.prevInput.dropMine || car.mines <= 0 || car.mineCooldown > 0 || car.wrecked || car.finished) continue;
    if (world.mines.length >= MINE_MAX_ON_TRACK) world.mines.shift();
    const h = st.ph[car.id];
    const off = car.entrant.mesh.length / 2 + MINE_DROP_OFFSET;
    const pos = { x: st.px[car.id] - Math.cos(h) * off, y: st.py[car.id] - Math.sin(h) * off };
    const mine: SimMine = { id: world.nextMineId++, owner: car.id, pos, age: 0, armed: false };
    world.mines.push(mine);
    car.mines--;
    car.mineCooldown = MINE_COOLDOWN;
    world.out.push({ type: 'mineDropped', mine: mine.id, car: car.id, pos: { x: pos.x, y: pos.y } });
  }

  // Compact in place: expired and exploded mines are dropped without allocating a new array.
  let kept = 0;
  for (let i = 0; i < world.mines.length; i++) {
    const m = world.mines[i];
    if (!m) continue;
    m.age += SIM_DT;
    m.armed = m.age >= MINE_ARM_TIME;
    if (m.age >= MINE_LIFETIME) continue;
    if (m.armed && triggered(world, st, m)) {
      explodeMine(world, st, m);
      continue;
    }
    world.mines[kept++] = m;
  }
  world.mines.length = kept;

  for (const car of world.cars) car.mineCooldown = Math.max(0, car.mineCooldown - SIM_DT);
};

// ---------------------------------------------------------------- 5. pickups

function atCap(car: SimCar, kind: PickupKind): boolean {
  switch (kind) {
    case 'cash':
      return false;
    case 'repair':
      return car.hp >= car.base.maxHp;
    case 'mines':
      return car.mines >= MAX_MINES_CARRIED;
    case 'turbo':
      return car.turbo >= MAX_TURBO_CARRIED;
  }
}

function collect(car: SimCar, kind: PickupKind): void {
  switch (kind) {
    case 'cash':
      car.cashPicked += PICKUP_CASH_UNITS;
      break;
    case 'repair':
      car.hp = Math.min(car.base.maxHp, car.hp + PICKUP_REPAIR_HP);
      break;
    case 'mines':
      car.mines = Math.min(MAX_MINES_CARRIED, car.mines + PICKUP_MINES);
      break;
    case 'turbo':
      car.turbo = Math.min(MAX_TURBO_CARRIED, car.turbo + PICKUP_TURBO_SECONDS);
      break;
  }
}

export const updatePickups: SimSystem = (world) => {
  if (world.phase !== 'racing') return;
  const st = stateOf(world);
  readPositions(world, st);
  for (const p of world.pickups) {
    if (!p.active) {
      p.respawnIn -= SIM_DT;
      if (p.respawnIn <= 0) {
        p.active = true;
        p.respawnIn = 0;
        world.out.push({ type: 'pickupRespawned', pickup: p.id });
      }
      continue;
    }
    // world.cars is in id order, so the lowest id wins a tie.
    for (const car of world.cars) {
      if (car.wrecked || car.finished || atCap(car, p.kind)) continue;
      const r = PICKUP_RADIUS + car.entrant.mesh.width / 2;
      const dx = st.px[car.id] - p.pos.x;
      const dy = st.py[car.id] - p.pos.y;
      if (dx * dx + dy * dy > r * r) continue;
      collect(car, p.kind);
      p.active = false;
      p.respawnIn = PICKUP_RESPAWN_SECONDS;
      world.out.push({ type: 'pickupCollected', pickup: p.id, car: car.id, kind: p.kind, pos: { x: p.pos.x, y: p.pos.y } });
      break;
    }
  }
};
