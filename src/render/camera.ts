import * as THREE from 'three';
import type { Vec2 } from '../shared/contracts';
import { clamp } from '../shared/math';

// design.md section 2.
const FOV = 34;
const TURBO_FOV = 3;
const NEAR = 1;
const FAR = 600;
const HEIGHT_REST = 46; // tuning pass 1, was 52-64
const HEIGHT_FAST = 62;
const HEIGHT_TAU = 0.4; // s
const HEIGHT_INTRO = 90;
const HEIGHT_WRECK = 70;
const BACK_FACTOR = 0.32; // z offset = height * 0.32, ~18 deg tilt
const LOOKAHEAD = 0.35; // s of velocity
const LOOKAHEAD_MAX = 14; // m
const TARGET_SMOOTH = 0.18; // s
const TRAUMA_DECAY = 1.6; // per s
const SHAKE_MAX = 1.2; // m at trauma 1
const SHAKE_FREQ = 14; // noise lattice points per s
const FOV_TAU = 0.25; // s

/** Critically damped spring toward `target` (Unity SmoothDamp). `vel` is the spring state, updated in place. */
export function smoothDamp(current: number, target: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

/** Exponential approach with time constant tau. */
export const approach = (current: number, target: number, tau: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

export const decayTrauma = (trauma: number, dt: number): number => Math.max(0, trauma - TRAUMA_DECAY * dt);

/** 1D value noise in [-1, 1], smooth between integer lattice points; `seed` picks an independent channel. */
export function valueNoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const h = (n: number): number => {
    let x = Math.imul(n ^ Math.imul(seed, 0x27d4eb2d), 0x85ebca6b);
    x ^= x >>> 13;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 16;
    return ((x >>> 0) / 4294967295) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) + (h(i + 1) - h(i)) * u;
}

const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export interface CameraInput {
  pos: Vec2; // followed car, sim plane
  vel: Vec2;
  speed: number;
  maxSpeed: number;
  phase: 'countdown' | 'racing' | 'finished';
  countdown: number; // s left
  countdownTotal: number;
  wrecked: boolean;
  turbo: boolean;
  shake: boolean;
}

/** Follow camera: fixed north-up orientation, spring target with lookahead, speed-based height, trauma shake. */
export class FollowCamera {
  readonly camera = new THREE.PerspectiveCamera(FOV, 16 / 9, NEAR, FAR);
  readonly target = { x: 0, y: 0 };
  height = HEIGHT_INTRO;
  trauma = 0;
  private readonly vx = { v: 0 };
  private readonly vy = { v: 0 };
  private fovBoost = 0;
  private time = 0;
  private started = false;

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Jump to the goal (first frame, car switch) instead of springing across the map. */
  reset(): void {
    this.started = false;
  }

  update(dt: number, inp: CameraInput): void {
    this.time += dt;
    let gx = inp.pos.x;
    let gy = inp.pos.y;
    if (!inp.wrecked) {
      let lx = inp.vel.x * LOOKAHEAD;
      let ly = inp.vel.y * LOOKAHEAD;
      const l = Math.hypot(lx, ly);
      if (l > LOOKAHEAD_MAX) {
        lx *= LOOKAHEAD_MAX / l;
        ly *= LOOKAHEAD_MAX / l;
      }
      gx += lx;
      gy += ly;
    }
    const rest = HEIGHT_REST + (HEIGHT_FAST - HEIGHT_REST) * clamp(Math.abs(inp.speed) / Math.max(inp.maxSpeed, 1), 0, 1);
    if (!this.started) {
      this.started = true;
      this.target.x = gx;
      this.target.y = gy;
      this.vx.v = this.vy.v = 0;
      this.height = inp.phase === 'countdown' ? HEIGHT_INTRO : rest;
    }
    this.target.x = smoothDamp(this.target.x, gx, this.vx, TARGET_SMOOTH, dt);
    this.target.y = smoothDamp(this.target.y, gy, this.vy, TARGET_SMOOTH, dt);
    if (inp.phase === 'countdown') {
      const k = inp.countdownTotal > 0 ? inp.countdown / inp.countdownTotal : 0;
      this.height = HEIGHT_REST + (HEIGHT_INTRO - HEIGHT_REST) * smoothstep(k);
    } else {
      this.height = approach(this.height, inp.wrecked ? HEIGHT_WRECK : rest, HEIGHT_TAU, dt);
    }

    this.trauma = decayTrauma(this.trauma, dt);
    const amp = inp.shake ? this.trauma * this.trauma * SHAKE_MAX : 0;
    const ox = amp * valueNoise(this.time * SHAKE_FREQ, 1);
    const oz = amp * valueNoise(this.time * SHAKE_FREQ, 2);

    this.fovBoost = approach(this.fovBoost, inp.turbo ? TURBO_FOV : 0, FOV_TAU, dt);
    const cam = this.camera;
    if (Math.abs(cam.fov - (FOV + this.fovBoost)) > 1e-3) {
      cam.fov = FOV + this.fovBoost;
      cam.updateProjectionMatrix();
    }
    const tx = this.target.x + ox;
    const tz = this.target.y + oz;
    cam.position.set(tx, this.height, tz + this.height * BACK_FACTOR);
    cam.lookAt(tx, 0, tz);
  }
}
