import { createContext, useContext } from 'react';
import type { GameCommand, UiNav, UiSound } from '../shared/contracts';

/** What App hands every screen: the command channel, UI sounds and the menu nav events it does not consume itself. */
export interface UiContextValue {
  dispatch(cmd: GameCommand): void;
  sound(s: UiSound): void;
  onNav(cb: (n: UiNav) => void): () => void;
}

export const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi outside <App>');
  return ctx;
}
