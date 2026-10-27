/** Standard Gamepad mapping: Select / Back / View (w3c.github.io/gamepad/#remapping). */
const PAD_SELECT = 8;

export interface RestartKeys {
  /** Reads the gamepad's Select edge; call once per frame. */
  poll(): void;
  dispose(): void;
}

/**
 * WP40: the time trial restart key, R on the keyboard (by code, so AZERTY gets the same key) or Select on the first
 * standard gamepad. Read here rather than in the input module: it is a shell command, not a driving input.
 */
export function createRestartKeys(win: Window, onPress: () => void): RestartKeys {
  let held = false;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'KeyR' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) onPress();
  };
  win.addEventListener('keydown', onKeyDown);
  return {
    poll() {
      const pads = typeof win.navigator.getGamepads === 'function' ? win.navigator.getGamepads() : [];
      const pad = Array.from(pads).find((p) => p?.connected && p.mapping === 'standard');
      const down = pad?.buttons[PAD_SELECT]?.pressed ?? false;
      if (down && !held) onPress();
      held = down;
    },
    dispose() {
      win.removeEventListener('keydown', onKeyDown);
    },
  };
}
