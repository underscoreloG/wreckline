import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { KeyHints } from '../components/KeyHints';
import { Panel } from '../components/Panel';
import { TrackOutline } from '../components/TrackOutline';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

export function PreRace({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus(
    [{ onConfirm: () => dispatch({ type: 'startRace' }) }, { onConfirm: () => dispatch({ type: 'back' }) }],
    2,
  );
  const race = state.race;
  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">{race?.trackName ?? 'Race'}</h2>
        <p className="screen-sub muted display">{race ? `${race.laps} laps · ${race.entrants.length} drivers` : ''}</p>
        {race && (
          <div className="prerace-body">
            <div className="prerace-track">
              <TrackOutline points={race.minimapPath} />
            </div>
            <div className="entrants">
              {race.entrants.map((e, i) => (
                <div className="entrant stagger" key={e.id} style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="swatch" style={{ background: e.color }} />
                  <span className="entrant-text">
                    <span className="entrant-name">{e.name}</span>
                    <span className="muted">{e.carName}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="footer-row">
          <KeyHints gamepad={state.usingGamepad} />
          <div className="actions">
            <Button label="START" primary {...itemProps(0)} />
            <Button label="BACK" index={1} {...itemProps(1)} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
