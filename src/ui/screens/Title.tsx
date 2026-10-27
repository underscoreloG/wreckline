import { useEffect, useState } from 'react';
import type { UiState } from '../../shared/contracts';
import { Button } from '../components/Button';
import type { MenuItem } from '../hooks/useMenuFocus';
import { useMenuFocus } from '../hooks/useMenuFocus';
import { useUi } from '../uiContext';

type Menu = 'main' | 'career' | 'confirm';
type Item = MenuItem & { label: string; note?: string };

function MenuList({ items }: { items: Item[] }) {
  const { itemProps } = useMenuFocus(items);
  return (
    <>
      {items.map((it, i) => (
        <Button key={it.label} label={it.label} note={it.note} index={i} {...itemProps(i)} />
      ))}
    </>
  );
}

export function Title({ state }: { state: UiState }) {
  const ui = useUi();
  const { dispatch } = ui;
  const [menu, setMenu] = useState<Menu>('main');
  const hasSave = state.save !== null;

  // App forwards Esc / B on the title so a sub-menu can close.
  useEffect(
    () =>
      ui.onNav((n) => {
        if (n !== 'back' || menu === 'main') return;
        ui.sound('back');
        setMenu(menu === 'confirm' ? 'career' : 'main');
      }),
    [ui, menu],
  );

  const items: Record<Menu, Item[]> = {
    main: [
      { label: 'QUICK RACE', onConfirm: () => dispatch({ type: 'startQuickRace' }) },
      { label: 'TIME TRIAL', onConfirm: () => dispatch({ type: 'navigate', screen: 'timeTrial' }) },
      { label: 'CAREER', onConfirm: () => (hasSave ? setMenu('career') : dispatch({ type: 'newCareer' })) },
      { label: 'CONTROLS', onConfirm: () => dispatch({ type: 'navigate', screen: 'controls' }) },
      { label: 'SETTINGS', onConfirm: () => dispatch({ type: 'navigate', screen: 'settings' }) },
    ],
    career: [
      { label: 'CONTINUE', onConfirm: () => dispatch({ type: 'continueCareer' }) },
      { label: 'NEW CAREER', onConfirm: () => setMenu('confirm') },
      { label: 'BACK', onConfirm: () => setMenu('main') },
    ],
    confirm: [
      // Cancel first: a double Enter must not wipe the save.
      { label: 'CANCEL', onConfirm: () => setMenu('career') },
      { label: 'OVERWRITE', onConfirm: () => dispatch({ type: 'newCareer' }) },
    ],
  };

  return (
    <div className="screen title-screen">
      <div className="title-col">
        <h1 className="wordmark display">WRECKLINE</h1>
        <nav className="menu">
          {menu === 'confirm' && <p className="menu-prompt display">Overwrite current career?</p>}
          {menu === 'career' && <p className="menu-prompt display muted">Career</p>}
          {/* Keyed so each menu mounts with its own focus, starting on the first item. */}
          <MenuList key={menu} items={items[menu]} />
        </nav>
      </div>
      <span className="version muted">v{state.version}</span>
    </div>
  );
}
