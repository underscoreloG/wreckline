import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, quickTrackOrFirst, saveSettings, SETTINGS_KEY, type SettingsStorage } from './settings';

const memory = (init: Record<string, string> = {}): SettingsStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe('settings', () => {
  it('defaults when nothing is stored or storage is unavailable', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual({ version: 1, masterVolume: 0.8, sfxVolume: 0.9, quality: 'high', cameraShake: true, showFps: false, quickTrackId: null });
  });

  it('round-trips through save and load', () => {
    const st = memory();
    const s = { ...DEFAULT_SETTINGS, quality: 'low' as const, masterVolume: 0.35, showFps: true };
    saveSettings(st, s);
    expect(JSON.parse(st.data[SETTINGS_KEY] ?? '')).toEqual(s);
    expect(loadSettings(st)).toEqual(s);
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
});
