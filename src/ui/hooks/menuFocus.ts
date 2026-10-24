// Pure focus model behind useMenuFocus, kept free of React so it is unit-testable in Node.

export type FocusDir = 'up' | 'down' | 'left' | 'right';

export interface FocusLayout {
  /** Disabled flags, one per item, in focus order. */
  disabled: readonly boolean[];
  /** Items per row: 1 = vertical list, items.length = horizontal row. */
  columns: number;
}

/** First enabled index, or 0 when every item is disabled. */
export function firstEnabled(layout: FocusLayout): number {
  const i = layout.disabled.indexOf(false);
  return i < 0 ? 0 : i;
}

/**
 * Next focused index for a move. No wrap-around: at an edge the focus stays put.
 * Disabled items are skipped by continuing in the same direction; if only disabled
 * items remain that way, the focus stays put too.
 */
export function moveFocus(index: number, dir: FocusDir, layout: FocusLayout): number {
  const count = layout.disabled.length;
  const cols = Math.max(1, layout.columns);
  const col = index % cols;
  let step: number;
  if (dir === 'up') step = -cols;
  else if (dir === 'down') step = cols;
  else if (dir === 'left') step = col === 0 ? 0 : -1;
  else step = col === cols - 1 ? 0 : 1;
  if (step === 0) return index;

  for (let i = index + step; i >= 0 && i < count; i += step) {
    // Horizontal moves never leave the row.
    if ((dir === 'left' || dir === 'right') && Math.floor(i / cols) !== Math.floor(index / cols)) break;
    if (!layout.disabled[i]) return i;
  }
  return index;
}
