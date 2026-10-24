import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CarState } from '../shared/contracts';
import { lerpAngle } from '../shared/math';
import { interpolatePose } from './interp';

const car = (x: number, y: number, heading: number): CarState => ({ pos: { x, y }, heading }) as CarState;
const pose = () => ({ x: 0, z: 0, heading: 0, rotY: 0 });
const nose = (rotY: number): THREE.Vector3 => new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, rotY, 0));

describe('render: sim -> world mapping and interpolation', () => {
  it('heading PI/2 (sim +y, screen down) points the mesh nose to world +z', () => {
    const p = interpolatePose(car(5, 7, Math.PI / 2), car(5, 7, Math.PI / 2), 0, pose());
    expect(p.x).toBe(5);
    expect(p.z).toBe(7);
    const n = nose(p.rotY);
    expect(n.x).toBeCloseTo(0, 6);
    expect(n.z).toBeCloseTo(1, 6);
  });

  it('heading 0 faces +x, and a right turn (heading up) swings the nose toward +z', () => {
    expect(nose(interpolatePose(car(0, 0, 0), car(0, 0, 0), 0, pose()).rotY).x).toBeCloseTo(1, 6);
    expect(nose(interpolatePose(car(0, 0, 0.3), car(0, 0, 0.3), 0, pose()).rotY).z).toBeGreaterThan(0);
  });

  it('position lerps with alpha, sim y -> world z', () => {
    const p = interpolatePose(car(0, 10, 0), car(10, 20, 0), 0.25, pose());
    expect(p.x).toBeCloseTo(2.5);
    expect(p.z).toBeCloseTo(12.5);
  });

  it('heading interpolates across the +-PI wrap on the short arc', () => {
    const a = Math.PI - 0.1;
    const b = -Math.PI + 0.1;
    const mid = interpolatePose(car(0, 0, a), car(0, 0, b), 0.5, pose()).heading;
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(1e-9);
    expect(Math.abs(lerpAngle(a, b, 0.25) - (Math.PI - 0.05))).toBeLessThan(1e-9);
  });
});
