import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../shared/contracts';
import { decayTrauma, FollowCamera, smoothDamp, valueNoise } from './camera';

const input = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, speed: 0, maxSpeed: 34, phase: 'racing' as const, countdown: 0, countdownTotal: 3, wrecked: false, turbo: false, shake: true };

describe('render: camera', () => {
  it('spring (smooth time 0.18 s) converges within 1 s', () => {
    const vel = { v: 0 };
    let x = 0;
    for (let i = 0; i < 60; i++) x = smoothDamp(x, 10, vel, 0.18, SIM_DT);
    expect(Math.abs(10 - x)).toBeLessThan(0.01);
    expect(Math.abs(vel.v)).toBeLessThan(0.1);
  });

  it('follow target settles on the car + lookahead within 1 s after a jump', () => {
    const cam = new FollowCamera();
    cam.update(SIM_DT, input);
    const moved = { ...input, pos: { x: 30, y: -20 }, vel: { x: 10, y: 0 } };
    for (let i = 0; i < 60; i++) cam.update(SIM_DT, moved);
    expect(cam.target.x).toBeCloseTo(33.5, 1); // 30 + 10 m/s * 0.35 s
    expect(cam.target.y).toBeCloseTo(-20, 1);
  });

  it('lookahead is clamped to 14 m', () => {
    const cam = new FollowCamera();
    const fast = { ...input, vel: { x: 100, y: 0 } };
    for (let i = 0; i < 120; i++) cam.update(SIM_DT, fast);
    expect(cam.target.x).toBeCloseTo(14, 1);
  });

  it('trauma decays to 0 at 1.6/s and no shake remains', () => {
    let t = 1;
    for (let i = 0; i < 38; i++) t = decayTrauma(t, SIM_DT);
    expect(t).toBe(0);
    const cam = new FollowCamera();
    cam.addTrauma(0.6);
    for (let i = 0; i < 60; i++) cam.update(SIM_DT, input);
    expect(cam.trauma).toBe(0);
    expect(cam.camera.position.x).toBeCloseTo(cam.target.x, 6);
  });

  it('countdown intro starts at 90 m and eases to the rest height', () => {
    const cam = new FollowCamera();
    cam.update(SIM_DT, { ...input, phase: 'countdown', countdown: 3 });
    expect(cam.height).toBeCloseTo(90, 3);
    cam.update(SIM_DT, { ...input, phase: 'countdown', countdown: 0 });
    expect(cam.height).toBeCloseTo(46, 3);
  });

  it('height is 46 m at rest and settles at 62 m at maxSpeed (0.4 s time constant)', () => {
    const cam = new FollowCamera();
    cam.update(SIM_DT, input);
    expect(cam.height).toBeCloseTo(46, 3);
    expect(cam.camera.position.y).toBeCloseTo(46, 3);
    for (let i = 0; i < 4 * 60; i++) cam.update(SIM_DT, { ...input, speed: input.maxSpeed });
    expect(cam.height).toBeCloseTo(62, 2);
  });

  it('camera sits south of the target, tilted ~18 deg', () => {
    const cam = new FollowCamera();
    cam.update(SIM_DT, input);
    const p = cam.camera.position;
    expect(p.z - cam.target.y).toBeCloseTo(p.y * 0.32, 6);
    expect((Math.atan2(p.z - cam.target.y, p.y) * 180) / Math.PI).toBeCloseTo(17.7, 0);
  });

  it('value noise stays in [-1, 1] and is continuous', () => {
    let prev = valueNoise(0, 1);
    for (let t = 0.01; t < 20; t += 0.01) {
      const v = valueNoise(t, 1);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.1);
      prev = v;
    }
  });
});
