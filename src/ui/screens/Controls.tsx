import { Button } from '../components/Button';
import { Keycap } from '../components/Keycap';
import { Panel } from '../components/Panel';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

// Fixed M1 bindings, must match WP05 (WP04 spec table). [action, keyboard keys, gamepad inputs, separator]
const BINDINGS: readonly [string, string[], string[], string][] = [
  ['Accelerate', ['↑'], ['RT'], ''],
  ['Brake / reverse', ['↓'], ['LT'], ''],
  ['Steer', ['←', '→'], ['Left stick', 'D-pad'], ','],
  ['Fire gun', ['S'], ['A'], ''],
  ['Drop mine', ['D'], ['X'], ''],
  ['Turbo', ['A'], ['Y', 'RB'], 'or'],
  ['Handbrake', ['Space'], ['B'], ''],
  ['Pause', ['Esc'], ['Start'], ''],
];

function Keys({ keys, pad, sep }: { keys: string[]; pad: boolean; sep: string }) {
  return (
    <span className="bind-keys">
      {keys.map((k, i) => (
        <span className="bind-keys" key={k}>
          {i > 0 && sep && <span className="muted">{sep}</span>}
          <Keycap label={k} pad={pad} />
        </span>
      ))}
    </span>
  );
}

export function Controls() {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus([{ onConfirm: () => dispatch({ type: 'back' }) }]);
  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">Controls</h2>
        <table className="bind-table">
          <thead>
            <tr>
              <th>ACTION</th>
              <th>KEYBOARD</th>
              <th>GAMEPAD</th>
            </tr>
          </thead>
          <tbody>
            {BINDINGS.map(([action, keys, pad, sep]) => (
              <tr key={action}>
                <td>{action}</td>
                <td>
                  <Keys keys={keys} pad={false} sep={keys.length > 1 ? '/' : ''} />
                </td>
                <td>
                  <Keys keys={pad} pad sep={sep} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <Button label="BACK" {...itemProps(0)} />
        </div>
      </Panel>
    </div>
  );
}
