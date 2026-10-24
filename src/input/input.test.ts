import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, SIM_DT, type InputFrame } from '../shared/contracts';
import { stickSteer, triggerValue } from './gamepad';
import { mergeFrame, stepSteer, type KeyDrive, type PadDrive } from './merge';
import { createNavRepeater, NAV_REPEAT_DELAY, NAV_REPEAT_RATE } from './nav';

const kb = (p: Partial<KeyDrive> = {}): KeyDrive => ({
  throttle: false,
  brake: false,
  steer: 0,
  handbrake: false,
  fire: false,
  dropMine: false,
  turbo: false,
  ...p,
});
const pad = (p: Partial<PadDrive> = {}): PadDrive => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  fire: false,
  dropMine: false,
  turbo: false,
  ...p,
});
const out = (): InputFrame => ({ ...NEUTRAL_INPUT });

describe('mergeFrame', () => {
  it('keyboard only maps digital values', () => {
    const f = mergeFrame(out(), kb({ throttle: true, fire: true }), 0.5, null, false);
    expect(f).toEqual({ ...NEUTRAL_INPUT, throttle: 1, fire: true, steer: 0.5 });
  });
  it('larger magnitude wins per field', () => {
    const f = mergeFrame(out(), kb({ brake: true }), 0, pad({ throttle: 0.4, brake: 0.3 }), false);
    expect(f.throttle).toBe(0.4);
    expect(f.brake).toBe(1);
  });
  it('booleans OR', () => {
    const f = mergeFrame(out(), kb({ handbrake: true }), 0, pad({ turbo: true, dropMine: true }), false);
    expect([f.handbrake, f.turbo, f.dropMine, f.fire]).toEqual([true, true, true, false]);
  });
  it('steer: the non-zero source wins, the last mover wins when both are non-zero', () => {
    expect(mergeFrame(out(), kb(), 0, pad({ steer: -0.3 }), false).steer).toBe(-0.3);
    expect(mergeFrame(out(), kb(), 0.7, pad(), true).steer).toBe(0.7);
    expect(mergeFrame(out(), kb(), 0.7, pad({ steer: -0.3 }), true).steer).toBe(-0.3);
    expect(mergeFrame(out(), kb(), 0.7, pad({ steer: -0.3 }), false).steer).toBe(0.7);
  });
});

describe('gamepad curves', () => {
  it('radial stick deadzone 0.15', () => {
    expect(stickSteer(0.14, 0)).toBe(0);
    expect(stickSteer(0.1, 0.1)).toBe(0); // inside the radius
    expect(stickSteer(0.15, 0.5)).toBe(0); // outside the radius but no x past the deadzone
    expect(stickSteer(1, 0)).toBe(1);
    expect(stickSteer(-1, 0)).toBe(-1);
  });
  it('response curve sign(x) * ((|x| - 0.15) / 0.85)^1.5', () => {
    for (const x of [0.2, 0.4, 0.575, 0.8, 0.95]) {
      expect(stickSteer(x, 0)).toBeCloseTo(((x - 0.15) / 0.85) ** 1.5, 10);
      expect(stickSteer(-x, 0)).toBeCloseTo(-(((x - 0.15) / 0.85) ** 1.5), 10);
    }
    expect(stickSteer(0.575, 0)).toBeCloseTo(0.5 ** 1.5, 10);
  });
  it('trigger deadzone 0.05, full pull is 1', () => {
    expect(triggerValue(0.04)).toBe(0);
    expect(triggerValue(0.05)).toBe(0);
    expect(triggerValue(1)).toBe(1);
    expect(triggerValue(0.525)).toBeCloseTo(0.5, 10);
  });
});

describe('keyboard steer ramp', () => {
  const ticksTo = (from: number, target: number, goal: number): number => {
    let v = from;
    let n = 0;
    while (v !== goal && n < 1000) {
      v = stepSteer(v, target, SIM_DT);
      n++;
    }
    return n;
  };
  it('0 -> 1 in 0.125 s = 8 ticks at 60 Hz (+-1)', () => {
    const n = ticksTo(0, 1, 1);
    expect(n).toBeGreaterThanOrEqual(7);
    expect(n).toBeLessThanOrEqual(9);
  });
  it('returns to 0 at 12 per second (5 ticks from full lock)', () => {
    expect(ticksTo(1, 0, 0)).toBe(5);
    expect(ticksTo(-1, 0, 0)).toBe(5);
  });
  it('reversing passes through the centre at the return rate', () => {
    let v = 1;
    v = stepSteer(v, -1, SIM_DT);
    expect(v).toBeCloseTo(1 - 12 * SIM_DT, 10);
    expect(ticksTo(1, -1, -1)).toBe(5 + 8);
  });
});

describe('nav repeat', () => {
  it('emits on press, after 180 ms, then every 90 ms', () => {
    const r = createNavRepeater();
    const emits: number[] = [];
    for (let t = 0; t <= 600; t += 1) if (r.update('down', t)) emits.push(t);
    expect(emits).toEqual([0, NAV_REPEAT_DELAY, 270, 360, 450, 540]);
    expect(NAV_REPEAT_RATE).toBe(90);
  });
  it('release and a new direction restart the delay', () => {
    const r = createNavRepeater();
    expect(r.update('up', 0)).toBe('up');
    expect(r.update('up', 100)).toBeNull();
    expect(r.update(null, 120)).toBeNull();
    expect(r.update('up', 130)).toBe('up');
    expect(r.update('up', 300)).toBeNull();
    expect(r.update('left', 305)).toBe('left');
    expect(r.update('left', 484)).toBeNull();
    expect(r.update('left', 485)).toBe('left');
  });
  it('a long stall emits once, not a burst', () => {
    const r = createNavRepeater();
    r.update('right', 0);
    expect(r.update('right', 5000)).toBe('right');
    expect(r.update('right', 5010)).toBeNull();
    expect(r.update('right', 5090)).toBe('right');
  });
});
