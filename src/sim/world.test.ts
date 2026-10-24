import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuickRaceSetup } from '../content/quickRace';
import { NEUTRAL_INPUT } from '../shared/contracts';
import { createSimWithWorld, initPhysics } from './index';

beforeAll(async () => {
  await initPhysics();
});

const inertSetup = () => {
  const s = buildQuickRaceSetup({ seed: 3, aiCount: 3 });
  return { ...s, entrants: s.entrants.map((e) => ({ ...e, ai: null })) };
};

describe('buildWorld', () => {
  it('creates two closed wall loops, cars and pickups', () => {
    const { sim, world } = createSimWithWorld(inertSetup());
    let polylines = 0;
    world.physics.forEachCollider((c) => {
      if (c.shape.type === world.rapier.ShapeType.Polyline) {
        polylines++;
        expect(c.indices()?.length).toBe(world.track.samples.length * 2);
      }
    });
    expect(polylines).toBe(2);
    expect(world.cars).toHaveLength(4);
    expect(world.pickups).toHaveLength(world.setup.track.pickups.length);
    expect(world.colliderToCar.size).toBe(4);
    for (const car of world.cars) {
      expect(car.progress).toBeLessThan(0);
      expect(car.progress).toBeGreaterThan(-30);
      expect(car.lap).toBe(0);
      expect(car.nextCheckpoint).toBe(0);
      expect(car.crossedStart).toBe(false);
      expect(car.eff).toEqual(car.base);
      expect(car.eff).not.toBe(car.base);
      expect(car.input).toEqual(NEUTRAL_INPUT);
      expect(car.collider.mass()).toBeCloseTo(car.base.mass, 3);
    }
    expect(world.cars.map((c) => c.position)).toEqual([1, 2, 3, 4]);
    sim.dispose();
  });

  it('4 cars spawn without overlapping', () => {
    const { sim, world } = createSimWithWorld(inertSetup());
    world.physics.step(world.events);
    let contacts = 0;
    for (const a of world.cars) {
      for (const b of world.cars) {
        if (a.id < b.id) world.physics.contactPair(a.collider, b.collider, (m) => (contacts += m.numContacts()));
      }
    }
    expect(contacts).toBe(0);
    for (const a of world.cars) {
      for (const b of world.cars) {
        if (a.id >= b.id) continue;
        const p = a.body.translation();
        const q = b.body.translation();
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(a.entrant.mesh.width);
      }
    }
    sim.dispose();
  });

  it('a car pushed at 60 m/s into a wall for 2 s stays inside the walls (CCD)', () => {
    for (const side of [-1, 1]) {
      const { sim, world } = createSimWithWorld(inertSetup());
      world.phase = 'racing';
      const car = world.cars[0];
      const smp = world.track.sampleAt(60);
      const h = Math.atan2(side * smp.right.y, side * smp.right.x);
      car.body.setTranslation({ x: smp.pos.x, y: smp.pos.y }, true);
      car.body.setRotation(h, true);
      const limit = world.setup.track.width / 2 + world.setup.track.shoulder;
      const empty = new Map();
      for (let i = 0; i < 120; i++) {
        car.body.setLinvel({ x: Math.cos(h) * 60, y: Math.sin(h) * 60 }, true);
        sim.step(empty);
        const pr = world.track.project(car.body.translation(), 60);
        expect(Math.abs(pr.lateral)).toBeLessThan(limit);
      }
      sim.dispose();
    }
  });
});
