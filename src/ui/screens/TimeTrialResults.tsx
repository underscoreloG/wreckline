import '../timeTrial.css';
import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { formatTime } from '../format';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { formatDelta } from '../hud/TimeTrialInfo';
import { useUi } from '../uiContext';

/** WP40: the run's laps after END RUN, its fastest highlighted, and "New best!" when it beat the stored best. */
export function TimeTrialResults({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus([{ onConfirm: () => dispatch({ type: 'continueFromResults' }) }]);
  const tt = state.timeTrial;
  const laps = tt?.laps ?? [];
  const fastest = laps.length ? Math.min(...laps) : null;
  const fastestAt = fastest === null ? -1 : laps.indexOf(fastest);
  const car = state.race?.entrants[0]?.carName ?? '';

  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">Time Trial</h2>
        {state.race && <p className="screen-sub muted display">{`${state.race.trackName} · ${car}`}</p>}
        {tt?.newBest && <p className="tt-new-best display">New best! {tt.best !== null ? formatTime(tt.best) : ''}</p>}
        {laps.length === 0 ? (
          <p className="muted">No lap completed.</p>
        ) : (
          <div className="tt-laps-wrap">
            <table className="results-table num">
              <thead>
                <tr>
                  <th>LAP</th>
                  <th className="right">TIME</th>
                  <th className="right">GAP</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((t, i) => (
                  <tr key={i} className={`stagger${i === fastestAt ? ' tt-best-lap' : ''}`} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
                    <td className="display">{i + 1}</td>
                    <td className="right">{formatTime(t)}</td>
                    <td className="right">{i === fastestAt || fastest === null ? '-' : formatDelta(t - fastest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!tt?.newBest && tt?.best != null && <p className="muted">Best lap stays {formatTime(tt.best)}.</p>}
        <div className="actions">
          <Button label="CONTINUE" primary {...itemProps(0)} />
        </div>
      </Panel>
    </div>
  );
}
