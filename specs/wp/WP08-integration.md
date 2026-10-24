# WP08 - Game integration

Goal: one playable game: boot, title, quick race, pause, results, settings, with the real sim, renderer, audio, input and UI wired through the store and a fixed-step loop.
Read first: `SPEC.md` (all), `specs/contracts.ts` (all), `specs/design.md` sections 2 and 5, the reports of WP01-05.
Depends on: WP01-WP05 merged. Runs in parallel with WP07 (AI may still be the stub on your branch: use `?autoplay=0` and drive yourself; after WP07 merges, re-run the acceptance checks on main).
Owns: `src/game/**`, `src/main.tsx` (taken over from WP00), `.github/**`, `CHANGELOG.md`. One-line wiring fixes elsewhere only as allowed in SPEC.md section 5, listed in the report.

## Deliverables

| File | Exports / does |
|---|---|
| `src/game/index.ts` | `startGame(root: HTMLElement): Promise<GameHandle>`, `GameHandle = { store: GameStore; dispose(): void }` (frozen WP00 stub signatures) |
| `src/game/store.ts` | `createGameStore(initial: UiState, handler: (cmd) => void): GameStore & { set(patch: Partial<UiState>): void }` (immutable updates, listeners notified once per `set`) |
| `src/game/machine.ts` | screen state machine: commands -> transitions + side effects (table below) |
| `src/game/loop.ts` | `createLoop(onStep, onRender)`: rAF, accumulator, `SIM_DT`, max 5 steps per frame (drop the rest), `alpha`, pause, `stepManual(n)` for tests |
| `src/game/raceSession.ts` | owns one race: sim, renderer, input polling, audio updates, HUD derivation, event buffering |
| `src/game/hud.ts` | `deriveHud(snapshot, events, prevHud, setup): HudState` (pure, unit tested): banners, kill feed (from `carWrecked` with names), `hitFlash` (+0.6 per player damage event, decays 2/s). Banner expiry (1.5 s) needs a start time that `HudState` doesn't carry: keep it in a module-internal `{ bannerUntil }` held by `raceSession.ts` and passed alongside `prevHud` (internal type, not a contract change) |
| `src/game/settings.ts` | load/save `wreckline.settings.v1` (defaults: master 0.8, sfx 0.9, quality high, cameraShake true, showFps false), tolerant of corrupt JSON |
| `src/game/debug.ts` | dev-only `window.__game` (see below) |
| `src/game/titleBackdrop.ts` | title screen backdrop: a renderer on the fake sim following car 0 (the Renderer API has no orbit camera, and none is needed), dimmed by the title's CSS gradient overlay |
| `src/main.tsx` | routing per SPEC.md section 4, mounts `App` with the store, nav and `onUiSound` -> `audio.ui` |
| `.github/workflows/pages.yml` | SPEC.md section 10: on push to `main`, Node 22, `npm ci && npm run verify`, `actions/upload-pages-artifact` with `dist`, `actions/deploy-pages`. Committed now, runs once the user creates the repo |
| `CHANGELOG.md` | starts with `## 0.2.0 - M1 vertical slice` (date filled at release) |

### State machine

| From | Command | To | Side effects |
|---|---|---|---|
| boot | (auto after `initPhysics` + fonts ready) | title | start title backdrop |
| title | startQuickRace | preRace | build setup with `buildQuickRaceSetup({ seed: random uint32 from crypto, laps: 3, aiCount: 3 })`, fill `state.race` |
| preRace | startRace | race | stop backdrop, create race session, audio.unlock() |
| preRace | back | title | |
| race | pause (Esc/Start) | paused | loop paused, `audio.stopRace()` |
| paused | resume / back | race | loop resumes (accumulator reset, no catch-up burst) |
| paused | restartRace | race | dispose + new session with the same setup but a new seed |
| paused | quitRace | title | dispose session, restart backdrop |
| paused | navigate settings | settings (previousScreen = paused) | |
| race | (sim phase finished, + 2.5 s) | results | `state.results = sim.result()`, cash shown as units x 100 |
| results | continueFromResults | title (M1) | dispose session |
| results | restartRace | race | as above |
| title | navigate controls/settings | that screen (previousScreen = title) | |
| controls/settings | back | previousScreen | settings persisted on every `setSetting` |

`setSetting` applies live: volumes -> audio, quality/cameraShake -> renderer, showFps -> overlay.
Window blur or `visibilitychange` to hidden during a race -> auto-pause, except when `?autopause=0` is set or `window.__game` has driven the game (any `step`/`setInput` call disables auto-pause for the session): the browser pane is often hidden, and auto-pause would break every scripted check.

### Per frame (race)
1. `loop` calls `onStep` N times: `inputs = new Map([[0, input.poll()]])` (skip when the player is AI via autoplay), `events.push(...sim.step(inputs))`, keep the last two snapshots (`prev`, `curr`), reusing objects where possible.
2. `onRender(alpha, dt)`: `renderer.render(prev, curr, alpha, eventsSinceLastRender, dt)`, `audio.update(curr, eventsSinceLastRender, 0)`, then append those events to a separate `hudEvents` buffer and clear the render buffer. Every 4th frame (~15 Hz): `store.set({ hud: deriveHud(curr, hudEvents, prevHud, setup) })`, then clear `hudEvents`, so no lap, wreck or damage event is lost between HUD updates. `__game.step(n)` feeds both buffers the same way.

### Debug handle (dev builds only)
`window.__game = { store, session(), step(n) /* manual sim steps even when rAF is throttled */, snapshot(), setInput(partial: Partial<InputFrame>) /* overrides the player's input until cleared */, clearInput(), finishRaceNow() /* calls sim.debugFinishRace() (contracts.ts), then steps once so the machine sees phase finished */ }`. `session()` returns `{ sim, renderer, setup }` so checks read `renderer.stats()` (incl. `geometries`/`textures`).
The browser pane is often hidden and rAF throttles to ~2 fps: every browser check must use `__game.step(n)` and state assertions, not wall-clock waits.

## Acceptance tests
- [ ] `npm test -- game` -> `deriveHud` (banners at lap change, FINAL LAP, kill feed expiry at 4 s, hitFlash decay), loop accumulator (max 5 steps, alpha in [0,1]), settings load/save with corrupt input, machine transition table tests pass.
- [ ] Browser pane, `?race=1&seed=42&autoplay=1` (after WP07 is merged): `__game.step(60 * 150)` -> `store.getState().screen === 'results'` (or `phase === 'finished'`), 4 result rows, no console errors.
- [ ] Browser pane, full flow with key events: title -> Enter (quick race) -> Enter (start) -> countdown -> `__game.setInput({ throttle: 1 })` + `step(600)` -> player progress > 30 m (the pole slot faces a curve exit, so throttle-only leaves the road after ~48 m) -> Esc -> `screen === 'paused'` -> Quit -> `screen === 'title'`.
- [ ] Settings: set quality low, reload page, setting persisted.
- [ ] Memory: 5 consecutive restart cycles -> `__game.session().renderer.stats()` `geometries`/`textures` back to the baseline (WP03 reuses one WebGLRenderer per canvas, so the counts are comparable).
- [ ] fps >= 58 at 1920x1080 high, visible pane, during a race (report the readout).

## Allowed deferrals
Career commands (`newCareer`, ...) are no-ops in M1 that log a warning. WP10 owns `src/game/**` in wave C2 and wires them directly (no CCR needed).

## Out of scope
Tuning numbers (WP12), new screens, new art.
