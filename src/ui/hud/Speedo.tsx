import { formatKmh } from '../format';

// Display scale only: a stock Raven tops out near 125 km/h, upgrades plus turbo reach ~200.
const MAX_KMH = 200;
// 240-degree arc, open at the bottom, in a 100x80 box.
const ARC = 'M 17.09 69 A 38 38 0 1 1 82.91 69';

export function Speedo({ kmh }: { kmh: number }) {
  const t = Math.min(1, Math.abs(kmh) / MAX_KMH);
  return (
    <div className="hud-pill speedo">
      <svg viewBox="0 0 100 80" aria-hidden="true">
        <path className="speedo-arc track" d={ARC} pathLength={100} />
        <path className="speedo-arc value" d={ARC} pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 - t * 100} />
      </svg>
      <div className="speedo-read">
        <span className="speedo-n">{formatKmh(kmh)}</span>
        <span className="speedo-unit">KM/H</span>
      </div>
    </div>
  );
}
