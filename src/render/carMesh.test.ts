import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CARS } from '../content/cars';
import type { CarMeshSpec } from '../shared/contracts';
import { buildCarParts, buildSpikesGeometry, CarRig, steerVisual } from './carMesh';
import { triangles } from './geo';

const COMPACT: CarMeshSpec = { ...CARS.raven.mesh, style: 'compact', spoiler: false };

const count = (g: THREE.Object3D): { tris: number; meshes: number } => {
  let tris = 0;
  let meshes = 0;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    tris += triangles(m.geometry);
    meshes++;
  });
  return { tris, meshes };
};

describe('render: car mesh', () => {
  for (const spec of [...Object.values(CARS).map((c) => c.mesh), COMPACT]) {
    it(`${spec.style} ${spec.length} m: < 400 triangles, <= 8 draw calls, no roof plate`, () => {
      const { group } = buildCarParts(spec, '#FF5A1F');
      const { tris, meshes } = count(group);
      expect(tris).toBeLessThan(400);
      expect(meshes).toBeLessThanOrEqual(8);
      expect(group.getObjectByName('roofPlate')).toBeUndefined();
    });
  }

  for (const car of Object.values(CARS)) {
    it(`${car.id} at spikes 3: < 420 triangles, <= 8 draw calls`, () => {
      const { tris, meshes } = count(buildCarParts({ ...car.mesh, spikes: 3 }, '#FF5A1F').group);
      expect(tris).toBeLessThan(420);
      expect(meshes).toBeLessThanOrEqual(8);
    });
  }

  it('bumper spikes: 2 open 4-sided cones per level (4 triangles each), merged into the body', () => {
    const spec = CARS.raven.mesh;
    expect(buildSpikesGeometry({ ...spec, spikes: 0 })).toBeNull();
    const body = (spikes: number): number => triangles((buildCarParts({ ...spec, spikes }, '#FF5A1F').group.getObjectByName('body') as THREE.Mesh).geometry);
    for (const level of [1, 2, 3]) {
      const g = buildSpikesGeometry({ ...spec, spikes: level });
      expect(g && triangles(g)).toBe(2 * level * 4);
      expect(body(level) - body(0)).toBe(2 * level * 4);
      // In front of the nose, pointing forward.
      g!.computeBoundingBox();
      expect(g!.boundingBox!.max.x).toBeGreaterThan(spec.length / 2 + 0.2);
    }
  });

  it('procedural body keeps the livery in its vertex colors on a white material, and damage still darkens it', () => {
    const parts = buildCarParts(COMPACT, '#5C7CFF');
    expect(parts.bodyMaterial.color.equals(new THREE.Color(1, 1, 1))).toBe(true);
    const colors = (parts.group.getObjectByName('body') as THREE.Mesh).geometry.getAttribute('color');
    const livery = new THREE.Color('#5C7CFF');
    expect(colors.getX(0)).toBeCloseTo(livery.r, 5);
    expect(colors.getY(0)).toBeCloseTo(livery.g, 5);
    expect(colors.getZ(0)).toBeCloseTo(livery.b, 5);
    const rig = new CarRig(parts, COMPACT);
    rig.update({ x: 0, z: 0, rotY: 0, speed: 0, angVel: 0, braking: false, hpFrac: 0, wrecked: true });
    expect(parts.bodyMaterial.color.r).toBeCloseTo(0.2, 6);
  });

  it('bumper spikes: none added to the boss style, which carries its own', () => {
    expect(buildSpikesGeometry({ ...CARS.wraith.mesh, spikes: 3 })).toBeNull();
  });

  it('front wheels steer toward the turn and clamp at 0.45 rad', () => {
    expect(steerVisual(1, 4, 10)).toBeCloseTo(0.4);
    expect(steerVisual(5, 4, 10)).toBe(0.45);
    expect(steerVisual(-5, 4, 0)).toBe(-0.45);
  });
});
