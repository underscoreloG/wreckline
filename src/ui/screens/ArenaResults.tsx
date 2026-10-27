import '../arena.css';
import type { RaceResultRow, UiState } from '../../shared/contracts';
import { PLAYER_CAR_ID } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { formatTime, ordinal } from '../format';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

const outCell = (r: RaceResultRow) =>
  r.eliminatedAt === null || r.eliminatedAt === undefined ? <span className="arena-alive">{r.position === 1 ? 'WINNER' : 'RUNNING'}</span> : formatTime(r.eliminatedAt);

/** WP41: an arena fight's result: elimination order (the last car standing 1st), when each car went out, wrecks and damage. */
export function ArenaResults({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus([{ onConfirm: () => dispatch({ type: 'continueFromResults' }) }, { onConfirm: () => dispatch({ type: 'restartRace' }) }], 0);
  const entrants = new Map(state.race?.entrants.map((e) => [e.id, e]));
  const rows = state.results?.rows ?? [];
  const winner = rows[0];
  const fightTime = rows.reduce((t, r) => Math.max(t, r.eliminatedAt ?? 0), 0);
  const won = winner?.car === PLAYER_CAR_ID;

  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">{won ? 'Last car standing' : 'Arena'}</h2>
        {state.race && (
          <p className="screen-sub muted display">{`${state.race.trackName} · ${winner ? `${winner.name} won` : ''} · ${formatTime(fightTime)}`}</p>
        )}
        <table className="results-table num">
          <thead>
            <tr>
              <th>POS</th>
              <th>DRIVER</th>
              <th>CAR</th>
              <th className="right">OUT AT</th>
              <th className="right">WRECKS</th>
              <th className="right">DAMAGE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.car} className={`stagger${r.car === PLAYER_CAR_ID ? ' player' : ''}`} style={{ animationDelay: `${i * 30}ms` }}>
                <td className="display">{ordinal(r.position)}</td>
                <td>
                  <span className="driver">
                    <span className="swatch" style={{ background: entrants.get(r.car)?.color ?? 'var(--muted)' }} />
                    {r.name}
                  </span>
                </td>
                <td className="muted">{entrants.get(r.car)?.carName ?? ''}</td>
                <td className="right">{outCell(r)}</td>
                <td className="right">{r.wrecksCaused}</td>
                <td className="right">{Math.round(r.damageDealt ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <Button label="CONTINUE" primary {...itemProps(0)} />
          <Button label="RESTART" index={1} {...itemProps(1)} />
        </div>
      </Panel>
    </div>
  );
}
