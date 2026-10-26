import { useEffect } from 'react';
import { carOrStarter, CARS } from '../../content/cars';
import { TRACKS } from '../../content/tracks';
import { sabotageTarget } from '../../meta/career';
import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { KeyHints } from '../components/KeyHints';
import { Keycap } from '../components/Keycap';
import { Panel } from '../components/Panel';
import { TrackOutline } from '../components/TrackOutline';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';
import { formatCash, Tile } from './career/parts';

/**
 * START / BACK, then compact rows under START: the quick race TRACK and CAR pickers (left/right),
 * or the career SABOTAGE row. START keeps the default focus, so a stray Enter never spends cash.
 */
export function PreRace({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const race = state.race;
  const save = state.save;
  const offer = (state.selectedOffer && state.offers?.find((o) => o.id === state.selectedOffer)) || null;
  const career = offer !== null && save !== null;
  const sabotaged = career && save.sabotage?.offerId === offer.id ? save.sabotage : null;
  const target = career ? sabotageTarget(save, offer).name : '';

  const trackIds = Object.keys(TRACKS);
  const trackIndex = Math.max(0, trackIds.indexOf(race?.trackId ?? ''));
  const pickTrack = (d: number) => () => {
    const id = trackIds[(trackIndex + d + trackIds.length) % trackIds.length];
    if (id && id !== race?.trackId) dispatch({ type: 'setQuickTrack', trackId: id });
  };
  // Quick race car (CCR-10): every car in registry order, stock, remembered in settings.quickCarId.
  const carIds = Object.keys(CARS);
  const car = carOrStarter(state.settings.quickCarId);
  const carIndex = carIds.indexOf(car.id);
  const pickCar = (d: number) => () => {
    const id = carIds[(carIndex + d + carIds.length) % carIds.length];
    if (id && id !== car.id) dispatch({ type: 'setSetting', patch: { quickCarId: id } });
  };

  const items: MenuItem[] = [{ onConfirm: () => dispatch({ type: 'startRace' }) }, { onConfirm: () => dispatch({ type: 'back' }) }];
  if (career) items.push({ disabled: sabotaged !== null, onConfirm: () => dispatch({ type: 'buySabotage' }) });
  // Index 3 is an empty, disabled grid cell, so left/right on the TRACK and CAR rows pick instead of moving focus.
  else items.push({ onLeft: pickTrack(-1), onRight: pickTrack(1), onConfirm: pickTrack(1) }, { disabled: true }, { onLeft: pickCar(-1), onRight: pickCar(1), onConfirm: pickCar(1) });
  const { itemProps, setFocused } = useMenuFocus(items, 2);

  // Bought: the row turns into the result, so focus goes back to START.
  useEffect(() => {
    if (sabotaged) setFocused(0);
  }, [sabotaged !== null]);

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
          <div className="prerace-actions">
            <div className="actions">
              <Button label="START" primary {...itemProps(0)} />
              <Button label="BACK" index={1} {...itemProps(1)} />
            </div>
            {career ? (
              <Tile index={2} className="prerace-row" {...itemProps(2)}>
                {sabotaged ? (
                  <span className="display">
                    Sabotaged: {target} <span className="prerace-hit">-{sabotaged.pct}%</span>
                  </span>
                ) : (
                  <>
                    <span className="muted display">Sabotage</span>
                    <span className="display prerace-row-value">{target}</span>
                    <span className={`num display ${offer.sabotagePrice > save.cash ? 'prerace-poor' : 'cash'}`}>{formatCash(offer.sabotagePrice)}</span>
                  </>
                )}
              </Tile>
            ) : (
              <>
                <Tile index={2} className="prerace-row" {...itemProps(2)}>
                  <span className="muted display">Track</span>
                  <Keycap label="←" />
                  <span className="display prerace-row-value">{race?.trackName ?? ''}</span>
                  <Keycap label="→" />
                </Tile>
                <Tile index={3} className="prerace-row" {...itemProps(4)}>
                  <span className="muted display">Car</span>
                  <Keycap label="←" />
                  <span className="prerace-row-value">
                    <span className="display">{car.name}</span>{' '}
                    <span className="muted num">
                      {Math.round(car.base.maxSpeed * 3.6)} km/h · {car.base.maxHp} hp · {car.base.gunDps} dps
                    </span>
                  </span>
                  <Keycap label="→" />
                </Tile>
              </>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
