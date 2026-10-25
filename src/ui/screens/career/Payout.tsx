import type { Payout as PayoutT } from '../../../shared/contracts';
import { formatCash } from './parts';

/** Career payout strip under the results table (design.md section 5). */
export function Payout({ payout }: { payout: PayoutT }) {
  const parts: [string, number][] = [
    ['PRIZE', payout.prize],
    ['WRECKS', payout.wreckBonus],
    ['PICKUPS', payout.pickups],
  ];
  return (
    <div className="payout num">
      {parts.map(([k, v]) => (
        <span key={k} className="payout-item">
          <span className="muted">{k}</span>
          <span>{formatCash(v)}</span>
        </span>
      ))}
      <span className="payout-item total">
        <span className="muted">TOTAL</span>
        <span className="cash display">{formatCash(payout.total)}</span>
      </span>
      <span className="payout-item">
        <span className="muted">POINTS</span>
        <span className="display">+{payout.pointsGained}</span>
      </span>
    </div>
  );
}
