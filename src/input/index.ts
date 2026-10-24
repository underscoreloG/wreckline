import type { InputFrame, InputSource, UiNav } from '../shared/contracts';
import { NEUTRAL_INPUT, SIM_DT } from '../shared/contracts';
import { createPadState, readGamepad, type PadState } from './gamepad';
import { createKeyboard } from './keyboard';
import { mergeFrame, stepSteer, type KeyDrive } from './merge';
import { createNavRepeater } from './nav';

const KEY_NAV: Readonly<Record<string, UiNav>> = { Enter: 'confirm', Space: 'confirm', Escape: 'pause' };

export interface InputDebug {
  gamepadId(): string | null;
}

/** Keyboard + first standard gamepad. A rAF loop polls the pad for menu nav and drives key repeat. */
export function createInputSource(target: Window): InputSource & InputDebug {
  const listeners = new Set<(nav: UiNav) => void>();
  const emit = (nav: UiNav): void => {
    for (const cb of listeners) cb(nav);
  };
  const kbRepeat = createNavRepeater();
  const padRepeat = createNavRepeater();
  const kbDrive: KeyDrive = { throttle: false, brake: false, steer: 0, handbrake: false, fire: false, dropMine: false, turbo: false };
  const pad: PadState = createPadState();
  const frame: InputFrame = { ...NEUTRAL_INPUT };
  let kbSteer = 0;
  let prevPadSteer = 0;
  let steerFromPad = false;
  let gamepad = false;
  let padConnected = false;
  let prevButtons = { confirm: false, back: false, pause: false };

  const keyboard = createKeyboard(target, (code) => {
    gamepad = false;
    if (code === 'ArrowLeft' || code === 'ArrowRight') steerFromPad = false;
    const nav = KEY_NAV[code];
    if (nav) emit(nav);
    // Arrows emit at once (no wait for the next frame), then repeat from the loop.
    const dir = kbRepeat.update(keyboard.heldDir(), target.performance.now());
    if (dir) emit(dir);
  }, () => {
    // Track the change without emitting, so pressing the same arrow again emits even when no frame ran in between.
    kbRepeat.update(keyboard.heldDir(), target.performance.now());
  });

  const readPad = (): PadState | null => {
    const p = readGamepad(target.navigator, pad);
    padConnected = p !== null;
    if (p?.active) gamepad = true;
    return p;
  };

  let raf = 0;
  const loop = (): void => {
    raf = target.requestAnimationFrame(loop);
    const now = target.performance.now();
    const kd = kbRepeat.update(keyboard.heldDir(), now);
    if (kd) emit(kd);
    const p = readPad();
    const pd = padRepeat.update(p ? p.dir : null, now);
    if (pd) emit(pd);
    const b = p ? { confirm: p.confirm, back: p.back, pause: p.pause } : { confirm: false, back: false, pause: false };
    if (b.confirm && !prevButtons.confirm) emit('confirm');
    if (b.back && !prevButtons.back) emit('back');
    if (b.pause && !prevButtons.pause) emit('pause');
    prevButtons = b;
  };
  raf = target.requestAnimationFrame(loop);

  return {
    poll(): InputFrame {
      keyboard.drive(kbDrive);
      kbSteer = stepSteer(kbSteer, kbDrive.steer, SIM_DT);
      const p = readPad();
      if (p && p.drive.steer !== prevPadSteer) {
        if (p.drive.steer !== 0) steerFromPad = true;
        prevPadSteer = p.drive.steer;
      }
      return mergeFrame(frame, kbDrive, kbSteer, p ? p.drive : null, steerFromPad);
    },
    onNav(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    usingGamepad: () => gamepad,
    gamepadId: () => (padConnected ? pad.id : null),
    dispose() {
      target.cancelAnimationFrame(raf);
      keyboard.dispose();
      listeners.clear();
    },
  };
}
