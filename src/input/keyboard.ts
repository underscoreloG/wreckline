import type { UiNav } from '../shared/contracts';
import type { KeyDrive } from './merge';

// Bindings from WP04/WP05, by KeyboardEvent.code so AZERTY gets the same physical keys.
const ARROWS: Readonly<Record<string, UiNav>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

const isTextField = (t: EventTarget | null): boolean =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export interface Keyboard {
  drive(out: KeyDrive): KeyDrive;
  /** The most recently pressed arrow that is still held. */
  heldDir(): UiNav | null;
  dispose(): void;
}

/** `onPress` fires on every non-repeat keydown, `onRelease` on keyup and on blur/hide, both after the key state is updated. */
export function createKeyboard(target: Window, onPress: (code: string) => void, onRelease: () => void): Keyboard {
  const down = new Set<string>();
  const arrowOrder: string[] = [];

  const onKeyDown = (e: KeyboardEvent): void => {
    if (SCROLL_KEYS.has(e.code) && !isTextField(e.target)) e.preventDefault();
    if (e.repeat) return;
    down.add(e.code);
    if (ARROWS[e.code]) {
      const i = arrowOrder.indexOf(e.code);
      if (i >= 0) arrowOrder.splice(i, 1);
      arrowOrder.push(e.code);
    }
    onPress(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    down.delete(e.code);
    const i = arrowOrder.indexOf(e.code);
    if (i >= 0) arrowOrder.splice(i, 1);
    onRelease();
  };
  const reset = (): void => {
    down.clear();
    arrowOrder.length = 0;
  };
  const clear = (): void => {
    reset();
    onRelease();
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', clear);
  target.document.addEventListener('visibilitychange', clear);

  return {
    drive(out) {
      out.throttle = down.has('ArrowUp');
      out.brake = down.has('ArrowDown');
      out.steer = ((down.has('ArrowRight') ? 1 : 0) - (down.has('ArrowLeft') ? 1 : 0)) as -1 | 0 | 1;
      out.handbrake = down.has('Space');
      out.fire = down.has('KeyS');
      out.dropMine = down.has('KeyD');
      out.turbo = down.has('KeyA');
      return out;
    },
    heldDir() {
      const code = arrowOrder[arrowOrder.length - 1];
      return code === undefined ? null : (ARROWS[code] ?? null);
    },
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', clear);
      target.document.removeEventListener('visibilitychange', clear);
      reset();
    },
  };
}
