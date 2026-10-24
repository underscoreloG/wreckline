# WP00 - Foundation

**Wave 0, sequential. Everything else depends on it.** Goal: a repo where every other WP can work in parallel against frozen contracts, real stubs and test harnesses, with no file conflicts.

Read first: `SPEC.md`, `specs/contracts.ts`, `specs/sim-internal.ts`, `specs/content.md`.

## Owned paths

Root config files, `src/main.tsx`, `src/shared/**`, `src/content/**`, `src/sim/{index,internal,world,fake}.ts` (+ their tests), `src/debug/**` (frozen after wave 0: later changes go through a CCR), `scripts/**` (except `scripts/balance/**`), plus **stub files** for every module owned by other WPs (you write the stub, they own it after).

## Deliverables

### 1. Project scaffold
- `package.json`: name `wreckline`, version `0.1.0`, `"type": "module"`, exact versions from SPEC.md section 2.
  Scripts: `dev` (vite), `build` (`tsc --noEmit && vite build && node scripts/bundleSize.mjs`), `preview`, `test` (`vitest run`), `typecheck` (`tsc --noEmit`), `check:boundaries` (`node scripts/checkBoundaries.mjs`), `verify` (typecheck + check:boundaries + test + build, `&&` chained).
- `tsconfig.json`: same as the football project (`ES2022`, `moduleResolution: bundler`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`, `skipLibCheck`, `noEmit`, `resolveJsonModule`), plus `"jsx": "react-jsx"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, `"types": ["vite/client"]`, include `src`, `scripts`, `vite.config.ts`.
- `vite.config.ts`: `base: './'`, React plugin, `server.port: 5181`, `define: { __APP_VERSION__ }` from package.json, vitest `{ environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 60000 }`.
- `index.html`: `<div id="app">`, a full-viewport `<canvas id="game">` under it, dark `#0B0D10` body background (no white flash).
- `src/globals.d.ts` declaring `__APP_VERSION__`.
- `.gitignore` (node_modules, dist, art-incoming), `README.md` (how to run, query params table from SPEC.md, verify command).
- `vite.config.ts` also sets `server.strictPort: true` (a busy port fails loudly instead of silently moving).
- Dev servers: you run in a worktree. The brain has already added a `launch.json` entry named `wreckline-wp00` for your worktree (port 5200, `npm --prefix <your worktree> run dev -- --port 5200 --strictPort`); open the game with `preview_start` on that name, after `npm install` in your worktree (you create the lockfile; later WPs run `npm ci`). Never start a server for the main checkout. The brain adds the main entry `wreckline-dev` (port 5181, `--prefix /Users/kevin/Downloads/Claude/wreckline`) itself; `launch.json` is outside the repo and not yours to edit.

### 2. Contracts
- `src/shared/contracts.ts` = `specs/contracts.ts` verbatim.
- `src/sim/internal.ts` = `specs/sim-internal.ts` verbatim.

### 3. Shared utilities (`src/shared/`)
- `rng.ts`: `createRng(seed: number): Rng` with `interface Rng { next(): number /*[0,1)*/; range(a, b): number; int(a, b): number /*inclusive*/; chance(p): boolean; pick<T>(arr: readonly T[]): T; state(): number; }`. Algorithm: **mulberry32**. `hashString(s: string): number` (FNV-1a 32-bit). Tests: same seed gives the same 1000 numbers; `int` covers its bounds; mean of 10k `next()` within 0.5 +- 0.02.
- `math.ts`: `Vec2` helpers as pure functions (`add, sub, scale, dot, cross, len, len2, norm, rotate, lerp, dist, angleWrap(a) -> (-PI, PI], lerpAngle, clamp, segmentIntersect(p1, p2, q1, q2): number | null` (t along p) and `fwd(h)`, `right(h)` per contracts). Plus **mutating** `set/addTo/scaleTo` variants for hot loops. Tests for each.
- `trackGeometry.ts`:
  - `buildTrackGeometry(def: TrackDef): TrackGeometry`. Centripetal Catmull-Rom (alpha 0.5) through the closed `centerline`, densely sampled (200 sub-steps per segment), arc-length reparametrized into `N = round(length)` uniform samples. `right = (-t.y, t.x)`. Curvature = signed, from the 3-sample circumradius over a +-3 sample window (+ = turning right). Edges at +-width/2, walls at +-(width/2 + shoulder).
  - Checkpoints: `count = max(8, round(length / checkpointSpacing))`, gate i at `s = i * length / count`, from `leftWall` to `rightWall` point.
  - Grid: 8 slots. Slot k: row `floor(k / 2)`, column `k % 2`. Position = centerline at `s = length - 8 - row * 8 - column * 4` (wrapped), lateral `column === 0 ? -3 : +3`. Heading = tangent angle at that s. Slot 0 is pole.
  - `sampleAt(s)` linear between samples, s wrapped. `project(p, hintS?)`: with hint, search samples within +-40 m, else all; refine on the best segment by projecting onto the sample segment. Both have allocation-free **methods** on the geometry object, `sampleAtInto(out, s)` and `projectInto(out, p, hintS?)` (signatures in contracts.ts): they write into `out` in place and return it; `sampleAt`/`project` are thin wrappers that allocate a fresh `out` and call them. Callers preallocate with `createTrackSample()` / `createTrackProjection()` (exported from `trackGeometry.ts`).
  - `validateTrack(def): TrackValidation`. Errors when: length outside 600-2000; min radius < width; min clearance between samples more than `4 * width` apart (along s) < `width + 2 * shoulder + 8`; any pickup `|lateral| > width/2 - 1.5` or `s` outside [0, length); any prop within `width/2 + shoulder + 1 + propRadius(kind)` of the centerline; two props overlapping (circle approximation). `propRadius`: crate 0.8, tireStack 0.7, barrel 0.5, container 3.2, wreck 2.4, lightPole 0.3, cone 0.3, rock 1.5, cactus 0.6, building 6.
  - Tests: a circle track (24 points, r = 100) has length 2*PI*100 within 0.5% and curvature 1/100 within 5% (sign + for clockwise-on-screen); `project` of any sample pos returns its s within 0.5 m; `projectInto`/`sampleAtInto` give results equal to `project`/`sampleAt` for 1000 random inputs and return the same `out` object (and the same `out.sample`) every call; grid slots are all on the road (`|lateral| < width/2`); 1000 random points project consistently with and without hint when near the line; Scrapyard validates `ok` with length 1049 +- 5.
- `stats.ts`: none (stats math lives in content/economy.ts).

### 4. Content (`src/content/`)
Encode `specs/content.md` exactly:
- `cars.ts`: `CARS: Record<string, CarDef>` (8 cars, `mesh.model: null` for all), `getCar(id)`, `carsForSale(): CarDef[]` (`forSale` only, table order).
- `economy.ts`: `UPGRADE_EFFECTS`, `UPGRADE_COSTS`, `TIER_MULT`, `upgradeCost(car, kind, toLevel)`, `computeStats(car, levels): CarStats`, shop prices, pickup values, career tier table. Tests: computeStats with all zeros returns base; with all 5 matches hand-computed values for raven; grip cap holds.
- `ai.ts`: anchor table + `profileForSkill(skill): AiProfile` (linear interpolation, clamp). Test: endpoints and midpoints.
- `weapons.ts`: all section 5 numbers as named constants (`GUN_RATE`, `GUN_RANGE`, ...). `pickups.ts`: section 6. `race.ts`: section 7. `vehicle.ts`: section 4 modifiers.
- `rivals.ts`: section 10 table, `BOSS`.
- `liveries.ts`: section 9.
- `tracks/scrapyard.ts`, `tracks/placeProps.ts`, `tracks/index.ts` (`TRACKS`, `getTrack(id)`). `placeProps(base, rules, extraScatter)` per content.md section 12, deterministic from `hashString(trackId)`. Test: output is identical across two calls, and validateTrack passes.
- `quickRace.ts`: `buildQuickRaceSetup(opts: { seed: number; laps?: number; aiCount?: number; trackId?: string; autoplay?: boolean }): RaceSetup`. `aiCount` defaults to 3 (4 cars total). Player = entrant 0 (`ai: null`, or `profileForSkill(0.55)` when autoplay), AI skills from content.md section 8 (first N of 0.35, 0.55, 0.75; extra AIs repeat 0.55), liveries in order, raven stats via `computeStats`, full hp, 3 mines, 4 s turbo, laps default 3, `countdownSeconds: 3`.

### 5. Sim skeleton (`src/sim/`)
- `index.ts`: `initPhysics()` (calls `RAPIER.init()` once, idempotent), `createSim(setup)`, re-exports `createFakeSim`, and the test-only `createSimWithWorld(setup): { sim: Sim; world: SimWorld }` (same as createSim but also returns the internal world; used by WP01/WP02/WP07 tests, never by game code). `createSim` builds the world (`world.ts`), creates AI drivers via `createAiDriver` from `ai.ts` for entrants with a profile, and implements `step()` with the **exact system order** in `sim-internal.ts`. Countdown: during `countdown` skip steps 3-9 and keep cars frozen (set linvel/angvel 0). `snapshot()` maps `SimCar` -> `CarState` (fresh objects). `result()` returns `world.result`. `stateHash()` = FNV-1a over positions, velocities, headings (rounded to 1e-4) and hp of all cars plus `tick`. `debugFinishRace()` per contracts.ts: sets phase `finished` and builds `world.result` through the same result builder WP01's race-end rule uses (WP00 writes `buildResult(world): RaceResult` in `world.ts`, not `index.ts`, so `race.ts` can import it without an import cycle, with the ranking rule of content.md section 7). `dispose()` frees the Rapier world.
- Step 2 (inputs), for each car i: first copy `car.input` into `car.prevInput` field by field, then pick the new frame: `world.ai[i]` non-null -> its `decide(world)` result goes through the reaction delay; null -> `inputs.get(i) ?? NEUTRAL_INPUT`. Copy the chosen frame into `car.input` field by field. Never store a reference to a frame you did not allocate.
- Reaction delay: a per-car ring buffer of `profile.reactionTicks` **preallocated** `InputFrame` slots. Each tick, first read (copy out) the slot written `reactionTicks` ticks ago (neutral until filled), then copy `decide()`'s result field by field into that same slot: read before write, or the delay becomes 0. This lives in `index.ts` so AI code stays pure. Test: an AI whose `decide` returns one reused object with throttle switching 0 -> 1 at tick T moves its car's `input.throttle` to 1 at exactly tick T + reactionTicks.
- Test rule for every sim test in every WP: a test that scripts cars sets `entrants[i].ai = null` for each car it drives or wants inert, and passes their frames in `inputs`, so tests stay valid after WP07 replaces the AI stub.
- `world.ts`: `buildWorld(rapier, setup): SimWorld`.
  - `World({ x: 0, y: 0 })`, `integrationParameters.dt = SIM_DT`.
  - Walls: two closed `ColliderDesc.polyline` loops from `leftWall` / `rightWall` (indices closing the loop), on a fixed body, friction 0.3, restitution 0.2, group `GROUP_WALL`, filter `GROUP_CAR`.
  - Props with kind `container | building | rock`: fixed cuboid/ball colliders (sizes from `propRadius`), group `GROUP_PROP`.
  - Cars: dynamic body at grid slot `id`, `setCcdEnabled(true)`, cuboid collider `(mesh.length/2, mesh.width/2)`, mass from `stats.mass` (`setMass`), friction 0.4, restitution 0.3, `ActiveEvents.COLLISION_EVENTS`, group `GROUP_CAR`, filter `GROUP_CAR | GROUP_WALL | GROUP_PROP`. Linear/angular damping 0 (WP01 drives velocities).
  - Pickups from `track.pickups` (pos = sampleAt(s).pos + right * lateral), all active.
  - All `SimCar` fields initialized (hp/mines/turbo from entrant, `lap: 0`, `nextCheckpoint: 0`, `crossedStart: false`, `trackS` = grid slot s, `progress = trackS - length` (slightly negative), `position` by grid order, `eff` = copy of `base`, `input`/`prevInput` = neutral).
  - Tests: walls exist; a car pushed at 60 m/s straight into a wall for 2 s never ends up outside the walls (CCD works); 4 cars spawn without overlapping.
- `fake.ts`: `createFakeSim(setup): Sim`. No physics. Cars move along the centerline at `0.6 + 0.1 * id` of their maxSpeed, with lateral sway `sin(t * 0.7 + id) * 3`, heading from the tangent; laps and positions computed from s. Countdown and finish like the real sim (laps from setup), `debugFinishRace` supported. Deterministic from the seed. This is what WP03/WP04/WP05 develop against, so it exercises **every event type and every CarState flag** on this schedule (t = race time, per car `id`, offsets `+ id` seconds so cars don't act in sync):

  | Every | What (events and flags) |
  |---|---|
  | 2 s | `gunShot` toward the car ahead (`hitCar` set, or `hitWall` when none ahead); `firing` true 0.5 s around it; `gunHeat` +0.25 per shot, cooling 0.2/s |
  | 15 s | `gunHeat` reaches 1: `gunOverheat`, `gunOverheated` true 2 s |
  | 7 s | `mineDropped` 1 m behind the car, then `mineExploded` 1 s later with `hitCars` = the car right behind (if within 6 m), plus `carDamaged` (source `mine`) for it |
  | 11 s | `impact` with `'wall'` (speed 9) and `carDamaged` (source `wall`, 10 hp) |
  | 9 s | `turboStart`, `turboActive` true and turbo seconds draining for 2 s, `turboEnd` |
  | 13 s | `pickupCollected` for the nearest active pickup (cycling kinds), pickup `active` false, `pickupRespawned` 12 s later |
  | 17 s | `offroad` true 1 s (lateral pushed to width/2 + 1) |
  | corners | `drifting` true when |curvature| > 1/30; `braking` true during the 1 s before entering such a corner |
  | 23 s | `wrongWay` true for 1.5 s (flag only, the car keeps driving forward) |
  | hp | every car loses hp linearly from maxHp to 10% over 40 s with a `carDamaged` (source `gun`, `by` = car ahead) each second; at 10% cars 0-2 reset to maxHp, car 3 instead wrecks at exactly t = 40 s (this row has no `+ id` offset): `carWrecked` (by car 2), `wrecked` true, it stops and stays wrecked |
  | laps | `lapCompleted`, `finalLap`, `carFinished`, `raceFinished` like the real sim |
- **Stubs** (final signatures, owners replace bodies):
  - `vehicle.ts` (WP01): `export const applyDynamics: SimSystem` -> when throttle, brake and steer are all 0 it does nothing (so tests that set velocities directly keep them); otherwise sets linvel along heading at `10 * throttle - 5 * brake` m/s and angvel `steer * 1.5` rad/s (so the debug view can drive, turn and reverse). Always sets `braking = brake > 0.1`.
  - `race.ts` (WP01): `updateCountdown: SimSystem` (minimal: countdown decrement, phase switch, events), `updateProgress: SimSystem` (minimal: projection + trackS only).
  - `combat.ts` (WP02): `updateTurbo, handleCollisions, updateGuns, updateMines, updatePickups: SimSystem` -> no-ops (`handleCollisions` must still drain the event queue).
  - `ai.ts` (WP07): `createAiDriver(world: SimWorld, car: CarId, profile: AiProfile): AiDriver` -> returns one reused frame: throttle 0.4, steer toward the centerline point 12 m ahead (via `sampleAtInto`), fire while a car is within 30 m ahead, `dropMine` pulsed every 5 s. Crude on purpose: it makes AI cars move, shoot and drop mines in the debug view. Sim tests never depend on it (test rule above).
  - `racingLine.ts` (WP07): `export interface RacingLine { offsets: Float32Array; speeds: Float32Array }` and `buildRacingLine(track: TrackGeometry, grip: number, brake: number): RacingLine` -> zeros.
  - `src/render/index.ts` (WP03): `createRenderer(opts)` throws `not implemented: WP03`; `buildCarMesh` throws. `src/render/harness.ts`: `mountRenderHarness(root: HTMLElement): void` shows "WP03 pending".
  - `src/audio/index.ts` (WP05): `createAudioEngine(): AudioEngine` returns a silent no-op engine. `src/audio/harness.ts`: `mountAudioHarness(root: HTMLElement): void` shows "WP05 pending".
  - `src/input/index.ts` (WP05): `createInputSource(target: Window): InputSource` with the full keyboard map from `specs/wp/WP05-input-audio.md` (arrows drive, S fire, D mine, A turbo, Space handbrake, Esc pause, Enter confirm), no gamepad. `src/input/harness.ts`: `mountInputHarness(root: HTMLElement): void` shows "WP05 pending".
  - `src/ui/App.tsx` (WP04): `export function App(props: { store: GameStore; nav: (cb: (n: UiNav) => void) => () => void; onUiSound?: (s: UiSound) => void }): ReactElement` (`import type { ReactElement } from 'react'`) renders the current screen name in plain text. `src/ui/harness.tsx`: `mountUiHarness(root: HTMLElement): void`.
  - `src/game/index.ts` (WP08): `export interface GameHandle { store: GameStore; dispose(): void }` and `startGame(root: HTMLElement): Promise<GameHandle>` mounts the debug view with a quick race.
  These are the **final** signatures (frozen like contracts): owners replace bodies, never signatures.
- `src/debug/debug2d.ts` (WP00 owns): `mountDebug2d(root, sim, input?)`: 2D canvas top-down debug view of any `Sim`: walls, checkpoints (numbered), racing line if available, cars as oriented rectangles with id + hp, mines, pickups, a text panel (tick, phase, lap/position per car, fps). Pan/zoom with mouse. Fixed 60 Hz stepping with the same accumulator as the game. The race comes from `buildQuickRaceSetup` with query params `seed`, `laps`, `ai` (AI opponent count, default 3), `autoplay`, `track`. `window.__harness = { sim, step(n): SimEvent[] /* all events of those n ticks, in order */, snapshot(), setInput(partial: Partial<InputFrame>) /* overrides car 0's keyboard input until cleared */, clearInput(), finishRace() /* sim.debugFinishRace() */ }`, so agents drive by script instead of holding keys. Route `?harness=debug2d[&fake=1]`.

### 6. Entry and routing (`src/main.tsx`)
Reads query params (SPEC.md section 4) and mounts: `harness=debug2d|render|ui|audio|input` -> that harness; otherwise `startGame`. WP08 takes over this file in wave B.

### 7. Scripts (`scripts/`)
- `checkBoundaries.mjs`: walks `src/`, parses import specifiers with a regex (`import ... from '...'`, `import('...')`, `export ... from '...'`), and fails (exit 1, listing file:line) on SPEC.md section 3 rules 1-3 (rules 4-5 are not regex-checkable: the brain checks them in review; `src/main.tsx` and `src/debug/**` are allowed to create the sim). Also greps for `Math.random|Date.now|performance.now` in `src/sim`, `src/shared`, `src/content`, and for `window|document|localStorage|requestAnimationFrame` in pure dirs (word-boundary regex, ignoring comments). Files matching `*.test.ts` are exempt from the clock/random grep (perf tests time themselves with `performance.now()`, typed by the DOM lib) but not from the import rules. Include a self-test: `node scripts/checkBoundaries.mjs --self-test` checks it catches planted violations in a temp dir.
- `bundleSize.mjs`: prints gzip size per file in `dist/assets` and the total; exits 1 if total > 2.5 MB.

### 8. Git
The orchestrator already ran `git init` and committed specs. Commit your work on your branch in logical commits (scaffold, shared, content, sim skeleton, stubs, debug, scripts).

## Acceptance criteria
1. `npm ci && npm run verify` green (fresh clone).
2. `npm run check:boundaries -- --self-test` passes.
3. Browser pane via `preview_start` on `wreckline-wp00`, asserted through `window.__harness` (not screenshots alone): `?harness=debug2d&fake=1&laps=2`, `step(60 * 45)` (42 s of race time; car 3 completes lap 1, so `finalLap` fires, before it wrecks at 40 s) -> 4 cars have progressed, the events seen include every SimEvent type except `carFinished` and `raceFinished`, and car 3 is `wrecked`; `finishRace()` then gives `raceFinished` and phase `finished`. `?harness=debug2d`: 4 cars on the grid, `step(200)` -> phase `racing`; `setInput({ throttle: 1 })` + `step(120)` -> car 0 moved > 15 m; `setInput({ throttle: 1, steer: 1 })` changes its heading; holding throttle into a wall for `step(600)` keeps it inside the walls; AI cars moved. `finishRace()` -> `snapshot().phase === 'finished'` and a 4-row result.
4. Determinism test: two `createSim` runs with the same setup and the same scripted inputs for 600 ticks give the same `stateHash()`; a different seed is allowed to differ.
5. Scrapyard: `validateTrack` ok, length 1049 +- 5 m, 26 checkpoints (= round(1049/40)).
6. Bundle size printed, under budget.
7. Every stub file exists with the exact signatures listed here, and `tsc` passes with them.

## Allowed deferrals
None.

## Out of scope
Real vehicle dynamics, combat, AI, the three.js renderer, React screens, audio: you only write their stubs. No ESLint/Prettier setup.
