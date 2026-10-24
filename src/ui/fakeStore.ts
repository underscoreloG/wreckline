import type { GameCommand, GameStore, Screen, UiState } from '../shared/contracts';

export interface FakeStore extends GameStore {
  /** Harness only: swap the whole state (screen switcher, HUD fixture, gamepad glyphs). */
  replace(next: UiState): void;
  /** Every command dispatched so far, oldest first. */
  readonly log: GameCommand[];
}

/** GameStore for the UI harness: logs commands and applies the obvious screen moves so the harness is clickable. */
export function createFakeStore(initial: UiState): FakeStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const log: GameCommand[] = [];

  const go = (screen: Screen, previousScreen: Screen | null = null): void => {
    state = { ...state, screen, previousScreen };
  };

  return {
    log,
    getState: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    replace(next) {
      state = next;
      listeners.forEach((l) => l());
    },
    dispatch(cmd) {
      log.push(cmd);
      console.info('[fakeStore]', JSON.stringify(cmd));
      switch (cmd.type) {
        case 'navigate':
          go(cmd.screen, state.screen);
          break;
        case 'back':
          go(state.previousScreen ?? 'title');
          break;
        case 'pause':
          go('paused');
          break;
        case 'resume':
        case 'startRace':
        case 'restartRace':
          go('race');
          break;
        case 'startQuickRace':
          go('preRace');
          break;
        case 'quitRace':
        case 'continueFromResults':
          go('title');
          break;
        case 'setSetting':
          state = { ...state, settings: { ...state.settings, ...cmd.patch } };
          break;
        default:
          return;
      }
      listeners.forEach((l) => l());
    },
  };
}
