import { describe, expect, it } from 'vitest';
import { CARS, carOrStarter, STARTER_CAR_ID } from '../content/cars';
import { DEFAULT_SETTINGS, loadSettings, quickTrackOrFirst, saveSettings, SETTINGS_KEY, type SettingsStorage } from './settings';

const memory = (init: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('settings', () => {
  it('defaults when nothing is stored or storage is unavailable', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual({ version: 1, masterVolume: 0.8, sfxVolume: 0.9, musicVolume: 0.5, quality: 'high', cameraShake: true, showFps: false, quickTrackId: null, quickCarId: null, difficulty: 'normal' });
  });

  it('round-trips through save and load', () => {
    const st = memory();
    const s = { ...DEFAULT_SETTINGS, quality: 'low' as const, masterVolume: 0.35, showFps: true };
    saveSettings(st, s);
    expect(JSON.parse(st.data[SETTINGS_KEY] ?? '')).toEqual(s);
    expect(loadSettings(st)).toEqual(s);
  });

  it('a settings object saved before CCR-11 gets the default music volume and keeps the rest', () => {
    const old = { version: 1, masterVolume: 0.4, sfxVolume: 0.6, quality: 'low', cameraShake: false, showFps: true, quickTrackId: 'harbor', quickCarId: null };
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify(old) }))).toEqual({ ...old, musicVolume: 0.5, difficulty: 'normal' });
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...old, musicVolume: 0 }) })).musicVolume).toBe(0);
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...old, musicVolume: 'loud' }) })).musicVolume).toBe(0.5);
  });

  it('a settings object saved before CCR-13 gets difficulty normal; a stored level round-trips, a bad one falls back', () => {
    const { difficulty: _, ...old } = { ...DEFAULT_SETTINGS, quality: 'low' as const, quickTrackId: 'harbor' };
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify(old) }))).toEqual({ ...old, difficulty: 'normal' });
    for (const d of ['easy', 'hard'] as const) expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...old, difficulty: d }) })).difficulty).toBe(d);
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...old, difficulty: 'insane' }) })).difficulty).toBe('normal');
  });

  it('tolerates corrupt JSON and wrong-typed fields', () => {
    expect(loadSettings(memory({ [SETTINGS_KEY]: '{not json' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory({ [SETTINGS_KEY]: 'null' }))).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(memory({ [SETTINGS_KEY]: '42' }))).toEqual(DEFAULT_SETTINGS);
    const mixed = loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ masterVolume: 7, sfxVolume: 'x', quality: 'ultra', cameraShake: false, showFps: 1 }) }));
    expect(mixed).toEqual({ ...DEFAULT_SETTINGS, masterVolume: 1, cameraShake: false });
  });

  it('survives a storage that throws', () => {
    const broken: SettingsStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(broken, DEFAULT_SETTINGS)).not.toThrow();
  });

  it('quick race track: the stored id when it exists, else the first track (null and unknown ids)', () => {
    const ids = ['a', 'b', 'c'];
    expect(quickTrackOrFirst('b', ids)).toBe('b');
    expect(quickTrackOrFirst(null, ids)).toBe('a');
    expect(quickTrackOrFirst('gone', ids)).toBe('a');
    const st = memory({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, quickTrackId: 'gone' }) });
    expect(loadSettings(st).quickTrackId).toBe('gone');
  });

  it('quick race car (CCR-10): null by default, persisted, unknown or null ids resolve to raven', () => {
    expect(DEFAULT_SETTINGS.quickCarId).toBeNull();
    const st = memory();
    saveSettings(st, { ...DEFAULT_SETTINGS, quickCarId: 'blaze' });
    expect(loadSettings(st).quickCarId).toBe('blaze');
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, quickCarId: 7 }) })).quickCarId).toBeNull();
    // Settings written before CCR-10 have no quickCarId.
    const { quickCarId: _c, ...old } = DEFAULT_SETTINGS;
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify(old) })).quickCarId).toBeNull();
    expect(loadSettings(memory({ [SETTINGS_KEY]: JSON.stringify({ ...DEFAULT_SETTINGS, quickCarId: 'gone' }) })).quickCarId).toBe('gone');
    for (const id of Object.keys(CARS)) expect(carOrStarter(id).id).toBe(id);
    expect(carOrStarter(null).id).toBe(STARTER_CAR_ID);
    expect(carOrStarter('gone').id).toBe(STARTER_CAR_ID);
  });
});
