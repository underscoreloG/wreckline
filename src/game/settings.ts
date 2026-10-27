import type { Settings } from '../shared/contracts';

export const SETTINGS_KEY = 'wreckline.settings.v1';

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  version: 1,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.5,
  quality: 'high',
  cameraShake: true,
  showFps: false,
  quickTrackId: null,
  quickCarId: null,
};

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const unit = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/** Reads saved settings; any missing, wrong-typed or unparsable field falls back to its default. */
export function loadSettings(storage: SettingsStorage | null): Settings {
  let raw: unknown = null;
  try {
    const text = storage?.getItem(SETTINGS_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    raw = null;
  }
  const d = DEFAULT_SETTINGS;
  if (typeof raw !== 'object' || raw === null) return { ...d };
  const r = raw as Record<string, unknown>;
  return {
    version: 1,
    masterVolume: unit(r.masterVolume, d.masterVolume),
    sfxVolume: unit(r.sfxVolume, d.sfxVolume),
    // Settings saved before CCR-11 have no musicVolume: they get the default.
    musicVolume: unit(r.musicVolume, d.musicVolume),
    quality: r.quality === 'low' || r.quality === 'high' ? r.quality : d.quality,
    cameraShake: bool(r.cameraShake, d.cameraShake),
    showFps: bool(r.showFps, d.showFps),
    quickTrackId: typeof r.quickTrackId === 'string' ? r.quickTrackId : d.quickTrackId,
    // Kept as stored like quickTrackId; an unknown id falls back to the starter where it is used (carOrStarter).
    quickCarId: typeof r.quickCarId === 'string' ? r.quickCarId : d.quickCarId,
  };
}

/** The stored quick race track when it still exists, else the first of `trackIds` (null and unknown ids included). */
export function quickTrackOrFirst(id: string | null, trackIds: readonly string[]): string | undefined {
  return id !== null && trackIds.includes(id) ? id : trackIds[0];
}

export function saveSettings(storage: SettingsStorage | null, s: Settings): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Quota or private mode: the settings still apply for this session.
  }
}
