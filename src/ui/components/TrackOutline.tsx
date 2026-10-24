import type { ReactNode } from 'react';
import type { Vec2 } from '../../shared/contracts';

const MARGIN = 10; // m around the track bounds

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** viewBox of the points' bounds plus a 10 m margin. Sim +y is down, like SVG, so north stays up. */
export function outlineBounds(points: readonly Vec2[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!points.length) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: minX - MARGIN, y: minY - MARGIN, w: maxX - minX + 2 * MARGIN, h: maxY - minY + 2 * MARGIN };
}

/** Closed track loop as SVG; children are drawn in track meters on top (minimap dots). */
export function TrackOutline({ points, className = '', children }: { points: readonly Vec2[]; className?: string; children?: ReactNode }) {
  const b = outlineBounds(points);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('') + 'Z';
  return (
    <svg className={`track-outline ${className}`} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={d} vectorEffect="non-scaling-stroke" />
      {children}
    </svg>
  );
}
