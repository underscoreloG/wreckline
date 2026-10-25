import type { CSSProperties } from 'react';
import type { UiState } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { useUi } from '../../uiContext';
import { formatCash } from './parts';

const CONFETTI = 48;
const COLORS = ['var(--accent)', 'var(--cash)', 'var(--warning)', 'var(--info)', 'var(--text)'];

// Deterministic spread (golden-ratio steps) so the confetti looks random without a RNG.
const pieces: CSSProperties[] = Array.from({ length: CONFETTI }, (_, i) => {
  const f = (i * 0.618034) % 1;
  return {
    left: `${f * 100}%`,
    background: COLORS[i % COLORS.length],
    animationDelay: `${((i * 0.37) % 1) * -4}s`,
    animationDuration: `${3 + ((i * 0.53) % 1) * 2.5}s`,
    ['--drift' as string]: `${(f - 0.5) * 12}rem`,
  };
});

export function Champion({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const { itemProps } = useMenuFocus(
    [{ onConfirm: () => dispatch({ type: 'newCareer' }) }, { onConfirm: () => dispatch({ type: 'navigate', screen: 'title' }) }],
    2,
  );
  const save = state.save;
  return (
    <div className="screen scrim champion-screen">
      <div className="confetti" aria-hidden="true">
        {pieces.map((s, i) => (
          <span key={i} style={s} />
        ))}
      </div>
      <Panel className="screen-panel champion-panel">
        <span className="eyebrow display muted">The Warden is down</span>
        <h1 className="champion-title display">Champion</h1>
        {save && (
          <div className="champion-stats num">
            <span>
              <b className="display">{save.racesRun}</b>
              <span className="muted">RACES</span>
            </span>
            <span>
              <b className="display">{save.wins}</b>
              <span className="muted">WINS</span>
            </span>
            <span>
              <b className="display">{save.points}</b>
              <span className="muted">POINTS</span>
            </span>
            <span>
              <b className="display cash">{formatCash(save.cash)}</b>
              <span className="muted">CASH</span>
            </span>
          </div>
        )}
        <div className="actions center">
          <Button label="NEW CAREER" primary {...itemProps(0)} />
          <Button label="TITLE" index={1} {...itemProps(1)} />
        </div>
      </Panel>
    </div>
  );
}
