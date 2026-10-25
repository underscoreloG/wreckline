import { useMemo } from 'react';
import { CARS, getCar } from '../../../content/cars';
import { computeStats, MAX_UPGRADE_LEVEL, repairCost } from '../../../content/economy';
import { PLAYER_LIVERY } from '../../../content/liveries';
import { affordableRepairHp, partialRepairHp } from '../../../meta/shop';
import type { CarMeshSpec, CarStats, UiState } from '../../../shared/contracts';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { useMenuFocus } from '../../hooks/useMenuFocus';
import { useUi } from '../../uiContext';
import { CarPreview } from './CarPreview';
import { formatCash, HpBar } from './parts';

const STATS: readonly { key: keyof CarStats; label: string; fmt: (v: number) => string }[] = [
  { key: 'maxSpeed', label: 'Speed', fmt: (v) => `${Math.round(v * 3.6)} km/h` },
  { key: 'accel', label: 'Accel', fmt: (v) => v.toFixed(1) },
  { key: 'grip', label: 'Grip', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'maxHp', label: 'Armor', fmt: (v) => `${Math.round(v)} hp` },
  { key: 'gunDps', label: 'Gun', fmt: (v) => `${Math.round(v)} dps` },
];

const MAXED = { engine: MAX_UPGRADE_LEVEL, tires: MAX_UPGRADE_LEVEL, armor: MAX_UPGRADE_LEVEL, gun: MAX_UPGRADE_LEVEL, fuel: 0, spikes: 0 };
/** Bar scale per stat: the best fully upgraded car in the roster fills the bar. */
const SCALE = Object.fromEntries(STATS.map((s) => [s.key, Math.max(...Object.values(CARS).map((c) => computeStats(c, MAXED)[s.key]))])) as Record<keyof CarStats, number>;

function StatBar({ label, base, value, max, text }: { label: string; base: number; value: number; max: number; text: string }) {
  const pct = (v: number): string => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="stat-row">
      <span className="muted">{label}</span>
      <div className="bar stat-bar">
        <div className="bar-fill stat-up" style={{ width: pct(value) }} />
        <div className="bar-fill stat-base" style={{ width: pct(base) }} />
      </div>
      <span className="num">{text}</span>
    </div>
  );
}

export function Garage({ state }: { state: UiState }) {
  const { dispatch } = useUi();
  const save = state.save;
  const car = save ? getCar(save.carDefId) : null;
  const stats = car && save ? computeStats(car, save.upgrades) : null;
  const missing = stats && save ? Math.max(0, stats.maxHp - save.hp) : 0;
  const quarter = save ? partialRepairHp(save) : 0;
  const affordable = save ? affordableRepairHp(save) : 0;
  // REPAIR MAX only when it differs from both FULL and nothing; unaffordable repairs stay enabled (shop refuses with a toast).
  const showMax = affordable > 0 && affordable < missing;
  const repairs: { label: string; hp: number; amount: number | 'full' }[] = [
    { label: 'REPAIR +25%', hp: quarter, amount: quarter },
    ...(showMax ? [{ label: 'REPAIR MAX', hp: affordable, amount: affordable }] : []),
    { label: 'REPAIR FULL', hp: missing, amount: 'full' },
  ];
  const { itemProps } = useMenuFocus(
    [
      ...repairs.map((r) => ({ disabled: missing <= 0, onConfirm: () => dispatch({ type: 'repair', amount: r.amount }) })),
      { onConfirm: () => dispatch({ type: 'back' }) },
    ],
    repairs.length + 1,
  );
  // Bought bumper spikes show on the turntable; memoized so a re-render does not rebuild the preview renderer.
  const spikes = save?.upgrades.spikes ?? 0;
  const mesh = useMemo<CarMeshSpec | null>(() => (car ? { ...car.mesh, spikes } : null), [car, spikes]);
  if (!save || !car || !stats || !mesh) return null;

  return (
    <div className="screen scrim">
      <Panel className="screen-panel garage-panel">
        <h2 className="screen-title display">Garage</h2>
        <p className="screen-sub muted display">{car.name}</p>
        <div className="garage-body">
          <CarPreview spec={mesh} color={PLAYER_LIVERY} />
          <div className="garage-stats">
            {STATS.map((s) => (
              <StatBar key={s.key} label={s.label} base={car.base[s.key]} value={stats[s.key]} max={SCALE[s.key]} text={s.fmt(stats[s.key])} />
            ))}
            <div className="stat-row hp-row">
              <span className="muted">HP</span>
              <HpBar hp={save.hp} maxHp={stats.maxHp} />
              <span className="num">
                {Math.round(save.hp)} / {stats.maxHp}
              </span>
            </div>
            <p className="garage-supplies muted num">
              {save.mines} mines · {save.turbo.toFixed(1)} s rocket fuel
            </p>
          </div>
        </div>
        <div className="actions">
          {repairs.map((r, i) => (
            <Button key={r.label} label={r.label} note={missing > 0 ? formatCash(repairCost(car, r.hp)) : undefined} primary={missing > 0 && r.amount === 'full'} index={i} {...itemProps(i)} />
          ))}
          <Button label="BACK" index={repairs.length} {...itemProps(repairs.length)} />
        </div>
      </Panel>
    </div>
  );
}
