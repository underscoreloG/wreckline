import '../arena.css';
import type { ArenaHud } from '../../shared/contracts';
import { formatTime } from '../format';

/** "1:23" fight clock, whole seconds. */
const clock = (t: number): string => formatTime(Math.floor(t)).slice(0, -3);

/** WP41: the arena readout in place of the race position and LAP pill: cars left, fight clock, sudden death. */
export function ArenaInfo({ arena, carCount, raceTime, spectatingName }: { arena: ArenaHud; carCount: number; raceTime: number; spectatingName: string | null }) {
  const sd = arena.suddenDeathIn;
  return (
    <>
      <div className="pos">
        <span className="pos-n">{arena.alive}</span>
        <span className="pos-of">/{carCount} LEFT</span>
      </div>
      <div className="hud-pill lap-info">
        <span className="k">TIME</span>
        <span>{clock(raceTime)}</span>
        {sd > 0 ? (
          <>
            <span className="k">SUDDEN DEATH</span>
            <span>{clock(Math.ceil(sd))}</span>
          </>
        ) : (
          <span className="arena-sd-on blink">SUDDEN DEATH</span>
        )}
      </div>
      {spectatingName && <div className="hud-pill arena-spectating">WATCHING {spectatingName}</div>}
    </>
  );
}
