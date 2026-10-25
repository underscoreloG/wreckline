import type { GameStore, InputFrame, RaceSetup, RaceSnapshot, Renderer, Sim } from '../shared/contracts';

/** window.__game in dev builds: scripted checks drive the game with manual steps (rAF is throttled in a hidden pane). */
export interface GameDebug {
  store: GameStore;
  session(): { sim: Sim; renderer: Renderer; setup: RaceSetup } | null;
  /** n sim steps now, rendering and publishing the HUD along the way. */
  step(n: number): void;
  snapshot(): RaceSnapshot | null;
  setInput(patch: Partial<InputFrame>): void;
  clearInput(): void;
  finishRaceNow(): void;
}

/** Installs `api` as window.__game in dev builds only; returns the uninstaller. */
export function installDebug(api: GameDebug): () => void {
  if (!import.meta.env.DEV) return () => {};
  window.__game = api;
  return () => {
    if (window.__game === api) delete window.__game;
  };
}
