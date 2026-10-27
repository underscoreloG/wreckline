import { beforeAll, describe, expect, it } from 'vitest';
import { getArena } from '../content/arenas';
import {
  ARENA_DECAY_PER_SECOND,
  ARENA_PICKUP_RESPAWN_SECONDS,
  ARENA_SUDDEN_DEATH_AT,
  ARENA_SUDDEN_WALL_MULT,
  ARENA_TIME_LIMIT,
} from '../content/arenas/rules';
import { buildArenaSetup } from '../content/arenas/setup';
import type { RaceSetup, SimEvent } from '../shared/contracts';
import { SIM_DT } from '../shared/contracts';
import { arenaTargets, MAX_HUNTERS } from './arenaAi';
import { createSimWithWorld, initPhysics } from './index';
import type { SimWorld } from './internal';
import { updateArena, updateArenaPhase } from './arena';

beforeAll(async () => {
  await initPhysics();
});

/** An arena fight with every car driven from outside (no AI), stepped to the green light. */
function fight(arenaId = 'scrapPit', seed = 3): { world: SimWorld; sim: ReturnType<typeof createSimWithWorld>['sim'] } {
  const base = buildArenaSetup({ seed, arenaId });
  const setup: RaceSetup = { ...base, entrants: base.entrants.map((e) => ({ ...e, ai: null })) };
  const { sim, world } = createSimWithWorld(setup);
  while (world.phase !== 'racing') sim.step(new Map());
  return { sim, world };
}

const wreck = (world: SimWorld, id: number, at: number): void => {
  const c = world.cars[id];
  if (!c) throw new Error(`no car ${id}`);
  c.wrecked = true;
  c.wreckedAt = at;
  c.hp = 0;
};

describe('arena sim rules (WP41, CCR-16)', () => {
  it('builds the arena: spawn points, fixed pickup spots, no laps, every car on the road', () => {
    const { sim, world } = fight('dockLot');
    const arena = getArena('dockLot');
    const snap = sim.snapshot();
    snap.cars.forEach((c, i) => {
      expect(c.pos.x).toBeCloseTo(arena.spawns[i]!.pos.x, 1);
      expect(c.pos.y).toBeCloseTo(arena.spawns[i]!.pos.y, 1);
    });
    expect(snap.pickups.map((p) => p.pos)).toEqual(arena.pickups.map((p) => p.pos));
    for (let i = 0; i < 120; i++) sim.step(new Map([[1, { throttle: 1, brake: 0, steer: 0, handbrake: false, fire: false, dropMine: false, turbo: false }]]));
    expect(world.cars.every((c) => !c.offroad && c.lap === 0 && !c.wrongWay)).toBe(true);
    expect(sim.snapshot().cars[1]!.speed).toBeGreaterThan(10);
    sim.dispose();
  });

  it('the last car standing wins; placement by elimination order with damage dealt and elimination time', () => {
    const { sim, world } = fight();
    world.time = 30;
    // Car 3 dealt the most damage; 5 and 6 go out on the same tick: more damage dealt ranks higher.
    world.out.push({ type: 'carDamaged', car: 4, amount: 40, source: 'gun', by: 3, pos: { x: 0, y: 0 } });
    world.out.push({ type: 'carDamaged', car: 6, amount: 12, source: 'gun', by: 5, pos: { x: 0, y: 0 } });
    updateArena(world);
    world.out.length = 0;
    const order = [1, 7, 0, 4, 2];
    order.forEach((id, i) => wreck(world, id, 10 + i));
    wreck(world, 5, 20);
    wreck(world, 6, 20);
    updateArenaPhase(world);
    expect(world.phase).toBe('finished');
    const r = sim.result();
    expect(r?.mode).toBe('arena');
    expect(r?.rows.map((row) => row.car)).toEqual([3, 5, 6, 2, 4, 0, 7, 1]);
    expect(r?.rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(r?.rows[0]?.eliminatedAt).toBeNull();
    expect(r?.rows[1]?.eliminatedAt).toBe(20);
    expect(r?.rows[0]?.damageDealt).toBe(40);
    expect(r?.rows[1]?.damageDealt).toBe(12);
    expect(r?.rows.find((row) => row.car === 1)?.damageDealt).toBe(0);
    sim.dispose();
  });

  it('keeps going while two cars run, and ends at the time limit ranked by hp', () => {
    const { sim, world } = fight();
    for (const id of [1, 2, 3, 4, 5, 6]) wreck(world, id, 5);
    updateArenaPhase(world);
    expect(world.phase).toBe('racing');
    world.time = ARENA_TIME_LIMIT;
    world.cars[0]!.hp = 10;
    updateArenaPhase(world);
    expect(world.phase).toBe('finished');
    expect(sim.result()?.rows.slice(0, 2).map((row) => row.car)).toEqual([7, 0]);
    sim.dispose();
  });

  it('pickups respawn 10 s after collection; repairs stop respawning in sudden death', () => {
    const { sim, world } = fight();
    const repair = world.pickups.findIndex((p) => p.kind === 'repair');
    const mines = world.pickups.findIndex((p) => p.kind === 'mines');
    const collect = (i: number): void => {
      const p = world.pickups[i]!;
      p.active = false;
      world.out.push({ type: 'pickupCollected', pickup: i, car: 1, kind: p.kind, pos: p.pos });
    };
    world.time = 50;
    collect(repair);
    updateArena(world);
    world.out.length = 0;
    expect(world.pickups[repair]!.respawnIn).toBe(ARENA_PICKUP_RESPAWN_SECONDS);
    world.time = ARENA_SUDDEN_DEATH_AT + 1;
    world.pickups[repair]!.active = true;
    collect(repair);
    collect(mines);
    updateArena(world);
    expect(world.pickups[repair]!.respawnIn).toBe(Infinity);
    expect(world.pickups[mines]!.respawnIn).toBe(ARENA_PICKUP_RESPAWN_SECONDS);
    sim.dispose();
  });

  it('sudden death: 1% max hp per second from 120 s, wall hits deal double, the drain wrecks', () => {
    const { sim, world } = fight();
    const car = world.cars[2]!;
    const hp0 = car.hp;
    world.time = ARENA_SUDDEN_DEATH_AT - 1;
    updateArena(world);
    expect(car.hp).toBe(hp0);
    world.time = ARENA_SUDDEN_DEATH_AT;
    for (let i = 0; i < 60; i++) {
      updateArena(world);
      world.time += SIM_DT;
    }
    expect(car.hp).toBeCloseTo(hp0 - car.base.maxHp * ARENA_DECAY_PER_SECOND, 6);
    expect(world.out.filter((e) => e.type === 'carDamaged')).toHaveLength(0); // the drain is silent

    const before = car.hp;
    world.out.push({ type: 'carDamaged', car: 2, amount: 5, source: 'wall', by: null, pos: { x: 0, y: 0 } });
    car.hp -= 5; // as combat applied it
    updateArena(world);
    const drain = car.base.maxHp * ARENA_DECAY_PER_SECOND * SIM_DT;
    expect(before - car.hp).toBeCloseTo(5 * ARENA_SUDDEN_WALL_MULT + drain, 6);
    world.out.length = 0;

    car.hp = drain / 2;
    updateArena(world);
    expect(car.wrecked).toBe(true);
    const ev = world.out.find((e): e is Extract<SimEvent, { type: 'carWrecked' }> => e.type === 'carWrecked');
    expect(ev?.car).toBe(2);
    sim.dispose();
  });

  it('is deterministic: the same seed gives the same fight', () => {
    const run = (): string[] => {
      const { sim } = createSimWithWorld(buildArenaSetup({ seed: 11, arenaId: 'quarryBowl', autoplay: true }));
      const hashes: string[] = [];
      for (let i = 0; i < 1800; i++) {
        sim.step(new Map());
        if (i % 300 === 0) hashes.push(sim.stateHash());
      }
      sim.dispose();
      return hashes;
    };
    expect(run()).toEqual(run());
  });

  it('AI target fairness: never more than 3 AIs on one car, and the player is not the favourite target', () => {
    let playerHunted = 0;
    let othersHunted = 0;
    for (const arenaId of ['scrapPit', 'quarryBowl', 'dockLot']) {
      for (let seed = 1; seed <= 4; seed++) {
        // The player drives nothing (a human who does not move is the easiest target there is).
        const { sim, world } = createSimWithWorld(buildArenaSetup({ seed, arenaId }));
        const counts = new Array<number>(8).fill(0);
        for (let t = 0; t < 60 * 60 && !sim.result(); t++) {
          sim.step(new Map());
          if (world.phase !== 'racing') continue;
          counts.fill(0);
          for (const tg of arenaTargets(world)) if (tg >= 0) counts[tg] = (counts[tg] ?? 0) + 1;
          expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_HUNTERS);
          playerHunted += counts[0] ?? 0;
          othersHunted += counts.slice(1).reduce((a, b) => a + b, 0);
        }
        sim.dispose();
      }
    }
    // Per car, the parked player draws at most twice the others' average attention.
    expect(playerHunted).toBeLessThan((2 * othersHunted) / 7);
  });
});
