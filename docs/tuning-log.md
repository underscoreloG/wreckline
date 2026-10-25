# Tuning log

Every change to a tuning value after WP00 (content.md, AI scale constants, camera, effects) is recorded here: what, before/after, why, and the measurement behind it.

## 2026-10-25 - Tuning pass 1 (WP17): faster, more pickups

User, after playing v0.2.0: "seems to be working great, it is a little bit too slow in my opinion. And I would love a little bit more bonuses on the race"

Chosen direction: faster cars plus a stronger sense of speed, and more of the existing pickups (no new kinds). A pace and density change, not a rework.

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/content/cars.ts` | maxSpeed raven / outlaw / iceberg / scorch / blaze / titan / viper / wraith | 34 / 33 / 32 / 37 / 40 / 35 / 43 / 45 | 39.1 / 38 / 36.8 / 42.6 / 46 / 40.3 / 49.5 / 51.8 | x1.15: "too slow" (content.md section 1) |
| `src/content/cars.ts` | accel, same order | 13 / 15 / 12 / 15 / 16 / 13 / 17 / 18 | 15.6 / 18 / 14.4 / 18 / 19.2 / 15.6 / 20.4 / 21.6 | x1.20: snappier launches out of corners |
| `src/content/pickups.ts` | `PICKUP_RESPAWN_SECONDS` | 12 | 8 | "more bonuses" (content.md section 6) |
| `src/content/tracks/scrapyard.ts` | pickups | 6 (cash 3, mines 1, repair 1, turbo 1) | 12 (cash 4, mines 3, turbo 3, repair 2) | "more bonuses" (content.md section 12) |
| `src/content/tracks/scrapyard.ts` | `referenceLapTime` | 31 | 27.5 | re-measured: 0.55 AI median clean lap 27.70 s, rounded to 0.5 s |
| `src/render/camera.ts` | height at rest / at maxSpeed | 52 / 64 m | 46 / 62 m | closer at low speed, bigger pull-back at speed sells the pace (design.md section 2) |
| `src/render/fx.ts`, `particles.ts` | speed streaks on the player's turbo | none | 20-30 white additive lines, 0.05 m x 4-8 m, 0.25 s, ring 6-20 m, aligned with velocity, fade in and out, player only, quality high only | sense of speed (design.md section 3, turbo row) |

Not changed: brake, handling constants in `vehicle.ts`, AI scale constants (`AGGRESSION_SCALE` stays 0.2: all health numbers stayed in range).

### Before / after (headless `runSoak`, Scrapyard x 3 laps, seeds 1-16, AI 0.35/0.55/0.75 + autoplay 0.55)

"Before" was measured on the same branch before any value changed (v0.2.0 values), "after" with the final values.

| Metric | Before | After | Target (WP07) |
|---|---|---|---|
| 0.55 AI median clean lap | 30.95 s (16 clean laps) | 27.70 s (28 clean laps) | - |
| Raven 0-100 km/h (full throttle from rest, WP01 test 2 method) | 2.17 s | 1.78 s | - |
| Wall impacts per race (all cars, impact events >= 4 m/s) | 1.75 | 2.94 | - |
| Hard wall impacts per race (>= 10 m/s) | 0.19 | 0.88 | - |
| Wrecks per race | 0.75 | 0.25 | 0.2-2.0 |
| Pickups collected per race (all cars) | 8.7 | 21.9 | - |
| Gun damage events per race | 79.3 | 44.9 | >= 6 |
| Mines dropped per race | 4.13 | 3.81 | >= 1 |
| Max stuck episodes (non-wrecked car, one race) | 0 | 0 | <= 2 |
| Avg position 0.35 / 0.75 (gap) | 3.38 / 2.13 (1.25) | 3.69 / 2.81 (0.88) | gap >= 0.8 |
| End reasons | allFinished 11, playerWrecked 4, playerFinished15s 1 | allFinished 16 | no timeout |

### Notes for the next pass

- Lap time drops 10.5% for a 15% top speed gain: the model is turn-rate limited, so the gain shows on straights.
- Wrecks fell from 0.75 to 0.25 per race (floor 0.2) and no race ended on a player wreck: more repair pickups (2 at 8 s respawn) and a more spread-out pack mean fewer kills. Probe only, not applied: `AGGRESSION_SCALE` 0.3 gives 0.31 wrecks, gap 1.06, gun events 62.4. If the user misses the carnage, that is the first knob.
- Skill gap fell from 1.25 to 0.88 places (floor 0.8): the 0.55 autoplay car now often beats the 0.75 car.
- Pickups collected went 8.7 -> 21.9 per race (x2.5), more than "a little bit more". If it feels like too much, go back to a 12 s respawn first (keeps the 12 placements).
- Wall impacts +68%, hard ones x4.7 (0.19 -> 0.88 per race), but without more stuck cars or wrecks.
- `DRIFT_THRESHOLD` (vehicle.ts) is an absolute 3.5 m/s lateral speed, so plain full steer now flags `drifting` (smoke, skid marks; no dynamics change) from ~25 m/s, which the cars now reach. Test 9b moved from 65% to 60% of top speed.

## 2026-10-25 - AI stops pushing wrecks (WP24, CCR-7)

WP23a saw the 0.75 AI shove a wreck at 6.4 m/s on full throttle for 70+ s on Pine Hollow. Cause: avoidance (`src/sim/ai.ts`) skipped any car not slower than the AI, and a pushed wreck moves at the pusher's speed; the stuck detector missed it (speed > 1.5 m/s).

### Changed (AI behaviour, `src/sim/ai.ts`; no scale constant changed)

| Rule | Before | After | Why |
|---|---|---|---|
| Who blocks | cars ahead > 1 m/s slower | same, plus any wreck in the cone whatever its speed | the CCR-7 one-liner |
| Avoid target for a wreck | racing line +-3.5 m, side picked from the line | at least `WRECK_CLEAR` 3.5 m from the wreck, on the side the AI is on (shoulder allowed up to 2 m from the wall), the other side only if < 2.5 m of room; never toward the wreck | with the one-liner alone the AI steered 3.5 m off its line and dragged the wreck along |
| Speed near a wreck | no change | crawl at <= 3 m/s while a wreck is within 8 m in the cone | full throttle against a wreck shoves it whatever the steering |
| Pickups | override the target lateral | ignored while a wreck blocks | a needed pickup behind a wreck sent the AI straight into it (Pine Hollow seed 5) |
| `src/content/tracks/frostbite.ts` `referenceLapTime` | 33 | 32.5 | re-soaked median 32.74 s, 0.26 s off 33 (test tolerance 0.25), rounded to 0.5 s |

Regression test (`ai.test.ts`, stadium straight, wreck on the 0.75 AI's line 30 m ahead, AI at 20 m/s): on main the AI shoves it 82.6 m in 10 s and never passes; with only the one-liner the same; with the full fix it passes after 2.97 s and the wreck moves 9.8 m. A 144-case scratch sweep (skills 0.35/0.55/0.75, 5-30 m/s, wreck 10/30 m ahead, offset -1.5/0/+1.5 m, square or turned 1.2 rad): main 88 ok, one-liner 79, one-liner + crawl only 109, one-liner + wreck target only 102, full fix 144.

### Before / after (headless `runSoak`, 10 tracks x 3 laps, seeds 1-16, AI 0.35/0.55/0.75 + autoplay 0.55)

"Before" was measured on the WP24 branch (main 83e2c69 code) with the same seeds. Shove = metres a wreck travels more than 3 s after wrecking (scratch metric, per race), with the longest continuous shove at > 2 m/s.

| Track | 0.55 median clean lap (s) | Wall impacts / race | Wrecks / race | Shove m / race (longest) | End reasons (all = allFinished, p15 = playerFinished15s, pW = playerWrecked) |
|---|---|---|---|---|---|
| scrapyard | 27.68 -> 27.67 | 2.94 -> 2.94 | 0.25 -> 0.38 | 5.5 -> 2 (6 -> 1.7 s) | all 16 -> all 15, pW 1 |
| dustBowl | 36.13 -> 36.13 | 2.81 -> 2.88 | 0.31 -> 0.31 | 0.3 -> 0.1 (0.7 -> 0.4 s) | all 14, pW 2 -> all 13, p15 1, pW 2 |
| dockside | 30.78 -> 30.78 | 3.63 -> 3.81 | 0.69 -> 0.63 | 0.8 -> 0.7 (0.8 -> 0.8 s) | all 10, p15 2, pW 4 -> all 11, p15 1, pW 4 |
| frostbite | 32.78 -> 32.74 | 0.69 -> 0.56 | 1.19 -> 1.13 | 52 -> 3.1 (33.3 -> 1.1 s) | all 10, p15 5, pW 1 -> all 14, p15 1, pW 1 |
| neonMile | 39.15 -> 39.18 | 2.63 -> 2.63 | 0.50 -> 0.56 | 30 -> 3.9 (25.5 -> 1.5 s) | all 12, p15 4 -> all 14, p15 1, pW 1 |
| redrock | 34.82 -> 34.85 | 2.88 -> 2.88 | 0.69 -> 0.63 | 17.8 -> 3.4 (38.7 -> 1.3 s) | all 13, pW 3 -> all 13, pW 3 |
| junkyardSprint | 22.79 -> 22.79 | 2.75 -> 2.75 | 0.50 -> 0.50 | 0.2 -> 1.1 (0.6 -> 3.2 s) | all 13, p15 1, pW 2 -> all 12, p15 2, pW 2 |
| pineHollow | 36.42 -> 36.42 | 2.00 -> 1.94 | 0.81 -> 0.88 | 36.4 -> 4.3 (44.7 -> 3.7 s) | all 12, p15 2, pW 2 -> all 14, pW 2 |
| rainDistrict | 31.60 -> 31.60 | 2.50 -> 2.50 | 0.38 -> 0.38 | 2.5 -> 1.5 (6.2 -> 1.9 s) | all 16 -> all 16 |
| blastPit | 41.15 -> 41.17 | 2.44 -> 2.25 | 0.38 -> 0.44 | 0 -> 0.7 (0 -> 1.1 s) | all 13, pW 3 -> all 13, pW 3 |

WP07 gates after: no timeout, every early end has all live cars on the last lap, max stuck episodes 0 on every track, wrecks 0.31-1.13 per race (gate 0.2-2.0). Races with a shove over 10 s: 10 of 160 before (frostbite 4, neonMile 3, pineHollow 2, redrock 1), 0 after. Fewer races end on playerFinished15s (14 -> 6): before, a shoving AI often held the field up until the 15 s rule.

Old Pine Hollow starts: WP23a's first start is not recorded, so 24 start points round the loop (seed 8, same pickups) were scanned: before, 5 of them had a wreck shoved for 8.6-42.3 s (106-288 m); after, the longest shove at any of them is 6.4 s. The 12 starts x 16 seeds scan had no gate failure before or after.

### Notes for WP12

- Frostbite and Junkyard Sprint sit 0.24 / 0.21 s off their reference: any pace change will push them out of the 0.25 s tolerance.
- After passing a wreck on the far side of its line the AI's avoid offset can be large (up to ~14 m) and decays at 2 m/s, so it can run off-line for a few seconds after the pass.
- The general (non-wreck) avoidance still picks its side from the racing line, not from where the blocking car is.

## 2026-10-25 - AI recovers when glued to a wreck (CCR-8, in WP12)

A crawling AI (WP24: <= `WRECK_CRAWL` 3 m/s while a wreck is within 8 m ahead) could stay in contact with the wreck (~3.2 m centre to centre) at 0.6-2.6 m/s and shove it for 30-200 s. Above `STUCK_SPEED` 1.5 m/s the stuck recovery never fired; below it, the 1 s reverse left the car too close to turn round the wreck and it nosed straight back in. Seen in WP12's probe (rainDistrict seed 14 with the 0.75 AI in slot 0: the race timed out) and, with the WP12 retune values, in the gate tests pineHollow seed 12 and frostbite seed 13 (a 0.35 AI a lap down behind a wreck in a hairpin) and blastPit seed 6 (the autoplay car pushed a wreck along the wall at 0.6 m/s for 200 s: timeout).

### Changed (AI behaviour, `src/sim/ai.ts`; no scale constant changed)

| Rule | Before | After | Why |
|---|---|---|---|
| Stuck timer | counts while \|speed\| < 1.5 m/s | also counts while \|speed\| < `WRECK_CRAWL` with a wreck within `WRECK_GLUE_RANGE` 4.5 m ahead | the existing reverse recovery then runs; it steers toward the avoid target, which is away from the wreck |
| Reverse time | `REVERSE_TIME` 1 s | `WRECK_REVERSE_TIME` 2.5 s when the stuck came from a wreck, else 1 s | the stuck-timer change alone fixed rainDistrict seed 14 but not pineHollow 12 / blastPit 6 (1 s of reverse is not enough room to turn); 2, 2.5 and 3.5 s all fixed the three gate cases, 2 s cost pineHollow 12 a wreck, 2.5 s kept |

Regression test: `ai.test.ts` "wrecks (CCR-8) > an AI glued to a wreck below crawl speed recovers: rainDistrict seed 14, 0.75 AI in slot 0, finishes before the soak timeout" (fails on main: no result before the timeout; passes with the fix). `npm test` 533/533 with the fix at main's tuning values.

### Before / after (main 46c088f tuning values, WP12 probe: 10 tracks x 16 seeds x 4 grid rotations)

Shove = metres a wreck travels more than 3 s after wrecking, per race; longest = longest continuous run with the wreck moving > 0.5 m/s (WP24 used > 2 m/s, which misses a 0.6-2.6 m/s glue; the old 1 s reverses also split the run).

| Track | Wrecks / race | Shove m / race | Longest (s) | Timeouts |
|---|---|---|---|---|
| scrapyard | 0.45 -> 0.44 | 4.8 -> 4.0 | 8.9 -> 3.5 | 0 -> 0 |
| dustBowl | 0.50 -> 0.50 | 2.7 -> 2.5 | 6.2 -> 6.2 | 0 -> 0 |
| dockside | 0.44 -> 0.44 | 1.0 -> 1.0 | 2.3 -> 2.3 | 0 -> 0 |
| frostbite | 0.64 -> 0.64 | 3.0 -> 2.6 | 9.4 -> 3.4 | 0 -> 0 |
| neonMile | 0.73 -> 0.73 | 4.3 -> 4.3 | 5.1 -> 5.1 | 0 -> 0 |
| redrock | 0.52 -> 0.52 | 2.1 -> 2.1 | 2.4 -> 2.4 | 0 -> 0 |
| junkyardSprint | 0.45 -> 0.45 | 1.4 -> 1.2 | 4.2 -> 3.0 | 0 -> 0 |
| pineHollow | 0.84 -> 0.84 | 2.7 -> 2.7 | 6.6 -> 6.6 | 0 -> 0 |
| rainDistrict | 0.30 -> 0.30 | 2.9 -> 1.3 | 11.0 -> 3.6 | 1 -> 0 |
| blastPit | 0.69 -> 0.67 | 3.4 -> 1.9 | 3.9 -> 3.7 | 0 -> 0 |

Every other probe number is unchanged to two decimals (gun share 0.44, mine hits 4.41, spread 0.91 worst, lap medians identical at start 0).
