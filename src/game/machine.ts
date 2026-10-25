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

/** What the machine reads: the screens, plus the career flags the game tracks (WP10). */
export interface MachineState extends Pick<UiState, 'screen' | 'previousScreen'> {
  /** The race in progress (or just finished) is a career race. */
  career?: boolean;
  /** The career race that just finished won the title. */
  champion?: boolean;
}

const CAREER_SUBSCREENS: readonly Screen[] = ['garage', 'shop', 'raceSelect', 'standings'];

/** Screen state machine (WP08 table, career rows from WP10). Returns null when the input does nothing on this screen. */
export function transition(from: MachineState, input: MachineInput): Transition | null {
  const go = (screen: Screen, effects: Effect[] = [], previousScreen: Screen | null = null): Transition => ({ screen, previousScreen, effects });
  const t = input.type;
  switch (from.screen) {
    case 'boot':
      return t === 'booted' ? go('title', ['startBackdrop']) : null;
    case 'title':
      if (t === 'startQuickRace') return go('preRace', ['buildSetup']);
      if (t === 'newCareer' || t === 'continueCareer') return go('career');
      if (input.type === 'navigate' && (input.screen === 'controls' || input.screen === 'settings')) return go(input.screen, [], 'title');
      return null;
    case 'preRace':
      if (t === 'startRace') return go('race', ['stopBackdrop', 'unlockAudio', 'startSession']);
      // Career pre-race returns to race select (previousScreen), quick race to the title.
      if (t === 'back') return go(from.previousScreen ?? 'title');
      return null;
    case 'race':
      if (t === 'pause') return go('paused', ['pauseLoop']);
      // The loop pauses behind the results screen: no render, no audio.update restarting engine sounds after stopRace.
      if (t === 'raceOver') return go('results', ['showResults', 'pauseLoop']);
      return null;
    case 'paused':
      if (t === 'resume' || t === 'back') return go('race', ['resumeLoop']);
      // A career race cannot be re-rolled.
      if (t === 'restartRace') return from.career ? null : go('race', ['restartSession']);
      if (t === 'quitRace') return go(from.career ? 'career' : 'title', ['disposeSession', 'startBackdrop']);
      if (input.type === 'navigate' && input.screen === 'settings') return go('settings', [], 'paused');
      return null;
    case 'results':
      if (t === 'continueFromResults') return go(from.career ? (from.champion ? 'champion' : 'career') : 'title', ['disposeSession', 'startBackdrop']);
      if (t === 'restartRace') return from.career ? null : go('race', ['restartSession']);
      return null;
    case 'career':
      if (input.type === 'navigate' && CAREER_SUBSCREENS.includes(input.screen)) return go(input.screen, [], 'career');
      if (t === 'back' || (input.type === 'navigate' && input.screen === 'title')) return go('title');
      return null;
    case 'garage':
    case 'shop':
    case 'standings':
      return t === 'back' ? go('career') : null;
    case 'raceSelect':
      if (t === 'selectOffer') return go('preRace', [], 'raceSelect');
      return t === 'back' ? go('career') : null;
    case 'champion':
      if (t === 'newCareer') return go('career');
      if (t === 'back' || (input.type === 'navigate' && input.screen === 'title')) return go('title');
      return null;
    case 'controls':
    case 'settings':
      return t === 'back' ? go(from.previousScreen ?? 'title') : null;
    default:
      return null;
  }
}
