# Content and tuning tables

All numbers here are **starting values**. WP00 encodes them in `src/content/*.ts` exactly as written. WP12 is the only WP that changes them after that, and it records every change in `docs/tuning-log.md`.

## 1. Cars (`src/content/cars.ts`)

Roster from the concept sheet `specs/art/cars-concept-v1.webp` (decided 2026-10-24). Shop listing (user decision 2026-10-26, CCR-10): every car except the starter `raven` has a shop row. `forSale: true` cars (scorch, titan, viper) are buyable from the start; the other cars (outlaw, iceberg, blaze, wraith, the boss car included) are locked until the player has beaten that car type in a career race (section 3), then buyable at list price.

| id | name | forSale | price | tier | maxSpeed | accel | brake | turnRate | grip | mass | maxHp | gunDps |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `raven` | Raven (starter) | false | 0 | 1 | 39.1 | 15.6 | 24 | 2.7 | 0.78 | 1100 | 100 | 22 |
| `outlaw` | Outlaw | false | 3500 | 1 | 38 | 18 | 24 | 3.1 | 0.80 | 850 | 80 | 20 |
| `iceberg` | Iceberg | false | 4500 | 1 | 36.8 | 14.4 | 22 | 2.4 | 0.76 | 1500 | 135 | 22 |
| `scorch` | Scorch | true | 6000 | 2 | 42.6 | 18 | 25 | 2.5 | 0.80 | 1400 | 140 | 26 |
| `blaze` | Blaze | false | 10500 | 2 | 46 | 19.2 | 27 | 2.8 | 0.84 | 1150 | 110 | 26 |
| `titan` | Titan | true | 9000 | 2 | 40.3 | 15.6 | 26 | 2.2 | 0.80 | 1900 | 190 | 32 |
| `viper` | Viper | true | 12000 | 3 | 49.5 | 20.4 | 28 | 2.9 | 0.88 | 1200 | 120 | 30 |
| `wraith` | Wraith (boss car) | false | 20000 | 3 | 51.8 | 21.6 | 30 | 2.9 | 0.90 | 1700 | 220 | 34 |

`price` is the list price and the trade-in base for every car (user decision 2026-10-26: outlaw 3500, iceberg 4500, blaze 10500, wraith 20000 were 0; the starter stays 0 and is never listed). Tuning pass 1 (2026-10-25, user: "a little bit too slow"): every maxSpeed x1.15 and accel x1.20 from the first values (raven was 34 / 13).

Mesh specs (procedural placeholders until the art WPs; also the collider size). When WP14 imports the models, each car's `length` x `width` changes to the model's own proportions at the same area (user decision 2026-10-25: the hitbox follows the art), and the model is scaled uniformly to it:

Applied by WP14 (2026-10-26, Blender GLBs in `public/models/cars/<id>.glb`, `mesh.model` set for every car): iceberg 4.9 x 2.1 -> 4.85 x 2.1, titan 5.2 x 2.4 -> 5.1 x 2.45, wraith 5.2 x 2.4 -> 5.3 x 2.35; outlaw, scorch, blaze, viper unchanged; raven kept at 4.2 x 2.0 (the rule gives 4.15 by a 0.1 mm rounding edge, and 4.15 would move five WP12-tuned track tests; the model is identical either way). The table below shows the values in use. Height and the other columns now only shape the procedural fallback.

| id | style | length | width | height | cabinLength | cabinOffset | spoiler | wheelRadius |
|---|---|---|---|---|---|---|---|---|
| raven | muscle | 4.2 | 2.0 | 0.7 | 0.45 | -0.05 | true | 0.38 |
| outlaw | buggy | 3.8 | 2.0 | 0.6 | 0.50 | -0.05 | false | 0.48 |
| iceberg | wagon | 4.85 | 2.1 | 0.8 | 0.62 | -0.12 | false | 0.40 |
| scorch | muscle | 4.8 | 2.2 | 0.8 | 0.38 | -0.12 | true | 0.42 |
| blaze | wedge | 4.4 | 2.0 | 0.55 | 0.30 | -0.08 | true | 0.36 |
| titan | truck | 5.1 | 2.45 | 1.0 | 0.35 | 0.05 | false | 0.52 |
| viper | wedge | 4.5 | 2.0 | 0.55 | 0.30 | -0.10 | true | 0.36 |
| wraith | boss | 5.3 | 2.35 | 0.9 | 0.40 | -0.08 | true | 0.46 |

Every `mesh.model` is `null` (procedural) until WP14 sets `models/cars/<id>.glb`.

M1 uses `raven` for all 4 cars.

Every car's `base` also carries (same for all 8 cars, CCR-5): `turboSpeedMult` 1.30, `turboAccelMult` 1.60, `ramDealtMult` 1, `ramTakenMult` 1. Every `mesh.spikes` is 0 in the table; race setups set it from the spikes upgrade level.

**Naming (user decision 2026-10-25):** the boost is called **ROCKET FUEL** in every UI text (shop line and supplies, HUD label `FUEL`, controls screen, pickups). Code identifiers (`turbo`, `PickupKind 'turbo'`, `turboActive`) stay as they are.

## 2. Upgrades (`src/content/economy.ts`)

Levels 0..5 per line. Effect per level is multiplicative on the car's base stats:

| kind | effect per level | cap |
|---|---|---|
| engine | maxSpeed x1.05, accel x1.06 | - |
| tires | grip x1.04, turnRate x1.04 | grip <= 0.97 |
| armor | maxHp x1.15 (rounded) | - |
| gun | gunDps x1.12 | - |
| fuel (ROCKET FUEL) | turboSpeedMult +0.04, turboAccelMult +0.08 (additive: L5 = 1.50 / 2.00) | 5 levels |
| spikes (BUMPER SPIKES) | ramDealtMult +0.5, ramTakenMult -0.15 (additive: L3 = 2.5 / 0.55) | 3 levels |

Cost to buy level L (1..5): `[300, 700, 1500, 3000, 6000][L-1] * tierMult`, `tierMult = {1: 1, 2: 1.6, 3: 2.4}`, rounded to the nearest 10. Fuel uses the same table. Spikes (L 1..3): `[500, 1200, 2500][L-1] * tierMult`, rounded to the nearest 10. `MAX_LEVEL`: 5 for every line except spikes 3. Buying another car resets every line to 0, spikes and fuel included.

`computeStats(car: CarDef, up: UpgradeLevels): CarStats` lives in `src/content/economy.ts` (WP00). It applies the table above, then the caps.

## 3. Shop prices

| item | price | cap |
|---|---|---|
| repair | 4 cash per HP x tierMult of the current car, rounded up | to maxHp |
| partial repair | same price per HP; the garage offers +25% of maxHp and "all you can afford" next to FULL | to maxHp |
| free tow (user decision 2026-10-25) | when the car has 0 hp and the player cannot afford a repair to 30% of maxHp, it is repaired to `ceil(0.3 * maxHp)` for free, with the message "Towed: free repair to 30%". Checked after every race result, every shop action and on career load, so a career can never get stuck | - |
| mine | 60 each | 8 carried |
| rocket fuel (turbo) | 40 per second | 10 s carried |
| sabotage | `round(0.3 * offer.prizes[0])`: easy 270, medium 540, hard 1125, boss 3000 | once per race |
| car | `carOffer` in `src/meta/shop.ts` (user decision 2026-10-26, CCR-10): every car but the starter has a row. scorch, titan, viper: list price, or `round(list * (1 - BEATEN_DISCOUNT))` once beaten (`BEATEN_DISCOUNT` 0.25). outlaw, iceberg, blaze, wraith: locked ("Finish ahead of one in a race to unlock", not buyable) until beaten, then list price. The owned car's row is not buyable. Trade-in gives 50% of the current car's list price (the cheapest buy is 75% of list, so no buy/sell profit loop); upgrades are lost; new car starts at full hp | - |

**Beating a car type (user decision 2026-10-26, CCR-10):** after every career race (boss race included), every result row placed after the player's row marks that row's car type as beaten (`SaveGame.beatenCars`), but only when the player's row is finished or wrecked: a quit race (counted as a DNF) or any result where the player neither finished nor wrecked beats nothing. A win beats every car type in the race; finishing ahead of THE WARDEN beats `wraith`; a wrecked player still beats the rows behind it. Quick race never changes the save. The career hub shows one message per newly beaten car type: "Unlocked in shop: <NAME>" for a locked car, "<NAME> now 25% off in the shop" for scorch/titan/viper; nothing for `raven` or the player's own car type.

Starting career: cash 600, car `raven`, upgrades all 0, hp 100, mines 2, turbo 3 s.
M1 quick race: player and AI start with full hp, 3 mines, 4 s turbo. Quick race car (user decision 2026-10-26, CCR-10): the pre-race CAR picker lets the player race any of the 8 cars stock (upgrades 0), remembered in `Settings.quickCarId` (null or unknown = raven); unlocks and cash do not apply; the AI cars stay stock ravens; `?race=1` ignores the setting.

**Sabotage (user decision 2026-10-25):** bought on the pre-race screen for the selected offer. Target: the rival in that race with the most championship points (ties: higher skill; rival skills are all distinct, so no tie survives); in the boss race, THE WARDEN. `sabotageTarget(save, offer)` (WP20) gives the name to show before buying. The damage is a whole percentage drawn at purchase from the meta RNG, uniform in 25..49, stored with the price; the target starts that race at `round(maxHp * (1 - pct/100))` hp. The player sees "Sabotaged: <NAME> -<pct>%". Lifecycle: one pending sabotage at a time (buying for another offer is refused with "Sabotage already bought for another race"); the target is re-picked from the offer's rivals when the race setup is built (offers are rebuilt after a reload, so the stored offer id is matched, not the rival); if the player races a different offer, the price is refunded; it is cleared after the race it applies to. Rivals never sabotage the player. Quick race has no sabotage. Numbers live as named constants in `src/content/economy.ts` so WP12 can tune them: `SABOTAGE_PRICE_FRACTION` 0.3, `SABOTAGE_PCT_MIN` 25, `SABOTAGE_PCT_MAX` 49, `TRACKS_AT_START` 10 (was 3, user decision 2026-10-26), `RANKS_PER_UNLOCK` 2, `BEATEN_DISCOUNT` 0.25.

## 4. Vehicle modifiers (used by WP01)

| state | maxSpeed | accel | grip | extra |
|---|---|---|---|---|
| turbo active | x eff.turboSpeedMult (base 1.30) | x eff.turboAccelMult (base 1.60) | - | drains 1 turbo-second per second |
| offroad (|lateral| > width/2) | x0.70 | x0.80 | x0.60 | extra drag 4 m/s^2 opposing velocity |
| handbrake | - | 0 (no drive) | x0.35 | turnRate x1.4 |
| wrecked | - | 0 | - | linear damping 2.5, angular damping 3, inputs ignored |

## 5. Weapons and damage (used by WP02)

Machine gun:
| param | value |
|---|---|
| fire rate | 12 shots/s while `fire` held and not overheated |
| damage per shot | eff.gunDps / 12 |
| range | 45 m |
| aim assist | auto-aims at the nearest enemy (not wrecked) within a 7 deg half-angle cone of the heading, within range, with line of sight; otherwise fires along the heading |
| spread | uniform +-1.2 deg from `world.rng` |
| heat | +0.055 per shot; cools 0.45/s when not firing; at 1.0 it overheats and stays locked until heat < 0.35 |
| muzzle | 0.5 m ahead of the front bumper |

Mines:
| param | value |
|---|---|
| drop | on `dropMine` rising edge, if mines > 0 and mineCooldown == 0; cooldown 0.5 s |
| position | 1.0 m behind the rear bumper |
| arm time | 0.6 s (the owner can't trigger it before it arms) |
| trigger | any car center within 2.0 m + half car width of an armed mine |
| damage | 50 at the center, linear falloff to 25 at 4.0 m blast radius; 0 beyond |
| impulse | each hit car: velocity change of 8 m/s away from the mine, angVel += +-3 rad/s (sign from rng) |
| lifetime | 45 s, max 24 on track (oldest removed silently) |

Collisions (impact speed = |velocity after the physics step - velocity before it| for that car):
| case | damage to self |
|---|---|
| car vs car | max(0, impact - 6) * 1.6 * sqrt(otherMass / selfMass); `by` = other car. Front hits (CCR-5): car A's hit is a front hit when `dot(fwd(A.heading), norm(B.pos - A.pos)) >= cos(40 deg)`. Then the damage B takes is multiplied by `A.eff.ramDealtMult`, and the damage A takes by `A.eff.ramTakenMult`. Both cars can have a front hit in a head-on crash; each multiplier applies to its own side. |
| car vs wall/prop | max(0, impact - 9) * 1.0; `by` = null |
| same pair repeat | ignored for 0.25 s after a damaging hit (scraping) |
| `impact` event | emitted when impact >= 4 m/s |

Wrecks:
| param | value |
|---|---|
| trigger | hp <= 0 |
| credit | `lastDamagedBy` if it was set within the last 5 s, else null |
| explosion | 20 damage to other cars within 5 m (no chain credit), impulse 6 m/s outward |
| body | stays on track as an obstacle (see vehicle modifiers) |

## 6. Pickups (used by WP02)

| kind | effect | cap |
|---|---|---|
| cash | `cashPicked += 1` (meta pays per unit: easy 100, medium 200, hard 400, boss 0; quick race shows units x100) | - |
| repair | +30 hp | maxHp |
| mines | +2 | 8 |
| turbo | +2 s | 10 s |

Pickup radius 2.2 m + half car width. Respawn after 8 s (tuning pass 1; was 12 s). A full car (at cap) does not collect, the pickup stays.

## 7. Race rules (used by WP01)

| rule | value |
|---|---|
| countdown | 3 s, events at 3, 2, 1, then `raceStart` |
| checkpoints | every ~`checkpointSpacing` m (40 for all tracks); passed by segment intersection of prevPos->pos with the gate, in order only |
| lap | completed when crossing checkpoint 0 after all others in order |
| wrong way | progress decreasing for > 1.2 s while speed > 3 m/s |
| live position | finished cars by finishTime (a car that finished keeps that rank even if it is wrecked afterwards), then by `progress` desc, wrecked last (later wreck ranks higher) |
| race end | all non-wrecked cars finished, OR 15 s after the player finished, OR 2 s after the player wrecked. Unfinished cars are ranked by progress, `finished: false` |
| finished cars | (user decision 2026-10-25) a car that finished, and every car once the race phase is `finished`, keeps driving along the racing line at a calm cruise (`cruiseInput`, WP07) instead of coasting; it is immune: takes no damage, cannot be wrecked, does not fire, drop mines, trigger mines or collect pickups. Collisions with it stay physical. |

## 8. AI profiles (`src/content/ai.ts`)

`profileForSkill(skill)` linearly interpolates between these anchors (clamp skill to [0, 1.1]):

| skill | cornerSpeedFactor | lineNoise | reactionTicks | aggression | mineUse | turboUse | rubberBand |
|---|---|---|---|---|---|---|---|
| 0.0 | 0.78 | 1.6 | 14 | 0.15 | 0.15 | 0.30 | 0.06 |
| 0.5 | 0.88 | 0.9 | 9 | 0.40 | 0.40 | 0.60 | 0.04 |
| 1.0 | 0.97 | 0.3 | 5 | 0.75 | 0.70 | 0.90 | 0.00 |
| 1.1 | 1.00 | 0.2 | 4 | 0.90 | 0.85 | 1.00 | 0.00 |

reactionTicks rounds to an integer. The boss runs plain `wraith` stats (WP12: the +6% maxSpeed bonus was removed, `BOSS_MAX_SPEED_MULT` 1, user decision "Beatable boss").

Rubber banding is mild and only in easy and medium races (user decision 2026-10-23: hard and boss never cheat). In `hard` and `boss` career races every AI profile gets `rubberBand: 0` after `profileForSkill` (WP09 applies it when building the RaceSetup). M1 quick race uses the table as is.

M1 quick race AI skills: 0.35, 0.55, 0.75. Names VEX, RAZOR, MOTH.

## 9. Liveries (M1 and rival colors)

| slot | color | use |
|---|---|---|
| player | `#FF5A1F` | hot orange (matches the UI accent) |
| ai 1 | `#2EA8FF` | blue |
| ai 2 | `#B65CFF` | violet |
| ai 3 | `#F5D547` | yellow |

Livery use: with procedural placeholder cars (M1) the whole body takes the livery color. With imported models the body keeps the model's own paint and the livery color drives the driver marker (rim glow by default, user decision 2026-10-26; rule and constants in design.md section 1, "Car art"); the roof plate is gone (WP30). Same rule for rival colors in section 10. THE WARDEN races with its trim `#FF3355` as its color (marker, minimap), since its `#1A1A1A` body color would not show.

## 10. Rivals (M2, `src/content/rivals.ts`)

19 rivals. Initial points = round(skill * 40). The player starts at 0 points (rank 20).

| driverId | name | color | car | skill |
|---|---|---|---|---|
| r01 | ROOK | #8C9AA8 | outlaw | 0.10 |
| r02 | BRISKET | #C9824A | iceberg | 0.15 |
| r03 | SPROCKET | #6FCF5B | raven | 0.20 |
| r04 | MAGPIE | #E8E8E8 | outlaw | 0.25 |
| r05 | RUSTY | #B5532E | iceberg | 0.30 |
| r06 | VEX | #2EA8FF | raven | 0.35 |
| r07 | GRIT | #A3A35C | outlaw | 0.40 |
| r08 | KILN | #E0703A | scorch | 0.45 |
| r09 | MOTH | #F5D547 | blaze | 0.50 |
| r10 | RAZOR | #B65CFF | titan | 0.55 |
| r11 | OXIDE | #3FB6A8 | scorch | 0.60 |
| r12 | JINX | #FF4FA3 | blaze | 0.65 |
| r13 | CINDER | #FF7A45 | titan | 0.70 |
| r14 | TALON | #5C7CFF | viper | 0.75 |
| r15 | VOLT | #C6FF3D | viper | 0.80 |
| r16 | DUCHESS | #D9B26F | blaze | 0.85 |
| r17 | HALO | #F2F2FF | viper | 0.90 |
| r18 | NOVA | #45E0FF | titan | 0.93 |
| r19 | BANSHEE | #FF3355 | viper | 0.96 |
| boss | THE WARDEN | #1A1A1A with #FF3355 trim | wraith | 1.10 |

Rivals' upgrade levels: `floor(skill * 2)` on every line (fuel included), capped at 5, except spikes `floor(skill * 3)`, capped at 3. The boss (skill 1.1): every line 2, spikes 3. (WP12, user decision "Beatable boss": was `floor(skill * 5)`, boss fuel 5.)

## 11. Career economy (M2, used by WP09)

| tier | laps | rivals drawn from | prizes (1st..4th) | points (1st..4th) | cash pickup value | wreck bonus |
|---|---|---|---|---|---|---|
| easy | 3 | 3 rivals with the lowest skill among ranks below the player (or the bottom 6 if fewer) | 900, 530, 230, 0 | 3, 2, 1, 0 | 100 | 250 |
| medium | 4 | 3 rivals within +-5 ranks of the player | 1800, 1050, 450, 0 | 6, 4, 2, 1 | 200 | 375 |
| hard | 5 | 3 rivals from the top 6 ranks | 3750, 2100, 900, 150 | 10, 6, 3, 1 | 400 | 625 |
| boss | 5 | the boss + 2 rivals from the top 3 | 10000, 0, 0, 0 | 0 | 0 | 0 |

- The boss offer replaces the hard offer while the player is rank 1. Winning it sets `championWon`.
- Track per offer: `unlocked[(racesRun * OFFER_TRACK_STEP + tierIndex) % unlocked.length]` (easy 0, medium 1, hard/boss 2, `OFFER_TRACK_STEP` 3), so the three offers always differ and each round shows three tracks not offered the round before (user 2026-10-27; it moved by 1 before, so two of three repeated). `unlocked` = the first `min(10, TRACKS_AT_START + floor((20 - bestRank) / 2))` tracks of `TRACKS` in registry order. All 10 tracks from the first race (user decision 2026-10-26: `TRACKS_AT_START` 10, was 3 with one more every 2 ranks climbed), so the unlock code never adds a track and the career hub's "New track: <name>" message no longer fires. `bestRank` still updates after every race.
- Off-screen rivals: after each player race, every rival not in that race gains points from a simulated result: `pts = tierPointsTable[pickTier(skill)][simPosition]`, where `simPosition` is drawn so that higher skill finishes higher on average (WP09 spec has the exact formula).

## 12. Tracks

### Track shape (user decision 2026-10-26)

User: "currently in tracks there are a lot of straight lines, in death rally there are more small turns". Every track is redrawn as a **Death Rally tight track**: a chain of 15-40 m bends left and right with short links, a hairpin or two, one short start straight; camera unchanged. WP31 set the rules and redrew Scrapyard; WP32a/b/c redrew the other 9 (merged 2026-10-27). Length budget (so Blast Pit stays the longest): Junkyard Sprint 750-850 m, Blast Pit 1010-1060 m, every other track 850-990 m.

**Metric** (`trackShape(geometry)` in `src/shared/trackGeometry.ts`), on the uniform ~1 m samples: heading = atan2 of the sample tangent, k(s) = |wrapped heading(s + 10 m) - heading(s)| / 10 m (a forward window: each straight's run starts and ends a few m early).

| field | meaning |
|---|---|
| `nearStraightShare` | share of samples with k < 0.01 /m |
| `corners` | entries into k > 0.025 /m, counted around the closed loop |
| `longestStraight`, `straights` | runs of k < 0.01 (s of the first sample, length in m), wrapping over the start line |
| `turnPer100m` | total \|heading change\| in degrees per 100 m |
| `minRadius` | 1 / max k measured over a 4 m window |

**Rules** for a tight track (checked by `src/content/tracks/shape.test.ts` for every TRACKS entry exported with `shape: 'tight'`):

| rule | value |
|---|---|
| `nearStraightShare` | <= 0.25 |
| every straight | <= 80 m; the one through the start line (it covers s 0) <= 100 m for the 8-car grid |
| `corners` | >= 10 |
| `turnPer100m` | >= 110 |
| `minRadius` | >= 12 m (cars 3.8-5.3 m long, roads 13-16 m wide) |
| `validateTrack` | passes (min radius >= width, walls never overlap, props outside walls) |
| `referenceLapTime` | 24-32 s, the 0.55 AI median clean lap of the 16-seed soak, rounded to 0.5 s |

Plus everything in "Track list" below (a hairpin, pickup mix, WP07 soak gates) except the straight >= 150 m and the length range: a tight track is about 850-1000 m. Measured on the pre-WP31 layouts (WP31 brief): near-straight 41-90%, corners 2-16, longest straight 192-1148 m, 36-81 deg per 100 m; no old track passes.

How WP31 built Scrapyard, for WP32: a `roundedLoop` corner polygon with radius 22 (a few 24, 28 on the wiggles; under 22 the spline overshoot after a short link breaks `validateTrack`'s min radius >= width), links of 4-14 m, the hairpin as two back-to-back 90s whose vertices sit exactly 2 r apart (a gap leaves a flat in the middle and the 1/25 hairpin measure splits it). Pickups at lateral +-5.5 are outside the AI's line band (width / 2 - 1.6), so only a human goes for them. The soak numbers (wrecks, mine hits, timeouts) jump with any small edit: probe each candidate with `node scripts/balance/run.mjs --tracks <id> --skip-career` and the track's own test file before settling.

### Scrapyard (M1 layout redrawn in WP31, `src/content/tracks/scrapyard.ts`)

Tight track. 892 m, 22 checkpoints, min radius 14.7 m (shape metric) / 14.6 m (validateTrack), min clearance 43.3 m, near-straight 23.9%, 20 corners, longest straight 69 m (the start straight), 170 deg per 100 m, one hairpin (L 173 deg at s 402-472).

```ts
id: 'scrapyard', name: 'Scrapyard', theme: 'scrapyard', shape: 'tight',
width: 14, shoulder: 4, checkpointSpacing: 40, referenceLapTime: 26, // WP31 measured 26.09 s (old layout 27.5)
centerline: roundedLoop(SCRAPYARD_CORNERS, { x: 11, y: 0 }), // 21 corners, see the track file
pickups: [ // 12: cash 4, mines 3, turbo 3, repair 2; lateral 5.5 = off the AI line
  { kind: 'mines', s: 35, lateral: -5.5 }, { kind: 'cash', s: 110, lateral: -2 },
  { kind: 'turbo', s: 180, lateral: 3.5 }, { kind: 'mines', s: 255, lateral: -5.5 },
  { kind: 'repair', s: 330, lateral: -5.5 }, { kind: 'cash', s: 400, lateral: 5.5 },
  { kind: 'mines', s: 475, lateral: -5.5 }, { kind: 'repair', s: 550, lateral: 5 },
  { kind: 'cash', s: 620, lateral: 2 }, { kind: 'cash', s: 695, lateral: 5.5 },
  { kind: 'turbo', s: 770, lateral: -2 }, { kind: 'turbo', s: 835, lateral: -5.5 },
],
```

Props are generated by `placeProps(base, rules)` (`src/content/tracks/placeProps.ts`, WP00) from these rules. `offset` = gap in meters between the wall and the prop's edge on that side, so the prop centre sits at lateral `+-(width/2 + shoulder + offset + propRadius(kind) * scale)` (propRadius table in WP00 section 3); `every` = spacing along s; jitter (+-1.5 m along s, +-0.5 m laterally) comes from a fixed seed (`hash(trackId)`), so the output is constant. Rules are applied in table order and a placement whose circle (propRadius * scale) overlaps any earlier prop is skipped, so validateTrack's overlap check always passes.

| sFrom | sTo | every | side | offset | kind | scale |
|---|---|---|---|---|---|---|
| 0 | length | 60 | both (alternating) | 2.5 | lightPole | 1 |
| 20 | 120 | 12 | left | 1.5 | tireStack | 1 |
| 135 | 220 | 18 | right | 3 | container | 1 |
| 250 | 350 | 10 | left | 2 | crate | 0.8-1.2 |
| 380 | 470 | 25 | right | 4 | wreck | 1 |
| 500 | 590 | 8 | both | 1.5 | barrel | 1 |
| 605 | 755 | 22 | left | 3.5 | container | 1 |
| 755 | 880 | 14 | right | 2 | tireStack | 1 |

Plus 6 `wreck` and 10 `crate` props scattered on the infield: accepted only if they are >= 6 m from both walls and >= 4 m from each other and from every rule prop (rejection sampling, max 200 tries, seed `hash(trackId) + 1`).

The pre-WP31 layout (1049 m, referenceLapTime 27.5) lives on as `SCRAPYARD_FIXTURE` in `src/content/tracks/fixtures.ts` for the sim and AI tests.

### Track list and unlock order (10 tracks, user decision 2026-10-25)

| # | id | name | theme | signature | built by |
|---|---|---|---|---|---|
| 1 | scrapyard | Scrapyard | scrapyard | tight (WP31): a step down, wiggles, a hairpin at the end of a tongue into the infield, an elbow and a jog | WP00, WP31 |
| 2 | dustBowl | Dust Bowl | desert | tight (WP32a), the most open: wider bends r 22-45, a sweeper chain, a hairpin at the tip of a tongue | WP11, WP32a |
| 3 | dockside | Dockside | docks | tight (WP32a): square 90-degree steps round container stacks, a chicane, a 61 m quay along the sea, a hairpin | WP11, WP32a |
| 4 | frostbite | Frostbite Pass | snow | tight (WP32a): narrow wiggles between snowbanks and pines, three switchback hairpins | WP22, WP32a |
| 5 | neonMile | Neon Mile | city | tight (WP32b): right-angle staircases round city blocks, billboards; its hairpin is a U-turn round the last block | WP22, WP32b |
| 6 | redrock | Redrock Quarry | quarry | tight (WP32b): flowing quarry bends; the pinch hairpin under the crane at the end of a spur | WP22, WP32b |
| 7 | junkyardSprint | Junkyard Sprint | scrapyard | tight (WP32c): the shortest (750-850 m), a hairpin at each end, made for ramming | WP23a, WP32c |
| 8 | pineHollow | Pine Hollow | snow | tight (WP32c): forest sweeper chains with one blind kink; hairpin at the far end of the forest | WP23a, WP32c |
| 9 | rainDistrict | Rain District | city | tight (WP32b): chicane chain through narrow streets; the boulevard is the start straight, hairpin turnaround at its end | WP23b, WP32b |
| 10 | blastPit | Blast Pit | quarry | tight (WP32c): the longest (1010-1060 m), one big loop with an S-tongue into the cut; hairpin under the crane | WP23b, WP32c |

Themes are visual only: no surface or grip rules (user decision). Every track follows the constraints below (each has at least one hairpin: a turn of at least 150 deg with radius under 25 m, placed as listed), the pickup density of tuning pass 1 (about one per 90 m: 10-14 pickups, up to 18 above 1400 m), and the AI health gates of WP07 (all 16 soak races finish or end by rule, no car stuck more than twice, wrecks 0.2-2.0 per race). Wall impacts per race are report-only (Scrapyard 2.9, Dust Bowl 2.8, Dockside 3.6); flag anything above 4.5.

### Tight layouts (WP32, merged 2026-10-27)

All built with `roundedLoop` like Scrapyard; corner lists, pickups and prop rules live in each track file's header and body. Shape metric values (content.md "Track shape" rules), probe = `node scripts/balance/run.mjs` on main after the merge (64 races per track).

| track | length m | width / shoulder | near-straight | corners | longest straight (start) m | deg/100 m | min radius m | hairpins | ref lap s | pickups | wrecks | walls | mines | gun share |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dustBowl | 898 | 15 / 4 | 22.5% | 18 | 68 | 149 | 15.7 | 1 | 25 | 12 | 0.36 | 1.64 | 2.95 | 0.41 |
| dockside | 881 | 13 / 4 | 23.5% | 18 | 69 | 181 | 14.6 | 1 | 26.5 | 12 | 0.41 | 2.09 | 2.69 | 0.30 |
| frostbite | 857 | 13 / 5 | 22.6% | 18 | 75 | 173 | 15.0 | 3 | 25 | 12 | 0.27 | 2.45 | 2.81 | 0.30 |
| neonMile | 906 | 14 / 4 | 20.8% | 17 | 53 | 173 | 15.6 | 1 | 26 | 12 | 0.45 | 1.92 | 2.88 | 0.27 |
| redrock | 922 | 16 / 4 | 23.5% | 18 | 58 | 137 | 19.1 | 1 | 25 | 12 | 0.41 | 2.73 | 3.17 | 0.37 |
| junkyardSprint | 836 | 14 / 4 | 22.6% | 16 | 56 | 161 | 14.6 | 2 | 24 | 11 | 0.30 | 2.97 | 2.98 | 0.37 |
| pineHollow | 944 | 14 / 4 | 24.4% | 20 | 55 | 138 | 19.6 | 1 | 25 | 12 | 0.66 | 2.78 | 2.69 | 0.41 |
| rainDistrict | 899 | 14 / 4 | 19.7% | 21 | 61 | 172 | 16.3 | 1 | 25.5 | 12 | 0.44 | 2.52 | 2.80 | 0.37 |
| blastPit | 1046 | 16 / 5 | 20.7% | 23 | 54 | 149 | 16.4 | 1 | 28.5 | 13 | 0.48 | 2.66 | 2.88 | 0.38 |

Landmarks kept: Dockside's sea (theme `water` point (160, 256), normal (0, 1); 79 m of outer wall within 3 m of it) and more light poles than Scrapyard; Neon Mile more light poles than Scrapyard, Rain District more than Neon Mile; `REDROCK_CRANE_S` 416 and `BLAST_PIT_CRANE_S` 833 at their hairpin apexes. Pickups: every kind at least twice, cash the most common, a mix on and off the AI line (off-line = opposite side of the racing line, about lateral `width / 2 - 1.5`).

The pre-WP32 constraints (WP11/WP22/WP23: length 1100-1500 m, a straight >= 150 m) no longer apply; a pre-WP31 Rain District lives on as `RAIN_DISTRICT_FIXTURE` for the AI tests.
