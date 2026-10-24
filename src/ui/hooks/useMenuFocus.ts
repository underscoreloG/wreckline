import { useEffect, useRef, useState } from 'react';
import { useUi } from '../uiContext';
import { firstEnabled, moveFocus } from './menuFocus';

export interface MenuItem {
  disabled?: boolean;
  onConfirm?: () => void;
  /** Called on left/right when the layout does not move focus that way (sliders, toggles in a vertical list). */
  onLeft?: () => void;
  onRight?: () => void;
}

export interface MenuItemProps {
  focused: boolean;
  disabled: boolean;
  onMouseMove: () => void;
  onClick: () => void;
}

/** Focus for a vertical list (columns 1) or a grid, driven by nav events, mouse hover sets focus. */
export function useMenuFocus(items: readonly MenuItem[], columns = 1) {
  const ui = useUi();
  const layout = { disabled: items.map((it) => !!it.disabled), columns };
  const [focused, setFocusedRaw] = useState(() => firstEnabled(layout));
  const latest = useRef({ items, layout, focused });
  latest.current = { items, layout, focused };

  const setFocused = (i: number): void => {
    const cur = latest.current;
    if (i === cur.focused || cur.layout.disabled[i] !== false) return;
    latest.current = { ...cur, focused: i };
    setFocusedRaw(i);
    ui.sound('move');
  };

  const confirm = (i: number): void => {
    const item = latest.current.items[i];
    if (!item || item.disabled || !item.onConfirm) return;
    ui.sound('confirm');
    item.onConfirm();
  };

  useEffect(
    () =>
      ui.onNav((n) => {
        const { items: its, layout: lay, focused: f } = latest.current;
        if (n === 'confirm') return confirm(f);
        if (n !== 'up' && n !== 'down' && n !== 'left' && n !== 'right') return;
        const next = moveFocus(f, n, lay);
        if (next !== f) return setFocused(next);
        const item = its[f];
        const side = n === 'left' ? item?.onLeft : n === 'right' ? item?.onRight : undefined;
        if (side && !item?.disabled) {
          ui.sound('move');
          side();
        }
      }),
    // Subscribe once: ui is stable for the App's lifetime and the handler reads items through the ref.
    [ui],
  );

  const itemProps = (i: number): MenuItemProps => ({
    focused: i === focused,
    disabled: !!items[i]?.disabled,
    // mousemove, not mouseenter: a menu that opens under a resting cursor must not steal keyboard focus.
    onMouseMove: () => setFocused(i),
    onClick: () => {
      setFocused(i);
      confirm(i);
    },
  });

  return { focused, setFocused, itemProps };
}
