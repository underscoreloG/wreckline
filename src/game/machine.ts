import type { GameCommand, Screen, UiState } from '../shared/contracts';

/** Commands from the UI plus the two transitions the game raises itself. */
export type MachineInput = GameCommand | { type: 'booted' } | { type: 'raceOver' };

/** Side effects, run in order by the game (index.ts). */
export type Effect =
  | 'startBackdrop'
  | 'stopBackdrop'
  | 'buildSetup'
  | 'startSession'
  | 'restartSession'
  | 'disposeSession'
  | 'pauseLoop'
  | 'resumeLoop'
  | 'unlockAudio'
  | 'showResults';

export interface Transition {
  screen: Screen;
  previousScreen: Screen | null;
  effects: Effect[];
}

/** Screen state machine (WP08 table). Returns null when the input does nothing on this screen. */
export function transition(from: Pick<UiState, 'screen' | 'previousScreen'>, input: MachineInput): Transition | null {
  const go = (screen: Screen, effects: Effect[] = [], previousScreen: Screen | null = null): Transition => ({ screen, previousScreen, effects });
  const t = input.type;
  switch (from.screen) {
    case 'boot':
      return t === 'booted' ? go('title', ['startBackdrop']) : null;
    case 'title':
      if (t === 'startQuickRace') return go('preRace', ['buildSetup']);
      if (input.type === 'navigate' && (input.screen === 'controls' || input.screen === 'settings')) return go(input.screen, [], 'title');
      return null;
    case 'preRace':
      if (t === 'startRace') return go('race', ['stopBackdrop', 'unlockAudio', 'startSession']);
      if (t === 'back') return go('title');
      return null;
    case 'race':
      if (t === 'pause') return go('paused', ['pauseLoop']);
      if (t === 'raceOver') return go('results', ['showResults']);
      return null;
    case 'paused':
      if (t === 'resume' || t === 'back') return go('race', ['resumeLoop']);
      if (t === 'restartRace') return go('race', ['restartSession']);
      if (t === 'quitRace') return go('title', ['disposeSession', 'startBackdrop']);
      if (input.type === 'navigate' && input.screen === 'settings') return go('settings', [], 'paused');
      return null;
    case 'results':
      if (t === 'continueFromResults') return go('title', ['disposeSession', 'startBackdrop']);
      if (t === 'restartRace') return go('race', ['restartSession']);
      return null;
    case 'controls':
    case 'settings':
      return t === 'back' ? go(from.previousScreen ?? 'title') : null;
    default:
      return null;
  }
}
