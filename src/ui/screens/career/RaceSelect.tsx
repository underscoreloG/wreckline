import { getTrack } from '../../../content/tracks';
import { BOSS } from '../../../content/rivals';
import { ladder } from '../../../meta/career';
import type { UiState } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { TrackOutline } from '../../components/TrackOutline';
import type { MenuItem } from '../../hooks/useMenuFocus';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { ordinal } from '../../format';
import { useUi } from '../../uiContext';
import { formatCash, TIER_LABEL, Tile, trackPath } from './parts';

export function RaceSelect({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const offers = state.offers ?? [];
  const items: MenuItem[] = [...offers.map((o) => ({ onConfirm: () => dispatch({ type: 'selectOffer', offerId: o.id }) })), { onConfirm: () => dispatch({ type: 'back' }) }];
  const { itemProps } = useMenuFocus(items, Math.max(1, offers.length));
  const save = state.save;
  if (!save) return null;
  const rows = ladder(save);
  const rankOf = new Map(rows.map((r, i) => [r.driverId, i + 1]));
  const colorOf = new Map(save.rivals.map((r) => [r.driverId, r.color]));

  return (
    <div className="screen scrim">
      <Panel className="screen-panel race-select-panel">
        <h2 className="screen-title display">Race select</h2>
        <div className="offers">
          {offers.map((o, i) => {
            const track = getTrack(o.trackId);
            return (
              <Tile key={o.id} index={i} className={`offer tier-${o.tier}`} {...itemProps(i)}>
                <span className="offer-head">
                  <span className="offer-tier display">{TIER_LABEL[o.tier]}</span>
                  <span className="muted display">{o.laps} laps</span>
                </span>
                <span className="offer-track display">{track.name}</span>
                <span className="offer-outline">
                  <TrackOutline points={trackPath(o.trackId)} />
                </span>
                <span className="offer-rivals">
                  {o.rivals.map((d) => (
                    <span key={d} className="offer-rival">
                      <span className="swatch" style={{ background: d === BOSS.driverId ? BOSS.trim : (colorOf.get(d) ?? 'var(--muted)') }} />
                      <span className="num muted">{d === BOSS.driverId ? 'BOSS' : `#${rankOf.get(d) ?? '-'}`}</span>
                      <span>{d === BOSS.driverId ? BOSS.name : (save.rivals.find((r) => r.driverId === d)?.name ?? d)}</span>
                    </span>
                  ))}
                </span>
                <span className="prize-table num">
                  {o.prizes.map((p, pos) => (
                    <span key={pos} className="prize-row">
                      <span className="muted">{ordinal(pos + 1)}</span>
                      <span className="cash">{formatCash(p)}</span>
                      <span className="muted">{o.points[pos] ?? 0} pts</span>
                    </span>
                  ))}
                </span>
              </Tile>
            );
          })}
        </div>
        <div className="actions">
          <Button label="BACK" {...itemProps(offers.length)} />
        </div>
      </Panel>
    </div>
  );
}
