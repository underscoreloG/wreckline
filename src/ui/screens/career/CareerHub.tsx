import { getCar } from '../../../content/cars';
import { computeStats } from '../../../content/economy';
import { rankOf } from '../../../meta/career';
import type { UiState } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { useUi } from '../../uiContext';
import { Cash, HpBar } from './parts';

export function CareerHub({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const items = [
    { label: 'RACE', onConfirm: () => dispatch({ type: 'navigate', screen: 'raceSelect' }) },
    { label: 'GARAGE', onConfirm: () => dispatch({ type: 'navigate', screen: 'garage' }) },
    { label: 'SHOP', onConfirm: () => dispatch({ type: 'navigate', screen: 'shop' }) },
    { label: 'STANDINGS', onConfirm: () => dispatch({ type: 'navigate', screen: 'standings' }) },
    { label: 'SAVE & QUIT', onConfirm: () => dispatch({ type: 'navigate', screen: 'title' }) },
  ];
  const { itemProps } = useMenuFocus(items);
  const save = state.save;
  if (!save) return null;
  const car = getCar(save.carDefId);
  const maxHp = computeStats(car, save.upgrades).maxHp;

  return (
    <div className="screen scrim">
      <div className="hub">
        <Panel className="hub-card">
          <span className="eyebrow display muted">Career</span>
          <h2 className="hub-car display">{car.name}</h2>
          <Cash value={save.cash} className="hub-cash display" />
          <div className="kv-grid num">
            <span className="muted">RANK</span>
            <span>
              #{rankOf(save)} <span className="muted">/ {save.rivals.length + 1}</span>
            </span>
            <span className="muted">POINTS</span>
            <span>{save.points}</span>
            <span className="muted">RACES</span>
            <span>{save.racesRun}</span>
            <span className="muted">WINS</span>
            <span>{save.wins}</span>
          </div>
          <div className="hub-hp">
            <span className="muted">HP</span>
            <HpBar hp={save.hp} maxHp={maxHp} />
            <span className="num">{Math.round(save.hp)}</span>
          </div>
          {save.hp <= 0 && <p className="warn-text">Wrecked: repair before racing</p>}
        </Panel>
        <nav className="menu hub-menu">
          {items.map((it, i) => (
            <Button key={it.label} label={it.label} primary={i === 0} index={i} {...itemProps(i)} />
          ))}
        </nav>
      </div>
    </div>
  );
}
