import { useState } from 'react';
import { getCar } from '../../../content/cars';
import { computeStats, MAX_LEVEL, MINE_PRICE, repairCost, SHOP_MINES_CAP, SHOP_TURBO_CAP, TURBO_PRICE_PER_SECOND, UPGRADE_ADDS, UPGRADE_EFFECTS } from '../../../content/economy';
import { nextUpgradeCost, shopCars, tradeInValue } from '../../../meta/shop';
import type { CarStats, GameCommand, SaveGame, UiState, UpgradeKind } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Keycap } from '../../components/Keycap';
import { Panel } from '../../components/Panel';
import type { MenuItem } from '../../hooks/useMenuFocus';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { useUi } from '../../uiContext';
import { Cash, formatCash, Tile } from './parts';

const TABS = ['upgrades', 'supplies', 'cars'] as const;
type Tab = (typeof TABS)[number];

const STAT_TEXT: Partial<Record<keyof CarStats, string>> = {
  maxSpeed: 'top speed',
  accel: 'accel',
  grip: 'grip',
  turnRate: 'turning',
  maxHp: 'armor',
  gunDps: 'gun damage',
  turboSpeedMult: 'fuel speed',
  turboAccelMult: 'fuel thrust',
  ramDealtMult: 'ram damage',
  ramTakenMult: 'ram damage taken',
};

/** Shop names (content.md naming note); the code ids stay fuel / spikes. */
const UPGRADE_TITLE: Partial<Record<UpgradeKind, string>> = { fuel: 'Rocket fuel', spikes: 'Bumper spikes' };

const pct = (k: number): string => `${k < 0 ? '-' : '+'}${Math.round(Math.abs(k) * 100)}%`;

/** "+5% top speed, +6% accel" from the content tables (multiplicative, then additive), so WP12 tuning shows up here as is. */
const deltaText = (kind: UpgradeKind): string =>
  [
    ...(Object.entries(UPGRADE_EFFECTS[kind]) as [keyof CarStats, number][]).map(([stat, mult]) => `${pct(mult - 1)} ${STAT_TEXT[stat] ?? stat}`),
    ...(Object.entries(UPGRADE_ADDS[kind]) as [keyof CarStats, number][]).map(([stat, step]) => `${pct(step)} ${STAT_TEXT[stat] ?? stat}`),
  ].join(', ');

interface Offer {
  key: string;
  title: string;
  detail: string;
  cost: number | null; // null = maxed / nothing to buy
  extra?: string;
  cmd: GameCommand;
}

function offersFor(tab: Tab, save: SaveGame): Offer[] {
  const car = getCar(save.carDefId);
  if (tab === 'upgrades') {
    return (Object.keys(UPGRADE_EFFECTS) as UpgradeKind[]).map((kind) => ({
      key: kind,
      title: UPGRADE_TITLE[kind] ?? kind,
      detail: deltaText(kind),
      cost: nextUpgradeCost(save, kind),
      extra: String(save.upgrades[kind]),
      cmd: { type: 'buyUpgrade', kind },
    }));
  }
  if (tab === 'supplies') {
    const missing = Math.max(0, computeStats(car, save.upgrades).maxHp - save.hp);
    return [
      { key: 'repair', title: 'Repair', detail: `${Math.round(save.hp)} / ${computeStats(car, save.upgrades).maxHp} hp`, cost: missing > 0 ? repairCost(car, missing) : null, cmd: { type: 'repair', amount: 'full' } },
      { key: 'mines', title: 'Mine x1', detail: `${save.mines} / ${SHOP_MINES_CAP} carried`, cost: save.mines < SHOP_MINES_CAP ? MINE_PRICE : null, cmd: { type: 'buyMines', count: 1 } },
      { key: 'turbo', title: 'Rocket fuel +1 s', detail: `${save.turbo.toFixed(1)} / ${SHOP_TURBO_CAP} s carried`, cost: save.turbo < SHOP_TURBO_CAP ? Math.ceil(Math.min(1, SHOP_TURBO_CAP - save.turbo) * TURBO_PRICE_PER_SECOND) : null, cmd: { type: 'buyTurbo', seconds: 1 } },
    ];
  }
  const tradeIn = tradeInValue(save);
  return shopCars(save).map((c) => {
    const s = c.base;
    return {
      key: c.id,
      title: c.name,
      detail: `${Math.round(s.maxSpeed * 3.6)} km/h · ${s.maxHp} hp · ${s.gunDps} dps`,
      cost: Math.max(0, c.price - tradeIn),
      extra: `Price ${formatCash(c.price)}${tradeIn > 0 ? ` - trade-in ${formatCash(tradeIn)}` : ''} · upgrades lost`,
      cmd: { type: 'buyCar', carDefId: c.id },
    };
  });
}

function Pips({ level, max }: { level: number; max: number }) {
  return (
    <span className="pips">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`pip${i < level ? ' on' : ''}`} />
      ))}
    </span>
  );
}

function TabList({ tab, save, setTab }: { tab: Tab; save: SaveGame; setTab: (t: Tab) => void }) {
  const { dispatch } = useUi();
  const offers = offersFor(tab, save);
  const shift = (d: number) => () => setTab(TABS[Math.min(TABS.length - 1, Math.max(0, TABS.indexOf(tab) + d))]!);
  const side = { onLeft: shift(-1), onRight: shift(1) };
  const items: MenuItem[] = [...offers.map((o) => ({ ...side, onConfirm: () => dispatch(o.cmd) })), { ...side, onConfirm: () => dispatch({ type: 'back' }) }];
  const { itemProps } = useMenuFocus(items);
  return (
    <>
      <div className={`shop-list shop-${tab}`}>
        {offers.length === 0 && <p className="muted">Nothing for sale.</p>}
        {offers.map((o, i) => {
          const poor = o.cost !== null && o.cost > save.cash;
          return (
            <Tile key={o.key} index={i} className={`shop-tile${poor || o.cost === null ? ' dim' : ''}`} {...itemProps(i)}>
              <span className="tile-main">
                <span className="tile-title display">{o.title}</span>
                <span className="tile-detail muted">{o.detail}</span>
                {tab === 'cars' && o.extra && <span className="tile-detail muted">{o.extra}</span>}
              </span>
              {tab === 'upgrades' && <Pips level={Number(o.extra)} max={MAX_LEVEL[o.key as UpgradeKind]} />}
              <span className={`tile-cost num display${poor ? ' poor' : ''}`}>{o.cost === null ? (tab === 'upgrades' ? 'MAX' : 'FULL') : formatCash(o.cost)}</span>
            </Tile>
          );
        })}
      </div>
      <div className="actions">
        <Button label="BACK" {...itemProps(offers.length)} />
      </div>
    </>
  );
}

export function Shop({ state }: { state: UiState }) {
  const [tab, setTab] = useState<Tab>('upgrades');
  const save = state.save;
  if (!save) return null;
  return (
    <div className="screen scrim">
      <Panel className="screen-panel shop-panel">
        <div className="panel-head">
          <h2 className="screen-title display">Shop</h2>
          <Cash value={save.cash} className="head-cash display" />
        </div>
        <div className="tabs display">
          <Keycap label="←" />
          {TABS.map((t) => (
            <button key={t} type="button" tabIndex={-1} className={`tab${t === tab ? ' on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
          <Keycap label="→" />
        </div>
        {/* Keyed by tab: the list remounts, so focus starts on its first tile. */}
        <TabList key={tab} tab={tab} save={save} setTab={setTab} />
      </Panel>
    </div>
  );
}
