import type { ReactElement } from 'react';
import { useSyncExternalStore } from 'react';
import type { GameStore, UiNav, UiSound } from '../shared/contracts';

/** STUB (WP00), WP04 replaces the body and keeps the signature. Renders the current screen name. */
export function App(props: { store: GameStore; nav: (cb: (n: UiNav) => void) => () => void; onUiSound?: (s: UiSound) => void }): ReactElement {
  const state = useSyncExternalStore(props.store.subscribe, props.store.getState);
  return <div style={{ color: '#e8e8e8', font: '16px monospace', padding: 16 }}>{state.screen}</div>;
}
