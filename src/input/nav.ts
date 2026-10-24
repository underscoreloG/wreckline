import type { UiNav } from '../shared/contracts';

// Held directions repeat in menus (WP05): first repeat after 180 ms, then every 90 ms.
export const NAV_REPEAT_DELAY = 180;
export const NAV_REPEAT_RATE = 90;

export interface NavRepeater {
  /** Feed the currently held direction (or null) at time `nowMs`; returns a nav to emit, or null. */
  update(dir: UiNav | null, nowMs: number): UiNav | null;
}

export function createNavRepeater(): NavRepeater {
  let held: UiNav | null = null;
  let nextAt = 0;
  return {
    update(dir, nowMs) {
      if (dir !== held) {
        held = dir;
        nextAt = nowMs + NAV_REPEAT_DELAY;
        return dir;
      }
      if (dir === null || nowMs < nextAt) return null;
      nextAt += NAV_REPEAT_RATE;
      // A long stall (hidden tab) must not burst out every missed repeat at once.
      if (nextAt <= nowMs) nextAt = nowMs + NAV_REPEAT_RATE;
      return dir;
    },
  };
}
