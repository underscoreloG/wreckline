import '../arena.css';
import { ARENAS } from '../../content/arenas';
import { ARENA_CARS, ARENA_MAX_HP, ARENA_SUDDEN_DEATH_AT } from '../../content/arenas/rules';
import { carOrStarter, CARS } from '../../content/cars';
import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import { Keycap } from '../components/Keycap';
import { Panel } from '../components/Panel';
import { TrackOutline } from '../components/TrackOutline';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';
import { Tile } from './career/parts';

/** WP41 arena setup: the ARENA and CAR pickers (the car shared with quick race), the arena's floor plan and rules. */
export function ArenaSetup({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const race = state.race;
  const ids = Object.keys(ARENAS);
  const arena = ARENAS[race?.trackId ?? ''] ?? ARENAS[ids[0] ?? ''];
  const index = Math.max(0, ids.indexOf(arena?.id ?? ''));
  const pickArena = (d: number) => () => {
    const id = ids[(index + d + ids.length) % ids.length];
    if (id && id !== arena?.id) dispatch({ type: 'setArena', arenaId: id });
  };
  const carIds = Object.keys(CARS);
  const car = carOrStarter(state.settings.quickCarId);
  const carIndex = carIds.indexOf(car.id);
  const pickCar = (d: number) => () => {
    const id = carIds[(carIndex + d + carIds.length) % carIds.length];
    if (id && id !== car.id) dispatch({ type: 'setSetting', patch: { quickCarId: id } });
  };

  // The pre-race grid: index 3 is an empty cell, so left/right on a row picks.
  const items: MenuItem[] = [
    { onConfirm: () => dispatch({ type: 'startRace' }) },
    { onConfirm: () => dispatch({ type: 'back' }) },
    { onLeft: pickArena(-1), onRight: pickArena(1), onConfirm: pickArena(1) },
    { disabled: true },
    { onLeft: pickCar(-1), onRight: pickCar(1), onConfirm: pickCar(1) },
  ];
  const { itemProps } = useMenuFocus(items, 2);
  const minutes = Math.round(ARENA_SUDDEN_DEATH_AT / 60);

  return (
    <div className="screen scrim">
      <Panel className="screen-panel">
        <h2 className="screen-title display">Arena</h2>
        <p className="screen-sub muted display">{arena ? `${arena.name} · ${car.name} · last car standing` : ''}</p>
        {arena && (
          <div className="prerace-body">
            <div className="prerace-track">
              <TrackOutline points={arena.wall}>
                {arena.blocks.map((b, i) => (
                  <polygon key={i} className="arena-block" points={b.points.map((p) => `${p.x},${p.y}`).join(' ')} />
                ))}
                {arena.spawns.map((s, i) => (
                  <circle key={i} className={`arena-spawn${i === 0 ? ' player' : ''}`} cx={s.pos.x} cy={s.pos.y} r={i === 0 ? 3.2 : 2.4} />
                ))}
              </TrackOutline>
            </div>
            <ul className="arena-rules">
              <li>{ARENA_CARS} cars, one survivor. A wreck is out.</li>
              <li>Even stats: every car has {ARENA_MAX_HP} hp and the same gun. Pick a car for how it drives.</li>
              <li>Guns, mines, rocket fuel and repairs. Pickups come back after 10 s.</li>
              <li>
                <span className="arena-sd">Sudden death</span> after {minutes}:00: every car loses hp, walls hit twice as hard, no more repairs.
              </li>
              <li className="muted">No prize money: just the win.</li>
            </ul>
          </div>
        )}
        <div className="footer-row">
          <div className="key-hints muted">
            <span className="key-hint">
              <Keycap label={state.usingGamepad ? 'START' : 'ESC'} pad={state.usingGamepad} />
              PAUSE
            </span>
          </div>
          <div className="prerace-actions">
            <div className="actions">
              <Button label="START" primary {...itemProps(0)} />
              <Button label="BACK" index={1} {...itemProps(1)} />
            </div>
            <Tile index={2} className="prerace-row" {...itemProps(2)}>
              <span className="muted display">Arena</span>
              <Keycap label="←" />
              <span className="display prerace-row-value">{arena?.name ?? ''}</span>
              <Keycap label="→" />
            </Tile>
            <Tile index={3} className="prerace-row" {...itemProps(4)}>
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
