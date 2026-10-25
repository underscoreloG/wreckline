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
