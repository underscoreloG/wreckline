import type { GameCommand, GameStore, UiState } from '../shared/contracts';

export type MutableGameStore = GameStore & { set(patch: Partial<UiState>): void };

/** UI store: immutable state, commands go to `handler` (the game), listeners fire once per `set`. */
export function createGameStore(initial: UiState, handler: (cmd: GameCommand) => void): MutableGameStore {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch: (cmd) => handler(cmd),
    set(patch) {
      state = { ...state, ...patch };
      for (const l of [...listeners]) l();
    },
  };
}
