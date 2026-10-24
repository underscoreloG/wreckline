import type { InputFrame, InputSource, UiNav } from '../shared/contracts';
import { NEUTRAL_INPUT } from '../shared/contracts';

// Bindings from WP04/WP05 (KeyboardEvent.code, so AZERTY gets the same physical keys).
const NAV: Readonly<Record<string, UiNav>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  Space: 'confirm',
  Escape: 'pause',
};
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

/**
 * STUB (WP00), WP05 replaces the body and keeps the signature.
 * Keyboard only, digital steering, no gamepad, no nav key repeat.
 */
export function createInputSource(target: Window): InputSource {
  const down = new Set<string>();
  const listeners = new Set<(nav: UiNav) => void>();
  const frame: InputFrame = { ...NEUTRAL_INPUT };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(e.code) && !isTextField(e.target)) e.preventDefault();
    down.add(e.code);
    const nav = NAV[e.code];
    if (nav && !e.repeat) for (const cb of listeners) cb(nav);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    down.delete(e.code);
  };
  const clear = (): void => down.clear();

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);
  target.document.addEventListener('visibilitychange', clear);

  return {
    poll(): InputFrame {
      frame.throttle = down.has('ArrowUp') ? 1 : 0;
      frame.brake = down.has('ArrowDown') ? 1 : 0;
      frame.steer = (down.has('ArrowRight') ? 1 : 0) - (down.has('ArrowLeft') ? 1 : 0);
      frame.handbrake = down.has('Space');
      frame.fire = down.has('KeyS');
      frame.dropMine = down.has('KeyD');
      frame.turbo = down.has('KeyA');
      return frame;
    },
    onNav(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    usingGamepad: () => false,
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', clear);
      target.document.removeEventListener('visibilitychange', clear);
      listeners.clear();
      down.clear();
    },
  };
}
