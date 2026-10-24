import type { UiNav } from '../shared/contracts';
import type { PadDrive } from './merge';

export const STICK_DEADZONE = 0.15;
export const STICK_EXPONENT = 1.5;
export const TRIGGER_DEADZONE = 0.05;
export const NAV_STICK_THRESHOLD = 0.5;

// Standard Gamepad mapping indices (w3c.github.io/gamepad/#remapping), bindings from WP04's table.
const BTN = { a: 0, b: 1, x: 2, y: 3, rb: 5, lt: 6, rt: 7, start: 9, up: 12, down: 13, left: 14, right: 15 } as const;

/** Left stick X with a radial deadzone and the WP05 response curve. */
export function stickSteer(x: number, y: number): number {
  if (Math.hypot(x, y) < STICK_DEADZONE) return 0;
  const ax = Math.abs(x);
  if (ax <= STICK_DEADZONE) return 0;
  return Math.sign(x) * Math.min(1, ((ax - STICK_DEADZONE) / (1 - STICK_DEADZONE)) ** STICK_EXPONENT);
}

/** Trigger value with a small deadzone, rescaled so a full pull is still 1. */
export function triggerValue(v: number): number {
  return v < TRIGGER_DEADZONE ? 0 : Math.min(1, (v - TRIGGER_DEADZONE) / (1 - TRIGGER_DEADZONE));
}

export interface PadState {
  id: string;
  drive: PadDrive;
  dir: UiNav | null; // held menu direction (d-pad or stick past 0.5)
  confirm: boolean; // A held
  back: boolean; // B held
  pause: boolean; // Start held
  active: boolean; // any input above deadzone this poll
}

export function createPadState(): PadState {
  return {
    id: '',
    drive: { throttle: 0, brake: 0, steer: 0, handbrake: false, fire: false, dropMine: false, turbo: false },
    dir: null,
    confirm: false,
    back: false,
    pause: false,
    active: false,
  };
}

/** Reads the first `standard` pad into `out`; returns null when none is connected. */
export function readGamepad(nav: Navigator, out: PadState): PadState | null {
  const pads = typeof nav.getGamepads === 'function' ? nav.getGamepads() : [];
  let pad: Gamepad | null = null;
  for (const p of pads) {
    if (p && p.connected && p.mapping === 'standard') {
      pad = p;
      break;
    }
  }
  if (!pad) return null;
  const pressed = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
  const value = (i: number): number => pad.buttons[i]?.value ?? 0;
  const sx = pad.axes[0] ?? 0;
  const sy = pad.axes[1] ?? 0;

  const d = out.drive;
  const dpad = (pressed(BTN.right) ? 1 : 0) - (pressed(BTN.left) ? 1 : 0);
  d.steer = dpad !== 0 ? dpad : stickSteer(sx, sy);
  d.throttle = triggerValue(value(BTN.rt));
  d.brake = triggerValue(value(BTN.lt));
  d.fire = pressed(BTN.a);
  d.handbrake = pressed(BTN.b);
  d.dropMine = pressed(BTN.x);
  d.turbo = pressed(BTN.y) || pressed(BTN.rb);

  out.id = pad.id;
  out.confirm = pressed(BTN.a);
  out.back = pressed(BTN.b);
  out.pause = pressed(BTN.start);
  out.dir = pressed(BTN.up)
    ? 'up'
    : pressed(BTN.down)
      ? 'down'
      : pressed(BTN.left)
        ? 'left'
        : pressed(BTN.right)
          ? 'right'
          : Math.max(Math.abs(sx), Math.abs(sy)) < NAV_STICK_THRESHOLD
            ? null
            : Math.abs(sx) > Math.abs(sy)
              ? sx > 0
                ? 'right'
                : 'left'
              : sy > 0
                ? 'down'
                : 'up';
  out.active = d.steer !== 0 || d.throttle > 0 || d.brake > 0 || pad.buttons.some((b) => b.pressed);
  return out;
}
