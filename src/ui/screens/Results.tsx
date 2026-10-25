import type { RaceResultRow, UiState } from '../../shared/contracts';
import { PLAYER_CAR_ID } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { formatTime, ordinal } from '../format';
import { useUi } from '../uiContext';
import { formatCash } from './career/parts';
import { Payout } from './career/Payout';

function timeCell(r: RaceResultRow) {
  if (r.finished && r.totalTime !== null) return formatTime(r.totalTime);
  return <span className="dnf">{r.wrecked ? 'WRECKED' : 'DNF'}</span>;
}

export function Results({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  // Restart is quick race only: a career race cannot be re-rolled. A career result always comes with its payout.
  const quick = state.lastPayout === null;
  const offer = quick ? null : (state.offers?.find((o) => o.id === state.selectedOffer) ?? null);
  const items: MenuItem[] = [{ onConfirm: () => dispatch({ type: 'continueFromResults' }) }];
  if (quick) items.push({ onConfirm: () => dispatch({ type: 'restartRace' }) });
  const { itemProps } = useMenuFocus(items, items.length);
  const colors = new Map(state.race?.entrants.map((e) => [e.id, e.color]));
  const rows = state.results?.rows ?? [];

  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">Results</h2>
        {state.race && <p className="screen-sub muted display">{`${state.race.trackName} · ${state.race.laps} laps`}</p>}
        <table className="results-table num">
          <thead>
            <tr>
              <th>POS</th>
              <th>DRIVER</th>
              <th className="right">BEST LAP</th>
              <th className="right">TIME</th>
              <th className="right">WRECKS</th>
              {offer && <th className="right">PRIZE</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.car} className={`stagger${r.car === PLAYER_CAR_ID ? ' player' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
                <td className="display">{ordinal(r.position)}</td>
                <td>
                  <span className="driver">
                    <span className="swatch" style={{ background: colors.get(r.car) ?? 'var(--muted)' }} />
                    {r.name}
                  </span>
                </td>
                <td className="right">{r.bestLap === null ? '-' : formatTime(r.bestLap)}</td>
                <td className="right">{timeCell(r)}</td>
                <td className="right">{r.wrecksCaused}</td>
                {offer && <td className="right cash">{formatCash(r.finished ? (offer.prizes[r.position - 1] ?? 0) : 0)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {state.lastPayout && <Payout payout={state.lastPayout} />}
        <div className="actions">
          <Button label="CONTINUE" primary {...itemProps(0)} />
          {quick && <Button label="RESTART" index={1} {...itemProps(1)} />}
        </div>
      </Panel>
    </div>
  );
}
