import './theme.css';
import type { ReactElement } from 'react';
import { Fragment, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { GameStore, UiNav, UiSound, UiState } from '../shared/contracts';
import { Hud } from './hud/Hud';
import { Boot } from './screens/Boot';
import { Controls } from './screens/Controls';
import { Pause } from './screens/Pause';
import { PreRace } from './screens/PreRace';
import { Results } from './screens/Results';
import { Settings } from './screens/Settings';
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
    default:
      // 'race' is HUD only; M2 screens arrive with WP10.
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
          } else if (screen !== 'boot' && screen !== 'title') {
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
      </div>
    </UiContext.Provider>
  );
}
