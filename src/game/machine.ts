import type { GameCommand, Screen, UiState } from '../shared/contracts';

/** Commands from the UI plus the two transitions the game raises itself. */
export type MachineInput = GameCommand | { type: 'booted' } | { type: 'raceOver' };

/** Side effects, run in order by the game (index.ts). */
export type Effect =
  | 'startBackdrop'
  | 'stopBackdrop'
  | 'buildSetup'
  | 'buildTimeTrialSetup'
  | 'startSession'
  | 'restartSession'
  | 'disposeSession'
  | 'pauseLoop'
  | 'resumeLoop'
  | 'unlockAudio'
  | 'showResults'
  | 'showStory'
  | 'showEnding';

export interface Transition {
  screen: Screen;
  previousScreen: Screen | null;
  effects: Effect[];
}

/** What the machine reads: the screens, plus the career flags the game tracks (WP10). */
export interface MachineState extends Pick<UiState, 'screen' | 'previousScreen'> {
  /** The race in progress (or just finished) is a career race. */
  career?: boolean;
  /** The career race that just finished won the title (until the ending scene is left). */
  champion?: boolean;
  /** The race in progress (or just quit) is a time trial (WP40). */
  timeTrial?: boolean;
}

const CAREER_SUBSCREENS: readonly Screen[] = ['garage', 'shop', 'raceSelect', 'standings'];

/**
 * Screen state machine (WP08 table, career rows from WP10, story rows from WP36, time trial rows from WP40). Returns null when the input does nothing
 * on this screen. The title shows its key art (WP36): the live backdrop runs on the other menu screens only.
 */
export function transition(from: MachineState, input: MachineInput): Transition | null {
  const go = (screen: Screen, effects: Effect[] = [], previousScreen: Screen | null = null): Transition => ({ screen, previousScreen, effects });
  const t = input.type;
  switch (from.screen) {
    case 'boot':
      return t === 'booted' ? go('title') : null;
    case 'title':
      if (t === 'startQuickRace') return go('preRace', ['startBackdrop', 'buildSetup']);
      if (t === 'newCareer' || t === 'continueCareer') return go('career', ['startBackdrop']);
      if (input.type === 'navigate' && (input.screen === 'controls' || input.screen === 'settings')) return go(input.screen, [], 'title');
      if (input.type === 'navigate' && input.screen === 'timeTrial') return go('timeTrial', ['startBackdrop', 'buildTimeTrialSetup']);
      return null;
    case 'timeTrial':
      if (t === 'startRace') return go('race', ['stopBackdrop', 'unlockAudio', 'startSession']);
      if (t === 'back') return go('title', ['stopBackdrop']);
      return null;
    case 'timeTrialResults':
      // The quit run stays frozen behind the lap list, as a race behind its results.
      if (t === 'continueFromResults' || t === 'back') return go('timeTrial', ['disposeSession', 'startBackdrop', 'buildTimeTrialSetup']);
      return null;
    case 'preRace':
      // A career race starts after its story scene (WP36).
      if (t === 'startRace') return from.career ? go('story', ['stopBackdrop', 'unlockAudio', 'showStory']) : go('race', ['stopBackdrop', 'unlockAudio', 'startSession']);
      // Career pre-race returns to race select (previousScreen), quick race to the title.
      if (t === 'back') return from.previousScreen ? go(from.previousScreen) : go('title', ['stopBackdrop']);
      return null;
    case 'story':
      // The last line confirmed, or skipped: the race, or the champion screen after the ending.
      if (t === 'continueStory' || t === 'back') return from.champion ? go('champion', ['startBackdrop']) : go('race', ['startSession']);
      return null;
    case 'race':
      if (t === 'pause') return go('paused', ['pauseLoop']);
      // The loop pauses behind the results screen: no render, no audio.update restarting engine sounds after stopRace.
      if (t === 'raceOver') return go('results', ['showResults', 'pauseLoop']);
      // The time trial restart key works while driving.
      if (t === 'restartRace' && from.timeTrial) return go('race', ['restartSession']);
      return null;
    case 'paused':
      if (t === 'resume' || t === 'back') return go('race', ['resumeLoop']);
      // A career race cannot be re-rolled.
      if (t === 'restartRace') return from.career ? null : go('race', ['restartSession']);
      if (t === 'quitRace') {
        if (from.timeTrial) return go('timeTrialResults');
        return from.career ? go('career', ['disposeSession', 'startBackdrop']) : go('title', ['disposeSession']);
      }
      if (input.type === 'navigate' && input.screen === 'settings') return go('settings', [], 'paused');
      return null;
    case 'results':
      if (t === 'continueFromResults') {
        if (!from.career) return go('title', ['disposeSession']);
        return from.champion ? go('story', ['disposeSession', 'showEnding']) : go('career', ['disposeSession', 'startBackdrop']);
      }
      if (t === 'restartRace') return from.career ? null : go('race', ['restartSession']);
      return null;
    case 'career':
      if (input.type === 'navigate' && CAREER_SUBSCREENS.includes(input.screen)) return go(input.screen, [], 'career');
      if (t === 'back' || (input.type === 'navigate' && input.screen === 'title')) return go('title', ['stopBackdrop']);
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
      if (t === 'back' || (input.type === 'navigate' && input.screen === 'title')) return go('title', ['stopBackdrop']);
      return null;
    case 'controls':
    case 'settings':
      return t === 'back' ? go(from.previousScreen ?? 'title') : null;
    default:
      return null;
  }
}
