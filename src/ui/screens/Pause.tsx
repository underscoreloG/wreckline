import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { KeyHints } from '../components/KeyHints';
import { Panel } from '../components/Panel';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

export function Pause({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  // CCR-3: a career race (an offer is selected) cannot be restarted, so RESTART is quick race only.
  const quick = state.selectedOffer === null;
  // WP40: a time trial shows its restart key, the ghost toggle, and ends the run on the lap list.
  const trial = state.timeTrial ?? null;
  const items = [
    { label: 'RESUME', onConfirm: () => dispatch({ type: 'resume' }) },
    ...(quick ? [{ label: 'RESTART', note: trial ? (state.usingGamepad ? 'SELECT' : 'R') : undefined, onConfirm: () => dispatch({ type: 'restartRace' }) }] : []),
    ...(trial ? [{ label: 'GHOST', note: trial.ghost ? 'ON' : 'OFF', onConfirm: () => dispatch({ type: 'toggleGhost' }) }] : []),
    { label: 'SETTINGS', onConfirm: () => dispatch({ type: 'navigate', screen: 'settings' }) },
    { label: trial ? 'END RUN' : 'QUIT TO MENU', onConfirm: () => dispatch({ type: 'quitRace' }) },
  ];
  const { itemProps } = useMenuFocus(items);
  return (
    <div className="screen pause-screen">
      <Panel className="screen-panel pause-panel">
        <h2 className="screen-title display">Paused</h2>
        <nav className="menu">
          {items.map((it, i) => (
            <Button key={it.label} label={it.label} note={it.note} primary={i === 0} index={i} {...itemProps(i)} />
          ))}
        </nav>
        {!trial && <KeyHints gamepad={state.usingGamepad} />}
      </Panel>
    </div>
  );
}
