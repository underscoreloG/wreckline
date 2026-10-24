import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { KeyHints } from '../components/KeyHints';
import { Panel } from '../components/Panel';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

export function Pause({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const items = [
    { label: 'RESUME', onConfirm: () => dispatch({ type: 'resume' }) },
    { label: 'RESTART', onConfirm: () => dispatch({ type: 'restartRace' }) },
    { label: 'SETTINGS', onConfirm: () => dispatch({ type: 'navigate', screen: 'settings' }) },
    { label: 'QUIT TO MENU', onConfirm: () => dispatch({ type: 'quitRace' }) },
  ];
  const { itemProps } = useMenuFocus(items);
  return (
    <div className="screen pause-screen">
      <Panel className="screen-panel pause-panel">
        <h2 className="screen-title display">Paused</h2>
        <nav className="menu">
          {items.map((it, i) => (
            <Button key={it.label} label={it.label} primary={i === 0} index={i} {...itemProps(i)} />
          ))}
        </nav>
        <KeyHints gamepad={state.usingGamepad} />
      </Panel>
    </div>
  );
}
