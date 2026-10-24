import type { MenuItemProps } from '../hooks/useMenuFocus';

export interface ToggleProps extends MenuItemProps {
  label: string;
  value: boolean;
  onLabel?: string;
  offLabel?: string;
}

/** Settings row with a two-state switch; confirm, left/right and click flip it (wired by the screen's menu items). */
export function Toggle({ label, value, onLabel = 'ON', offLabel = 'OFF', focused, onMouseMove, onClick }: ToggleProps) {
  return (
    <div className={`setting-row${focused ? ' focused' : ''}`} onMouseMove={onMouseMove} onClick={onClick}>
      <span className="setting-label">{label}</span>
      <span className="toggle">
        <span className={`toggle-opt${value ? '' : ' on'}`}>{offLabel}</span>
        <span className={`toggle-opt${value ? ' on' : ''}`}>{onLabel}</span>
      </span>
    </div>
  );
}
