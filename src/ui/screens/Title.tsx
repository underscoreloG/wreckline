import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

export function Title({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const items = [
    { label: 'QUICK RACE', onConfirm: () => dispatch({ type: 'startQuickRace' }) },
    // M1: disabled; WP10 wires `navigate career`.
    { label: 'CAREER', disabled: true, note: 'Coming soon' },
    { label: 'CONTROLS', onConfirm: () => dispatch({ type: 'navigate', screen: 'controls' }) },
    { label: 'SETTINGS', onConfirm: () => dispatch({ type: 'navigate', screen: 'settings' }) },
  ];
  const { itemProps } = useMenuFocus(items);
  return (
    <div className="screen title-screen">
      <div className="title-col">
        <h1 className="wordmark display">WRECKLINE</h1>
        <nav className="menu">
          {items.map((it, i) => (
            <Button key={it.label} label={it.label} note={it.note} index={i} {...itemProps(i)} />
          ))}
        </nav>
      </div>
      <span className="version muted">v{state.version}</span>
    </div>
  );
}
