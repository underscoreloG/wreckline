import type { MouseEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { getTrack } from '../../../content/tracks';
import type { RaceTier, Vec2 } from '../../../shared/contracts';
import { buildTrackGeometry } from '../../../shared/trackGeometry';
import type { MenuItemProps } from '../../hooks/useMenuFocus';

export const formatCash = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

export const TIER_LABEL: Record<RaceTier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard', boss: 'Boss' };

/** Cash counter that flashes when the value changes (buying, payouts). */
export function Cash({ value, className = '' }: { value: number; className?: string }) {
  const last = useRef(value);
  const [flashes, setFlashes] = useState(0);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    setFlashes((n) => n + 1);
  }, [value]);
  // Re-keying restarts the CSS flash animation on every change.
  return (
    <span key={flashes} className={`cash num${flashes ? ' cash-flash' : ''} ${className}`}>
      {formatCash(value)}
    </span>
  );
}

/** HP bar in the HUD colors (design.md: > 60% ok, > 25% warning, else danger). */
export function HpBar({ hp, maxHp }: { hp: number; maxHp: number }) {
  const f = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
  const tone = f > 0.6 ? 'ok' : f > 0.25 ? 'mid' : 'low';
  return (
    <div className="bar segmented">
      <div className={`bar-fill hp-fill ${tone}`} style={{ width: `${f * 100}%` }} />
    </div>
  );
}

const keepDomFocus = (e: MouseEvent): void => e.preventDefault();

/** A focusable card for menus (shop tiles, offer cards); same nav and mouse rules as Button. */
export function Tile({ children, className = '', index = 0, focused, disabled, onMouseMove, onClick }: MenuItemProps & { children: ReactNode; className?: string; index?: number }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`tile stagger${focused ? ' focused' : ''} ${className}`}
      style={{ animationDelay: `${index * 30}ms` }}
      disabled={disabled}
      onMouseDown={keepDomFocus}
      onMouseMove={onMouseMove}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const MINIMAP_STEP = 8; // m between outline points, same as the race minimap
const paths = new Map<string, Vec2[]>();

/** Decimated centerline of a track for TrackOutline, cached per track. */
export function trackPath(trackId: string): Vec2[] {
  let p = paths.get(trackId);
  if (!p) {
    const geo = buildTrackGeometry(getTrack(trackId));
    const every = Math.max(1, Math.round(MINIMAP_STEP / (geo.length / geo.samples.length)));
    p = geo.samples.filter((_, i) => i % every === 0).map((s) => ({ x: s.pos.x, y: s.pos.y }));
    paths.set(trackId, p);
  }
  return p;
}
