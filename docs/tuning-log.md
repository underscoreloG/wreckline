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

## 2026-10-25 - Balance pass (WP12): 10 tracks, career length

Probes (`scripts/balance/`, run with `node scripts/balance/run.mjs`): every track x 16 seeds x 4 starts. A start is a grid rotation: the four soak drivers (autoplay 0.55, AI 0.35/0.55/0.75, stock ravens) are rotated over the four grid slots, so each skill starts from each slot (WP22: start position swings walls and wrecks 2x). Start 0 is exactly `runSoak` (it reproduces WP24's numbers: Frostbite 32.74 s / 1.13 wrecks, Scrapyard 27.67 s / 0.38). The lap-time row uses start 0 only, the grid every `referenceLapTime` was measured on: on rotated grids a 0.55 car sits behind the 0.35 for whole laps without contact, which the clean-lap rule does not catch (Frostbite +1.3 s). The career rows run `simulateCareer` (model, not physics) on seeds 1-16.

### Baseline (main 46c088f values, post-WP24 AI)

| Metric | Value | Target |
|---|---|---|
| Wrecks per AI race | 0.30-0.84 by track (avg 0.56) | 0.2-2.0 |
| Gun damage share | 0.44 | 0.45-0.65 |
| Mine hits per race | 4.41 | 0.8-3 |
| AI finish spread 0.75 vs 0.35 (worst track) | 0.91 (neonMile) | >= 0.8 |
| Lap time, worst track (start 0) | 0.24 s (Frostbite 32.74 vs 32.5) | +-1 s |
| Career greedy (WP09 model) | 0/16 champions within 60 races | 18-35 in >= 14/16 |
| Career safe | 0/16 champions | 25-50 or never |
| Greedy cash by race 5 | 6500 worst seed | >= 1000 |

### Model change: careerSim strength (not a tuning change)

WP09's `playerSkill = 0.35 + 0.1 * avgUpgrade + 0.15 * tier` ignored Rocket Fuel and Bumper Spikes, and compared the player's car-and-upgrade score with the rivals' bare driver skill. Replaced by one strength for everyone: `driver value + CAR_VALUE[car] + sum(LEVEL_VALUE[line] * level)`, used for the player and for every rival (their own car and `rivalUpgradeLevel`/`rivalSpikesLevel`), in both the greedy offer prediction and the race result draw (weight `exp(SKILL_WEIGHT_K * strength)`, unchanged K = 4).

Measured with `node scripts/balance/run.mjs --calibrate`: one car with a variant against three stock 0.55 ravens, scrapyard/dockside/junkyardSprint/pineHollow x 16 seeds x 4 grid slots (256 races per variant). Average place -> Plackett-Luce log-weight vs the field -> / 4 = skill units. Driver skill 0.15 -> 1.1 spans 3.8 log units, so K = 4 holds for the driver term.

| Variant | Avg place | Skill units | Model value |
|---|---|---|---|
| skill 0.15 / 0.35 / 0.45 / 0.55 / 0.65 / 0.75 / 0.95 / 1.1 | 3.79 / 3.48 / 2.90 / 2.50 / 2.25 / 1.83 / 1.82 / 1.67 | -0.65 / -0.39 / -0.14 / 0 / +0.09 / +0.24 / +0.25 / +0.31 | `DRIVER_CURVE` = 0.55 + these (the AI gains little above 0.75) |
| engine 2 / 5 | 1.47 / 1.21 | +0.42 / +0.65 | 0.14 per level (least squares) |
| tires 2 / 5 | 2.21 / 1.94 | +0.10 / +0.20 | 0.041 per level |
| armor 5 | 2.21 | +0.10 | 0.02 per level |
| gun 5 | 2.38 | +0.04 | 0.008 per level |
| fuel 5 | 2.14 | +0.12 | 0.025 per level |
| spikes 3 | 2.51 | 0 | 0 (the AI never rams on purpose; a human may get more) |
| car outlaw / iceberg / scorch / titan / blaze / viper / wraith | 2.86 / 3.26 / 1.46 / 1.88 / 1.08 / 1.04 / 1.01 | -0.12 / -0.28 / +0.43 / +0.22 / +0.89 / +1.08 / +1.38 | `CAR_VALUE` (viper and wraith saturate: lower bounds) |

The human driver is an assumption: `PLAYER_DRIVER_SKILL` 0.75. User, asked how they finish a 3-lap quick race against the 0.35/0.55/0.75 AIs: "Mostly 1st-2nd".

Probe player (greedy shop, `shopVisit`): it bought one level of every line on every visit, so it maxed the Raven and lost it all on trade-in, and never reached a Viper inside 60 races. Now: repair, then the next car when affordable with `CAR_MARGIN` 1000 left, then one level per line in the same priority, but no level above `SAVE_ABOVE_LEVEL` 1 while a better car is for sale (it saves). Offer policy unchanged.

With the measured model and main's content, greedy stays 0/16 at driver 0.55, 0.75 and 1.0: the top rivals' packages (Viper/Blaze at L4, 2.5-3.0) and the boss (skill 1.1 + Wraith L5 + 6% speed, about 3.6) are out of reach of any gear a 60-race income buys, and the top rivals score about 6 points per race off-screen.

User decision (asked with the numbers above): "Beatable boss (Recommended)": weaker rival gear, lower off-screen scoring for the top rivals, boss down to about a well-upgraded Viper.

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/sim/ai.ts` | `MINE_USE_SCALE` | 1 | 0.6 | mine hits 4.41 per race (target 0.8-3) |
| `src/sim/ai.ts` | `AGGRESSION_SCALE` | 0.2 | 0.25 | fewer mines dropped wrecks below 0.2 on 4 tracks; more gunfire also lifts gun share (0.44, target 0.45-0.65). 0.3 broke the spread on Dust Bowl (0.66) |
| `src/content/weapons.ts` | `MINE_DAMAGE_CENTER` / `MINE_DAMAGE_EDGE` | 40 / 20 | 50 / 25 | fewer but punchier mines keep Scrapyard's wrecks (mine-driven) above 0.2 and the Scrapyard soak gate in `ai.test.ts` green (0.125 at 0.25/0.6 with 40/20). gunDps x1.1 on every car was tried and dropped: no gain on Scrapyard, spread 0.84 |
| `src/content/tracks/dustBowl.ts` | `referenceLapTime` | 36 | 35.75 | soak median 35.75 s (29 laps), exactly between two 0.5 s steps: both 35.5 and 36 miss the 0.25 s test tolerance by 2e-12 |
| `src/content/tracks/neonMile.ts` | `referenceLapTime` | 39 | 38.5 | soak median 38.50 s (16 laps, still shaky) |
| `src/content/tracks/blastPit.ts` | `referenceLapTime` | 41 | 41.5 | soak median 41.47 s (41.50 with CCR-8) |
| `src/content/rivals.ts` | `rivalUpgradeLevel` | floor(skill * 5) | floor(skill * 2) | rival gear: rivals under 0.5 run L0, 0.5-0.96 L1, the boss L2 (fuel included). M = 3 left greedy at 24-54 races |
| `src/content/ai.ts` | `BOSS_MAX_SPEED_MULT` | 1.06 | 1 | user: boss beatable; the calibration did not include the 6%, so the game boss now matches the modelled one (strength 2.71 vs 2.11 for the best rival) |
| `src/meta/offSim.ts` | `OFF_SIM_MEDIAN_SKILL` easy / medium / hard | 0.25 / 0.55 / 0.85 | 0.5 / 1.0 / 1.2 | off-screen expected points per race: BANSHEE 6.0 -> 3.1, mid-pack (0.6) 3.5 -> 1.7, bottom (0.1) 1.1 -> 0.5; stays monotone in skill, so the standings keep their order (a hard median of 1.6 alone also gave careers in range but put JINX 0.65 on top) |
| `src/content/economy.ts` | prizes easy / medium / hard | 600-350-150-0 / 1200-700-300-0 / 2500-1400-600-100 | 900-530-230-0 / 1800-1050-450-0 / 3750-2100-900-150 | x1.5: the mid career saved for the Viper in easy races at ~500 net per race (Viper at race 23-26); x1.3 gave 13-14/16. Sabotage prices follow (30% of 1st: 270 / 540 / 1125, boss 3000) |
| `src/content/cars.ts` | Viper price | 16000 | 12000 | margin on unseen seeds: at 14000, seeds 17-32 gave 13/16 (tail 36-38 from boss attempts); 12000 gives 15/16 on both sets |
| `src/content/cars.ts` | Titan price | 11000 | 9000 | keeps an even 6000 / 9000 / 12000 ladder; at 11000 the Titan would sit 1000 under the Viper (the probe player skips the Titan either way) |
| `src/meta/career.ts` | `MEDIUM_RANK_WINDOW` | 3 | 5 | at a fresh career (rank 20) medium drew the same 3 rivals as easy every time (ranks 17-19 = r01-r03); now a random 3 of ranks 15-19, the same set 1 time in 10. Career length unchanged (15/16) |

Combat feel check on port 5212 (AI scales and mine damage above), user: "Good, keep it".

Pinned test expectations updated with these values (logic unchanged): `career.test.ts` (medium window 5, medium prizes, payout 1050 + 375 + 400 = 1825, rival levels floor(skill * 2), boss levels 2 and no speed bonus), `careerSim.test.ts` (player skill 0.79 at start, 3.04 for a maxed Viper; car-first shop cash 40 and 3200; Viper 12000), `sabotage.test.ts` (prices 270 / 540 / 1125, refund 540, rival and boss fuel floor(skill * 2): the boss now has fuel 2, content.md said 5), `shop.test.ts` (Titan 9000).

### After (all 10 tracks x 16 seeds x 4 starts, on top of CCR-8)

| Track | Wrecks / race | Mine hits / race | Gun share | Spread 0.75 vs 0.35 | 0.55 median clean lap, start 0 (s) |
|---|---|---|---|---|---|
| scrapyard | 0.45 -> 0.23 | 3.80 -> 2.27 | 0.33 -> 0.43 | 1.58 -> 1.66 | 27.67 -> 27.69 |
| dustBowl | 0.50 -> 0.80 | 3.70 -> 2.36 | 0.53 -> 0.62 | 1.16 -> 0.95 | 36.13 -> 35.75 |
| dockside | 0.44 -> 0.39 | 4.63 -> 2.80 | 0.38 -> 0.50 | 2.16 -> 2.13 | 30.78 -> 30.90 |
| frostbite | 0.64 -> 0.48 | 3.81 -> 2.45 | 0.49 -> 0.57 | 1.69 -> 1.77 | 32.74 -> 32.58 |
| neonMile | 0.73 -> 0.83 | 6.52 -> 4.45 | 0.36 -> 0.45 | 0.91 -> 0.97 | 39.18 -> 38.50 |
| redrock | 0.52 -> 0.75 | 3.52 -> 2.27 | 0.51 -> 0.59 | 1.73 -> 1.17 | 34.85 -> 34.97 |
| junkyardSprint | 0.45 -> 0.42 | 5.16 -> 3.23 | 0.33 -> 0.44 | 1.64 -> 1.36 | 22.79 -> 22.77 |
| pineHollow | 0.84 -> 0.88 | 4.69 -> 2.86 | 0.51 -> 0.57 | 0.98 -> 1.23 | 36.42 -> 36.39 |
| rainDistrict | 0.30 -> 0.23 | 3.66 -> 2.19 | 0.38 -> 0.46 | 1.67 -> 1.34 | 31.60 -> 31.53 |
| blastPit | 0.69 -> 0.61 | 4.67 -> 3.52 | 0.53 -> 0.61 | 1.38 -> 1.59 | 41.17 -> 41.50 |

| Metric | Before | After | Target |
|---|---|---|---|
| Wrecks per AI race | 0.30-0.84 (avg 0.56) | 0.23-0.88 (avg 0.56) | 0.2-2.0 |
| Gun damage share | 0.44 | 0.53 | 0.45-0.65 |
| Mine hits per race | 4.41 | 2.84 | 0.8-3 |
| Spread, worst track | 0.91 | 0.95 (dustBowl) | >= 0.8 |
| Lap time, worst track (start 0) | 0.24 s (frostbite) | 0.23 s (junkyardSprint) | +-1 s |
| Career greedy, seeds 1-16 | 0/16 within 60 | 15/16 in 18-35 (22-33, one 38) | >= 14/16 |
| Career greedy, seeds 17-32 (check) | - | 15/16 (20-35, one 36) | - |
| Career safe | never | never (safe never takes the boss by definition) | 25-50 or never |
| Greedy cash by race 5, worst seed | 6500 | 10250 | >= 1000 |

Same check at 32 seeds before the career changes and before CCR-8 (races only): wrecks 0.20-0.81, gun 0.57, mines 2.41, spread 1.07, worst lap 0.67 s.

### Measured, not changed

- Rival loadouts in races (measured before CCR-8; `--loadout rival`, each AI car upgraded like a career rival of its skill with the new floor(skill * 2): 0.35 -> L0 spikes 1, 0.55 -> L1 spikes 1, 0.75 -> L1 spikes 2): wrecks 0.20-0.48 (avg 0.34, armor), gun 0.51, mines 2.61, spread 1.69 or more on every track (gear gaps add to skill), laps 1.0-2.5 s faster than the stock references. WP20's fuel 4 / spikes 2 probe (wrecks 0.25 -> 0.56) no longer applies: rivals now carry fuel 0-1.
- Career sensitivity to the driver assumption (seeds 1-16): driver 0.55 -> 31-47 races (2/16 inside 35); driver 1.0 -> 18-37.

### Notes for the brain / next pass

- CCR-8 applied in its own commit before this pass (entry above): with these values it was what failed pineHollow seed 12, frostbite seed 13 and blastPit seed 6; after it, 0 probe timeouts and `npm test` 533/533. No gate seed was changed.
- Wrecks on Scrapyard and Rain District sit at 0.23 (floor 0.2; 0.4-1.5 preferred). Next knob if the user wants more carnage: `AGGRESSION_SCALE` 0.3 (costs Dust Bowl spread, 0.66 measured).
- Mine hits 2.84 sit near the 3 ceiling (Neon Mile 4.45, Blast Pit 3.50 are the high tracks).
- content.md needs the new numbers (rival levels floor(skill * 2), boss fuel follows it, no boss speed bonus, prizes, Viper 12000, Titan 9000, mine damage 50/25).

## 2026-10-25 - Engine voice per car (WP25)

Each car has its own synth profile (`src/audio/engineProfiles.ts`); the game names the race cars through `setRaceCars` (CCR-9), so rpm01 = |speed| / that car's effective maxSpeed. MIX levels unchanged (`MIX.engine` player 0.28, AI 0.12); per-profile `level` trims stay at 1 because every profile already sits within +-3 dB of raven.

Offline check (`?harness=audio`, "offline level check"): one voice at the player level through the real bus, 48 kHz. Level at rpm01 0.5 on throttle; fundamental (normalised autocorrelation, so the sub-octave square counts when it is strong) and spectral centroid (8192-point FFT) at rpm01 0.2 and 0.8 on throttle. Character is by measurement only, not verified by ear.

| car | target | peak dBFS | rms dBFS | vs raven | fund 0.2 (Hz) | centroid 0.2 (Hz) | fund 0.8 (Hz) | centroid 0.8 (Hz) |
|---|---|---|---|---|---|---|---|---|
| raven | V8 burble | -7.9 | -17.0 | 0 | 62.2 | 1507 | 67.1 | 1433 |
| outlaw | small rough engine | -7.9 | -18.3 | -1.3 | 95.3 | 2470 | 91.1 | 2530 |
| iceberg | diesel SUV | -8.1 | -16.2 | +0.8 | 45.8 | 3347 | 42.2 | 3342 |
| scorch | big-block hot rod | -6.6 | -14.9 | +2.1 | 45.7 | 1217 | 48.8 | 1190 |
| blaze | high-revving four | -9.5 | -19.1 | -2.1 | 139.6 | 3546 | 123.4 | 3510 |
| titan | diesel truck | -7.5 | -15.5 | +1.5 | 23.3 | 2505 | 30.7 | 2572 |
| viper | V10/V12 scream | -10.7 | -19.3 | -2.3 | 234.0 | 2558 | 309.0 | 2687 |
| wraith | supercharged V8 | -6.9 | -16.2 | +0.8 | 56.9 | 1477 | 62.0 | 1445 |

No two cars are within 5% on both fundamental and centroid at either rpm. First pass had wraith = raven (1509 vs 1507 Hz centroid): a 12x blower whine sat inside the tone's own centroid. Fix: whine at 24x the engine frequency, blower level 0.25, base pitch ~8% under raven.

Cost: 15 nodes per engine voice (WP05: 8), still one voice per car in the voice count. Game race check (raven, viper, blaze, titan, career offer): no console errors, at most 39 live Web Audio sources in 35 s with guns, mines and turbo (24 of them the 4 engines and 4 skids). Harness fake race: max 11 voices (cap 48).

For the listening session: the user judges each car with the per-car sweep buttons, and the recorded Mercedes 190E bench against blaze. Knobs per car: pitch (`base`, `span`, `step`, `gears`), `revTau`, `sub`, lowpass, noise layer (`noise`, `noiseHz`, `noiseQ`, `pulse`), idle wobble, `blower`, `level`.

## 2026-10-25 - Headlight beams and boost feel (WP26)

User: "Car lights are kind of weird with 2 layers. small and big cone" and "Car speed boost, I would like the shinny things to be less visible and a better sensation of speed". Grill choices: two soft beams on dark themes only; boost feel from camera kick, screen-edge motion, road-level particles and an exhaust flame.

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/render/fx.ts` | headlights | 2 stacked additive triangles per car (14 m faint, 7 m bright), every theme | 2 beams per car, one per lamp at +-`LAMP_OFFSET` 0.3 x car width, `BEAM_LENGTH` 13 m, half width `BEAM_HALF_START` 0.3 -> `BEAM_HALF_END` 2.8 m, `BEAM_FADE_IN` 1 m, `BEAM_PEAK` 0.06, warm white; one grid layer whose vertex colors fade to 0 at the far end and both sides; fog off | "2 layers" |
| `src/render/fx.ts` | headlight themes | all | `HEADLIGHT_THEMES` scrapyard, docks, snow, city (off on desert, quarry) | no headlights in daylight; closes the "desert headlights" ledger note |
| `src/render/fx.ts`, `particles.ts` | speed streaks (WP17) | 20-30 white HDR lines (`STREAK_GLOW` 2.2), high only | removed | "shinny things" |
| `src/render/fx.ts` | exhaust glow particles | 30/s blue-white additive dots | removed | "shinny things" |
| `src/render/fx.ts` | turbo flame | blue-white cone, 1.2-1.8 m | `FLAME_LEN_MIN`-`FLAME_LEN_MAX` 0.9-1.5 m (jitters every frame), `FLAME_RADIUS` 0.22 m, core `FLAME_CORE` (3, 2.4, 1.5) HDR -> orange `FLAME_TIP` (0.7, 0.24, 0.03) at `FLAME_CORE_FRAC` 0.3, fading out to the tip; brightness flicker 0.8-1.15 | only the core blooms |
| `src/render/fx.ts` | road particles (player boost, both qualities) | none | `ROAD_RATE` 140/s, `ROAD_LIFE` 0.35 s, 0.08-0.2 m, `ROAD_ALPHA` 0.3 (fade in and out), world velocity -0.35 x car velocity (`ROAD_BACK`), `ROAD_STRETCH` 0.1 s, spawned 5 m ahead to 2 m behind, car width + 3.5 m each side; colors `ROAD_COLORS` per theme (dust, spray, snow, grit); alpha blended, no bloom | sense of speed |
| `src/render/camera.ts` | turbo FOV | +3 deg, 0.25 s time constant | kick on turboStart: +`KICK_FOV_PEAK` 7 deg reached in `KICK_OUT` 0.15 s, settles to +`KICK_FOV_HOLD` 4 deg (`KICK_SETTLE_TAU` 0.3 s) while turbo lasts, back to 0 (`KICK_RELEASE_TAU` 0.25 s); not affected by the shake setting | sense of speed |
| `src/render/camera.ts` | turboStart shake | none | trauma +`KICK_TRAUMA` 0.35 (0.15 m), only with "camera shake" on | kick |
| `src/render/post.ts` | screen-edge zoom blur (high only) | none | own `EffectPass` (SMAA is also a convolution effect), enabled only while its strength > 0; `EDGE_SAMPLES` 8, `EDGE_SPAN` 0.06, sharp inside uv radius `EDGE_INNER` 0.25, full at `EDGE_OUTER` 0.6; strength = speed / maxSpeed (clamped 0..1) while boosting, ramps at 1 per `EDGE_FADE` 0.2 s (camera.ts) | sense of speed |

Knobs: "more kick" = `KICK_FOV_PEAK` / `KICK_FOV_HOLD`; "less blur" = `EDGE_SPAN` (or a larger `EDGE_INNER`); "more road rush" = `ROAD_RATE`, `ROAD_ALPHA`, `ROAD_STRETCH`; "dimmer lights" = `BEAM_PEAK`.

### Measured (dev server, hidden browser pane at 1280x720 x DPR 2, quality high, Scrapyard seed 7, 4 cars)

The pane was hidden, so rAF did not run: frames were driven by `__game.step(1)` and timed with a 1-pixel `readPixels` sync (sim step + render, GPU included).

| Scenario | Draw calls before | After | ms per frame before (median / p95) | After |
|---|---|---|---|---|
| Player holding turbo from the green light, 150 frames | 95 / 95 max | 95 / 96 max | 6.0 / 7.4 | 4.8 / 6.4 |
| `autoplay=1`, 1500 frames from tick 200 (no player turbo in the window) | 73 / 94 max | 73 / 93 max | 3.8 / 6.1 | 4.7 / 6.3 |

Bundle: main JS 4533.8 -> 4535.7 kB raw, 1620.6 -> 1621.5 kB gzip (+0.9 kB).

## 2026-10-26 - Track dressing (WP27)

User request (2026-10-25): "Tracks, I would like them to be more sexy, anything we can do? I want more details on the side". Render only: `src/render/dressing.ts` plans everything from the track geometry with a fixed seed per track (`hashString(id)`), `dressingMesh.ts` builds it into the group `trackMesh` returns. No change to `src/content/**`, `src/sim/**`, colliders or props; every 3D piece stands beyond the wall mesh and clear of every prop (`dressing.test.ts`).

Per theme (`ThemeDef.dressing`): kerbs on every corner over 1/70 curvature with 6 m lead-in/out (hairpins: turn >= 150 deg under 25 m radius, 1.6 m wide, 12 m lead); barrier dressing on the outside of corners tighter than 40 m radius (tyre walls scrapyard/docks, jersey blocks city, guard rails desert/quarry, wooden snow fences snow); ground and shoulder decals from one 512x512 canvas atlas (blotches, gravel, scrub, oil, puddles, sand and snow drifts); road paint (repair patches, tar seams, cracks, oil/puddle/sand/snow stains, tyre marks along a racing line through each corner, grid boxes, chipped markings and polished wheel lanes in the asphalt texture); low clutter beyond the walls (scrap, rocks, crates, snow mounds); grandstands with crowd and flags near the grid where they fit, crowd clusters behind hairpin barriers, banners on the start straight, smoke or steam vents (burning barrels on scrapyard and snow), neon signs on city tracks. Lamp pools stay the props' own: every dark track already has a pole every ~40 m, so a gap-filling lamp pass placed none and was removed.

User OK per theme (screenshots at race height 50 m, a hairpin from 52 m, the start area and a 13 m close-up, before/after):

| theme | track shown | user |
|---|---|---|
| scrapyard | Scrapyard (v3) | "looks good" |
| desert | Dust Bowl (v2: road sand toned down, kept off the grid) | "Dust Bowl looks good, ok. Next theme." |
| docks | Dockside (v2) | "Dockside looks good, ok. Next theme." |
| snow | Frostbite Pass (v1) | "Frostbite looks good, ok. Next theme." |
| city | Neon Mile (v2: neon every 30-50 m, lighter puddles) | "Neon Mile looks good, ok. Next theme." |
| quarry | Redrock Quarry (v2: lighter repair patches) | "Redrock looks good, ok. Finish up." |

Junkyard Sprint, Pine Hollow, Rain District and Blast Pit checked once each with their theme, no change needed.

Cost at high quality, 1920x1080 DPR 2, 4 cars, seed 1, sampled at ticks 300-2300 every 400 (draw calls over every pass incl. shadows; triangles likewise):

| track | draws mean before -> after | draws max before -> after | triangles mean before -> after |
|---|---|---|---|
| scrapyard | 68 -> 81 | 92 -> 110 | 51k -> 162k |
| dustBowl | 68 -> 77 | 89 -> 102 | 73k -> 108k |
| dockside | 79 -> 91 | 96 -> 109 | 75k -> 172k |
| frostbite | 74 -> 86 | 90 -> 103 | 143k -> 182k |
| neonMile | 72 -> 83 | 93 -> 106 | 58k -> 80k |
| redrock | 84 -> 91 | 93 -> 98 | 59k -> 88k |
| junkyardSprint | 87 -> 100 | 96 -> 113 | 57k -> 128k |
| pineHollow | 73 -> 83 | 89 -> 100 | 167k -> 184k |
| rainDistrict | 80 -> 91 | 92 -> 104 | 51k -> 80k |
| blastPit | 70 -> 78 | 86 -> 93 | 65k -> 101k |

Worst mean increase +13 draws (budget +30), worst peak 113 (gate 150). Triangles grow mostly from tyre walls (1000+ two-high tyre columns on Scrapyard), heaps and crowd, each drawn twice (shadow pass). Low quality hides ground scatter, clutter, stands, crowd, banners, flags, vents and neon (`userData.highOnly`, `applyQuality`); kept: kerbs, road paint, barriers. Low, tick 700: Scrapyard 42 -> 44 draws, Neon Mile 45 -> 47.

fps: the browser pane throttles rAF to 1 fps, so live fps was not measurable. Stand-in: 120 debug steps each followed by a 1-pixel readPixels (GPU sync), median frame cost Scrapyard 5.8 -> 6.7 ms, Dockside 5.9 -> 7.2 ms (sim step + render at 3840x2160). New texture: one 512x512 RGBA canvas atlas (~1.3 MB with mipmaps). Bundle: 1831.9 -> 1839.2 kB gzip (+7.3 kB).

Balance probe (`node scripts/balance/run.mjs`) identical before and after.

## 2026-10-26 - Recorded engines for blaze, iceberg, titan (WP28)

User: the WP25 synth engines "sound synthetic"; asked for real recordings. Only blaze, iceberg and titan have CC0 sources (Freesound HQ previews, `docs/sfx-sources.md`); the other 5 cars keep their synth profile. `node scripts/sfx/importEngines.mjs` cuts one loop per source into `public/sfx/engines/<car>/<slot>.mp3` and writes `manifest.json` (per step: rpm, load, loopStart/loopEnd measured on the decoded file). Adding a car later = its files, its `sources.csv` rows and one row in the script's `CARS`; the game reads only the manifest.

Import table (rpm_est from the firing frequency, 4-stroke f = rpm / 60 * cylinders / 2, searched within +-40% of the page value or of a hint where the page states none; `by`: autocorrelation, or the strongest spectral line when the source has no clear period; seam = the wrap step of the decoded loop / its median step, limit 3; all loops at -19.6 LUFS decoded):

| car | slot | load | src s | loop s | firing Hz (by, r) | rpm est | page / hint | src rms dBFS | src centroid Hz | peak dBFS | seam | kB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| blaze | 500_on | on | 1.85 | 1.580 | 21.5 (acf 0.97) | 646 | 500 page | -15.3 | 2758 | -8.3 | 1.26 | 27.4 |
| blaze | 2500_on | on | 4.75 | 2.911 | 85.5 (acf 0.87) | 2565 | 2500 page | -14.8 | 3943 | -8.4 | 0.31 | 48.2 |
| blaze | 6500_on | on | 1.63 | 1.450 | 208.3 (acf 0.79) | 6250 | 6500 page | -18.4 | 4836 | -8.3 | 0.13 | 25.3 |
| blaze | 500_off | off | 8.25 | 2.939 | 17.7 (acf 0.89) | 530 | 500 page | -50.7 | 3680 | -6.1 | 0.07 | 48.6 |
| blaze | 2500_off | off | 4.00 | 2.964 | 82.3 (acf 0.67) | 2470 | 2500 page | -49.2 | 4759 | -7.0 | 0.55 | 49.0 |
| blaze | 6500_off | off | 1.92 | 1.697 | 209.8 (fft 0.25) | 6295 | 6500 page | -34.8 | 5157 | -9.6 | 0.65 | 29.0 |
| iceberg | idle | any | 3.12 | 2.831 | 27.9 (acf 0.97) | 836 | 800 hint | -19.0 | 2177 | -6.2 | 0.65 | 47.0 |
| iceberg | low | any | 2.11 | 1.868 | 49.3 (acf 0.97) | 1478 | 1500 hint | -16.1 | 2970 | -7.1 | 0.64 | 31.9 |
| iceberg | mid | any | 2.80 | 2.627 | 67.8 (acf 0.88) | 2035 | 2200 hint | -18.0 | 3379 | -8.2 | 0.95 | 43.7 |
| iceberg | high | any | 2.04 | 1.858 | 84.9 (fft -0.02) | 2546 | 3000 hint | -15.6 | 3193 | -3.9 | 0.55 | 31.5 |
| titan | idle | any | 9.35 | 2.959 | 29.6 (acf 0.71) | 592 | 600 hint | -18.7 | 2626 | -7.6 | 1.05 | 49.0 |
| titan | low | any | 1.69 | 1.448 | 54.2 (acf 0.50) | 1085 | 1200 hint | -16.4 | 2872 | -8.4 | 0.56 | 25.3 |
| titan | mid | any | 3.84 | 2.912 | 93.6 (fft 0.45) | 1872 | 2000 page | -9.8 | 2309 | -7.5 | 0.64 | 48.2 |

`public/sfx/engines` 504.2 kB with the manifest (limit 1 MB). The manifest uses the estimates, so pitch stays continuous across the crossfades.

By measurement only, not verified by ear:
- blaze `500_on` runs at ~646 rpm, not 500 (its period is 46 ms; ~29% off the label). Every other blaze step is within 5% of its label.
- Load labels: the "on" takes are 16-35 dB louder than the "off" takes at each rpm, as full load should be. Brighter is not confirmed: the off takes have the higher centroid, but at -35 to -51 dBFS RMS they sit near the recording's noise floor, so hiss dominates their spectrum. Matching steps to one loudness lifts the off loops by 17-34 dB; the off-throttle sound may be hissy.
- titan: the 6-cylinder reading matches the page's ~2000 rpm for `mid` (1872); a 4-cylinder reading would give 2808. iceberg `high` and titan `mid` have no clear period (noisy), so their rpm comes from the strongest spectral line.

In the game (`src/audio/recordedEngine.ts`, math in `bench.ts`): rpm01 0..1 maps the set's idle step (lowest estimate) to its top step, linearly, with no fake gearbox; above 1 (turbo overspeed) the pitch keeps rising up to 1.5x the top step. Equal-power crossfade between the two steps around rpm per load, and by throttle between on and off (blaze only); the throttle is smoothed (0.15 s) because the game's throttle flips per frame. `RECORDED_LEVEL` 5 on every loop.

Offline check (`?harness=audio`, through the real bus, throttle on, 12 s held renders): rms vs raven's synth at rpm01 0.5 (-17.0 dBFS): blaze -0.6 dB, iceberg +1.1 dB, titan -1.1 dB. Peaks -4.5 to -7.5 dBFS. Seam metric (sharpest step within 2 ms of each predicted loop wrap / the render's 99.9th percentile step; a window of ordinary sound half a loop later as the control): 0.92-1.2 at the wraps against 0.75-1.23 for the controls, so no step at the loop points stands out.

Cost: at most 4 loops per recorded engine (2 for one-load sets) plus the whine oscillator. Harness fake race with blaze, iceberg, titan, raven: max 15 voices (cap 48). Game career race with the same four cars (21 s, player on throttle and firing): at most 25 live Web Audio sources (18 buffer, 7 oscillators), no console errors. The WP25 Mercedes bench (file picker) is removed: the per-car "recorded / synth" switch next to each sweep button replaces it. Bundle 1649.2 -> 1649.1 kB gzip.

Knobs for the listening session: `RECORDED_LEVEL` (all recorded cars), a per-step rpm in the manifest (pitch match between steps), `THROTTLE_TAU`, `MAX_PITCH_UP`.

## 2026-10-26 - Listening session: viper pitch

User, by ear in `?harness=audio`: viper "too high-pitched", then "still too high" at x0.7, "ok now" at x0.5. Filter, noise and level untouched.

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/audio/engineProfiles.ts` | viper base / span / step | 110 / 330 / 25 | 55 / 165 / 12 | x0.5: "too high-pitched"; top note 540 -> 296 Hz, now under blaze (370 Hz), so the WP25 "highest top end" target is dropped |

Offline check after: viper rms -19.3 dBFS (-2.3 dB vs raven, unchanged); fundamental / centroid 116.5 Hz / 2234 Hz at rpm01 0.2 (was 234.0 / 2558), 152.5 Hz / 2362 Hz at 0.8 (was 309.0 / 2687); every pair still differs by > 5% in fundamental or centroid.

## 2026-10-26 - Car unlocks by beating, all career tracks (WP29, CCR-10)

User decisions (2026-10-26): every car but the starter is listed in the shop; outlaw, iceberg, blaze and wraith are locked until the player finishes ahead of one in a career race, then sold at list price; scorch, titan and viper stay buyable from the start and get `BEATEN_DISCOUNT` 0.25 once beaten; all 10 tracks from the first career race.

| File | Value | Before | After | Why |
|---|---|---|---|---|
| `src/content/cars.ts` | outlaw / iceberg / blaze / wraith price | 0 / 0 / 0 / 0 | 3500 / 4500 / 10500 / 20000 | list prices for the newly sold cars (user decision) |
| `src/content/economy.ts` | `BEATEN_DISCOUNT` | - | 0.25 | new: forSale car price once beaten |
| `src/content/economy.ts` | `TRACKS_AT_START` | 3 | 10 | all tracks from the start (user decision) |

`careerSim` buys through the same `carOffer` price rule as the shop: the next car is the cheapest buyable (not locked) car of a higher tier, at its discounted price when beaten. Nothing was tuned for balance.

### Before / after (greedy `simulateCareer`, seeds 1-16, same probe and seeds; "before" = main 3872127)

| | median | min | max | in 22-38 | in 18-35 (run.mjs row) |
|---|---|---|---|---|---|
| Before | 27 | 22 | 38 | 16/16 | 15/16 |
| After | 25 | 21 | 38 | 15/16 (seed 3: 21) | 15/16 |

Races per seed after: 21 22 22 24 25 25 25 25 25 30 30 31 31 32 33 38 (before: 22 22 24 24 25 25 25 26 28 30 30 31 31 32 33 38). Every seed still buys scorch then viper (no blaze, titan or wraith purchase). Purchases that changed: scorch bought 25% off on seeds 4, 9, 10, 12, 13 (seed 4 at race 4, was 6; seeds 9, 10, 12 at race 5, was 6; seed 13 same race); viper bought 25% off on seeds 3 (race 12, was 13), 10 (race 10, was 16) and 11 (race 13, was 16). `node scripts/balance/run.mjs`: 8/8 inside target after.

## 2026-10-26 - Scrapyard redrawn as the first Death Rally tight track (WP31)

User: "currently in tracks there are a lot of straight lines, in death rally there are more small turns", then chose "Death Rally tight" corners for all 10 tracks, camera unchanged. WP31 added the shape metric and rules (content.md section 12, "Track shape") and redrew Scrapyard; WP32 does the other 9.

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/content/tracks/scrapyard.ts` | centerline | 17-point spline loop, 1049 m | `roundedLoop` of 21 corners, 892 m | tight rules: near-straight 41% -> 23.9%, corners 10 -> 20, longest straight 192 -> 69 m (the start), 80 -> 170 deg per 100 m, min radius 14.7 m |
| `src/content/tracks/scrapyard.ts` | `shoulder` | 2 | 4 | wall hits per race in the WP31 probe: 6.7-6.8 with 2 m, 4.7 with 3 m, 1.6-3.2 with 4 m (the old track: 3.72) |
| `src/content/tracks/scrapyard.ts` | `referenceLapTime` | 27.5 | 26 | soak median clean lap of the 0.55 AI 26.09 s (12 laps) |
| `src/content/tracks/scrapyard.ts` | pickups | same 12 spread over 1049 m, all inside the AI line band | 12 (cash 4, mines 3, turbo 3, repair 2) every ~74 m; 7 at lateral +-5.5, outside the AI's 5.4 m line band (the AI never steers for those), 5 on or near the line | "on the racing line and off it"; with fewer AI refills the mine hits stay under 3 per race overall |
| `src/content/tracks/scrapyard.ts` | prop rules | s ranges for 1049 m | same rules, s ranges re-fitted to 892 m | content.md section 12 table |

Not changed: AI code and scale constants, car handling, weapons, every other track.

### Before / after (`node scripts/balance/run.mjs`, scrapyard row, 16 seeds x 4 starts; start 0 = the soak)

| Metric | Before | After | Target |
|---|---|---|---|
| Wrecks per race | 0.23 | 0.47 | 0.2-2.0 |
| Wall impacts per race | 3.72 | 1.56 | report only, flag above 4.5 |
| Mine hits per race | 2.27 | 2.50 | 0.8-3 (all tracks) |
| Gun damage share | 0.43 | 0.37 | 0.45-0.65 (all tracks) |
| Spread 0.75 vs 0.35 | 1.66 | 2.39 | >= 0.8 |
| 0.55 median clean lap, start 0 | 27.69 s (30 laps) | 26.09 s (12 laps) | ref +-1 s |
| Timeouts | 0 | 0 | 0 |
| All-track rows | 8/8 | 8/8 (wrecks 0.23-0.88, gun 0.53, mines 2.86, spread 0.95, lap 0.23 s) | - |

Soak gate (scrapyard.test.ts, `runSoak` seeds 1-16): wrecks 1.25 per race, wall impacts 1.25, no timeout, nobody stuck. 8-car quick races (7 AI + autoplay, seeds 1-12, headless): 3.92 wrecks per race (old layout 3.42), no timeout, finished cars cruise 99+ m in their first 5 s.

### Notes for WP32 and the next balance pass

- The soak on a tight track is chaotic: moving one corner by 1-2 m or changing one radius by 1-2 m swung mine hits between 2.5 and 4.9, wrecks between 0.14 and 1.0, and once produced a timeout (an AI glued to a wreck lying in the shoulder against the outer wall, see the WP31 report). Probe every candidate with run.mjs and the track's test file; expect to try a few.
- On the wiggle-heavy drafts mine hits ran 3.6-4.8 per race (nearly every drop hits: followers sit nose to tail on one line). Scrapyard lands at 2.50, but with 10 tight tracks the all-track mine row (target <= 3) is at risk: the first knob is `MINE_USE_SCALE` (ai.ts).
- Gun damage share drops on tight tracks (0.37 here, 0.21-0.37 on the drafts): the 10 deg gun cone rarely lines up in bends. The all-track row (0.53, floor 0.45) will fall as WP32 lands; `AGGRESSION_SCALE` or the cone are the knobs.

## 2026-10-27 - The other 9 tracks redrawn Death Rally tight (WP32a/b/c), AI wreck at the wall (WP33)

User: "Scrapyard feels right. Merge WP31 and redraw the other 9 tracks the same way." Three workers redrew three tracks each to the content.md section 12 rules; per-track numbers are in content.md "Tight layouts (WP32)".

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| 9 track files | centerline | spline / corner polygons, 1130-1608 m (Junkyard 834) | `roundedLoop` tight layouts, 857-946 m, Junkyard 836, Blast Pit 1046 | tight rules: near-straight 19.7-24.4%, 16-23 corners, longest straight 53-75 m (all the start), 137-181 deg per 100 m |
| 9 track files | `referenceLapTime` | 23-41.5 s | 24-28.5 s | soak median clean lap of the 0.55 AI |
| dustBowl | `shoulder` | 3 | 4 | the WP31 finding: 2-3 m doubles the wall hits |
| frostbite, blastPit | `shoulder` | 4 | 5 | wall impacts per race 5.03 -> 2.38 (Frostbite draft), 4.14 -> 2.66 (Blast Pit) |
| 9 track files | pickups | 10-17 per track | 11-13, mixed on and off the AI line | WP31 pattern |
| `src/render/themes/docks.ts` | `water.point` | (170, 322) | (160, 256) | the new quay |
| `REDROCK_CRANE_S`, `BLAST_PIT_CRANE_S` | s | 745, 1118 | 416, 833 | the new hairpin apexes |
| `src/sim/ai.ts` (WP33) | `WRECK_WALL_NEAR` 5 m, `WRECK_ESCAPE_ANGLE` 20 deg, `WRECK_REVERSE_MIN` 0.5 s, `WRECK_REGLUE_TIME` 5 s, `WRECK_REVERSE_STEP` 2 s, `WRECK_TRIES_MAX` 2 | - | new | glued to a wreck on its own side near the wall, the AI reverses nose to the open side, then passes on that side; repeated glue reverses longer (at most twice). New test: past the wreck in 5.1 s (old code 7.2-7.6 s) |

### Balance after the merge (`node scripts/balance/run.mjs`, main, all 10 tracks tight)

7/8: wrecks 0.27-0.66 (avg 0.42), mine hits 2.83 (<= 3), spread worst 0.84 (pineHollow), lap delta worst 0.25 s (pineHollow), career rows pass, 0 timeouts. **Gun damage share 0.36, target 0.45-0.65: FAIL** (per track 0.27-0.41, Neon Mile lowest: the 10 deg gun cone rarely lines up in bends). Retune in WP34.

### Notes

- The soak on tight tracks is chaotic: each layout was picked from 4-16 probed variants; a 1-2 m edit swings wall hits by 1-3 and wrecks by up to 0.5.
- Bends of r 28-34 are taken flat at about 31 m/s, at the lateral grip limit, and become wall hotspots; r 22 or r 40+ ran clean (WP32a).
- With every mine pickup off the line, mine hits still run 2.7-4.0 per race from the 3-mine loadout alone; layout moves it most.
- WP33 CCR, not fixed: an AI stuck nose-in, square to the wall in the shoulder, can loop its 1 s reverse forever (6 timeouts in 3840 races on jittered Scrapyards); a car glued to a wreck mid-track in a hairpin; a car pinned with no motion at a hairpin wall. 0 timeouts on the shipped layouts.

## 2026-10-27 - AI gun retune for the tight tracks (WP34)

User: "Merge WP33, WP32a, WP32b, WP32c into main, then spec and dispatch a gun retune WP before the release." After WP32 the all-track gun damage share was 0.36 (target 0.45-0.65, 0.53 before the redraw): the AI only rolls to open fire while a target sits inside `GUN_CONE` and stops when it leaves, and in constant bends a car 15-20 m ahead sits about 17-23 deg off the nose (chord angle d / 2r at r 25, geometry estimate, not measured). AI side only; the player's gun, `GUN_AIM_CONE` 7 deg and weapons content are unchanged.

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/sim/ai.ts` | `GUN_CONE` | 10 deg | 30 deg | gun share 0.36 -> 0.50 alone (10 tracks x 16 seeds x 4 starts); 45 deg gains nothing more (0.51). Hits still need the 7 deg aim assist, so the wider cone mostly opens fire earlier in a bend |
| `src/sim/ai.ts` | `MINE_USE_SCALE` | 0.6 | 0.55 | with the 30 deg cone alone the spread margin is thin (pineHollow 0.88, 0.84 at 32 seeds); 0.55 gives 0.92 (0.88 at 32 seeds), mine hits 2.64 -> 2.49 and the gun share +0.01 |

Not changed: `AGGRESSION_SCALE` 0.25, racing line, handling, the glued-wreck logic (WP33).

### Probe trail (`run.mjs --skip-career`, 16 seeds x 4 starts unless noted)

| Candidate (cone, aggression, mine use) | Gun share | Mine hits | Wrecks (per track) | Spread worst | Result |
|---|---|---|---|---|---|
| 10, 0.25, 0.6 (main) | 0.36 | 2.83 | 0.27-0.66 | 0.84 | 7/8 |
| 12, 0.25, 0.6 | 0.38 | 2.88 | 0.30-0.84 | 0.64 | fail gun, spread |
| 14, 0.25, 0.6 | 0.41 | 2.87 | 0.25-0.91 | 0.39 | fail gun, spread |
| 20, 0.25, 0.6 | 0.45 | 2.83 | 0.22-0.97 | 0.83 | pass at the edge |
| 30, 0.25, 0.6 | 0.50 | 2.64 | 0.36-1.19 | 0.88 | pass |
| 30, 0.25, 0.6 (32 seeds) | 0.49 | 2.69 | 0.35-1.09 | 0.84 | pass, thin spread |
| 45, 0.25, 0.6 | 0.51 | 2.65 | 0.36-1.14 | 0.64 | fail spread |
| 10, 0.35, 0.6 | 0.42 | 2.70 | 0.25-0.97 | 0.72 | fail gun, spread |
| 10, 0.25, 0.4 | 0.41 | 2.19 | 0.17-0.58 | 1.13 | fail gun, wrecks (junkyardSprint, frostbite) |
| bend cone: 10 + \|k\| x 20 m / 2 at the car's s | 0.42 | 2.82 | 0.25-0.84 | 0.66 | fail gun, spread |
| bend cone: 10 + \|k\| x 30 m / 2 | 0.43 | 2.90 | 0.31-0.92 | 0.36 | fail gun, spread |
| 25, 0.25, 0.5 | 0.50 | 2.41 | 0.19-0.95 | 0.78 | fail wrecks, spread |
| 30, 0.2, 0.5 | 0.46 | 2.61 | 0.27-0.89 | 1.00 | pass, gun at the edge |
| 30, 0.25, 0.5 | 0.52 | 2.38 | 0.36-1.13 | 0.92 | pass |
| 30, 0.25, 0.5 (32 seeds) | 0.51 | 2.41 | 0.31-1.04 | 0.88 | pass |
| **30, 0.25, 0.55** | 0.51 | 2.49 | 0.42-1.11 | 0.92 | pass (chosen) |
| 30, 0.25, 0.55 (32 seeds) | 0.50 | 2.54 | 0.36-1.04 | 0.88 | pass |

The career rows are the careerSim model (no physics), so these knobs do not move them: identical before and after.

### Before / after (`node scripts/balance/run.mjs`, all 10 tracks x 16 seeds x 4 starts)

| Track | Wrecks / race | Mine hits / race | Gun share | Spread 0.75 vs 0.35 | 0.55 median clean lap, start 0 (s) |
|---|---|---|---|---|---|
| scrapyard | 0.47 -> 0.48 | 2.50 -> 1.95 | 0.37 -> 0.55 | 2.39 -> 2.17 | 26.09 -> 26.07 |
| dustBowl | 0.36 -> 0.63 | 2.95 -> 2.55 | 0.41 -> 0.54 | 1.42 -> 1.20 | 24.95 -> 24.95 |
| dockside | 0.41 -> 0.72 | 2.69 -> 2.70 | 0.30 -> 0.44 | 2.22 -> 1.52 | 26.37 -> 26.36 |
| frostbite | 0.27 -> 0.72 | 2.81 -> 2.86 | 0.30 -> 0.44 | 1.88 -> 0.94 | 25.09 -> 25.22 |
| neonMile | 0.45 -> 0.78 | 2.88 -> 2.83 | 0.27 -> 0.41 | 2.27 -> 2.02 | 25.95 -> 25.97 |
| redrock | 0.41 -> 0.59 | 3.17 -> 2.73 | 0.37 -> 0.50 | 1.86 -> 1.77 | 24.87 -> 24.84 |
| junkyardSprint | 0.30 -> 0.42 | 2.98 -> 2.45 | 0.37 -> 0.58 | 2.05 -> 2.30 | 23.90 -> 23.88 |
| pineHollow | 0.66 -> 1.11 | 2.69 -> 2.09 | 0.41 -> 0.54 | 0.84 -> 0.92 | 25.25 -> 25.25 |
| rainDistrict | 0.44 -> 0.55 | 2.80 -> 2.36 | 0.37 -> 0.59 | 1.47 -> 1.44 | 25.50 -> 25.53 |
| blastPit | 0.48 -> 0.83 | 2.88 -> 2.39 | 0.38 -> 0.53 | 1.73 -> 1.59 | 28.42 -> 28.42 |

| Metric | Before | After | Target |
|---|---|---|---|
| Wrecks per AI race | 0.27-0.66 (avg 0.42) | 0.42-1.11 (avg 0.68) | 0.2-2.0 |
| Gun damage share | 0.36 | 0.51 | 0.45-0.65 |
| Mine hits per race | 2.83 | 2.49 | 0.8-3 |
| Spread, worst track | 0.84 (pineHollow) | 0.92 (pineHollow) | >= 0.8 |
| Lap time, worst track (start 0) | 0.25 s (pineHollow) | 0.25 s (pineHollow) | +-1 s |
| Career greedy, seeds 1-16 | 15/16 (21-33, one 38) | 15/16 (same) | >= 14/16 |
| Career safe | never | never | 25-50 or never |
| Greedy cash by race 5, worst seed | 10250 | 10250 | >= 1000 |
| Timeouts | 0 | 0 | 0 |

### Notes

- The spread row is the binding one and noisy: at 16 seeds pineHollow swung 0.36-1.00 between neighbouring candidates (more gunfire hits the leader, usually the 0.75). Check it at `--seeds 32` before trusting a pass.
- Per track the gun share is 0.41-0.59; Neon Mile (0.41), Dockside and Frostbite (0.44) stay lowest. Frostbite's spread fell 1.88 -> 0.94.
- Wrecks rose 0.42 -> 0.68 per race (pineHollow 1.11), closer to the 0.4-1.5 the WP12 notes preferred.
- Widening the cone from the line curvature at the car's own s did worse than a flat cone: on the short legs between bends the curvature there is 0 while the target is already in the next bend.
- Neon Mile had one race with a wreck shove over 10 s (12.2 s longest; 0 on main), report only.
- WP34 also moved the 10 m window hairpin measure copied into six track tests into `windowHairpins` in `trackTestKit.ts` (test code only, same numbers on all 10 tracks).

## 2026-10-27 - AI pace: the top AI matches a good human (WP37)

User: "I would love the ai to be a little bit more challenging, with the same car, they feel kind of slow", then "Top AI matches you" (mid AI about 3% slower, weakest about 7%). Their best lap: 23-24 s on Scrapyard, quick race, RAVEN. Target P = 0.90 x the pre-WP37 0.55 AI median clean lap per track (Scrapyard 23.46 s).

### Root cause

- `cornerSpeedFactor` 0.78-1.0 was only part of it. The racing line plans corners at `LAT_ACCEL_PER_GRIP` 64 x grip (50 m/s^2 for a raven, measured on constant circles), and that is well under what the car holds on the tight-track line: a solo 1.1 AI at factor 1.15 still hit no wall (max lateral 6.1 of 7 m). At factor 1.0 the 1.1 AI lapped Scrapyard in 23.72 s, within 0.1% of the physics-limited ideal of its own speed profile (23.70 s, accel taper included), so factor 1.0 could never reach P x 0.97 (22.76 s). The fix is factors above 1, capped at top speed: the car's grip, power and top speed are unchanged.
- Smaller: the proportional throttle (err / 4) held every AI about 1 m/s under top speed on straights (0.08 s a lap at Scrapyard).
- The soak's 16 seeds ran nearly the same race: the rng only drives weapons and turbo, so seeds 1 and 3 matched to the tick for 26 s on Redrock. One start-line incident decided a track's spread and wreck numbers, and every candidate reshuffled them (Pine Hollow spread swung -0.16 to 1.39 between neighbours).

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/content/ai.ts` | cornerSpeedFactor at 0 / 0.5 / 0.75 / 1.0 / 1.1 | 0.78 / 0.88 / (0.925) / 0.97 / 1.0 | 0.88 / 1.02 / 1.12 / 1.12 / 1.14 | pace table below; a new 0.75 anchor (all other fields on the old 0.5-1.0 line) keeps the curve flat above 0.75 |
| `src/content/ai.ts` | lineNoise, reactionTicks at skill 0 | 1.6, 14 | 1.2, 11 | skill 0 lapped at 1.24-1.46 x P in the grid (few clean laps: wall hits from the 14-tick delay) |
| `src/sim/ai.ts` | speed target | `vLine * factor` | `min(vLine * factor, vMax)` | factors above 1 never go past top speed |
| `src/sim/ai.ts` | throttle at a top-speed target | err / 4 | 1 | flat out on straights |
| `src/sim/ai.ts` | rubber band | every target | corner targets only | with the flat-out throttle the band slowed leaders more on straights; now it never acts there (weaker, never stronger) |
| `src/sim/ai.ts` | line noise phase | `car * 1.7` | `car * 1.7` + a per-race offset hashed from seed and car | each soak seed is a different race, so 16 seeds average real variation |
| `src/sim/ai.ts` | `AGGRESSION_SCALE` | 0.25 | 0.3 | faster laps cut the gunfire per race: rainDistrict wrecks 0.13 at 0.25, 0.31 at 0.3 |

Not changed: car stats, weapons content, `MINE_USE_SCALE`, `GUN_CONE`, the racing line (`racingLine.ts`), careerSim and the economy. `src/game/raceSession.test.ts` (WP19 instant results) moved its quick-race seed 43 -> 44: with seed 43 every AI now finishes within 90 ticks of the autoplay player, so the test had nothing to skip.

### Pace (lap / P, same stock raven)

Solo = one car, no traffic, no rubber band (4 seeds x 2 flying laps). Soak = the soak grid (autoplay 0.55, AI 0.35/0.55/0.75), median clean lap, 16 seeds, start 0. Targets: 0.1 about 1.10, 0.35 1.07 +-1%, 0.55 1.03 +-1%, 0.75 1.00 +-1%, 1.0 about 0.98, 1.1 about 0.97.

| Track (P s) | 0.1 solo | 0.35 solo / soak | 0.55 solo / soak | 0.75 solo / soak | 1.0 solo | 1.1 solo |
|---|---|---|---|---|---|---|
| scrapyard (23.46) | 1.335 -> 1.137 | 1.171 -> 1.074 / 1.162 -> 1.061 | 1.111 -> 1.034 / 1.111 -> 1.033 | 1.070 -> 0.991 / 1.104 -> 0.994 | 1.033 -> 0.977 | 1.015 -> 0.967 |
| neonMile (23.37) | 1.330 -> 1.124 | 1.174 -> 1.079 / 1.142 -> 1.074 | 1.106 -> 1.041 / 1.111 -> 1.041 | 1.066 -> 0.988 / 1.071 -> 0.993 | 1.029 -> 0.973 | 1.011 -> 0.964 |
| dustBowl (22.45) | 1.319 -> 1.138 | 1.157 -> 1.076 / 1.145 -> 1.096 | 1.113 -> 1.044 / 1.111 -> 1.043 | 1.080 -> 1.011 / 1.069 -> 1.014 | 1.050 -> 1.001 | 1.035 -> 0.993 |
| frostbite (22.70) | 1.328 -> 1.130 | 1.157 -> 1.072 / 1.146 -> 1.065 | 1.101 -> 1.038 / 1.111 -> 1.036 | 1.065 -> 0.998 / 1.069 -> 0.999 | 1.029 -> 0.982 | 1.012 -> 0.971 |
| dockside (23.72) | 1.342 -> 1.134 | 1.182 -> 1.068 / 1.164 -> 1.061 | 1.111 -> 1.025 / 1.111 -> 1.026 | 1.066 -> 0.975 / 1.072 -> 0.973 | 1.023 -> 0.959 | 1.001 -> 0.947 |
| redrock (22.36) | 1.330 -> 1.147 | 1.183 -> 1.077 / 1.170 -> 1.068 | 1.106 -> 1.031 / 1.111 -> 1.038 | 1.071 -> 1.001 / 1.097 -> 1.015 | 1.043 -> 0.994 | 1.028 -> 0.987 |
| junkyardSprint (21.49) | 1.332 -> 1.128 | 1.181 -> 1.068 / 1.154 -> 1.060 | 1.111 -> 1.032 / 1.111 -> 1.031 | 1.073 -> 0.998 / 1.091 -> 1.000 | 1.036 -> 0.986 | 1.018 -> 0.978 |
| pineHollow (22.73) | 1.249 -> 1.120 | 1.149 -> 1.079 / 1.142 -> 1.075 | 1.111 -> 1.055 / 1.111 -> 1.057 | 1.090 -> 1.033 / 1.095 -> 1.033 | 1.067 -> 1.029 | 1.056 -> 1.025 |
| rainDistrict (22.98) | 1.311 -> 1.134 | 1.161 -> 1.085 / 1.150 -> 1.081 | 1.108 -> 1.042 / 1.111 -> 1.037 | 1.072 -> 0.998 / 1.090 -> 0.993 | 1.039 -> 0.986 | 1.023 -> 0.978 |
| blastPit (25.58) | 1.307 -> 1.130 | 1.159 -> 1.078 / 1.151 -> 1.073 | 1.108 -> 1.047 / 1.111 -> 1.053 | 1.080 -> 1.015 / 1.070 -> 1.019 | 1.049 -> 1.002 | 1.033 -> 0.994 |

On the tight tracks the table is met within about 1%. Off target: Dust Bowl, Pine Hollow and Blast Pit (open bends: top speed caps every skill, the 0.75 stays 1-3.5% above P and the field is closer), Dockside (square steps: corner speed counts most, the 0.75 is 2.5% under P), skill 0.1 (1.12-1.15, kept slow so 0.35 stays at 1.07 on the same 0-0.5 segment). Soak medians are noisy where clean laps are few (n 4-34).

### Probe trail (solo lap / P on Scrapyard, Neon Mile, Dust Bowl, Frostbite; run.mjs result)

| Candidate | 0.35 | 0.55 | 0.75 | 1.1 | Result |
|---|---|---|---|---|---|
| main | 1.157-1.174 | 1.101-1.113 | 1.065-1.080 | 1.011-1.035 | 8/8, 1.1 cannot reach 0.97 |
| flat-out throttle only | | | | Scrapyard 23.80 -> 23.72 s | 0.08 s a lap |
| 1.1 solo at factor 1.04 / 1.07 / 1.10 / 1.15 | | | | Scrapyard 23.35 / 23.12 / 22.92 / 22.63 s, 0 walls | the line plans under the car's limit |
| 0.95/1.02/1.10/1.14 (grid) | 1.074-1.084 | 1.03-1.06 | 1.004-1.020 | 0.963-0.993 | 0.1 at 1.24-1.34 |
| 0.98/1.04/1.11/1.15, skill 0 noise 1.2, react 11 | 1.054-1.064 | 1.032-1.040 | 1.000-1.020 | 0.961-0.992 | 0.35 too fast |
| 0.90/1.03/1.12/1.15 | 1.064-1.075 | 1.034-1.042 | 1.000-1.020 | 0.961-0.992 | |
| 0.93/1.04/1.12/1.14 | 1.058-1.069 | 1.031-1.040 | 0.999-1.018 | 0.963-0.993 | 5/8: spread pineHollow -0.16, dustBowl 0.44; wrecks junkyardSprint 0.17 |
| same, rubber band on corners only | | | | | spread pineHollow -0.05, redrock 0.63; wrecks neonMile 0.13 |
| same, AI mines off (diagnostic) | | | | | spread >= 1.0 on the 4 worst tracks: the faster AI eats mines while it sits behind a slower car |
| same + mine dodge / held-up pass / aggression 0.95 at 1.0 / mineUse 0.2 at 0.5 / band off | | | | | each fixed some tracks and broke others (redrock 0.45-0.48, pineHollow 0.23-0.45) |
| same + per-race noise phase (+ dodge) | | | | | 16 seeds pass; 48 seeds pineHollow 0.74 (no dodge 0.45) |
| 0.88/1.00/1.16/1.17 + phase | 1.076-1.086 | 1.042-1.051 | 0.999-1.018 | 0.957-0.989 | pineHollow 0.84 (48 seeds); 0.55 above 1.04 |
| 5 anchors 0.88/1.02/1.12/1.12/1.14 + phase, no flat-out throttle | | | | | pineHollow 0.64 (16), 0.38 (48); junkyardSprint wrecks 0.09 |
| same with flat-out throttle and corner-only band | 1.072-1.079 | 1.034-1.044 | 0.988-1.011 | 0.964-0.993 | 7/8: rainDistrict wrecks 0.13 |
| **same, `AGGRESSION_SCALE` 0.3** | same | same | same | same | 8/8 at 16 and 48 seeds (spread worst 0.97 / 0.86, wrecks 0.31 / 0.31) |

The mine dodge and held-up pass were experiments only, not shipped.

### Before / after (`node scripts/balance/run.mjs`, 10 tracks x 16 seeds x 4 starts)

| Track | Wrecks | Wall impacts | Mine hits | Gun share | Spread | 0.55 median, start 0 (s) | referenceLapTime |
|---|---|---|---|---|---|---|---|
| scrapyard | 0.48 -> 0.53 | 1.34 -> 4.08 | 1.95 -> 2.34 | 0.55 -> 0.48 | 2.17 -> 1.98 | 26.07 -> 24.23 | 26 -> 24 |
| dustBowl | 0.63 -> 0.78 | 1.38 -> 3.17 | 2.55 -> 2.09 | 0.54 -> 0.55 | 1.20 -> 1.27 | 24.95 -> 23.42 | 25 -> 23.5 |
| dockside | 0.72 -> 0.58 | 1.89 -> 4.19 | 2.70 -> 1.89 | 0.44 -> 0.48 | 1.52 -> 1.89 | 26.36 -> 24.35 | 26.5 -> 24.5 |
| frostbite | 0.72 -> 0.48 | 2.47 -> 2.80 | 2.86 -> 2.19 | 0.44 -> 0.55 | 0.94 -> 1.44 | 25.22 -> 23.51 | 25 -> 23.5 |
| neonMile | 0.78 -> 0.55 | 2.23 -> 3.72 | 2.83 -> 2.30 | 0.41 -> 0.41 | 2.02 -> 1.67 | 25.97 -> 24.33 | 26 -> 24.5 |
| redrock | 0.59 -> 0.70 | 2.92 -> 3.64 | 2.73 -> 1.80 | 0.50 -> 0.59 | 1.77 -> 1.69 | 24.84 -> 23.20 | 25 -> 23 |
| junkyardSprint | 0.42 -> 0.31 | 2.52 -> 3.86 | 2.45 -> 1.92 | 0.58 -> 0.55 | 2.30 -> 1.66 | 23.88 -> 22.15 | 24 -> 22 |
| pineHollow | 1.11 -> 1.23 | 2.63 -> 2.16 | 2.09 -> 0.89 | 0.54 -> 0.67 | 0.92 -> 0.97 | 25.25 -> 24.02 | 25 -> 24 |
| rainDistrict | 0.55 -> 0.31 | 2.39 -> 3.50 | 2.36 -> 1.47 | 0.59 -> 0.55 | 1.44 -> 1.33 | 25.53 -> 23.83 | 25.5 -> 24 |
| blastPit | 0.83 -> 0.91 | 2.73 -> 3.44 | 2.39 -> 1.88 | 0.53 -> 0.56 | 1.59 -> 1.33 | 28.42 -> 26.93 | 28.5 -> 27 |

| Metric | Before | After | Target |
|---|---|---|---|
| Wrecks per AI race | 0.42-1.11 (avg 0.68) | 0.31-1.23 (avg 0.64) | 0.2-2.0 |
| Gun damage share | 0.51 | 0.54 | 0.45-0.65 |
| Mine hits per race | 2.49 | 1.88 | 0.8-3 |
| Spread, worst track | 0.92 (pineHollow) | 0.97 (pineHollow); 0.86 at 48 seeds | >= 0.8 |
| Lap time, worst track (start 0) | 0.25 s (pineHollow) | 0.23 s (scrapyard) | +-1 s |
| Career greedy, seeds 1-16 | 15/16 (21-33, one 38) | 15/16 (same) | >= 14/16 |
| Career safe | never | never | 25-50 or never |
| Greedy cash by race 5, worst seed | 10250 | 10250 | >= 1000 |
| Timeouts | 0 | 0 | 0 (also 0 with `--loadout rival`) |

The tight-track `referenceLapTime` rule moves from 24-32 s to 21-28 s (measured 22-27 s, 1 s margin each side).

### Notes

- Career rows are the careerSim model (no physics), identical before and after. The model already plays the player as skill 0.75 (`PLAYER_DRIVER_SKILL`), and after WP37 the 0.75 AI laps at a good human's pace, so the model's assumption now holds; the economy was not touched.
- Wall impacts rose on every track but Pine Hollow (1.3-2.9 -> 2.2-4.2 per race, Dockside 4.19 the highest, under the 4.5 flag; Scrapyard 4.37 at 48 seeds). Solo laps hit no wall at any skill: the hits are traffic.
- The wraith and viper (level 5) at skills 0.95 and 1.1 lap solo with no wall hits on 6 tracks.
- Pine Hollow stays the weakest spread track (0.86 at 48 seeds): in its open bends the 0.35 is only 4.5% slower than the 0.75 (6-9.5% on the other tracks).

## 2026-10-27 - Difficulty Easy / Normal / Hard (WP38, CCR-13)

User: "top3 and 7 as a new mode in the menu", difficulty choice "Everywhere, same rewards"; "It needs to be competitive without making it too hard and make grinds for hours". Round 2: "Send WP38 back: Hard should give a clearly faster leader (extra skill range above 1.1 only Hard reaches), Normal unchanged." Every AI entrant's skill changes before `profileForSkill`; rewards, rival stats and ladder points are unchanged. P below = the normal 0.75 AI lap (a good human's pace, WP37).

### Changed values

| Where | Value | Before | After | Why |
|---|---|---|---|---|
| `src/content/ai.ts` | `DIFFICULTY_SKILL_OFFSET` easy / normal | - | -0.2 / 0, clamp [0, 1.1] | WP38 brief; normal is the WP37 tuning exactly |
| `src/content/ai.ts` | `HARD_SKILL_CURVE` | (round 1: +0.15, clamp 1.1) | 0 -> 0.15, 0.55 -> 0.7, 0.75 -> 1.12, 1.1 -> 1.15 | round 1 bunched the field (the pace curve is flat above 0.75: the 0.75 slot at 0.9 gained 0.4%, spread 0.13 on Pine Hollow). A steeper stretch above 0.55 lifts the leader; trail below |
| `src/content/ai.ts` | anchor row 1.25 (hard only), `HARD_SKILL_MAX` | - | cornerSpeedFactor 1.26, lineNoise 0.1, reactionTicks 3, aggression / mineUse / turboUse / rubberBand as 1.1 | solo sweep below: no wall hit up to 1.40, gain stops at about 1.26 (top speed). Weapons unchanged so only pace moves |
| `src/meta/careerSim.ts` | `DRIVER_CURVE` point | - | [1.25, 0.88] | calibrate probe: 0.75 at +0.246, 1.1 at +0.227, 1.25 at +0.334 (256 races each, the 0.75 point matches WP12's +0.24); 0.79 + 0.088. Only hard reaches it |
| `src/game/settings.ts` | `Settings.difficulty` default | - | 'normal' | saved settings without it migrate to 'normal' |

### Solo sweep (one raven, no traffic, 4 seeds x 2 flying laps, 10 tracks; lap / P solo)

| Profile | Scrapyard | Neon Mile | Dust Bowl | Frostbite | Mean 10 tracks | Wall hits |
|---|---|---|---|---|---|---|
| skill 1.1 (normal boss) | 0.976 | 0.976 | 0.982 | 0.974 | 0.979 | 0 |
| factor 1.18, noise 0.1, react 3 | 0.962 | 0.962 | 0.974 | 0.962 | 0.969 | 0 |
| factor 1.26 (the 1.25 row) | 0.951 | 0.954 | 0.967 | 0.954 | 0.961 | 0 |
| factor 1.30 / 1.34 / 1.40 | 0.946 / 0.946 / 0.943 | 0.951 / 0.949 / 0.948 | 0.965 | 0.951 / 0.949 / 0.948 | 0.959 / 0.958 / 0.958 | 0 |

Top speed caps the gain from about 1.26; the open tracks cap sooner (1.25 row: Redrock 0.975, Pine Hollow 0.982, Dust Bowl 0.967, Blast Pit 0.962 vs 0.943-0.959 on the tight ones). The boss wraith (level 2) at 1.1 / 1.15 / 1.25 hit no wall either; against a 0.75 driver in the same wraith it laps 0.961 / 0.941 / 0.905 on the four tracks above (top speed rarely caps a wraith), so 1.25 would make THE WARDEN about 6% faster than on normal: hard gives the boss +0.05 only.

### Hard slots (`run.mjs --difficulty hard`, start 0 grid, median clean lap / P per track)

| Slot (drives at) | Scrapyard | Neon Mile | Dust Bowl | Frostbite | Mean 10 tracks | Solo, mean 10 tracks |
|---|---|---|---|---|---|---|
| 0.35 (0.5) | 1.035 | 1.040 | - (no clean lap) | 1.030 | 1.035 (9 tracks) | 1.046 |
| 0.55 (0.7) | 1.000 | 0.999 | 0.999 | 1.001 | 1.002 | 1.004 |
| 0.75 (1.12) | 0.970 | 0.967 | 0.987 | 0.970 | 0.976 | 0.976 |
| THE WARDEN, raven solo (1.15) | 0.967 | 0.967 | 0.977 | 0.967 | | 0.973 |

Trail for the 0.75 point: 1.15 gave 0.965 / 0.962 / 0.974 / 0.966 on the four tracks (3.3%), 1.12 gives 2.7%. Pine Hollow (0.993) and Dust Bowl (0.987) are the open tracks where top speed caps the leader.

### All difficulties (`run.mjs`, 10 tracks x 16 seeds x 4 starts)

`node scripts/balance/run.mjs` (normal): 8/8, the table identical to main line for line, the raw probe JSON (12 files) identical apart from the new `cleanLaps` field. Easy is unchanged from round 1.

| Metric | Easy | Normal | Hard (round 2) | Target (normal) |
|---|---|---|---|---|
| Wrecks per AI race | 0.36-1.02 (avg 0.50) | 0.31-1.23 (avg 0.64) | 0.39-1.38 (avg 0.82) | 0.2-2.0 |
| Wall impacts per race (avg of tracks) | 3.66 | 3.46 | 3.27 | - |
| Gun damage share | 0.52 | 0.54 | 0.59 | 0.45-0.65 |
| Mine hits per race | 1.86 | 1.88 | 1.64 | 0.8-3 |
| Spread 0.75 vs 0.35, worst track | 0.58 (pineHollow) | 0.97 (pineHollow) | 0.23 (pineHollow); the other 9 tracks 1.13-1.97 (round 1: 0.13, 0.64, 0.77 ...) | >= 0.8 |
| Career greedy champion in 18-35 | 15/16, races 17-33, median 24 | 15/16, 21-38, median 25 | 15/16, 22-37, median 29 | >= 14/16 |
| Career safe | never | never | never | 25-50 or never |
| Greedy cash by race 5 | 10300 | 10250 | 9600 | >= 1000 |

Easy, mean lap / `referenceLapTime` per slot: 0.35 1.053, 0.55 1.035, 0.75 1.002 (normal 1.031 / 1.000 / 0.965): every slot 2-4% slower.

### Notes

- Pine Hollow stays the weak spread track on hard (0.23): its open bends let top speed cap every skill.
- Career on easy: the first rivals (skill 0.1-0.2) all clamp to 0, so they drive alike; their stats still differ.
- Career on hard: rivals 0.75-0.96 drive at 1.12-1.14, close to the boss's 1.15.
- careerSim (`CareerSimOptions.difficulty`) shifts the rivals' driver strength only, like the game. `DRIVER_CURVE` itself predates WP37 and was not recalibrated (1.1 measured +0.227 today against the curve's 0.86 - 0.55 = +0.31).

## 2026-10-27 - Reversed tracks (WP39, CCR-14)

User: reversed layouts in "Quick race, trial and career" (genre research: track repetition is a common single-player complaint). Every track gets a reversed layout `<id>~r` built at load (content.md section 12, "Reversed layouts"); the forward tracks are untouched (their run.mjs rows are identical to WP38 line for line).

### Changed values

| Where | Value | Why |
|---|---|---|
| `src/content/tracks/reverse.ts` | `GRID_DEPTH` 40 m | the reversed line sits 40 m before the forward start straight's end, so the 8-car grid (back slot 36 m behind the line) stands on the straight |
| `src/content/tracks/reverse.ts` | `REVERSED_START_S` scrapyard -10, frostbite -22 (rule -7, -18) | Scrapyard: finish spread 0.797 at -7 (run.mjs, target >= 0.8); probes at -10 / -13 / -16 / -20 gave 1.33 / 1.09 / 0.98 / 1.59, -10 is the smallest move. Frostbite: soak median 23.75 s at -18, on the 0.5 s rounding edge; -20 / -22 / -25 (snapped to the point at -26.7) gave 23.79 / 23.80 / 23.80 s, walls 5.81 / 3.38 / 4.63 |
| `src/content/tracks/reverse.ts` | `REVERSED_REFERENCE_LAP_TIMES` | the 16-seed soak median of each reversed layout (table below) |
| `src/meta/career.ts` | `offerReversed`: `(racesRun + TIER_TRACK_INDEX[tier]) % 3 === 2` | one offer per round reversed, never all three |

### Reversed layouts (`node scripts/balance/run.mjs`, 20 tracks x 16 seeds x 4 starts)

| Track | Wrecks | Wall impacts | Mine hits | Gun share | Spread | 0.55 median, start 0 (s) | referenceLapTime |
|---|---|---|---|---|---|---|---|
| scrapyard~r | 0.72 | 4.55 | 2.55 | 0.50 | 1.33 | 24.43 | 24.5 |
| dustBowl~r | 0.75 | 3.58 | 2.39 | 0.55 | 1.36 | 23.52 | 23.5 |
| dockside~r | 0.64 | 4.89 | 2.52 | 0.47 | 1.11 | 24.32 | 24.5 |
| frostbite~r | 0.66 | 3.58 | 2.47 | 0.52 | 1.44 | 23.80 | 24 |
| neonMile~r | 0.95 | 4.53 | 3.09 | 0.44 | 1.42 | 24.38 | 24.5 |
| redrock~r | 0.69 | 4.28 | 1.81 | 0.54 | 1.30 | 23.35 | 23.5 |
| junkyardSprint~r | 0.36 | 3.25 | 1.95 | 0.56 | 1.14 | 22.08 | 22 |
| pineHollow~r | 1.03 | 2.11 | 1.09 | 0.66 | 0.86 | 24.02 | 24 |
| rainDistrict~r | 0.94 | 4.00 | 2.58 | 0.49 | 1.08 | 24.00 | 24 |
| blastPit~r | 0.55 | 3.36 | 1.81 | 0.53 | 1.23 | 27.07 | 27 |

| Metric (all 20 tracks) | WP38 (10 tracks) | WP39 (20 tracks) | Target |
|---|---|---|---|
| Wrecks per AI race | 0.31-1.23 (avg 0.64) | 0.31-1.23 (avg 0.68) | 0.2-2.0 |
| Gun damage share | 0.54 | 0.53 | 0.45-0.65 |
| Mine hits per race | 1.88 | 2.05 | 0.8-3 |
| Spread, worst track | 0.97 (pineHollow) | 0.86 (pineHollow~r) | >= 0.8 |
| Lap time, worst track (start 0) | 0.23 s (scrapyard) | 0.23 s (scrapyard) | +-1 s |
| Career rows | 8/8 | same (careerSim does not race the layouts) | |
| Timeouts | 0 | 0 | 0 |

`run.mjs` now lists the reversed rows after the 10 base tracks by default (`--tracks a~r` picks one); 8/8 inside target, 63 s.

### Notes

- Wall impacts run higher reversed (2.11-4.89 per race, avg 3.81, vs 2.16-4.19, avg 3.46, forward; Dockside~r 4.89 above the 4.5 flag, Scrapyard~r 4.55 and Neon Mile~r 4.53 just above): report-only, not tuned here.
- Neon Mile~r has 8 m of straight after the line (the forward line sits at T1's turn-in, so the reversed grid fills the straight behind it); its wrecks 0.95 and mine hits 3.09 are the highest reversed numbers but inside target.
- Dressing: stands are now checked as the straight box they are (a stand next to a bend clipped the wall on Dust Bowl~r), and every barrier segment at its middle too (a tyre stack overlapped a prop on Junkyard Sprint~r). Forward tracks: Pine Hollow loses one of its two stands, Blast Pit gains one; the other 8 dressings are identical.
