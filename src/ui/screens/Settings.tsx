import type { Settings as SettingsT, UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { Slider } from '../components/Slider';
import { Toggle } from '../components/Toggle';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

const STEP = 5;
const toPct = (v: number): number => Math.round((v * 100) / STEP) * STEP;
const clampPct = (v: number): number => Math.min(100, Math.max(0, v));

export function Settings({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const s = state.settings;
  const set = (patch: Partial<Omit<SettingsT, 'version'>>): void => dispatch({ type: 'setSetting', patch });

  const volume = (key: 'masterVolume' | 'sfxVolume' | 'musicVolume'): MenuItem => {
    const nudge = (d: number) => () => {
      const v = clampPct(toPct(s[key]) + d);
      if (v !== toPct(s[key])) set({ [key]: v / 100 });
    };
    return { onLeft: nudge(-STEP), onRight: nudge(STEP) };
  };
  const toggle = (flip: () => void): MenuItem => ({ onConfirm: flip, onLeft: flip, onRight: flip });

  const items: MenuItem[] = [
    volume('masterVolume'),
    volume('sfxVolume'),
    volume('musicVolume'),
    toggle(() => set({ quality: s.quality === 'high' ? 'low' : 'high' })),
    toggle(() => set({ cameraShake: !s.cameraShake })),
    toggle(() => set({ showFps: !s.showFps })),
    { onConfirm: () => dispatch({ type: 'back' }) },
  ];
  const { itemProps } = useMenuFocus(items);

  return (
    <div className="screen scrim">
      <Panel className="screen-panel settings-panel">
        <h2 className="screen-title display">Settings</h2>
        <div className="settings-list">
          <Slider label="Master volume" value={toPct(s.masterVolume)} step={STEP} onChange={(v) => set({ masterVolume: v / 100 })} {...itemProps(0)} />
          <Slider label="Effects volume" value={toPct(s.sfxVolume)} step={STEP} onChange={(v) => set({ sfxVolume: v / 100 })} {...itemProps(1)} />
          <Slider label="Music volume" value={toPct(s.musicVolume)} step={STEP} onChange={(v) => set({ musicVolume: v / 100 })} {...itemProps(2)} />
          <Toggle label="Graphics quality" value={s.quality === 'high'} onLabel="HIGH" offLabel="LOW" {...itemProps(3)} />
          <Toggle label="Camera shake" value={s.cameraShake} {...itemProps(4)} />
          <Toggle label="Show FPS" value={s.showFps} {...itemProps(5)} />
        </div>
        <div className="actions">
          <Button label="BACK" {...itemProps(6)} />
        </div>
      </Panel>
    </div>
  );
}
