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
