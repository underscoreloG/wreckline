import { beforeAll, describe, expect, it } from 'vitest';
import { PICKUP_REPAIR_HP, PICKUP_RESPAWN_SECONDS } from '../content/pickups';
import { buildQuickRaceSetup } from '../content/quickRace';
import {
  GUN_COOL_RATE,
  GUN_HEAT_PER_SHOT,
  GUN_OVERHEAT_AT,
  GUN_RATE,
  GUN_SPREAD,
  GUN_UNLOCK_BELOW,
  MINE_ARM_TIME,
  MINE_DAMAGE_CENTER,
  MINE_DAMAGE_EDGE,
  MINE_MAX_ON_TRACK,
  WALL_IMPACT_THRESHOLD,
  WRECK_EXPLOSION_DAMAGE,
} from '../content/weapons';
import type { CarId, InputFrame, Sim, SimEvent } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_HZ } from '../shared/contracts';
import { createSimWithWorld, initPhysics } from './index';
import type { SimCar, SimWorld } from './internal';

beforeAll(async () => {
  await initPhysics();
});

const DEG = Math.PI / 180;
const FIRE: InputFrame = { ...NEUTRAL_INPUT, fire: true };
const DROP: InputFrame = { ...NEUTRAL_INPUT, dropMine: true };
const TURBO: InputFrame = { ...NEUTRAL_INPUT, turbo: true };

/** Every entrant scripted (WP00 test rule), green light already on, cars parked away from the main straight. */
function make(): { sim: Sim; world: SimWorld } {
  const s = buildQuickRaceSetup({ seed: 1, aiCount: 3 });
  const { sim, world } = createSimWithWorld({ ...s, entrants: s.entrants.map((e) => ({ ...e, ai: null })) });
  world.phase = 'racing';
  world.countdown = 0;
  world.cars.forEach((c) => park(world, c.id));
  return { sim, world };
}

/** Parking spots on the centerline, clear of the main straight and of every pickup. */
function park(world: SimWorld, id: CarId): void {
  const smp = world.track.sampleAt(470 + 30 * id);
  place(world, id, smp.pos.x, smp.pos.y, Math.atan2(smp.tangent.y, smp.tangent.x));
}

function place(world: SimWorld, id: CarId, x: number, y: number, heading: number, vx = 0, vy = 0): SimCar {
  const car = world.cars[id] as SimCar;
  car.body.setTranslation({ x, y }, true);
  car.body.setRotation(heading, true);
  car.body.setLinvel({ x: vx, y: vy }, true);
  car.body.setAngvel(0, true);
  return car;
}

function run(sim: Sim, ticks: number, inputs: ReadonlyMap<CarId, InputFrame> = new Map()): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) all.push(...sim.step(inputs));
  return all;
}

const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

const damageTo = (events: SimEvent[], car: CarId) => of(events, 'carDamaged').filter((e) => e.car === car);

describe('machine gun', () => {
  it('1. hits a target 20 m ahead: 1 s of fire deals gunDps +- 1 shot', () => {
    const { sim, world } = make();
    const shooter = place(world, 0, 10, 0, 0);
    const target = place(world, 1, 30, 0, 0);
    const ev = run(sim, SIM_HZ, new Map([[0, FIRE]]));
    const perShot = shooter.eff.gunDps / GUN_RATE;
    const dealt = target.base.maxHp - target.hp;
    expect(Math.abs(dealt - shooter.eff.gunDps)).toBeLessThanOrEqual(perShot + 1e-9);
    expect(of(ev, 'gunShot').every((s) => s.hitCar === 1)).toBe(true);
    expect(damageTo(ev, 1).every((d) => d.source === 'gun' && d.by === 0)).toBe(true);
    expect(target.lastDamagedBy).toBe(0);
    sim.dispose();
  });

  it('2. aim assist: 5 deg off-axis hits, 10 deg off-axis misses and shots go straight', () => {
    const fireAt = (deg: number) => {
      const { sim, world } = make();
      place(world, 0, 10, 0, 0);
      const target = place(world, 1, 10 + 20 * Math.cos(deg * DEG), 20 * Math.sin(deg * DEG), 0);
      const ev = run(sim, SIM_HZ, new Map([[0, FIRE]]));
      sim.dispose();
      return { dealt: target.base.maxHp - target.hp, shots: of(ev, 'gunShot') };
    };
    const near = fireAt(5);
    expect(near.dealt).toBeGreaterThan(0);
    expect(near.shots.every((s) => s.hitCar === 1)).toBe(true);
    const far = fireAt(10);
    expect(far.dealt).toBe(0);
    expect(far.shots.length).toBeGreaterThan(0);
    for (const s of far.shots) {
      expect(s.hitCar).toBeNull();
      expect(Math.abs(Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x))).toBeLessThanOrEqual(GUN_SPREAD + 1e-9);
    }
  });

  it('3. range: a target at 50 m takes no damage', () => {
    const { sim, world } = make();
    place(world, 0, 10, 0, 0);
    const target = place(world, 1, 60, 0, 0);
    const ev = run(sim, SIM_HZ, new Map([[0, FIRE]]));
    expect(of(ev, 'gunShot').length).toBeGreaterThan(0);
    expect(target.hp).toBe(target.base.maxHp);
    sim.dispose();
  });

  it('4. walls block: hitWall true, no damage', () => {
    const { sim, world } = make();
    const smp = world.track.sampleAt(60);
    const face = Math.atan2(smp.right.y, smp.right.x);
    place(world, 0, smp.pos.x, smp.pos.y, face);
    // The right wall sits at lateral width/2 + shoulder = 9 m, the target is beyond it.
    const target = place(world, 1, smp.pos.x + smp.right.x * 20, smp.pos.y + smp.right.y * 20, face);
    const ev = run(sim, SIM_HZ, new Map([[0, FIRE]]));
    const shots = of(ev, 'gunShot');
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((s) => s.hitWall && s.hitCar === null)).toBe(true);
    expect(target.hp).toBe(target.base.maxHp);
    sim.dispose();
  });

  it('5. overheat in 1.4-1.6 s, firing stops, resumes once heat < 0.35 (~1.4 s later)', () => {
    const { sim, world } = make();
    const car = place(world, 0, 10, 0, 0);
    const fire = new Map([[0, FIRE]]);
    let overTick = -1;
    let resumeTick = -1;
    for (let t = 0; t < 6 * SIM_HZ && resumeTick < 0; t++) {
      const ev = sim.step(fire);
      if (of(ev, 'gunOverheat').length > 0) {
        expect(overTick).toBe(-1);
        overTick = t;
        expect(car.gunOverheated).toBe(true);
      } else if (overTick >= 0) {
        if (of(ev, 'gunShot').length > 0) resumeTick = t;
        else expect(car.firing).toBe(false);
      }
    }
    const overAt = (overTick + 1) / SIM_HZ;
    expect(overAt).toBeGreaterThanOrEqual(1.4);
    expect(overAt).toBeLessThanOrEqual(1.6);
    expect(resumeTick).toBeGreaterThan(overTick);
    const expectedGap = (GUN_OVERHEAT_AT - GUN_UNLOCK_BELOW) / GUN_COOL_RATE;
    expect(Math.abs((resumeTick - overTick) / SIM_HZ - expectedGap)).toBeLessThanOrEqual(2 / SIM_HZ);
    expect(car.gunHeat).toBeLessThan(GUN_UNLOCK_BELOW + GUN_HEAT_PER_SHOT);
    sim.dispose();
  });
});

describe('mines', () => {
  it('6. the owner cannot trigger an unarmed mine; another car does after 0.7 s', () => {
    const { sim, world } = make();
    const owner = place(world, 0, 40, 0, 0);
    const ev0 = run(sim, 1, new Map([[0, DROP]]));
    const dropped = of(ev0, 'mineDropped');
    expect(dropped).toHaveLength(1);
    const mp = dropped[0]!.pos;
    place(world, 0, mp.x, mp.y, 0);
    const standing = run(sim, Math.round(0.5 * SIM_HZ));
    expect(of(standing, 'mineExploded')).toHaveLength(0);
    expect(owner.hp).toBe(owner.base.maxHp);

    park(world, 0);
    const victim = place(world, 1, mp.x - 10, mp.y, 0);
    const drive = new Map([[1, { ...NEUTRAL_INPUT, throttle: 1 }]]);
    let boom: Extract<SimEvent, { type: 'mineExploded' }> | undefined;
    const all: SimEvent[] = [];
    let t = 1 + Math.round(0.5 * SIM_HZ);
    for (; t < 5 * SIM_HZ && !boom; t++) {
      const ev = sim.step(drive);
      all.push(...ev);
      boom = of(ev, 'mineExploded')[0];
    }
    expect(boom).toBeDefined();
    expect(t / SIM_HZ).toBeGreaterThanOrEqual(0.7);
    expect(boom!.hitCars).toContain(1);
    const hit = damageTo(all, 1);
    expect(hit).toHaveLength(1);
    expect(hit[0]!.source).toBe('mine');
    expect(hit[0]!.by).toBe(0);
    expect(hit[0]!.amount).toBeGreaterThanOrEqual(MINE_DAMAGE_EDGE);
    expect(hit[0]!.amount).toBeLessThanOrEqual(MINE_DAMAGE_CENTER);
    expect(victim.lastDamagedBy).toBe(0);
    expect(world.mines).toHaveLength(0);
    sim.dispose();
  });

  it('7. dropping 26 mines leaves 24 on track', () => {
    const { sim, world } = make();
    const car = place(world, 0, 40, 0, 0);
    const drop = new Map([[0, DROP]]);
    let drops = 0;
    let booms = 0;
    for (let i = 0; i < 26; i++) {
      car.mines = 3;
      drops += of(run(sim, 1, drop), 'mineDropped').length;
      booms += of(run(sim, Math.round(0.5 * SIM_HZ) + 1), 'mineExploded').length;
    }
    expect(drops).toBe(26);
    expect(booms).toBe(0);
    expect(world.mines).toHaveLength(MINE_MAX_ON_TRACK);
    expect(sim.snapshot().mines).toHaveLength(MINE_MAX_ON_TRACK);
    expect(world.mines[0]!.id).toBe(2); // the two oldest went first
    expect(world.mines.every((m) => m.armed === m.age >= MINE_ARM_TIME)).toBe(true);
    sim.dispose();
  });
});

describe('collisions', () => {
  /** Car A (0) placed 0.3 m behind car B (1) on the straight, moving at `speed`. Neutral inputs (see report). */
  function rearEnd(speed: number) {
    const { sim, world } = make();
    const a = place(world, 0, 20, 0, 0, speed, 0);
    const b = place(world, 1, 20 + a.entrant.mesh.length + 0.3, 0, 0);
    const ev = run(sim, 10);
    sim.dispose();
    return { a, b, ev };
  }

  it('8. 25 m/s into a stationary car damages both, B by A; a 7 m/s bump only emits impact', () => {
    const hard = rearEnd(25);
    const toA = damageTo(hard.ev, 0);
    const toB = damageTo(hard.ev, 1);
    expect(toA.length).toBeGreaterThan(0);
    expect(toB.length).toBeGreaterThan(0);
    expect(toA.every((d) => d.source === 'collision' && d.by === 1)).toBe(true);
    expect(toB.every((d) => d.source === 'collision' && d.by === 0)).toBe(true);
    expect(hard.b.lastDamagedBy).toBe(0);
    // Equal masses, restitution 0.3: each car changes speed by about 0.65 * 25 m/s.
    expect(hard.b.base.maxHp - hard.b.hp).toBeGreaterThan(8);
    expect(hard.b.base.maxHp - hard.b.hp).toBeLessThan(30);

    const soft = rearEnd(7);
    expect(of(soft.ev, 'carDamaged')).toHaveLength(0);
    const imp = of(soft.ev, 'impact');
    expect(imp.length).toBeGreaterThan(0);
    expect(imp[0]).toMatchObject({ a: 0, b: 1 });
    expect(imp[0]!.speed).toBeGreaterThanOrEqual(4);
  });

  it('9. 30 m/s head-on into a wall: damage = impact - 9 (+-15%)', () => {
    const { sim, world } = make();
    const smp = world.track.sampleAt(60);
    const face = Math.atan2(smp.right.y, smp.right.x);
    const car = place(world, 0, smp.pos.x + smp.right.x * 5, smp.pos.y + smp.right.y * 5, face, smp.right.x * 30, smp.right.y * 30);
    const ev = run(sim, 15);
    const wall = of(ev, 'impact').filter((e) => e.a === 0 && e.b === 'wall');
    expect(wall.length).toBeGreaterThan(0);
    const impact = wall[0]!.speed;
    expect(impact).toBeGreaterThanOrEqual(30 * 0.85);
    expect(impact).toBeLessThanOrEqual(30 * 1.4); // restitution 0.2-0.3 bounces it back at 6-9 m/s
    const dmg = damageTo(ev, 0);
    expect(dmg.every((d) => d.source === 'wall' && d.by === null)).toBe(true);
    const total = car.base.maxHp - car.hp;
    const expected = impact - WALL_IMPACT_THRESHOLD;
    expect(Math.abs(total - expected)).toBeLessThanOrEqual(expected * 0.15);
    sim.dispose();
  });
});

describe('wrecks', () => {
  it('10. A shoots B to 0 hp: credit to A, nearby C takes the explosion damage', () => {
    const { sim, world } = make();
    const a = place(world, 0, 10, 0, 0);
    const b = place(world, 1, 30, 0, 0);
    const c = place(world, 2, 30, 3.5, 0);
    b.hp = 3;
    const all: SimEvent[] = [];
    for (let t = 0; t < SIM_HZ && !b.wrecked; t++) all.push(...sim.step(new Map([[0, FIRE]])));
    const wrecked = of(all, 'carWrecked');
    expect(wrecked).toHaveLength(1);
    expect(wrecked[0]).toMatchObject({ car: 1, by: 0 });
    expect(b.wrecked).toBe(true);
    expect(b.wreckedAt).toBeCloseTo(world.time - 1 / SIM_HZ, 9); // time advanced after the wreck tick
    expect(b.hp).toBe(0);
    expect(a.wrecksCaused).toBe(1);
    expect(c.base.maxHp - c.hp).toBeCloseTo(WRECK_EXPLOSION_DAMAGE, 9);
    expect(damageTo(all, 2)).toEqual([expect.objectContaining({ amount: WRECK_EXPLOSION_DAMAGE, by: null })]);
    expect(damageTo(all, 0)).toHaveLength(0);
    sim.dispose();
  });
});

describe('pickups', () => {
  it('11. cash is collected once, inactive 8 s, respawns; a full-hp car does not take repair', () => {
    const { sim, world } = make();
    const cash = world.pickups.find((p) => p.kind === 'cash')!;
    const car = place(world, 0, cash.pos.x, cash.pos.y, 0);
    const first = run(sim, 1);
    expect(of(first, 'pickupCollected')).toEqual([expect.objectContaining({ pickup: cash.id, car: 0, kind: 'cash' })]);
    expect(car.cashPicked).toBe(1);
    expect(cash.active).toBe(false);

    // The car stays on the spot: nothing to collect until the respawn.
    let respawnTick = -1;
    for (let t = 1; t < 14 * SIM_HZ && respawnTick < 0; t++) {
      const ev = sim.step(new Map());
      if (of(ev, 'pickupRespawned').some((e) => e.pickup === cash.id)) respawnTick = t;
      else expect(of(ev, 'pickupCollected')).toHaveLength(0);
    }
    expect(Math.abs(respawnTick - PICKUP_RESPAWN_SECONDS * SIM_HZ)).toBeLessThanOrEqual(1);
    expect(cash.active).toBe(true);
    expect(car.cashPicked).toBe(1);
    expect(of(run(sim, 1), 'pickupCollected')).toHaveLength(1);
    expect(car.cashPicked).toBe(2);

    const repair = world.pickups.find((p) => p.kind === 'repair')!;
    const full = place(world, 1, repair.pos.x, repair.pos.y, 0);
    expect(of(run(sim, 10), 'pickupCollected')).toHaveLength(0);
    expect(repair.active).toBe(true);
    full.hp = 50;
    const ev = run(sim, 1);
    expect(of(ev, 'pickupCollected')).toEqual([expect.objectContaining({ pickup: repair.id, car: 1, kind: 'repair' })]);
    expect(full.hp).toBe(50 + PICKUP_REPAIR_HP);
    sim.dispose();
  });
});

describe('turbo', () => {
  it('12. held 5 s with 4 s available: active 240 +- 1 ticks, one turboEnd', () => {
    const { sim, world } = make();
    const car = world.cars[0]!;
    car.turbo = 4;
    let active = 0;
    const all: SimEvent[] = [];
    for (let t = 0; t < 5 * SIM_HZ; t++) {
      all.push(...sim.step(new Map([[0, TURBO]])));
      if (car.turboActive) active++;
    }
    expect(Math.abs(active - 4 * SIM_HZ)).toBeLessThanOrEqual(1);
    expect(of(all, 'turboStart')).toHaveLength(1);
    expect(of(all, 'turboEnd')).toHaveLength(1);
    expect(car.turbo).toBe(0);
    expect(car.turboActive).toBe(false);
    sim.dispose();
  });
});

describe('determinism', () => {
  it('13. a 1200-tick scripted fight gives the same stateHash twice', () => {
    const fight = () => {
      const { sim, world } = make();
      place(world, 0, 30, 0, 0);
      place(world, 1, 50, 0, Math.PI);
      const counts = { shots: 0, hits: 0, mines: 0 };
      for (let t = 0; t < 1200; t++) {
        const drop = t % 90 < 3;
        const ev = sim.step(
          new Map([
            [0, { ...NEUTRAL_INPUT, throttle: 1, steer: 0.6, fire: true, dropMine: drop }],
            [1, { ...NEUTRAL_INPUT, throttle: 1, steer: 0.6, fire: true, dropMine: drop }],
          ]),
        );
        counts.shots += of(ev, 'gunShot').length;
        counts.hits += of(ev, 'gunShot').filter((s) => s.hitCar !== null).length;
        counts.mines += of(ev, 'mineDropped').length;
      }
      const hash = sim.stateHash();
      sim.dispose();
      return { hash, counts };
    };
    const a = fight();
    const b = fight();
    expect(b.hash).toBe(a.hash);
    expect(b.counts).toEqual(a.counts);
    expect(a.counts.shots).toBeGreaterThan(0);
    expect(a.counts.hits).toBeGreaterThan(0);
    expect(a.counts.mines).toBeGreaterThan(0);
  });
});

describe('finished cars are immune (WP07, content.md section 7)', () => {
  const finish = (car: SimCar): SimCar => {
    car.finished = true;
    car.finishTime = 0;
    return car;
  };

  it('take no gun damage and are skipped by aim assist', () => {
    const { sim, world } = make();
    place(world, 0, 10, 0, 0);
    const target = finish(place(world, 1, 10 + 20 * Math.cos(5 * DEG), 20 * Math.sin(5 * DEG), 0));
    const ev = run(sim, SIM_HZ, new Map([[0, FIRE]]));
    const shots = of(ev, 'gunShot');
    expect(shots.length).toBeGreaterThan(0);
    // Not aimed at: every shot leaves along the heading, within the spread.
    for (const s of shots) expect(Math.abs(Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x))).toBeLessThanOrEqual(GUN_SPREAD + 1e-9);
    expect(target.hp).toBe(target.base.maxHp);
    expect(damageTo(ev, 1)).toHaveLength(0);
    sim.dispose();
  });

  it('do not trigger mines and are not mine-blast victims', () => {
    const { sim, world } = make();
    const fin = finish(place(world, 1, 60, 0, 0));
    world.mines.push({ id: 900, owner: 0, pos: { x: 60, y: 0 }, age: 1, armed: true });
    expect(of(run(sim, 1), 'mineExploded')).toHaveLength(0);
    // A racing car sets it off with the finished car inside the blast radius.
    place(world, 1, 60, 3.5, 0);
    place(world, 2, 60, 0, 0);
    const ev = run(sim, 1);
    expect(of(ev, 'mineExploded')).toEqual([expect.objectContaining({ mine: 900, hitCars: [2] })]);
    expect(fin.hp).toBe(fin.base.maxHp);
    expect(world.cars[2]!.hp).toBeLessThan(world.cars[2]!.base.maxHp);
    sim.dispose();
  });

  it('take no collision, wall or wreck-explosion damage and are never wrecked', () => {
    // Rear-ended at 25 m/s: only the racing car is hurt.
    {
      const { sim, world } = make();
      const a = place(world, 0, 20, 0, 0, 25, 0);
      const b = finish(place(world, 1, 20 + a.entrant.mesh.length + 0.3, 0, 0));
      const ev = run(sim, 10);
      expect(of(ev, 'impact').some((e) => e.a === 0 && e.b === 1)).toBe(true);
      expect(damageTo(ev, 0).length).toBeGreaterThan(0);
      expect(damageTo(ev, 1)).toHaveLength(0);
      expect(b.hp).toBe(b.base.maxHp);
      sim.dispose();
    }
    // 30 m/s head-on into a wall.
    {
      const { sim, world } = make();
      const smp = world.track.sampleAt(60);
      const face = Math.atan2(smp.right.y, smp.right.x);
      const car = finish(place(world, 0, smp.pos.x + smp.right.x * 5, smp.pos.y + smp.right.y * 5, face, smp.right.x * 30, smp.right.y * 30));
      const ev = run(sim, 15);
      expect(of(ev, 'impact').some((e) => e.a === 0 && e.b === 'wall' && e.speed > 20)).toBe(true);
      expect(car.hp).toBe(car.base.maxHp);
      sim.dispose();
    }
    // A car wrecked right next to it: no explosion damage.
    {
      const { sim, world } = make();
      place(world, 0, 10, 0, 0);
      const b = place(world, 1, 30, 0, 0);
      const c = finish(place(world, 2, 30, 3.5, 0));
      b.hp = 3;
      const all: SimEvent[] = [];
      for (let t = 0; t < SIM_HZ && !b.wrecked; t++) all.push(...sim.step(new Map([[0, FIRE]])));
      expect(b.wrecked).toBe(true);
      expect(c.hp).toBe(c.base.maxHp);
      expect(damageTo(all, 2)).toHaveLength(0);
      expect(c.wrecked).toBe(false);
      sim.dispose();
    }
  });

  it('never fire, drop mines, use turbo or collect pickups', () => {
    const { sim, world } = make();
    const cash = world.pickups.find((p) => p.kind === 'cash')!;
    const car = finish(place(world, 0, cash.pos.x, cash.pos.y, 0));
    car.turbo = 4;
    place(world, 1, cash.pos.x + 20, cash.pos.y, 0);
    const all = { ...NEUTRAL_INPUT, fire: true, dropMine: true, turbo: true };
    const ev: SimEvent[] = [];
    for (let t = 0; t < SIM_HZ; t++) ev.push(...sim.step(new Map([[0, t % 2 === 0 ? all : { ...all, dropMine: false }]])));
    expect(of(ev, 'gunShot').filter((e) => e.car === 0)).toHaveLength(0);
    expect(of(ev, 'mineDropped')).toHaveLength(0);
    expect(of(ev, 'pickupCollected')).toHaveLength(0);
    expect(of(ev, 'turboStart')).toHaveLength(0);
    expect(car.turbo).toBe(4);
    expect(cash.active).toBe(true);
    sim.dispose();
  });
});
