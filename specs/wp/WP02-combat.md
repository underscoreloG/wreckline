# WP02 - Combat, damage and pickups

**Wave A, parallel with WP01.** Goal: machine gun, mines, turbo, collision damage, wrecks and pickups, all deterministic.

Read first: `SPEC.md`, `specs/contracts.ts`, `specs/sim-internal.ts`, `specs/content.md` sections 4, 5, 6.

## Owned paths
`src/sim/combat.ts`, `src/sim/combat.test.ts`. Replace the WP00 stub bodies of `updateTurbo`, `handleCollisions`, `updateGuns`, `updateMines`, `updatePickups`; keep signatures. Constants come from `src/content/weapons.ts` and `src/content/pickups.ts`.

You develop while WP01 is still a stub (cars only move forward at 10 m/s). Tests therefore place cars directly with `body.setTranslation` / `setRotation` / `setLinvel` and step the sim; never rely on WP01 dynamics.

## Shared helper (inside combat.ts)
`applyDamage(world, car, amount, source, by, pos)`: ignore if `car.finished` (wave B rule, content.md section 7: finished cars are immune; WP07 adds this check) or wrecked or amount <= 0; `hp = max(0, hp - amount)`; if `by !== null && by !== car.id`: `lastDamagedBy = by`, `lastDamagedAt = time`; emit `carDamaged`. If hp hits 0: `wrecked = true`, `wreckedAt = time`, credit = `lastDamagedBy` if `time - lastDamagedAt <= 5` else null, `cars[credit].wrecksCaused++` when credited, emit `carWrecked`, then apply the wreck explosion (content.md section 5: 20 damage within 5 m with `by = null`, 6 m/s outward velocity change).

## 1. `updateTurbo`
For each non-wrecked, racing car: `turboActive = input.turbo && turbo > 0`. While active, `turbo = max(0, turbo - SIM_DT)`. Emit `turboStart` / `turboEnd` on transitions (also `turboEnd` when it runs out).

## 2. `handleCollisions`
1. `world.events.drainCollisionEvents((h1, h2, started) => ...)`: collect started contacts into a preallocated pair list. Map handles via `colliderToCar`; a handle not in the map is wall/prop.
2. For each car involved this tick: `impact = |vel_after - prevVel|` where `vel_after = body.linvel()` and `prevVel` was stored by index.ts before the physics step (after dynamics).
   Note: drainCollisionEvents only reports *started* contacts. Long scrapes produce one start; damage from a continuous scrape is intentionally not modeled.
3. Car vs car: `dmg = max(0, impact - 6) * 1.6 * sqrt(other.mass / self.mass)` for each side, `by = other`. Car vs wall/prop: `dmg = max(0, impact - 9)`, `by = null`, source `'wall'`.
4. Pair cooldown 0.25 s: keep a small fixed-size array of `{a, b, until}` (max 32 entries, overwrite oldest).
5. Emit `impact` when `impact >= 4` (b = other car id or `'wall'`), pos = midpoint of the two car positions, or the car position for walls.

## 3. `updateGuns`
For each car, `firing = input.fire && !gunOverheated && !wrecked && phase === 'racing'`.
- Cooling: if not firing, `gunHeat = max(0, gunHeat - 0.45 * dt)`. If overheated and heat < 0.35: `gunOverheated = false`.
- `gunCooldown -= dt`. While `firing && gunCooldown <= 0`: one shot, `gunCooldown += 1 / GUN_RATE` (keeps the exact 12/s rate across ticks).
- Shot:
  1. Muzzle = pos + fwd(heading) * (length/2 + 0.5).
  2. Aim: among other non-wrecked cars within `GUN_RANGE`, pick the one with the smallest angle to the heading if that angle <= 7 deg **and** a ray from the muzzle to it hits that car's collider first. Aim direction = toward it; else the heading.
  3. Spread: rotate the aim direction by `world.rng.range(-1.2, 1.2)` deg.
  4. Ray: `physics.castRay(new Ray(muzzle, dir), GUN_RANGE, true, undefined, undefined, shooterCollider)`. Reuse one `Ray` object (mutate `origin`/`dir`).
  5. Hit a car: `applyDamage(target, eff.gunDps / GUN_RATE, 'gun', shooter, hitPoint)`. Hit a wall/prop: `hitWall = true`.
  6. Emit `gunShot` with from, to (hit point or max range point), hitCar, hitWall.
  7. `gunHeat += 0.055`; if >= 1: `gunHeat = 1`, `gunOverheated = true`, emit `gunOverheat`, stop firing this tick.

## 4. `updateMines`
- Drop: on `dropMine` rising edge (`input.dropMine && !prevInput.dropMine`), if `mines > 0`, `mineCooldown <= 0`, racing, not wrecked: create at `pos - fwd * (length/2 + 1.0)`, `mines--`, `mineCooldown = 0.5`, emit `mineDropped`. If 24 mines exist, remove the oldest first (no event).
- Age and arm: `age += dt`; `armed = age >= 0.6`. Remove at age >= 45 (no event).
- Trigger: an armed mine explodes when any non-wrecked car's center is within `2.0 + car.width/2`, the owner included. Unarmed mines never trigger: the 0.6 s arm time is what protects the owner.
- Explosion: for each car within 4.0 m: `dmg = lerp(40, 20, d / 4)`, `applyDamage(car, dmg, 'mine', owner === car ? null : owner, minePos)`, velocity change 8 m/s away from the mine (`body.applyImpulse(dir * 8 * mass)`), angVel += `rng.chance(0.5) ? 3 : -3`. Emit `mineExploded` with `hitCars`. Remove the mine.
- `mineCooldown = max(0, mineCooldown - dt)`.

## 5. `updatePickups`
- Inactive pickups: `respawnIn -= dt`; at <= 0, `active = true`, emit `pickupRespawned`.
- Active: the first car (lowest id, deterministic) within `2.2 + width/2` that is not wrecked and not at the cap for that kind collects it: apply the effect from content.md section 6, `active = false`, `respawnIn = 12`, emit `pickupCollected`.

## 6. Tests (`combat.test.ts`)
Build the sim with `createSimWithWorld(buildQuickRaceSetup({ seed: 1, aiCount: 3 }))` (test-only export from WP00's `src/sim/index.ts`, returns `{ sim, world }`), with `ai: null` for **every** entrant (WP00 test rule: the stub AI moves and shoots, and WP07's real AI will too). Drive any car by passing its frame in `inputs` (e.g. `new Map([[0, fire], [1, fire]])` for test 13). Set `world.phase = 'racing'` directly and place cars on the main straight by teleporting. Read damage, rate and heat numbers from the `src/content` constants rather than literals, so WP12 tuning moves them with the content.

| # | Test | Pass condition |
|---|---|---|
| 1 | Gun hits in front | target 20 m ahead on the heading: 1 s of fire deals `gunDps * 1s` +- 1 shot |
| 2 | Aim assist | target 20 m ahead, 5 deg off-axis: hits; 10 deg off-axis: misses (shots go straight) |
| 3 | Range | target at 50 m: no damage |
| 4 | Walls block | wall between shooter and target: `hitWall` true, no damage |
| 5 | Overheat | continuous fire overheats in 1.4-1.6 s, firing stops, resumes after heat < 0.35 (~1.4 s later) |
| 6 | Mine arm | a car standing on its own mine for 0.5 s: no explosion; another car driving over it after 0.7 s: explosion, damage 20-40, `by = owner` |
| 7 | Mine cap | dropping 26 mines (refill mines between drops) leaves 24 on track |
| 8 | Collision damage | car A at 25 m/s into stationary car B: both damaged, B's `by` = A; a 7 m/s bump does no damage but emits `impact` |
| 9 | Wall damage | 30 m/s head-on into a wall: damage = impact - 9 (+-15%) |
| 10 | Wreck credit | A shoots B to 0 hp: `carWrecked.by = A`, `A.wrecksCaused === 1`; nearby car C takes 20 explosion damage |
| 11 | Pickups | cash pickup collected once, inactive 12 s, respawns; a full-hp car does not take repair |
| 12 | Turbo | turbo held for 5 s with 4 s available: active for 240 +- 1 ticks (float drain), `turboEnd` emitted once |
| 13 | Determinism | a 1200-tick scripted fight (two cars circling and firing, mines dropped) gives the same stateHash twice |

## Out of scope
Vehicle dynamics, laps and positions (WP01), AI decisions (WP07), visuals and sounds of any of this.

## Acceptance criteria
- 13 tests green, `npm run verify` green.
- Browser pane via `preview_start` on your `wreckline-wp02` entry, `?harness=debug2d`: `__harness.setInput({ throttle: 1, fire: true })` + `step(300)` -> `gunShot` events seen and drawn as tracers; the stub AI cars drop mines and at least one `mineExploded` occurs within `step(60 * 30)` (assert from events collected via `__harness.step`'s return or `snapshot()`).
- No per-tick allocation except events.
