import './theme.css';
import './career.css';
import type { ReactElement } from 'react';
import { Fragment, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { GameStore, UiNav, UiSound, UiState } from '../shared/contracts';
import { Hud } from './hud/Hud';
import { Boot } from './screens/Boot';
import { CareerHub } from './screens/career/CareerHub';
import { Champion } from './screens/career/Champion';
import { Garage } from './screens/career/Garage';
import { RaceSelect } from './screens/career/RaceSelect';
import { Shop } from './screens/career/Shop';
import { Standings } from './screens/career/Standings';
import { StoryScene } from './screens/career/StoryScene';
import { Toast } from './screens/career/Toast';
import { Controls } from './screens/Controls';
import { Pause } from './screens/Pause';
import { PreRace } from './screens/PreRace';
import { Results } from './screens/Results';
import { Settings } from './screens/Settings';
import { TimeTrialResults } from './screens/TimeTrialResults';
import { TimeTrialSetup } from './screens/TimeTrialSetup';
import { Title } from './screens/Title';
import type { UiContextValue } from './uiContext';
import { UiContext } from './uiContext';

function screenFor(state: UiState): ReactElement | null {
  switch (state.screen) {
    case 'boot':
      return <Boot />;
    case 'title':
      return <Title state={state} />;
    case 'controls':
      return <Controls />;
    case 'settings':
      return <Settings state={state} />;
    case 'preRace':
      return <PreRace state={state} />;
    case 'paused':
      return <Pause state={state} />;
    case 'results':
      return <Results state={state} />;
    case 'career':
      return <CareerHub state={state} />;
    case 'garage':
      return <Garage state={state} />;
    case 'shop':
      return <Shop state={state} />;
    case 'raceSelect':
      return <RaceSelect state={state} />;
    case 'standings':
      return <Standings state={state} />;
    case 'champion':
      return <Champion state={state} />;
    case 'story':
      return <StoryScene state={state} />;
    case 'timeTrial':
      return <TimeTrialSetup state={state} />;
    case 'timeTrialResults':
      return <TimeTrialResults state={state} />;
    default:
      // 'race' is HUD only.
      return null;
  }
}

/** UI root: renders the screen for `state.screen` and maps pause/back nav (WP04 spec), other nav goes to the screen's menu. */
export function App(props: { store: GameStore; nav: (cb: (n: UiNav) => void) => () => void; onUiSound?: (s: UiSound) => void }): ReactElement {
  const { store, nav } = props;
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const soundRef = useRef(props.onUiSound);
  soundRef.current = props.onUiSound;
  const menuListeners = useRef(new Set<(n: UiNav) => void>());

  const ctx = useMemo<UiContextValue>(
    () => ({
      dispatch: (cmd) => store.dispatch(cmd),
      sound: (s) => soundRef.current?.(s),
      onNav: (cb) => {
        menuListeners.current.add(cb);
        return () => menuListeners.current.delete(cb);
      },
    }),
    [store],
  );

  useEffect(
    () =>
      nav((n) => {
        const screen = store.getState().screen;
        if (n === 'pause' || n === 'back') {
          if (screen === 'race') {
            // Gamepad B is the handbrake while racing, so only pause counts here.
            if (n === 'pause') store.dispatch({ type: 'pause' });
          } else if (screen === 'paused') {
            ctx.sound('back');
            store.dispatch({ type: 'resume' });
          } else if (screen === 'title') {
            // Title sub-menus (career, overwrite confirm) close on back.
            for (const cb of [...menuListeners.current]) cb('back');
          } else if (screen !== 'boot') {
            ctx.sound('back');
            store.dispatch({ type: 'back' });
          }
          return;
        }
        for (const cb of [...menuListeners.current]) cb(n);
      }),
    [nav, store, ctx],
  );

  const showHud = (state.screen === 'race' || state.screen === 'paused') && state.hud !== null;
  return (
    <UiContext.Provider value={ctx}>
      <div className="ui-root">
        {showHud && state.hud && <Hud hud={state.hud} minimapPath={state.race?.minimapPath ?? []} paused={state.screen === 'paused'} />}
        {/* Keyed by screen so each screen mounts fresh: entry animation and focus reset. */}
        <Fragment key={state.screen}>{screenFor(state)}</Fragment>
        <Toast toast={state.toast} />
      </div>
    </UiContext.Provider>
  );
}
