import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CARS } from '../content/cars';
import type { CarMeshSpec } from '../shared/contracts';
import { buildCarParts, steerVisual } from './carMesh';
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
    it(`${spec.style} ${spec.length} m: < 400 triangles, <= 9 draw calls`, () => {
      const { tris, meshes } = count(buildCarParts(spec, '#FF5A1F').group);
      expect(tris).toBeLessThan(400);
      expect(meshes).toBeLessThanOrEqual(9);
    });
  }

  it('front wheels steer toward the turn and clamp at 0.45 rad', () => {
    expect(steerVisual(1, 4, 10)).toBeCloseTo(0.4);
    expect(steerVisual(5, 4, 10)).toBe(0.45);
    expect(steerVisual(-5, 4, 0)).toBe(-0.45);
  });
});
