import type { KillFeedItem } from '../../shared/contracts';

const LIFE = 4; // s, items expire after 4 s (contracts)
const FADE_AT = 3.6; // s, the opacity transition covers the last 0.4 s
const MAX_LINES = 3;

export function KillFeed({ items, raceTime }: { items: readonly KillFeedItem[]; raceTime: number }) {
  const live = items.filter((it) => raceTime - it.time < LIFE).slice(-MAX_LINES);
  return (
    <div className="kill-feed">
      {live.map((it) => (
        <div key={it.id} className="hud-pill" style={{ opacity: raceTime - it.time >= FADE_AT ? 0 : 1 }}>
          {it.text}
        </div>
      ))}
    </div>
  );
}
