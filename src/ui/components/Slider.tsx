import type { PointerEvent } from 'react';
import type { MenuItemProps } from '../hooks/useMenuFocus';

export interface SliderProps extends Omit<MenuItemProps, 'onClick'> {
  label: string;
  value: number; // 0..100
  step: number;
  onChange: (v: number) => void;
}

/** Settings row with a 0-100 bar. Left/right come from the screen's menu items; the mouse can click or drag the bar. */
export function Slider({ label, value, step, onChange, focused, onMouseMove }: SliderProps) {
  const fromPointer = (e: PointerEvent<HTMLDivElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.round((t * 100) / step) * step;
    if (v !== value) onChange(v);
  };
  return (
    <div className={`setting-row${focused ? ' focused' : ''}`} onMouseMove={onMouseMove}>
      <span className="setting-label">{label}</span>
      <span className="slider">
        <div
          className="slider-track"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            fromPointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons & 1) fromPointer(e);
          }}
        >
          <div className="slider-fill" style={{ width: `${value}%` }} />
        </div>
        <span className="slider-value num">{value}</span>
      </span>
    </div>
  );
}
