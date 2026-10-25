import { describe, expect, it } from 'vitest';
import type { Screen } from '../shared/contracts';
import { transition, type MachineInput } from './machine';
import { createGameStore } from './store';
import type { UiState } from '../shared/contracts';

const from = (screen: Screen, previousScreen: Screen | null = null) => ({ screen, previousScreen });

// WP08 state machine table: [from, previous, input, to, previous after, effects]
const TABLE: [Screen, Screen | null, MachineInput, Screen, Screen | null, string[]][] = [
  ['boot', null, { type: 'booted' }, 'title', null, ['startBackdrop']],
  ['title', null, { type: 'startQuickRace' }, 'preRace', null, ['buildSetup']],
  ['preRace', null, { type: 'startRace' }, 'race', null, ['stopBackdrop', 'unlockAudio', 'startSession']],
  ['preRace', null, { type: 'back' }, 'title', null, []],
  ['race', null, { type: 'pause' }, 'paused', null, ['pauseLoop']],
  ['paused', null, { type: 'resume' }, 'race', null, ['resumeLoop']],
  ['paused', null, { type: 'back' }, 'race', null, ['resumeLoop']],
  ['paused', null, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['paused', null, { type: 'quitRace' }, 'title', null, ['disposeSession', 'startBackdrop']],
  ['paused', null, { type: 'navigate', screen: 'settings' }, 'settings', 'paused', []],
  ['race', null, { type: 'raceOver' }, 'results', null, ['showResults', 'pauseLoop']],
  ['results', null, { type: 'continueFromResults' }, 'title', null, ['disposeSession', 'startBackdrop']],
  ['results', null, { type: 'restartRace' }, 'race', null, ['restartSession']],
  ['title', null, { type: 'navigate', screen: 'controls' }, 'controls', 'title', []],
  ['title', null, { type: 'navigate', screen: 'settings' }, 'settings', 'title', []],
  ['controls', 'title', { type: 'back' }, 'title', null, []],
  ['settings', 'title', { type: 'back' }, 'title', null, []],
  ['settings', 'paused', { type: 'back' }, 'paused', null, []],
];

// WP10 career rows: [from, previous, career flags, input, to, previous after, effects]
const CAREER: [Screen, Screen | null, { career?: boolean; champion?: boolean }, MachineInput, Screen, Screen | null, string[]][] = [
  ['title', null, {}, { type: 'newCareer' }, 'career', null, []],
  ['title', null, {}, { type: 'continueCareer' }, 'career', null, []],
  ['career', null, {}, { type: 'navigate', screen: 'garage' }, 'garage', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'shop' }, 'shop', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'raceSelect' }, 'raceSelect', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'standings' }, 'standings', 'career', []],
  ['career', null, {}, { type: 'navigate', screen: 'title' }, 'title', null, []],
  ['career', null, {}, { type: 'back' }, 'title', null, []],
  ['garage', 'career', {}, { type: 'back' }, 'career', null, []],
  ['shop', 'career', {}, { type: 'back' }, 'career', null, []],
  ['standings', 'career', {}, { type: 'back' }, 'career', null, []],
  ['raceSelect', 'career', {}, { type: 'back' }, 'career', null, []],
  ['raceSelect', 'career', {}, { type: 'selectOffer', offerId: '0-easy' }, 'preRace', 'raceSelect', []],
  ['preRace', 'raceSelect', { career: true }, { type: 'back' }, 'raceSelect', null, []],
  ['preRace', 'raceSelect', { career: true }, { type: 'startRace' }, 'race', null, ['stopBackdrop', 'unlockAudio', 'startSession']],
  ['paused', null, { career: true }, { type: 'quitRace' }, 'career', null, ['disposeSession', 'startBackdrop']],
  ['results', null, { career: true }, { type: 'continueFromResults' }, 'career', null, ['disposeSession', 'startBackdrop']],
  ['results', null, { career: true, champion: true }, { type: 'continueFromResults' }, 'champion', null, ['disposeSession', 'startBackdrop']],
  ['champion', null, {}, { type: 'newCareer' }, 'career', null, []],
  ['champion', null, {}, { type: 'navigate', screen: 'title' }, 'title', null, []],
];

describe('machine', () => {
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
