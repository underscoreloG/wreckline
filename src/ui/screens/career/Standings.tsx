import { getCar } from '../../../content/cars';
import { PLAYER_LIVERY } from '../../../content/liveries';
import { BOSS } from '../../../content/rivals';
import { ladder, rankOf } from '../../../meta/career';
import type { UiState } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { useUi } from '../../uiContext';

export function Standings({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus([{ onConfirm: () => dispatch({ type: 'back' }) }]);
  const save = state.save;
  if (!save) return null;
  const colorOf = new Map(save.rivals.map((r) => [r.driverId, r.color]));
  // The boss stays a locked "?" row until the player reaches rank 1 (design.md).
  const bossOpen = rankOf(save) === 1;

  return (
    <div className="screen scrim">
      <Panel className="screen-panel standings-panel">
        <h2 className="screen-title display">Standings</h2>
        <table className="results-table standings-table num">
          <thead>
            <tr>
              <th>RANK</th>
              <th>DRIVER</th>
              <th>CAR</th>
              <th className="right">PTS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="boss-row">
              <td className="display">BOSS</td>
              <td>
                <span className="driver">
                  <span className="swatch boss-swatch" />
                  {bossOpen ? BOSS.name : '?'}
                </span>
              </td>
              <td>{bossOpen ? getCar(BOSS.carDefId).name : '?'}</td>
              <td className="right muted">{bossOpen ? 'OPEN' : 'LOCKED'}</td>
            </tr>
            {ladder(save).map((r, i) => (
              <tr key={r.driverId} className={r.isPlayer ? 'player' : ''}>
                <td className="display">{i + 1}</td>
                <td>
                  <span className="driver">
                    <span className="swatch" style={{ background: r.isPlayer ? PLAYER_LIVERY : (colorOf.get(r.driverId) ?? 'var(--muted)') }} />
                    {r.name}
                  </span>
                </td>
                <td className="muted">{getCar(r.carDefId).name}</td>
                <td className="right">{r.points}</td>
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
