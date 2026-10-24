# WP07 - AI drivers

Goal: AI cars that race a proper line, brake for corners, overtake, shoot, drop mines, use turbo and recover when stuck, with difficulty that clearly scales with skill.
Read first: `SPEC.md`, `specs/contracts.ts` (AiProfile), `specs/sim-internal.ts` (AiDriver, SimWorld, system order), `specs/content.md` sections 1, 5, 8, 12, `specs/wp/WP01-vehicle-race.md` (dynamics you are driving).
Depends on: WP01 and WP02 merged (real dynamics and combat).
Owns: `src/sim/ai.ts`, `src/sim/racingLine.ts`, `src/sim/soak.ts`, `src/sim/ai.test.ts`. Anything else needs a CCR.

## Deliverables
- `racingLine.ts`: `buildRacingLine(track, grip, brake): RacingLine` (signature from the WP00 stub). Cached per `(track.def.id, grip, brake)` in a module-level Map.
- `ai.ts`: `createAiDriver(world, car, profile): AiDriver`. AI-side tuning factors are named constants at the top of `ai.ts` (`AGGRESSION_SCALE = 1`, `MINE_USE_SCALE = 1`, `TURBO_USE_SCALE = 1`, multiplied onto the profile values): tune those, never `src/content` (WP12 owns content values).
- `soak.ts`: `runSoak(opts: { trackId: string; seed: number; laps?: number }): SoakStats` (one headless 4-AI race with the player slot on autoplay 0.55, returns `endReason: 'allFinished' | 'playerFinished15s' | 'playerWrecked'`, per-car position, finished, wrecked, stuck count, gun damage events, mines dropped, wrecks, median clean lap, race time, ticks). Public API only (no `internal.ts` import), so WP11 and WP12 reuse it.

## Behaviour and numbers

### Racing line (precomputed once per race)
1. `offsets[i]` (lateral, + right) for each track sample, start at 0. Run 300 iterations of: path points `p[i] = pos[i] + right[i] * o[i]`; move each `p[i]` halfway toward the midpoint of `p[i-1]` and `p[i+1]`; the new `o[i]` is the moved point projected on `right[i]` (`dot(moved - pos[i], right[i])`), clamped to `+-lim`, `lim = width/2 - 1.6`. Indices wrap. This converges to an apex-cutting, low-curvature line.
2. Curvature `k[i]` of the resulting path (3-point circumradius over +-4 samples).
3. Speed profile: `vCorner[i] = sqrt(LAT_ACCEL / max(|k[i]|, 1e-4))` with `LAT_ACCEL = grip * 22` (m/s^2, tune: this is the grip-limited lateral accel of the WP01 model; measure it in a test at constant radius and set the constant from the measurement, note it in the report). Backward pass for braking: `v[i] = min(vCorner[i], sqrt(v[i+1]^2 + 2 * brake * 0.85 * ds))`, iterate twice around the loop. Store as `speeds`. Uncapped by maxSpeed here; the driver caps.

### Per-tick decide(world) (pure, deterministic, allocation-free)
Let `c` = the car, `p` = profile.
1. **Target point:** `look = 6 + 0.45 * |speed|` m ahead of `c.trackS`. Target lateral = `offsets[look] + noise + avoidOffset`, where `noise = p.lineNoise * sin(time * 0.37 + id * 1.7)` (deterministic, no rng), `avoidOffset` below. Target point = `sampleAtInto(scratch, s).pos + right * lateral` (one preallocated sample per driver; `sampleAt` allocates). The returned `InputFrame` is one object per driver, reused every tick (index.ts copies it).
2. **Steer:** angle `a = angleWrap(atan2(target - pos) - heading)`; `steer = clamp(a * 2.2, -1, 1)`.
3. **Speed:** `vTarget = min(speeds[at s + 0.5 * speed * 0.3], eff.maxSpeed) * p.cornerSpeedFactor` (apply cornerSpeedFactor only to corner-limited speed, i.e. when `speeds < eff.maxSpeed`). Rubber band: `d = progress(player) - progress(c)`, `vTarget *= 1 + clamp(d / 150, -1, 1) * p.rubberBand` (faster when behind the player). `err = vTarget - speed`: `err > 1` -> throttle `clamp(err / 4, 0.3, 1)`, `err < -1.5` -> brake `clamp(-err / 6, 0.2, 1)`, else throttle 0.4.
4. **Avoidance:** nearest car ahead within 14 m and within +-25 deg of the heading, slower than `c` by > 1 m/s: `avoidOffset` moves toward the side with more room (compare target lateral +-3.5 m against `lim`) at 4 m/s, max 3.5 m, decays back at 2 m/s when clear.
5. **Handbrake:** only in hairpins: when `|k| > 1/18` at the target and `speed > vTarget + 6` -> `handbrake = true` for that tick.
6. **Stuck recovery:** if racing and `|speed| < 1.5` for 1.5 s (`c.stuckTimer`): reverse (brake 1, steer = -sign(a)) for 1.0 s, then resume. Also triggers if `wrongWay` for 2 s: perform a 3-point turn (reverse with full steer until heading error < 60 deg).
7. **Gun:** a valid target = other non-wrecked car within 40 m, within 10 deg of the heading (aim assist does the rest). When valid, start firing with probability `p.aggression * dt` per tick, keep firing while valid, stop when heat > 0.85 (AI does not overheat on purpose, except skill < 0.3 which ignores heat).
8. **Mines:** a car behind within 15 m and within 30 deg of the rear axis: `dropMine` with probability `p.mineUse` once per encounter (cooldown 3 s per AI). Never drop in the first 5 s of the race.
9. **Turbo:** if `turbo > 0`, the next 80 m have `max |k| < 1/120`, and `speed > 0.7 * maxSpeed`: start with probability `p.turboUse` (one roll per straight), hold until the straight ends or turbo is empty.
10. **Pickups:** if a needed pickup (repair when hp < 60%, mines when < 2, turbo when < 2 s) is active within 40 m ahead and within `lim` laterally, override the target lateral with its lateral.
11. During countdown and after finishing: neutral input (finished cars coast with throttle 0.3 along the line).

All randomness from `world.rng`. Reaction delay is applied by `index.ts` (WP00), not here.

## Acceptance tests
- [ ] `npm test -- ai` passes:
  1. Racing line stays within `lim` and has lower total |curvature| than the centerline (by >= 15% on Scrapyard).
  2. **Soak:** `it.each` over 16 seeds (one test per seed, so each stays under the 60 s timeout), Scrapyard x 3 laps via `runSoak`, 4 AI cars (skills 0.35/0.55/0.75 + 0.55 in the player slot via autoplay): when `endReason === 'allFinished'`, every non-wrecked car finished; when it is `playerFinished15s` or `playerWrecked` the race ended early by rule, so instead every non-wrecked car must be on its last lap or finished (`playerWrecked` may end earlier: then only the stuck rule applies); race time < 3 * referenceLapTime * 1.6 when no early end; no non-wrecked car stuck (|speed| < 1.5 for > 4 s) more than twice per race (wrecked cars are excluded from the stuck count).
  3. **Skill ordering:** over the 16 seeds, the 0.75 car's average position is better than the 0.35 car's by >= 0.8 places.
  4. **Combat happens:** over the 16 seeds, average >= 6 `carDamaged` events from guns per race and >= 1 mine dropped per race, wrecks per race between 0.2 and 2.0 (if outside, tune the `ai.ts` scale constants and note it).
  5. **Lap time calibration:** report the median clean lap of the 0.55 AI; set `referenceLapTime` in the report (the orchestrator updates content via WP12/CCR).
  6. **Determinism:** one AI race twice with the same seed -> same `stateHash()` every 600 ticks.
  7. **Perf:** sim step < 0.5 ms average per tick with 4 AI cars (SPEC.md section 8; a 3-lap Scrapyard race is ~6900 ticks, so < 3.5 s in Node).
- [ ] Browser pane via `preview_start` on your `wreckline-wp07` entry, `?harness=debug2d&ai=3&autoplay=1` (3 AI opponents + the player slot on autoplay = 4 AI cars): `__harness.step(60 * 60)` -> every non-wrecked car has progress > 1 lap, the racing line is drawn.

## Allowed deferrals
None.

## Out of scope
Machine learning, path planning around wrecks beyond avoidance, team tactics, difficulty settings UI.
