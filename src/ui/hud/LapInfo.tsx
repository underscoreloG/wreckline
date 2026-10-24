import { formatTime } from '../format';

export function LapInfo({ lap, laps, lapTime, bestLap }: { lap: number; laps: number; lapTime: number; bestLap: number | null }) {
  return (
    <div className="hud-pill lap-info">
      <span className="k">LAP</span>
      <span>
        {lap}/{laps}
      </span>
      <span className="k">TIME</span>
      <span>{formatTime(lapTime)}</span>
      <span className="k">BEST</span>
      <span>{bestLap === null ? '-:--.--' : formatTime(bestLap)}</span>
    </div>
  );
}
