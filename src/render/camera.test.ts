import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../shared/contracts';
import { decayTrauma, EDGE_BLUR_KEY, FollowCamera, smoothDamp, valueNoise } from './camera';

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

  describe('boost kick (WP26)', () => {
    const fast = { ...input, speed: 34, vel: { x: 34, y: 0 } };
    /** Runs `seconds` of frames, returning the FOV per frame. */
    const run = (cam: FollowCamera, seconds: number, inp: typeof input): number[] => {
      const out: number[] = [];
      for (let i = 0; i < Math.round(seconds * 60); i++) {
        cam.update(SIM_DT, inp);
        out.push(cam.camera.fov);
      }
      return out;
    };

    it('zooms out to a peak within 0.2 s of turboStart, holds while boosting, returns to rest after turbo end', () => {
      const cam = new FollowCamera();
      run(cam, 1, fast);
      expect(cam.camera.fov).toBeCloseTo(34, 3);
      const boost = run(cam, 2, { ...fast, turbo: true });
      const peakAt = boost.indexOf(Math.max(...boost));
      expect((peakAt + 1) * SIM_DT).toBeLessThanOrEqual(0.2);
      expect(Math.max(...boost)).toBeGreaterThan(boost[boost.length - 1] + 2); // a pulse, then a lower hold
      expect(boost[boost.length - 1] - 34).toBeCloseTo(4, 1); // held offset while turbo lasts
      run(cam, 2, fast);
      expect(cam.camera.fov).toBeCloseTo(34, 2);
    });

    it('the peak still shows with long frames (dt 0.1 s)', () => {
      const cam = new FollowCamera();
      cam.update(0.1, fast);
      const fovs: number[] = [];
      for (let i = 0; i < 4; i++) {
        cam.update(0.1, { ...fast, turbo: true });
        fovs.push(cam.camera.fov);
      }
      expect(Math.max(...fovs.slice(0, 2))).toBeCloseTo(41, 3);
    });

    it('turboStart shakes the camera only when the shake setting is on; the zoom ignores the setting', () => {
      for (const shake of [true, false]) {
        const cam = new FollowCamera();
        run(cam, 1, { ...fast, shake });
        let maxOff = 0;
        for (let i = 0; i < 20; i++) {
          cam.update(SIM_DT, { ...fast, shake, turbo: true });
          maxOff = Math.max(maxOff, Math.abs(cam.camera.position.x - cam.target.x));
        }
        if (shake) expect(maxOff).toBeGreaterThan(0.01);
        else expect(maxOff).toBe(0);
        expect(cam.camera.fov).toBeGreaterThan(38);
      }
    });

    it('edge blur fades in over ~0.2 s while boosting, follows speed, fades out after turbo end', () => {
      const cam = new FollowCamera();
      const blur = (): number => cam.camera.userData[EDGE_BLUR_KEY] as number;
      run(cam, 0.5, fast);
      expect(blur()).toBe(0);
      run(cam, 0.1, { ...fast, turbo: true });
      expect(blur()).toBeGreaterThan(0.4);
      expect(blur()).toBeLessThan(0.6);
      run(cam, 0.15, { ...fast, turbo: true });
      expect(blur()).toBeCloseTo(1, 6);
      run(cam, 0.5, { ...fast, turbo: true, speed: 17 });
      expect(blur()).toBeCloseTo(0.5, 6);
      run(cam, 0.25, fast);
      expect(blur()).toBe(0);
    });
  });
});
