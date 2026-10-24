import type { MouseEvent } from 'react';
import type { MenuItemProps } from '../hooks/useMenuFocus';

export interface ButtonProps extends MenuItemProps {
  label: string;
  primary?: boolean;
  /** Small right-aligned note, e.g. "Coming soon" on a disabled item. */
  note?: string;
  /** Position in its list, for the 30 ms entry stagger. */
  index?: number;
}

// Menus are driven by nav events, not DOM focus: tabIndex -1 and no focus on mousedown,
// otherwise Enter/Space would also fire a native click on the last clicked button.
const keepDomFocus = (e: MouseEvent): void => e.preventDefault();

export function Button({ label, primary, note, index = 0, focused, disabled, onMouseMove, onClick }: ButtonProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`btn stagger ${primary ? 'primary' : 'secondary'}${focused ? ' focused' : ''}`}
      style={{ animationDelay: `${index * 30}ms` }}
      disabled={disabled}
      onMouseDown={keepDomFocus}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      <span>{label}</span>
      {note && <span className="btn-note">{note}</span>}
    </button>
  );
}
