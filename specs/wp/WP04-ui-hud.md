# WP04 - UI shell and HUD

Goal: every M1 screen and the race HUD exist as React components, styled to the design system, fully keyboard/gamepad navigable, driven only by `GameStore`.
Read first: `SPEC.md`, `specs/contracts.ts` (UiState, HudState, GameCommand, GameStore, Settings), `specs/design.md` sections 4-5.
Depends on: WP00. Develop against fixtures and a fake store; the real store comes from WP08.
Owns: `src/ui/**` except `src/ui/screens/career/**` and `src/ui/career.css` (WP10). Anything else needs a CCR.

## Deliverables

| File | Exports / does |
|---|---|
| `App.tsx` | `App({ store, nav, onUiSound }: { store: GameStore; nav: (cb: (n: UiNav) => void) => () => void; onUiSound?: (s: UiSound) => void })` (the frozen WP00 stub signature; `onUiSound` is called on focus move, confirm, back): subscribes with `useSyncExternalStore`, renders the screen for `state.screen`, screen transitions |
| `theme.css` | tokens from design.md section 4 + base styles, `@fontsource` imports (chakra-petch 600/700, inter 400/500/600) |
| `components/Button.tsx`, `Panel.tsx`, `KeyHints.tsx`, `Slider.tsx`, `Toggle.tsx`, `Keycap.tsx`, `TrackOutline.tsx` (SVG from `Vec2[]`) | design system primitives |
| `hooks/useMenuFocus.ts` | focus model for vertical lists and grids; wires `nav` events; mouse hover sets focus; returns `{ focused, setFocused, itemProps(i) }` |
| `screens/Title.tsx`, `Controls.tsx`, `Settings.tsx`, `PreRace.tsx`, `Pause.tsx`, `Results.tsx`, `Boot.tsx` | M1 screens per design.md section 5 |
| `hud/Hud.tsx` + `Position.tsx`, `LapInfo.tsx`, `Minimap.tsx`, `KillFeed.tsx`, `Vitals.tsx` (hp, turbo, mines, heat), `Speedo.tsx`, `Banner.tsx`, `HitFlash.tsx` | race HUD |
| `format.ts` | `formatTime(s) -> "1:07.42"`, `formatKmh`, `ordinal(n) -> "1st"` + tests |
| `fixtures.ts` | `fixtureState(screen: Screen): UiState` with realistic data for every M1 screen and 3 HUD states (countdown, mid-race, overheated + low hp + wrong way) |
| `fakeStore.ts` | `createFakeStore(initial)`: implements GameStore; `dispatch` logs the command and applies obvious navigation (`navigate`, `back`, `pause`/`resume`) so the harness is clickable |
| `harness.tsx` | `mountUiHarness(root)`: `?harness=ui&screen=<Screen>[&hud=countdown|mid|critical]`; a small floating switcher listing all screens; `window.__harness = { store }` |
| `*.test.ts` | `format.ts`, `useMenuFocus` logic (extract the reducer as a pure function and test it) |

## Behaviour and numbers
- The UI root is a full-viewport layer above the canvas: `pointer-events: none` on the HUD container, `auto` on menus.
- Commands: each button dispatches exactly the `GameCommand` named in its label's row below. Never call game code directly.

| Screen | Items (focus order) -> command |
|---|---|
| title | QUICK RACE -> `startQuickRace`; CAREER -> disabled in M1 (`navigate career` in M2); CONTROLS -> `navigate controls`; SETTINGS -> `navigate settings` |
| controls | BACK -> `back` |
| settings | sliders/toggles -> `setSetting` (patch on every change); BACK -> `back` |
| preRace | START -> `startRace`; BACK -> `back` |
| paused | RESUME -> `resume`; RESTART -> `restartRace`; SETTINGS -> `navigate settings`; QUIT TO MENU -> `quitRace` |
| results | CONTINUE -> `continueFromResults`; RESTART -> `restartRace` (quick race only: hidden when `state.save` is set) |

- Nav mapping (WP05 emits Esc and gamepad Start as `pause`, gamepad B as `back`):
  - `screen === 'race'`: `pause` -> dispatch `pause`; `back` is ignored (gamepad B is the handbrake while racing).
  - `screen === 'paused'`: `pause` or `back` -> `resume`.
  - any other screen: `pause` or `back` -> `back`.
- Sounds: the UI never imports audio. It calls an optional `onUiSound?: (s: UiSound) => void` prop on `App` for move/confirm/back.
- HUD reads `state.hud` only; it re-renders at the store's 15 Hz. Use CSS transitions for smoothness (hp bar width 120 ms), not per-frame React updates.
- Minimap: SVG viewBox from the bounds of `race.minimapPath` + 10 m margin; keep aspect; 180 px wide at root font 16px.
- Controls screen bindings table (fixed, must match WP05):

| Action | Keyboard | Gamepad |
|---|---|---|
| Accelerate | Up | RT |
| Brake / reverse | Down | LT |
| Steer | Left / Right | Left stick, d-pad |
| Fire gun | S | A |
| Drop mine | D | X |
| Turbo | A | Y or RB |
| Handbrake | Space | B |
| Pause | Esc | Start |

- Key hint row (preRace, paused): `[S] FIRE  [D] MINE  [A] TURBO  [SPACE] HANDBRAKE  [ESC] PAUSE`; gamepad version when `usingGamepad`.

## Acceptance tests
- [ ] `npm test -- ui` -> format and focus reducer tests pass (`formatTime(67.421) === '1:07.42'`, focus does not wrap, disabled items are skipped).
- [ ] For every M1 screen: `?harness=ui&screen=<name>` renders with no console errors; screenshot in the report.
- [ ] Keyboard only: from title, Down x3 then Enter opens settings (assert `__harness.store.getState().screen === 'settings'` after the fake store applies `navigate`), Esc goes back.
- [ ] HUD fixtures `countdown`, `mid`, `critical` render; `critical` shows blinking WRONG WAY, red hp, overheated heat bar.
- [ ] Layout holds at 1024x640 and 2560x1440 (screenshots), no text overflow.
- [ ] `prefers-reduced-motion` disables transitions (check computed `transition-duration` is `0s` with emulation).

## Allowed deferrals
None for M1 screens. Career screens are WP10.

## Out of scope
Game logic, real store, audio playback, rebinding keys, mobile layout, i18n (all text English).
