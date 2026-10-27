import { describe, expect, it } from 'vitest';
import type { Screen } from '../shared/contracts';
import { transition, type MachineInput } from './machine';
import { createGameStore } from './store';
import type { UiState } from '../shared/contracts';

const from = (screen: Screen, previousScreen: Screen | null = null) => ({ screen, previousScreen });

// WP08 state machine table: [from, previous, input, to, previous after, effects]
const TABLE: [Screen, Screen | null, MachineInput, Screen, Screen | null, string[]][] = [
  // WP36: the title shows its key art, the live backdrop runs on the other menu screens.
  ['boot', null, { type: 'booted' }, 'title', null, []],
  ['title', null, { type: 'startQuickRace' }, 'preRace', null, ['startBackdrop', 'buildSetup']],
  ['preRace', null, { type: 'startRace' }, 'race', null, ['stopBackdrop', 'unlockAudio', 'startSession']],
  ['preRace', null, { type: 'back' }, 'title', null, ['stopBackdrop']],
  ['race', null, { type: 'pause' }, 'paused', null, ['pauseLoop']],
  ['paused', null, { type: 'resume' }, 'race', null, ['resumeLoop']],
  ['paused', null, { type: 'back' }, 'race', null, ['resumeLoop']],
  ['paused', null, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['paused', null, { type: 'quitRace' }, 'title', null, ['disposeSession']],
  ['paused', null, { type: 'navigate', screen: 'settings' }, 'settings', 'paused', []],
  ['race', null, { type: 'raceOver' }, 'results', null, ['showResults', 'pauseLoop']],
  ['results', null, { type: 'continueFromResults' }, 'title', null, ['disposeSession']],
  ['results', null, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['title', null, { type: 'navigate', screen: 'controls' }, 'controls', 'title', []],
  ['title', null, { type: 'navigate', screen: 'settings' }, 'settings', 'title', []],
  ['controls', 'title', { type: 'back' }, 'title', null, []],
  ['settings', 'title', { type: 'back' }, 'title', null, []],
  ['settings', 'paused', { type: 'back' }, 'paused', null, []],
];

// WP10 career rows: [from, previous, career flags, input, to, previous after, effects]
const CAREER: [Screen, Screen | null, { career?: boolean; champion?: boolean }, MachineInput, Screen, Screen | null, string[]][] = [
  ['title', null, {}, { type: 'newCareer' }, 'career', null, ['startBackdrop']],
  ['title', null, {}, { type: 'continueCareer' }, 'career', null, ['startBackdrop']],
  ['career', null, {}, { type: 'navigate', screen: 'garage' }, 'garage', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'shop' }, 'shop', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'raceSelect' }, 'raceSelect', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'standings' }, 'standings', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'title' }, 'title', null, ['stopBackdrop']],
  ['career', null, {}, { type: 'back' }, 'title', null, ['stopBackdrop']],
  ['garage', 'career', {}, { type: 'back' }, 'career', null, []],
  ['shop', 'career', {}, { type: 'back' }, 'career', null, []],
  ['standings', 'career', {}, { type: 'back' }, 'career', null, []],
  ['raceSelect', 'career', {}, { type: 'back' }, 'career', null, []],
  ['raceSelect', 'career', {}, { type: 'selectOffer', offerId: '0-easy' }, 'preRace', 'raceSelect', []],
  ['preRace', 'raceSelect', { career: true }, { type: 'back' }, 'raceSelect', null, []],
  // WP36: the story scene, then the race; SPACE after the last line or ESC (back) leaves it.
  ['preRace', 'raceSelect', { career: true }, { type: 'startRace' }, 'story', null, ['stopBackdrop', 'unlockAudio', 'showStory']],
  ['story', null, { career: true }, { type: 'continueStory' }, 'race', null, ['startSession']],
  ['story', null, { career: true }, { type: 'back' }, 'race', null, ['startSession']],
  ['paused', null, { career: true }, { type: 'quitRace' }, 'career', null, ['disposeSession', 'startBackdrop']],
  ['results', null, { career: true }, { type: 'continueFromResults' }, 'career', null, ['disposeSession', 'startBackdrop']],
  // The title win: the ending scene, then the champion screen (WP36).
  ['results', null, { career: true, champion: true }, { type: 'continueFromResults' }, 'story', null, ['disposeSession', 'showEnding']],
  ['story', null, { career: true, champion: true }, { type: 'continueStory' }, 'champion', null, ['startBackdrop']],
  ['story', null, { career: true, champion: true }, { type: 'back' }, 'champion', null, ['startBackdrop']],
  ['champion', null, {}, { type: 'newCareer' }, 'career', null, []],
  ['champion', null, {}, { type: 'navigate', screen: 'title' }, 'title', null, ['stopBackdrop']],
];

// WP40 time trial rows: [from, previous, flags, input, to, previous after, effects]
const TIME_TRIAL: [Screen, Screen | null, { timeTrial?: boolean }, MachineInput, Screen, Screen | null, string[]][] = [
  ['title', null, {}, { type: 'navigate', screen: 'timeTrial' }, 'timeTrial', null, ['startBackdrop', 'buildTimeTrialSetup']],
  ['timeTrial', null, { timeTrial: true }, { type: 'startRace' }, 'race', null, ['stopBackdrop', 'unlockAudio', 'startSession']],
  ['timeTrial', null, { timeTrial: true }, { type: 'back' }, 'title', null, ['stopBackdrop']],
  // The restart key works while driving and from the pause menu.
  ['race', null, { timeTrial: true }, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['paused', null, { timeTrial: true }, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['paused', null, { timeTrial: true }, { type: 'quitRace' }, 'timeTrialResults', null, []],
  ['timeTrialResults', null, { timeTrial: true }, { type: 'continueFromResults' }, 'timeTrial', null, ['disposeSession', 'startBackdrop', 'buildTimeTrialSetup']],
  ['timeTrialResults', null, { timeTrial: true }, { type: 'back' }, 'timeTrial', null, ['disposeSession', 'startBackdrop', 'buildTimeTrialSetup']],
];

describe('machine', () => {
  it.each(TIME_TRIAL)('time trial: %s (prev %s, %o) + %o -> %s', (screen, prev, flags, input, to, prevAfter, effects) => {
    expect(transition({ ...from(screen, prev), ...flags }, input)).toEqual({ screen: to, previousScreen: prevAfter, effects });
  });

  it('the restart key does nothing in a race', () => {
    expect(transition(from('race'), { type: 'restartRace' })).toBeNull();
    expect(transition({ ...from('race'), career: true }, { type: 'restartRace' })).toBeNull();
  });

  it.each(CAREER)('career: %s (prev %s, %o) + %o -> %s', (screen, prev, flags, input, to, prevAfter, effects) => {
    expect(transition({ ...from(screen, prev), ...flags }, input)).toEqual({ screen: to, previousScreen: prevAfter, effects });
  });

  it('a career race cannot be restarted', () => {
    expect(transition({ ...from('paused'), career: true }, { type: 'restartRace' })).toBeNull();
    expect(transition({ ...from('results'), career: true }, { type: 'restartRace' })).toBeNull();
  });

  it.each(TABLE)('%s + %o: %s -> %s', (screen, prev, input, to, prevAfter, effects) => {
    expect(transition(from(screen, prev), input)).toEqual({ screen: to, previousScreen: prevAfter, effects });
  });

  it('ignores commands that do not apply to the current screen', () => {
    expect(transition(from('boot'), { type: 'startQuickRace' })).toBeNull();
    expect(transition(from('title'), { type: 'pause' })).toBeNull();
    expect(transition(from('title'), { type: 'navigate', screen: 'race' })).toBeNull();
    expect(transition(from('race'), { type: 'back' })).toBeNull();
    expect(transition(from('race'), { type: 'quitRace' })).toBeNull();
    expect(transition(from('paused'), { type: 'raceOver' })).toBeNull();
    expect(transition(from('results'), { type: 'pause' })).toBeNull();
    expect(transition(from('preRace'), { type: 'restartRace' })).toBeNull();
    expect(transition(from('story'), { type: 'pause' })).toBeNull();
    expect(transition(from('story'), { type: 'startRace' })).toBeNull();
    expect(transition(from('preRace'), { type: 'continueStory' })).toBeNull();
  });
});

describe('WP41 arena rows', () => {
  const arena = (screen: Screen) => ({ screen, previousScreen: null, arena: true });
  it('title -> arena setup -> fight -> results -> arena setup, and back to the title', () => {
    expect(transition(from('title'), { type: 'navigate', screen: 'arena' })).toEqual({ screen: 'arena', previousScreen: null, effects: ['startBackdrop', 'buildArenaSetup'] });
    expect(transition(arena('arena'), { type: 'startRace' })).toEqual({ screen: 'race', previousScreen: null, effects: ['stopBackdrop', 'unlockAudio', 'startSession'] });
    expect(transition(arena('arena'), { type: 'back' })).toEqual({ screen: 'title', previousScreen: null, effects: ['stopBackdrop'] });
    expect(transition(arena('results'), { type: 'continueFromResults' })).toEqual({ screen: 'arena', previousScreen: null, effects: ['disposeSession', 'startBackdrop', 'buildArenaSetup'] });
    expect(transition(arena('results'), { type: 'restartRace' })?.effects).toEqual(['restartSession']);
    expect(transition(arena('paused'), { type: 'quitRace' })).toEqual({ screen: 'title', previousScreen: null, effects: ['disposeSession'] });
    expect(transition(arena('arena'), { type: 'pause' })).toBeNull();
  });
});

describe('store', () => {
  it('replaces state immutably and notifies each listener once per set', () => {
    const seen: string[] = [];
    const store = createGameStore({ screen: 'boot' } as UiState, (cmd) => seen.push(cmd.type));
    const before = store.getState();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.set({ screen: 'title', previousScreen: null });
    expect(calls).toBe(1);
    expect(before.screen).toBe('boot');
    expect(store.getState()).not.toBe(before);
    off();
    store.set({ screen: 'race' });
    expect(calls).toBe(1);
    store.dispatch({ type: 'pause' });
    expect(seen).toEqual(['pause']);
  });
});
