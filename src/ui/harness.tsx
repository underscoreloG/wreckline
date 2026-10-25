import type { CSSProperties, MouseEvent } from 'react';
import { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { createInputSource } from '../input';
import type { Screen } from '../shared/contracts';
import { App } from './App';
import type { FakeStore } from './fakeStore';
import { createFakeStore } from './fakeStore';
import type { HudFixture } from './fixtures';
import { CAREER_SCREENS, fixtureHud, fixtureState } from './fixtures';

const SCREENS: readonly Screen[] = ['boot', 'title', 'controls', 'settings', 'preRace', 'race', 'paused', 'results', ...CAREER_SCREENS];
const HUDS: readonly HudFixture[] = ['countdown', 'mid', 'critical'];

const bar: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 8,
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 4,
  padding: 4,
  borderRadius: 6,
  background: 'rgba(0,0,0,0.6)',
  font: '11px ui-monospace, monospace',
  zIndex: 10,
};
const chip = (on: boolean): CSSProperties => ({
  padding: '2px 6px',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 4,
  background: on ? '#FF5A1F' : 'transparent',
  color: on ? '#120700' : '#ccc',
  font: 'inherit',
  cursor: 'pointer',
});
// Keep DOM focus off the switcher so Enter/Space never re-click it.
const noFocus = (e: MouseEvent): void => e.preventDefault();

function Switcher({ store }: { store: FakeStore }) {
  const s = useSyncExternalStore(store.subscribe, store.getState);
  const hudKind = HUDS.find((k) => JSON.stringify(fixtureHud(k)) === JSON.stringify(s.hud));
  return (
    <div style={bar}>
      {SCREENS.map((sc) => (
        <button key={sc} tabIndex={-1} style={chip(s.screen === sc)} onMouseDown={noFocus} onClick={() => store.replace({ ...fixtureState(sc), hud: s.hud, usingGamepad: s.usingGamepad })}>
          {sc}
        </button>
      ))}
      <span style={{ width: 8 }} />
      {HUDS.map((k) => (
        <button key={k} tabIndex={-1} style={chip(hudKind === k)} onMouseDown={noFocus} onClick={() => store.replace({ ...s, hud: fixtureHud(k) })}>
          {k}
        </button>
      ))}
      <button tabIndex={-1} style={chip(s.usingGamepad)} onMouseDown={noFocus} onClick={() => store.replace({ ...s, usingGamepad: !s.usingGamepad })}>
        pad
      </button>
    </div>
  );
}

/** `?harness=ui&screen=<Screen>[&hud=countdown|mid|critical][&career=1]`, fake store at window.__harness.store. */
export function mountUiHarness(root: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const screen = (SCREENS as readonly string[]).includes(params.get('screen') ?? '') ? (params.get('screen') as Screen) : 'title';
  const hud = (HUDS as readonly string[]).includes(params.get('hud') ?? '') ? (params.get('hud') as HudFixture) : 'mid';
  const career = params.get('career') === '1' || CAREER_SCREENS.includes(screen);
  const store = createFakeStore(fixtureState(screen, hud, career));
  const input = createInputSource(window);
  const nav = (cb: Parameters<typeof input.onNav>[0]) => input.onNav(cb);
  window.__harness = { store };
  // Stand-in for the game canvas so blur, scrims and HUD pills read as they will over the race.
  document.body.style.background = 'radial-gradient(ellipse at 60% 40%, #2a2622 0%, #1b1e26 55%, #0b0d10 100%)';
  createRoot(root).render(
    <>
      <App store={store} nav={nav} onUiSound={(s) => console.debug('[ui sound]', s)} />
      <Switcher store={store} />
    </>,
  );
}
