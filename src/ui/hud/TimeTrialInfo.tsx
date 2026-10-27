import '../timeTrial.css';
import type { TimeTrialHud } from '../../shared/contracts';
import { formatTime } from '../format';

/** "+0.42" / "-0.31": the live gap to the best lap at the same distance, hundredths. */
export function formatDelta(delta: number): string {
  const cs = Math.round(Math.abs(delta) * 100);
  const sign = cs === 0 ? '±' : delta > 0 ? '+' : '-';
  return `${sign}${Math.floor(cs / 100)}.${String(cs % 100).padStart(2, '0')}`;
}

const time = (t: number | null): string => (t === null ? '-:--.--' : formatTime(t));

/** WP40: the time trial readout in place of the race LAP pill: lap, clock, best, last, and the delta to the best. */
export function TimeTrialInfo({ lap, lapTime, trial }: { lap: number; lapTime: number; trial: TimeTrialHud }) {
  const d = trial.delta;
  return (
    <>
      <div className="hud-pill lap-info">
        <span className="k">LAP</span>
        <span>{lap}</span>
        <span className="k">TIME</span>
        <span>{formatTime(lapTime)}</span>
        <span className="k">BEST</span>
        <span>{time(trial.best)}</span>
        <span className="k">LAST</span>
        <span>{time(trial.last)}</span>
      </div>
      {d !== null && <div className={`hud-pill tt-delta ${d > 0.005 ? 'slower' : d < -0.005 ? 'faster' : ''}`}>{formatDelta(d)}</div>}
    </>
  );
}
