import type { AudioEngine } from '../shared/contracts';

/** STUB (WP00), WP05 replaces the body and keeps the signature. A silent engine: every call is a no-op. */
export function createAudioEngine(): AudioEngine {
  return {
    unlock: () => Promise.resolve(),
    setVolumes: () => {},
    update: () => {},
    stopRace: () => {},
    ui: () => {},
    dispose: () => {},
  };
}
