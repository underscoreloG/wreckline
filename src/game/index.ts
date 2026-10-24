import { buildQuickRaceSetup } from '../content/quickRace';
import { mountDebug2d } from '../debug/debug2d';
import { createInputSource } from '../input';
import type { GameStore, UiState } from '../shared/contracts';
import { createSim, initPhysics } from '../sim';

export interface GameHandle {
  store: GameStore;
  dispose(): void;
}

/**
 * STUB (WP00), WP08 replaces the body and keeps the signatures.
 * Mounts the 2D debug view on a quick race, with a static store.
 */
export async function startGame(root: HTMLElement): Promise<GameHandle> {
  await initPhysics();
  const sim = createSim(buildQuickRaceSetup({ seed: 1 }));
  const input = createInputSource(window);
  const view = mountDebug2d(root, sim, input);
  const state: UiState = {
    screen: 'race',
    previousScreen: null,
    settings: { version: 1, masterVolume: 0.8, sfxVolume: 0.9, quality: 'high', cameraShake: true, showFps: false },
    usingGamepad: false,
    version: __APP_VERSION__,
    race: null,
    hud: null,
    results: null,
    save: null,
    offers: null,
    selectedOffer: null,
    lastPayout: null,
    toast: null,
  };
  const store: GameStore = { getState: () => state, subscribe: () => () => {}, dispatch: () => {} };
  return {
    store,
    dispose() {
      view.dispose();
      input.dispose();
      sim.dispose();
    },
  };
}
