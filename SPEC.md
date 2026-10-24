# Wreckline - Build Spec

Top-down combat racing in the browser, in the spirit of Death Rally (1996): short laps, machine guns, mines, turbo, wrecks, then a garage/shop loop between races. Modern look: stylized low-poly 3D seen from above, real-time lights, bloom, particles, and a clean DOM UI.

"Wreckline" is a working title. Death Rally is Remedy's IP: no names, assets, sounds or track layouts from it.

This file is the entry point for every agent. Read it fully, then `specs/contracts.ts`, then your own `specs/wp/WPxx-*.md`, plus `specs/content.md` and `specs/design.md` when your WP references them.

---

## 1. Scope

### M1 - Vertical slice (the fun gate)
- 1 track ("Scrapyard"), 3 laps, player + 3 AI drivers, 1 car model (with 4 liveries).
- Driving with drift and handbrake, front machine gun with overheat, rear mines, turbo.
- Damage, smoke and fire, wrecks with explosion, pickups (cash, repair, mines, turbo).
- AI that races, overtakes, shoots, drops mines and recovers when stuck.
- HUD, title, controls, settings, pre-race, pause, results. Quick Race only.
- Keyboard + gamepad. Procedural meshes and procedural audio: no external asset files.

**Gate:** the user drives the slice and answers "is the core loop fun?". If no, tune (WP12 scope pulled forward) before any M2 work. M2 never starts on a "no".

### M2 - Career loop
- Career: 19 rivals + boss on a points ladder, 3 race offers per round (easy/medium/hard), boss race unlocked at rank 1, champion screen.
- Garage (car preview, stats), shop (4 upgrade lines x 5 levels, repair, mines, turbo, 3 cars), race select, standings.
- 2 more tracks ("Dust Bowl" desert, "Dockside" docks), save/load in localStorage.
- Balance pass with headless AI and economy simulations.

### Out of scope (backlog, do not build)
Multiplayer, touch controls, music, track editor, replays/ghosts, sponsors/loans, mobile layout, localization, external audio assets, external art except the 8 car models (WP13-WP14, after the fun gate), achievements, leaderboards.

---

## 2. Stack (pinned, verified on npm 2026-10-23)

| Package | Version | Role |
|---|---|---|
| `typescript` | 7.0.2 | Types, `tsc --noEmit` (no emit, Vite bundles) |
| `vite` | 8.3.5 | Dev server (port **5181**) and build |
| `vitest` | 5.0.5 | Unit and simulation tests, `environment: 'node'` |
| `three` / `@types/three` | 0.186.1 / 0.186.0 | Rendering with **WebGLRenderer** |
| `postprocessing` | 6.39.5 | Bloom, vignette, tone mapping, SMAA (peer three `>=0.168 <0.187`) |
| `@dimforge/rapier2d-deterministic-compat` | 0.21.0 | 2D physics, cross-platform deterministic, WASM embedded (no Vite plugin) |
| `react` / `react-dom` | 19.3.1 | UI screens and HUD |
| `@types/react` / `@types/react-dom` | 19.3.0 | |
| `@vitejs/plugin-react` | 6.1.2 | JSX |
| `@fontsource/chakra-petch` / `@fontsource/inter` | 5.3.0 | Self-hosted fonts |

Pin exact versions (no `^`). Do not add dependencies outside this table; a WP that needs one files a Contract Change Request (section 9).

Decisions and why:
- **WebGLRenderer, not WebGPURenderer.** No visual feature here needs WebGPU, and the pmndrs `postprocessing` stack only supports WebGL. Fewer unknowns for agents.
- **No ESLint.** `typescript-eslint` 8.72 supports TypeScript `<6.1` only. Strict `tsc` + the boundary check script replace it.
- **Deterministic Rapier + seeded RNG.** Headless tests reproduce any race from a seed, and online play or replays stay possible later.
- **React for UI only.** The game loop never goes through React. The HUD reads a store updated at 15 Hz.

---

## 3. Architecture

```
src/
  shared/      contracts.ts, rng.ts, math.ts, trackGeometry.ts      pure TS, no DOM
  content/     cars.ts, tracks/*.ts, ai.ts, economy.ts, rivals.ts   pure data + tiny helpers
  sim/         index.ts, internal.ts, world.ts, vehicle.ts, race.ts,
               combat.ts, ai.ts, racingLine.ts, fake.ts             pure TS + Rapier, no DOM
  meta/        career.ts, shop.ts, save.ts, stats.ts                pure TS, no DOM (M2)
  render/      index.ts + scene/camera/car/track/fx modules         three.js + postprocessing
  audio/       index.ts + synth modules                             Web Audio API
  input/       index.ts, keyboard.ts, gamepad.ts                    DOM events, Gamepad API
  ui/          App.tsx, screens/*, hud/*, components/*, theme.css   React
  game/        main loop, state machine, store, wiring              glue (WP08)
  main.tsx     entry, query-param routing to harnesses / game
```

Data flow per frame:

```
input.poll() --InputFrame--> sim.step() x N (fixed 60 Hz, accumulator, max 5 steps/frame)
                                 |-- SimEvent[] --> renderer, audio, game (HUD banners, kill feed)
                                 '-- snapshot() ---> renderer (prev+curr, alpha), audio, HUD (15 Hz)
UI --GameCommand--> game store --> state machine --> sim/renderer/audio lifecycle
```

Hard rules (checked by `npm run check:boundaries`, a Node script WP00 writes):
1. `src/sim`, `src/shared`, `src/content`, `src/meta` import nothing from `three`, `postprocessing`, `react`, `src/render`, `src/ui`, `src/audio`, `src/input`, `src/game`, and use no `window`, `document`, `localStorage`, `requestAnimationFrame` (except `src/meta/save.ts`, which takes a storage adapter as a parameter, no global).
2. `src/sim` uses no `Math.random`, `Date.now`, `performance.now`. All randomness comes from `world.rng` (seeded from `RaceSetup.seed`).
3. Only `src/sim/**` imports `src/sim/internal.ts`. Everyone else uses `Sim` from `src/sim/index.ts`.
4. `src/render`, `src/audio`, `src/ui` never mutate snapshots or call `sim.step`.
5. No module outside `src/game` creates the sim, renderer, audio engine or input source (harnesses excepted).

---

## 4. Conventions

- Units, axes and heading: see the header of `specs/contracts.ts`. Every WP must follow it, the renderer especially (`mesh.rotation.y = -heading`).
- TypeScript strict as in `tsconfig.json` (WP00). No `any` except at the Rapier/three boundary with a comment saying why.
- Files: `camelCase.ts`, React components `PascalCase.tsx`. Named exports only, no default exports (the Rapier import is the one exception).
- Comments: explain why, not what. No commented-out code. No dashes other than plain `-` in strings and comments (no em/en dashes).
- Tests: `*.test.ts` next to the code. Sim tests run headless in Node with real Rapier.
- Tunables live in `src/content/*` (from `specs/content.md`), never as magic numbers in systems. The exception is physics constants listed in a WP spec, which live as named `const` at the top of that module.
- Debug: in dev builds `window.__game` exposes the game handle (WP08). Every harness exposes `window.__harness`.

Query params (dev and prod, handled in `main.tsx`):

| Param | Effect |
|---|---|
| `?harness=render\|ui\|audio\|input` | Mount that WP's dev harness instead of the game |
| `?screen=<Screen>` | With `harness=ui`: open that screen with fixture data |
| `?race=1&seed=N&laps=N&ai=N&track=id` | Skip menus, start a quick race directly |
| `?autoplay=1` | Player car driven by a medium AI (for unattended checks) |
| `?fps=1` | FPS / draw-call overlay |
| `?autopause=0` | Disable auto-pause on blur/hidden (scripted checks in a hidden browser pane) |
| `?harness=debug2d[&fake=1]` | WP00 2D debug view; also reads `seed`, `laps`, `ai` (AI opponents, default 3), `autoplay`, `track` |

---

## 5. Work packages

| WP | Name | Wave | Depends on | Owns (only these paths) | Model | Dispatch |
|---|---|---|---|---|---|---|
| WP00 | Foundation | 0 | - | root config, `scripts/**` (not `scripts/balance`), `src/shared/**`, `src/content/**`, `src/sim/{index,internal,world,fake}.ts` (+ tests), `src/debug/**`, `src/main.tsx`, stubs for every other module | opus high | subagent |
| WP01 | Vehicle and race rules | A | WP00 | `src/sim/vehicle.ts`, `src/sim/race.ts`, `src/sim/vehicle.test.ts`, `src/sim/race.test.ts` | opus high | subagent |
| WP02 | Combat and pickups | A | WP00 | `src/sim/combat.ts`, `src/sim/combat.test.ts` | opus high | subagent |
| WP03 | Renderer | A | WP00 | `src/render/**` | opus high | subagent |
| WP04 | UI shell and HUD | A | WP00 | `src/ui/**` (not `src/ui/screens/career/**`, `src/ui/career.css`) | opus high | subagent |
| WP05 | Input and audio | A | WP00 | `src/input/**`, `src/audio/**` | opus high | subagent |
| WP07 | AI drivers | B | WP01, WP02 | `src/sim/ai.ts`, `src/sim/racingLine.ts`, `src/sim/soak.ts`, `src/sim/ai.test.ts` | opus high | subagent |
| WP08 | Game integration | B | WP01-05 | `src/game/**`, `src/main.tsx` (taken over from WP00), `.github/**`, `CHANGELOG.md` | opus high | subagent |
| WP09 | Career logic | C1 | M1 gate | `src/meta/**` | opus high | subagent |
| WP11 | Tracks 2-3 and themes | C1 | M1 gate, WP03 | `src/content/tracks/dustBowl.ts`, `src/content/tracks/dockside.ts`, `src/content/tracks/m2Tracks.test.ts`, `src/render/themes/**` (data; WP03 created `index.ts`) | opus high | subagent |
| WP10 | Career UI and wiring | C2 | WP08, WP09 | `src/ui/**` (taken over from WP04, edits listed in WP10), `src/ui/career.css`, `src/game/**` (taken over from WP08) | opus high | subagent |
| WP13 | Car art prompt pack | C1 | M1 gate | `specs/art/prompts/**` | opus high | subagent |
| WP13U | Generate car sheets and models | U1 | WP13 | `art-incoming/cars/**` (gitignored) | - | user:ChatGPT+Tripo |
| WP14 | Car model import | C2 | WP03, WP13U | `scripts/assets/**`, `public/models/cars/**`, `src/render/carModel.ts` (+ test), `src/render/{carMesh,index,harness}.ts` (taken over from WP03), `mesh.model` values in `src/content/cars.ts` | opus high | subagent |
| WP12 | Balance and polish | C3 | WP09-11 merged | values in `src/content/**`, AI scale constants in `src/sim/ai.ts`, expected values in tuning-pinned tests (list in WP12), `scripts/balance/**`, `docs/tuning-log.md` | opus high | session |

WP06 is intentionally unused (reserved). Each WP spec lists exact deliverables, algorithms, numbers and acceptance tests. WP12 runs as a session because feel tuning needs the user's live steering; all others are fresh-context subagents in their own worktree.

Ownership rules:
- Write only inside your owned paths. Need something elsewhere? Stop and file a Contract Change Request.
- WP00 creates **stub files** for every module another WP owns, with the final exported signatures and a body that throws `new Error('not implemented: <WP>')` or returns a neutral value (documented in WP00). The owning WP replaces the body. Signatures in stubs are frozen like contracts.
- WP11 touching `src/render/themes/**` and WP03 owning `src/render/**`: WP03 is merged before WP11 starts, so there is no concurrent writer.
- WP08 integration may make one-line wiring fixes in other modules only if the owning WP is merged and the fix is listed in its report.

---

## 6. Orchestration

Run by the main session. Every agent gets: this file, `specs/contracts.ts`, its WP file, and the referenced spec files.

Worktrees and dev servers (the brain sets these up before each dispatch, so parallel agents never test main or collide on a port):
- The brain creates each worktree itself: `git -C /Users/kevin/Downloads/Claude/wreckline worktree add /Users/kevin/Downloads/Claude/wreckline-wt/wpNN -b wp/NN-<name> main`, and passes that absolute path in the brief. Agents run without `isolation`, and a subagent's shell starts in the brain's directory (inside the main checkout) on every call, so the brief requires: every shell command starts with `cd <worktree> &&`, and every git command uses `git -C <worktree>`. The merge check `git diff --name-only main...wp/NN-x` plus `git log main -1` (main unchanged) catches a slip.
- Gitignored inputs a WP needs (e.g. `art-incoming/` for WP14) are copied into its worktree by the brain before dispatch.
- The brain adds a launch entry per WP to `/Users/kevin/Downloads/Claude/.claude/launch.json`: name `wreckline-wpNN`, `npm --prefix <worktree> run dev -- --port <5200+NN> --strictPort`, port `5200+NN`. Agents open the game only through `preview_start` on their own entry, after `npm ci` in their worktree. The main checkout's entry is `wreckline-dev` (port 5181), used by the brain for gates.
- After the merge the brain removes the worktree and its launch entry.

```
Step 0 (orchestrator): git init in wreckline/, commit specs/ + SPEC.md on main.
Wave 0: WP00                              -> merge -> gate G0
Wave A: WP01 | WP02 | WP03 | WP04 | WP05  (5 agents in parallel) -> merge each -> gate GA
Wave B: WP07 | WP08                        (2 agents in parallel) -> merge -> gate GB = M1 build
M1 gate: orchestrator verification in the browser pane, then the user playtests. Go / tune / stop.
Wave C1: WP09 | WP11 | WP13               (3 agents in parallel) -> merge
Wave U1: WP13U                             (user generates 8 sheets + models with ChatGPT and Tripo)
Wave C2: WP10 | WP14                       (WP10 needs the career API and the M1 shell; WP14 needs the user's models) -> merge -> art gate (brain: lineup screenshots, fresh critic agent vs the concept sheet, then the user)
Wave C3: WP12                              (session with the user, after C1+C2) -> gate GC = M2
```

Merge protocol (orchestrator, per branch):
1. Read the agent report and the diff. A report is not proof.
2. Check the diff touches only owned paths: `git diff --name-only main...wp/NN-x`.
3. Merge with `--no-ff`. Then run `npm ci && npm run verify` on main. Red = revert the merge and send the failure back to the same agent.
4. Merge order inside a wave: sim WPs first (WP01, WP02), then WP05, WP03, WP04. Files are disjoint, so order only matters for bisecting.

Gates:
- **G0:** `npm run verify` green; boundary check (and its self-test) green; `?harness=debug2d&fake=1` shows 4 fake cars lapping Scrapyard in the 2D debug view; `?harness=debug2d` shows the real sim on the grid with the stub dynamics.
- **GA:** all WP01-05 acceptance tests green on main; each harness works.
- **GB / M1:** full race playable from the title screen with keyboard and gamepad; `?race=1&autoplay=1` finishes a race unattended with no console errors; 60 fps at 1920x1080 on the dev Mac with `quality=high`; AI soak test green.
- **GC / M2:** a scripted career (`scripts/balance/career.ts`) becomes champion in 18-35 races across 16 seeds; all three tracks pass validation and AI soak.

`npm run verify` = `npm run typecheck && npm run check:boundaries && npm test && npm run build`.

### Agent report format (return to orchestrator, max ~40 lines)

```
WP: WPxx <name>          Branch: wp/xx-name          Status: done | blocked
Files changed: <list>
Verification: <commands run + real output tail, e.g. "vitest: 42 passed">
Acceptance criteria: <each one from the WP spec: pass/fail + evidence>
Deviations from spec: <what and why, or "none">
Contract Change Requests: <none, or see format below>
Known issues / tuning notes: <short>
```

---

## 7. Global definition of done (every WP)

- `npm run verify` green on the WP branch (with other WPs still stubbed).
- Every acceptance criterion in the WP spec checked, with evidence in the report.
- No file changed outside owned paths. No new dependency.
- No `TODO` left in code unless it is in the WP's "allowed deferrals" list.
- Performance budgets in section 8 respected for the WP's part.

---

## 8. Performance budgets

| Budget | Target | Checked by |
|---|---|---|
| Frame rate | 60 fps at 1920x1080, `quality: high`, 4 cars, on an Apple M1-class GPU | WP03 harness `stats()`, M1 gate |
| Sim step | < 0.5 ms average for 4 cars (3600 ticks < 1.8 s in Node) | WP01 perf test, WP07 soak |
| Draw calls | < 150 during a race at `high` | `renderer.stats()` |
| JS bundle | < 2.5 MB gzip total (Rapier WASM is embedded, ~1 MB of it) | WP00 build check script prints gzip sizes |
| Boot to title | < 2 s on a warm cache | M1 gate |
| GC | No per-tick allocations in sim systems beyond events and snapshot() | code review by orchestrator |

---

## 9. Contract Change Request (CCR)

When a WP cannot meet its spec without changing a frozen file (contracts, sim-internal, a stub signature, a file it doesn't own, a dependency):

```
CCR: <short title>
WP: WPxx
File: <path>
Change: <exact diff or new signature>
Why: <what fails without it>
Impact: <which other WPs read this>
Workaround used meanwhile: <or "blocked">
```

The agent keeps working on everything else, reports the CCR, and does not apply it. The orchestrator decides, applies it on main, and notifies affected agents.

---

## 10. Ship

Same pipeline as the football project (Pixel Pitch):
- Repo `github.com/underscoreloG/wreckline`, created by the user when M1 passes the gate (`user` step). Push over SSH (no `gh` CLI, HTTPS has no credentials).
- GitHub Pages via `.github/workflows/pages.yml` (WP08 writes it in M1, disabled until the repo exists): on push to `main`, `npm ci && npm run verify`, upload `dist`, deploy. Pages source must stay "GitHub Actions" (branch mode serves raw TS and shows a blank page).
- Version: `package.json` is the single source, shown bottom-left on the title screen (`__APP_VERSION__`). Every pushed batch bumps it (minor = feature, patch = fix), adds a `CHANGELOG.md` entry and a tag `vX.Y.Z` (push tags too). WP00 starts at `0.1.0`; the first public push (M1 complete) is `0.2.0`; M2 is `0.3.0`; `1.0.0` when the user calls it done.
- Live check: the site caches ~10 min. Verify by comparing the live bundle hash in `index.html` with a local `npm run build`, then load the live URL and read the version on the title screen.

---

## 11. Spec index

| File | Contents |
|---|---|
| `specs/contracts.ts` | All cross-module types and APIs (frozen) |
| `specs/sim-internal.ts` | Mutable sim world shared by WP01, WP02, WP07 (frozen) |
| `specs/content.md` | Cars, upgrades, weapons, pickups, AI profiles, economy, rivals, tracks (numbers) |
| `specs/design.md` | Art direction, palette, lighting, camera, UI design system, screen layouts |
| `specs/wp/WP00-foundation.md` ... `WP14-car-models.md` | One spec per work package |
| `specs/art/cars-concept-v1.webp` | Car concept sheet: look target for the roster and WP13-WP14 |
| `specs/STATUS.md` | Orchestrator ledger: phase, decisions, WP states (workers don't need it) |
