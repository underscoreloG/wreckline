# WP01 - Vehicle dynamics and race rules

**Wave A.** Goal: cars that feel snappy and arcade-like (grip, controllable drift, handbrake slides), and correct laps, positions and race end.

Read first: `SPEC.md`, `specs/contracts.ts`, `specs/sim-internal.ts`, `specs/content.md` sections 1, 4, 7.

## Owned paths
`src/sim/vehicle.ts`, `src/sim/race.ts`, `src/sim/vehicle.test.ts`, `src/sim/race.test.ts`. Replace the WP00 stub bodies; keep the exported signatures.

## 1. `vehicle.ts` - `applyDynamics: SimSystem`

Runs once per tick for each car, before `physics.step`. Read velocity and heading from the body, write new linvel/angvel. Use module-level scratch vectors (no allocation per tick).

Named constants at the top of the file:
```ts
const ACCEL_TAPER_START = 0.75;   // fraction of maxSpeed where full accel starts fading to 0 at maxSpeed
const COAST_DECEL = 3;            // m/s^2 with no throttle/brake
const REVERSE_MAX = 0.3;          // fraction of maxSpeed
const REVERSE_ACCEL = 0.5;        // fraction of accel
const GRIP_RATE = 18;             // 1/s, lateral damping = grip * GRIP_RATE
const STEER_FULL_SPEED = 8;       // m/s, steering authority ramps 0 -> 1 from 0 to this speed
const HIGH_SPEED_STEER_LOSS = 0.35; // steering lost at maxSpeed
const ANGVEL_RESPONSE = 12;       // 1/s, how fast angVel tracks its target
const DRIFT_THRESHOLD = 3.5;      // m/s lateral speed
```

Per car (skip and apply wrecked damping if `wrecked`; skip input if `finished` -> treat as throttle 0.3, steer to follow nothing, i.e. coast):

1. `eff` = `base` with modifiers from content.md section 4: offroad when `|car.lateral| > width/2` (use last tick's projection), turbo when `car.turboActive` (WP02 sets it in step 3). Write into `car.eff` in place.
2. `h = body.rotation()`, `f = fwd(h)`, `r = right(h)`, `v = body.linvel()`, `vF = dot(v, f)`, `vR = dot(v, r)`.
3. Longitudinal acceleration `a`:
   - handbrake: `a = -sign(vF) * min(|vF| / dt, eff.brake * 0.5)` (handbrake also scrubs speed), no drive.
   - throttle > 0 and vF >= -0.5: `taper = clamp((eff.maxSpeed - vF) / ((1 - ACCEL_TAPER_START) * eff.maxSpeed), 0, 1)`; `a = eff.accel * throttle * taper`.
   - brake > 0: if `vF > 0.5`: `a = -eff.brake * brake`; else reverse: `a = -eff.accel * REVERSE_ACCEL * brake` only while `vF > -REVERSE_MAX * eff.maxSpeed`.
   - throttle > 0 while rolling backwards (vF < -0.5): acts as a brake: `a = eff.brake * throttle`.
   - neither: `a = -sign(vF) * min(|vF| / dt, COAST_DECEL)`.
   - offroad extra drag: `a -= sign(vF) * 4`.
   - `vF += a * dt`.
4. Lateral grip: `gripNow = eff.grip * (handbrake ? 0.35 : 1)` (offroad grip already in eff); `vR *= exp(-gripNow * GRIP_RATE * dt)`.
5. `body.setLinvel(f * vF + r * vR)`.
6. Steering: `authority = clamp(|vF| / STEER_FULL_SPEED, 0, 1) * (vF >= 0 ? 1 : -1)`; `rate = eff.turnRate * (1 - HIGH_SPEED_STEER_LOSS * clamp(|vF| / eff.maxSpeed, 0, 1)) * (handbrake ? 1.4 : 1)`; `target = steer * authority * rate`; `w = body.angvel()`; `w += (target - w) * (1 - exp(-ANGVEL_RESPONSE * dt))`; `body.setAngvel(w)`.
7. Flags: `drifting = |vR| > DRIFT_THRESHOLD`; `braking = brake > 0.1 && vF > 1`.
8. Wrecked cars: `body.setLinearDamping(2.5)`, `setAngularDamping(3)` once when wrecked, then skip steps 1-7.

Collisions are resolved by Rapier inside `physics.step`. Their effect on velocity is read next tick, so impacts and spins survive for a few ticks before grip and steering take over. That is intended.

## 2. `race.ts`

### `updateCountdown: SimSystem`
- `phase === 'countdown'`: `countdown -= SIM_DT`. Emit `{type: 'countdown', value}` when crossing 3 (at tick 0), 2 and 1 (integer boundaries of the remaining time, from `setup.countdownSeconds`). At `countdown <= 0`: `phase = 'racing'`, `countdown = 0`, `time = 0`, every `currentLapStart = 0`, emit `raceStart`.
- `phase === 'racing'`: evaluate the end rules from content.md section 7 (all non-wrecked finished; 15 s after `playerFinishedAt`; 2 s after `playerWreckedAt`). When met: `phase = 'finished'`, `world.result = buildResult(world)` (WP00's builder in `src/sim/world.ts`, also used by `debugFinishRace`; import it from `./world`, never from `./index`, which imports `race.ts` and would make a cycle; `compareRank` there gives the position order), emit `raceFinished`.

### `updateProgress: SimSystem` (after physics and combat)
Per car, using `track.projectInto` with `hintS = car.trackS`:
1. Store `trackS`, `lateral` (one preallocated `TrackProjection` per car, from `createTrackProjection()`). If the player is `wrecked` and `world.playerWreckedAt === null`, set it to `time`; do the same for every car's `wreckedAt` if WP02 left it null (tests may set `wrecked` directly).
2. Checkpoints. Spawn state (set by WP00): grid is behind the line, `lap = 0`, `nextCheckpoint = 0`, `crossedStart = false`. Only the gate `nextCheckpoint` can be passed (segment `prevPos -> pos` intersects it, via `segmentIntersect`), and only going forward (positive dot product with the gate normal), so reversing over the line never counts. On passing gate `i`:
   - `i === 0 && !crossedStart`: `crossedStart = true`, `currentLapStart = time`. Not a lap.
   - `i === 0 && crossedStart`: lap completed (all other gates were passed in order, since only the next gate can be passed). `lap++`, `lastLapTime = time - currentLapStart`, update `bestLapTime`, `currentLapStart = time`, emit `lapCompleted`. Emit `finalLap` when `lap === laps - 1`. When `lap === laps`: `finished = true`, `finishTime = time`, emit `carFinished` with the position at that moment; set `playerFinishedAt` when it's the player.
   - Then `nextCheckpoint = (i + 1) % count`.
3. Progress:
   - `!crossedStart`: `progress = trackS - length` (small negative on the grid).
   - otherwise `sAdj = (nextCheckpoint === 0 && trackS < length / 2) ? length : trackS` (projection already past the line but the gate not yet crossed this tick), `progress = lap * length + sAdj`.
   - Anti-cut: clamp `progress` to at most `lap * length + gateS(nextCheckpoint) + 20` (with gate 0's s taken as `length`).
4. Wrong way: if `progress` decreased since last tick and `|speed| > 3`, `wrongWayTimer += dt`, else reset to 0. `wrongWay = wrongWayTimer > 1.2`.
5. Positions: sort per content.md section 7 (wrecked cars last, ordered by `wreckedAt` descending: a later wreck ranks higher) and write `position` (1-based). Allocation-free sort on a preallocated index array.
6. Result rows (`RaceResultRow`) when the race ends: positions as above, `finished`, `wrecked`, `totalTime`, `bestLap`, `wrecksCaused`, `cashPicked`, `hpLeft`, `minesLeft`, `turboLeft`.

## 3. Tests (`vehicle.test.ts`, `race.test.ts`)

Use real Rapier (`await initPhysics()` in `beforeAll`), `createSimWithWorld`, and `ai: null` for every entrant (WP00 test rule; scripted cars get their frames through `inputs`). Read expected speeds and rates from the `src/content` constants rather than literals, so WP12 tuning moves them with the content. Build tracks with a helper `makeTestTrack('straight' | 'circle')`: a long oval (two 400 m straights) and a circle r = 80, both width 14, built as `TrackDef` inline in the test.

| # | Test | Pass condition |
|---|---|---|
| 1 | Top speed | full throttle on the straight for 8 s: speed within maxSpeed * [0.97, 1.0] |
| 2 | 0-100 km/h | raven reaches 27.8 m/s in 2.0-3.2 s (the content values give ~2.17 s at 60 Hz) |
| 3 | Braking | from maxSpeed, full brake stops within `v^2/(2*brake) * [0.98, 1.25]` (60 Hz semi-implicit Euler stops ~1.2% short of the ideal) |
| 4 | Reverse | holding brake from rest reaches -REVERSE_MAX * maxSpeed +- 5%, never more |
| 5 | Turning | at 15 m/s with full steer on open ground, the car turns right (heading increases) and completes a circle with radius 6-14 m; steer -1 turns left |
| 6 | Lap counting | a scripted path-following controller (test-only: steer toward centerline 12 m ahead, throttle 0.7) completes 3 laps of the oval; exactly 3 `lapCompleted` events, `carFinished` once, lap times within 10% of each other |
| 7 | No cutting | teleporting a car across the infield to the start line does not count a lap |
| 8 | Wrong way | driving backwards around the track sets `wrongWay` within 1.5 s; no lap counted |
| 9 | Drift | at 25 m/s, handbrake + full steer for 0.5 s gives `drifting` true and lateral speed > 5 m/s; releasing returns `drifting` false within 1.5 s |
| 10 | Offroad | holding lateral > width/2 caps speed between 0.6 and 0.7 * maxSpeed (the x0.70 cap plus the 4 m/s^2 extra drag settle near 0.63) |
| 11 | Race end | with 2 cars where car 1 never moves, the race ends 15 s after the player finishes; car 1 ranked 2nd with `finished: false` |
| 12 | Player wrecked | setting player hp to 0 (and `wrecked`) ends the race 2 s later; player row `wrecked: true`, last |
| 13 | Determinism | same seed + same inputs for 3600 ticks -> same `stateHash()` |
| 14 | Perf | 4 cars, 3600 ticks with the test controller < 1.8 s in Node |

## 4. Feel targets (playtest notes for the report)
Snappy, not heavy (the user's stated preference): the car should answer steering in under 0.1 s, grip by default, and only slide when the handbrake is used or when steering hard above ~70% of top speed. Write down any constant you changed from the table and why.

## Acceptance criteria
- All 14 tests green, `npm run verify` green.
- Browser pane via `preview_start` on your `wreckline-wp01` entry, `?harness=debug2d&ai=1&laps=1` (RaceSetup needs 2+ entrants): drive car 0 with `__harness.setInput` and `step(n)` along a scripted path (or `autoplay=1` once WP07 exists, not on your branch): it drives, `drifting` goes true with handbrake + steer at speed, `lap` increments, and the race ends. Assert from `__harness.snapshot()`.
- No allocations in `applyDynamics` / `updateProgress` per tick (except events and result).

## Out of scope
Weapons, damage, turbo state (WP02 sets `turboActive`, you only read it), AI (WP07), rendering.
