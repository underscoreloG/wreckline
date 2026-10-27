import '../timeTrial.css';
import { carOrStarter, CARS } from '../../content/cars';
import { baseTrackId, TRACKS } from '../../content/tracks';
import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Keycap } from '../components/Keycap';
import { Panel } from '../components/Panel';
import { TrackOutline } from '../components/TrackOutline';
import { formatTime } from '../format';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';
import { Tile } from './career/parts';

/**
 * WP40 time trial setup: the quick race TRACK, REVERSE and CAR pickers (same remembered picks), and the stored best
 * lap for the shown track, direction and car. START keeps the default focus.
 */
export function TimeTrialSetup({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const race = state.race;
  const best = state.timeTrial?.best ?? null;

  const trackIds = Object.keys(TRACKS);
  const baseId = baseTrackId(race?.trackId ?? '');
  const trackIndex = Math.max(0, trackIds.indexOf(baseId));
  const pickTrack = (d: number) => () => {
    const id = trackIds[(trackIndex + d + trackIds.length) % trackIds.length];
    if (id && id !== baseId) dispatch({ type: 'setQuickTrack', trackId: id });
  };
  const reversed = state.settings.quickReversed;
  const toggleReverse = () => dispatch({ type: 'setSetting', patch: { quickReversed: !reversed } });
  const carIds = Object.keys(CARS);
  const car = carOrStarter(state.settings.quickCarId);
  const carIndex = carIds.indexOf(car.id);
  const pickCar = (d: number) => () => {
    const id = carIds[(carIndex + d + carIds.length) % carIds.length];
    if (id && id !== car.id) dispatch({ type: 'setSetting', patch: { quickCarId: id } });
  };

  // Same grid as the quick race pre-race: indices 3 and 5 are empty cells, so left/right on a row picks.
  const items: MenuItem[] = [
    { onConfirm: () => dispatch({ type: 'startRace' }) },
    { onConfirm: () => dispatch({ type: 'back' }) },
    { onLeft: pickTrack(-1), onRight: pickTrack(1), onConfirm: pickTrack(1) },
    { disabled: true },
    { onLeft: toggleReverse, onRight: toggleReverse, onConfirm: toggleReverse },
    { disabled: true },
    { onLeft: pickCar(-1), onRight: pickCar(1), onConfirm: pickCar(1) },
  ];
  const { itemProps } = useMenuFocus(items, 2);
  const pad = state.usingGamepad;

  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">Time Trial</h2>
        <p className="screen-sub muted display">{race ? `${race.trackName} · ${car.name} · solo, no weapons` : ''}</p>
        {race && (
          <div className="prerace-body">
            <div className="prerace-track">
              <TrackOutline points={race.minimapPath} />
            </div>
            <div className="tt-best">
              <span className="muted display">Best lap</span>
              <span className="tt-best-time display num">{best === null ? '-:--.--' : formatTime(best)}</span>
              <span className="muted">{best === null ? 'No lap set yet with this car in this direction.' : 'Its ghost drives with you.'}</span>
            </div>
          </div>
        )}
        <div className="footer-row">
          <div className="key-hints muted">
            <span className="key-hint">
              <Keycap label={pad ? 'SELECT' : 'R'} pad={pad} />
              RESTART
            </span>
            <span className="key-hint">
              <Keycap label={pad ? 'START' : 'ESC'} pad={pad} />
              PAUSE
            </span>
          </div>
          <div className="prerace-actions">
            <div className="actions">
              <Button label="START" primary {...itemProps(0)} />
              <Button label="BACK" index={1} {...itemProps(1)} />
            </div>
            <Tile index={2} className="prerace-row" {...itemProps(2)}>
              <span className="muted display">Track</span>
              <Keycap label="←" />
              <span className="display prerace-row-value">{TRACKS[baseId]?.name ?? ''}</span>
              <Keycap label="→" />
            </Tile>
            <Tile index={3} className="prerace-row" {...itemProps(4)}>
              <span className="muted display">Reverse</span>
              <Keycap label="←" />
              <span className={`display prerace-row-value${reversed ? ' prerace-on' : ''}`}>{reversed ? 'On' : 'Off'}</span>
              <Keycap label="→" />
            </Tile>
            <Tile index={4} className="prerace-row" {...itemProps(6)}>
              <span className="muted display">Car</span>
              <Keycap label="←" />
              <span className="prerace-row-value">
                <span className="display">{car.name}</span>{' '}
                <span className="muted num">
                  {Math.round(car.base.maxSpeed * 3.6)} km/h · {car.base.accel.toFixed(1)} m/s²
                </span>
              </span>
              <Keycap label="→" />
            </Tile>
          </div>
        </div>
      </Panel>
    </div>
  );
}
