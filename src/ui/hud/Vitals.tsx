import { MAX_MINES_CARRIED, MAX_TURBO_CARRIED } from '../../content/pickups';
import type { HudState } from '../../shared/contracts';

type VitalsProps = Pick<HudState, 'hp' | 'maxHp' | 'turbo' | 'turboActive' | 'mines' | 'gunHeat' | 'gunOverheated'>;

const pct = (v: number): string => `${Math.min(100, Math.max(0, v * 100))}%`;

export function Vitals({ hp, maxHp, turbo, turboActive, mines, gunHeat, gunOverheated }: VitalsProps) {
  const ratio = maxHp > 0 ? hp / maxHp : 0;
  // design.md: --cash above 60%, --warning above 25%, else --danger and pulsing.
  const tone = ratio > 0.6 ? 'ok' : ratio > 0.25 ? 'mid' : 'low';
  return (
    <div className="hud-pill vitals">
      <div className="vital-row">
        <span className="k">HP</span>
        <div className={`bar segmented${tone === 'low' ? ' pulse' : ''}`}>
          <div className={`bar-fill hp-fill ${tone}`} style={{ width: pct(ratio) }} />
        </div>
        <span className="v">{Math.ceil(hp)}</span>
      </div>
      <div className={`vital-row${turboActive ? ' turbo-active' : ''}`}>
        <span className="k">FUEL</span>
        <div className="bar">
          <div className={`bar-fill turbo-fill${turboActive ? ' active' : ''}`} style={{ width: pct(turbo / MAX_TURBO_CARRIED) }} />
        </div>
        <span className="v">{turbo.toFixed(1)}s</span>
      </div>
      <div className="vital-row">
        <span className="k">HEAT</span>
        <div className={`bar thin${gunOverheated ? ' blink' : ''}`}>
          <div className={`bar-fill heat-fill${gunOverheated ? ' hot' : ''}`} style={{ width: pct(gunHeat) }} />
        </div>
        <span className={`v${gunOverheated ? ' hot-text blink' : ''}`}>{gunOverheated ? 'HOT' : `${Math.round(gunHeat * 100)}%`}</span>
      </div>
      <div className="vital-row">
        <span className="k">MINES</span>
        <span className="mines">
          {Array.from({ length: Math.min(mines, MAX_MINES_CARRIED) }, (_, i) => (
            <span key={i} className="mine-icon" />
          ))}
        </span>
        <span className="v">{mines}</span>
      </div>
    </div>
  );
}
