import type { HudState, Vec2 } from '../../shared/contracts';
import { PLAYER_CAR_ID } from '../../shared/contracts';
import { outlineBounds, TrackOutline } from '../components/TrackOutline';

const WIDTH_PX = 180; // design width at a 16px root (.minimap is 11.25rem)

export function Minimap({ path, cars }: { path: readonly Vec2[]; cars: HudState['minimap']['cars'] }) {
  // Dot sizes are given in screen pixels and converted to track meters for the viewBox.
  const px = outlineBounds(path).w / WIDTH_PX;
  // Player last so its dot is drawn on top.
  const ordered = [...cars].sort((a, b) => (a.id === PLAYER_CAR_ID ? 1 : 0) - (b.id === PLAYER_CAR_ID ? 1 : 0));
  return (
    <div className="hud-pill minimap">
      <TrackOutline points={path}>
        {ordered.map((c) => {
          const player = c.id === PLAYER_CAR_ID;
          const r = (player ? 4.5 : 3.5) * px;
          return (
            <circle
              key={c.id}
              cx={c.pos.x}
              cy={c.pos.y}
              r={r}
              fill={c.wrecked ? 'none' : c.color}
              stroke={player ? '#fff' : c.wrecked ? c.color : 'none'}
              strokeWidth={(player ? 2 : 1.5) * px}
            />
          );
        })}
      </TrackOutline>
    </div>
  );
}
